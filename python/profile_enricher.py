import os
import sys
import json
import time
import signal
import logging
import re
from os.path import join, dirname
from dotenv import load_dotenv
from apify_client import ApifyClient
from openai import OpenAI
from supabase import create_client, Client

# =============================================================================
# CONFIGURATION
# =============================================================================

# Retry settings
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2           # seconds — doubles each attempt (2, 4, 8 …)
RETRY_MAX_DELAY = 60           # ceiling for backoff

# Apify
APIFY_TIMEOUT_SECS = 180       # max wait for profile scraper to finish

# OpenAI
OPENAI_DELAY_BETWEEN_CALLS = 1.0  # simple rate-limit guard

# Skip profiles that already have name + website_url (+ address for venues)
SKIP_ALREADY_ENRICHED = True

# =============================================================================
# SETUP
# =============================================================================

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

dotenv_path = join(dirname(__file__), "../.env")
load_dotenv(dotenv_path)

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_missing = [k for k, v in {
    "APIFY_TOKEN": APIFY_TOKEN,
    "OPENAI_API_KEY": OPENAI_API_KEY,
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_KEY": SUPABASE_KEY,
}.items() if not v]
if _missing:
    logger.error(f"Missing environment variables: {', '.join(_missing)}. Check your .env file.")
    sys.exit(1)

try:
    apify_client = ApifyClient(APIFY_TOKEN)
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as exc:
    logger.error(f"Failed to initialise API clients: {exc}")
    sys.exit(1)

APIFY_PROFILE_SCRAPER_ID = "apify/instagram-profile-scraper"

# -- Graceful shutdown --------------------------------------------------------

_shutdown_requested = False


def _handle_signal(signum, _frame):
    global _shutdown_requested
    name = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
    logger.warning(f"Received {name} — will finish current profile then exit.")
    _shutdown_requested = True


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)

# =============================================================================
# STATS
# =============================================================================

class Stats:
    def __init__(self):
        self.profiles_found = 0
        self.profiles_skipped_enriched = 0
        self.profiles_scraped = 0
        self.profiles_parsed = 0
        self.parse_failures = 0
        self.venues_updated = 0
        self.organizers_updated = 0
        self.update_failures = 0
        self.retries = 0

    def summary(self):
        return (
            f"\n{'=' * 55}\n"
            f"  ENRICHER RUN SUMMARY\n"
            f"{'=' * 55}\n"
            f"  Profiles found              {self.profiles_found}\n"
            f"  Profiles skipped (enriched) {self.profiles_skipped_enriched}\n"
            f"  Profiles scraped by Apify   {self.profiles_scraped}\n"
            f"  Profiles parsed by AI       {self.profiles_parsed}\n"
            f"  AI parse failures           {self.parse_failures}\n"
            f"  Venues updated              {self.venues_updated}\n"
            f"  Organizers updated          {self.organizers_updated}\n"
            f"  Update failures             {self.update_failures}\n"
            f"  Total retries               {self.retries}\n"
            f"{'=' * 55}"
        )


stats = Stats()

# =============================================================================
# UTILITIES
# =============================================================================

_NON_RETRYABLE = (json.JSONDecodeError, ValueError, TypeError, KeyError, AttributeError)


def with_retry(operation, description, max_retries=MAX_RETRIES):
    """Call *operation()* with exponential backoff.  Data-format errors raise immediately."""
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            return operation()
        except _NON_RETRYABLE:
            raise
        except Exception as exc:
            last_exc = exc
            if attempt < max_retries:
                delay = min(RETRY_BASE_DELAY * (2 ** attempt), RETRY_MAX_DELAY)
                logger.warning(
                    f"[Retry] {description} — attempt {attempt + 1}/{max_retries + 1} "
                    f"failed ({type(exc).__name__}: {exc}). Retrying in {delay}s …"
                )
                stats.retries += 1
                time.sleep(delay)
            else:
                logger.error(f"[Retry] {description} — all {max_retries + 1} attempts failed.")
    raise last_exc  # type: ignore[misc]


def extract_json(text):
    """Best-effort JSON extraction from a string that may contain markdown fences or prose."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for pattern in (r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"):
        m = re.search(pattern, text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    return None


def fetch_all_rows(table, columns):
    """Fetch every row from *table*, handling Supabase's default 1000-row page limit."""
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        start, end = offset, offset + page_size - 1
        res = with_retry(
            lambda s=start, e=end: supabase.table(table).select(columns).range(s, e).execute(),
            f"fetch {table} (offset {offset})",
        )
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return all_rows


def is_profile_enriched(row, is_venue=False):
    """Return True if the row already has meaningful enriched data."""
    handle = (row.get("instagram_username") or "").lower()
    name = (row.get("name") or "").strip()

    # Name is just the handle or empty → not enriched
    if not name or name.lower() == handle:
        return False
    # No website → not enriched
    if not row.get("website_url"):
        return False
    # Venues also need an address
    if is_venue and not row.get("address"):
        return False

    return True


def validate_enrichment(parsed, is_venue):
    """Sanitise the OpenAI result for profile enrichment."""
    if not isinstance(parsed, dict):
        return None

    name = parsed.get("name")
    if name and isinstance(name, str):
        name = name.strip()
        # Reject if it's clearly garbage (too short, all symbols, etc.)
        if len(name) < 2 or not any(c.isalpha() for c in name):
            name = None
    else:
        name = None

    website = parsed.get("website_url")
    if website and isinstance(website, str):
        website = website.strip()
        # Basic URL sanity
        if not website.startswith(("http://", "https://")):
            if "." in website:
                website = "https://" + website
            else:
                website = None
    else:
        website = None

    result = {"name": name, "website_url": website}

    if is_venue:
        address = parsed.get("address")
        if address and isinstance(address, str):
            address = address.strip()
            if len(address) < 3:
                address = None
        else:
            address = None
        result["address"] = address

    return result


# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def analyze_profile_with_openai(profile_data, is_venue):
    """Use OpenAI to clean up scraped Instagram profile data."""
    prompt = f"""
Sei un assistente che estrae dati di contatto da un profilo Instagram.
Dati restituiti dallo scraper: {json.dumps(profile_data, ensure_ascii=False)}

1. 'name': Riscrivi il 'fullName' usando le normali maiuscole, rimuovendo emoji o frasi strane. Se il fullName è vuoto, prova a ricavare il nome dalla biography.
2. 'website_url': Estrai il link dal campo 'externalUrl' o dalla 'biography'. Deve essere un URL completo (https://...).
"""
    if is_venue:
        prompt += "3. 'address': Se è un locale, ricava l'indirizzo esatto (via, numero civico, città) dal campo 'businessAddressJSON' o leggendolo in 'biography'. Solo la location fisica, non il nome del locale.\n"

    prompt += "\nRitorna SOLO un oggetto JSON con queste chiavi esatte: name, website_url"
    if is_venue:
        prompt += ", address"
    prompt += "\nSe un dato non è disponibile, usa null."

    time.sleep(OPENAI_DELAY_BETWEEN_CALLS)

    def _call():
        return openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

    try:
        response = with_retry(_call, f"OpenAI profile analysis")
    except Exception as exc:
        logger.error(f"  OpenAI call failed: {exc}")
        stats.parse_failures += 1
        return None

    raw = (response.choices[0].message.content or "").strip()
    parsed = extract_json(raw)
    if parsed is None:
        logger.error(f"  Could not extract JSON from OpenAI response: {raw[:200]}")
        stats.parse_failures += 1
        return None

    validated = validate_enrichment(parsed, is_venue)
    if validated is None:
        logger.error(f"  Validation failed for OpenAI response.")
        stats.parse_failures += 1
        return None

    stats.profiles_parsed += 1
    return validated


# =============================================================================
# MAIN
# =============================================================================

def main():
    logger.info("Starting Profile Enricher …")

    try:
        # -- 1. Fetch venues and organizers from DB --
        logger.info("Fetching venues and organizers from DB …")

        venues_map = {}       # handle → {id, row}
        organizers_map = {}   # handle → {id, row}
        usernames_to_scrape = []

        venue_rows = fetch_all_rows("venues", "id, name, instagram_username, website_url, address")
        for row in venue_rows:
            handle = (row.get("instagram_username") or "").strip().lower()
            if not handle:
                continue
            if SKIP_ALREADY_ENRICHED and is_profile_enriched(row, is_venue=True):
                logger.info(f"  Skipping already-enriched venue @{handle}")
                stats.profiles_skipped_enriched += 1
                continue
            venues_map[handle] = {"id": row["id"], "row": row}
            usernames_to_scrape.append(handle)

        org_rows = fetch_all_rows("organizers", "id, name, instagram_username, website_url")
        for row in org_rows:
            handle = (row.get("instagram_username") or "").strip().lower()
            if not handle:
                continue
            if SKIP_ALREADY_ENRICHED and is_profile_enriched(row, is_venue=False):
                logger.info(f"  Skipping already-enriched organizer @{handle}")
                stats.profiles_skipped_enriched += 1
                continue
            organizers_map[handle] = {"id": row["id"], "row": row}
            if handle not in [u.lower() for u in usernames_to_scrape]:
                usernames_to_scrape.append(handle)

        stats.profiles_found = len(usernames_to_scrape)

        if not usernames_to_scrape:
            logger.info("No profiles need enrichment.")
            return

        logger.info(f"Targeting {len(usernames_to_scrape)} profiles for metadata enrichment …")

        # -- 2. Scrape profiles via Apify --
        run_input = {"usernames": usernames_to_scrape}

        try:
            run = with_retry(
                lambda: apify_client.actor(APIFY_PROFILE_SCRAPER_ID).call(
                    run_input=run_input,
                    timeout_secs=APIFY_TIMEOUT_SECS,
                ),
                "Apify profile scraper call",
            )
        except Exception as exc:
            logger.error(f"Apify profile scraper failed: {exc}")
            return

        run_status = run.get("status", "UNKNOWN")
        if run_status not in ("SUCCEEDED",):
            logger.error(f"Apify profile scraper finished with status '{run_status}'.")
            return

        dataset_id = run.get("defaultDatasetId")
        if not dataset_id:
            logger.error("Apify run has no defaultDatasetId.")
            return

        try:
            items = list(apify_client.dataset(dataset_id).iterate_items())
        except Exception as exc:
            logger.error(f"Failed to read Apify dataset {dataset_id}: {exc}")
            return

        stats.profiles_scraped = len(items)
        logger.info(f"Apify returned {len(items)} profile(s).")

        if not items:
            logger.info("Apify returned no profiles.")
            return

        # -- 3. Process each profile --
        for item in items:
            if _shutdown_requested:
                logger.warning("Shutdown requested — stopping.")
                break

            handle = (item.get("username") or "").strip().lower()
            if not handle:
                logger.warning("  Skipping item with no username.")
                continue

            profile_data = {
                "fullName": item.get("fullName"),
                "biography": item.get("biography"),
                "externalUrl": item.get("externalUrl"),
                "businessAddressJSON": item.get("businessAddressJSON"),
            }

            is_venue = handle in venues_map
            is_org = handle in organizers_map

            if not is_venue and not is_org:
                logger.info(f"  @{handle} not found in venue or organizer maps — skipping.")
                continue

            logger.info(f"Processing @{handle} (venue={is_venue}, organizer={is_org}) …")
            parsed = analyze_profile_with_openai(profile_data, is_venue)
            if not parsed:
                continue

            # Update venue (if applicable)
            if is_venue:
                venue_info = venues_map[handle]
                update_data = {
                    "name": parsed.get("name") or profile_data.get("fullName") or handle,
                    "website_url": parsed.get("website_url"),
                    "address": parsed.get("address"),
                }
                try:
                    with_retry(
                        lambda vid=venue_info["id"], ud=update_data: (
                            supabase.table("venues").update(ud).eq("id", vid).execute()
                        ),
                        f"update venue @{handle}",
                    )
                    stats.venues_updated += 1
                    logger.info(f"  Updated venue @{handle}: {update_data}")
                except Exception as exc:
                    stats.update_failures += 1
                    logger.error(f"  Failed to update venue @{handle}: {exc}")

            # Update organizer (if applicable) — NOT elif, handles both cases
            if is_org:
                org_info = organizers_map[handle]
                update_data = {
                    "name": parsed.get("name") or profile_data.get("fullName") or handle,
                    "website_url": parsed.get("website_url"),
                }
                try:
                    with_retry(
                        lambda oid=org_info["id"], ud=update_data: (
                            supabase.table("organizers").update(ud).eq("id", oid).execute()
                        ),
                        f"update organizer @{handle}",
                    )
                    stats.organizers_updated += 1
                    logger.info(f"  Updated organizer @{handle}: {update_data}")
                except Exception as exc:
                    stats.update_failures += 1
                    logger.error(f"  Failed to update organizer @{handle}: {exc}")

    except KeyboardInterrupt:
        logger.warning("Interrupted by user (KeyboardInterrupt).")
    except Exception as exc:
        logger.error(f"Fatal error in main: {exc}", exc_info=True)
    finally:
        logger.info(stats.summary())


if __name__ == "__main__":
    main()
