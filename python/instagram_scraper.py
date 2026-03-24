import os
import sys
import json
import time
import signal
import logging
import functools
import re
import urllib.request
import urllib.error
import base64
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
from os.path import join, dirname
from dotenv import load_dotenv
from apify_client import ApifyClient
from openai import OpenAI
from supabase import create_client, Client

# =============================================================================
# CONFIGURATION
# =============================================================================

DAYS_AGO = 4                   # 0 = ignore date filter.  N = only posts from last N days.
MAX_POSTS_PER_PROFILE = 3      # 0 = ignore limit.        N = max N posts per profile.

FETCH_VENUES = True
FETCH_ORGANIZERS = True

# Retry settings
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2           # seconds — doubles each attempt (2, 4, 8 …)
RETRY_MAX_DELAY = 60           # ceiling for backoff

# Apify
APIFY_TIMEOUT_SECS = 300       # max wait for actor run to finish

# Image handling
MAX_IMAGE_BYTES = 5 * 1024 * 1024   # 5 MB — skip images larger than this
IMAGE_DOWNLOAD_TIMEOUT = 15          # seconds

# OpenAI
OPENAI_DELAY_BETWEEN_CALLS = 1.0    # seconds — simple rate-limit guard
MAX_CAPTION_LENGTH = 4000            # truncate captions longer than this

# Debug — overrides DB fetch; scrapes only the single item below
DEBUG_MODE = False
DEBUG_ITEM = {
    "idx": 3,
    "id": "d71a91c8-ece8-436c-87b1-10155f2e1e16",
    "name": "Groove Therapy",
    "website_url": "https://linktr.ee/groovetherapy_",
    "instagram_username": "groovetherapy_ent",
    "created_at": "2026-03-23 18:25:43.421236+00",
}

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

APIFY_ACTOR_ID = "apify/instagram-scraper"

# -- Graceful shutdown --------------------------------------------------------

_shutdown_requested = False


def _handle_signal(signum, _frame):
    global _shutdown_requested
    name = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
    logger.warning(f"Received {name} — will finish current item then exit.")
    _shutdown_requested = True


signal.signal(signal.SIGINT, _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)

# =============================================================================
# STATS
# =============================================================================

class Stats:
    def __init__(self):
        self.profiles_found = 0
        self.posts_scraped = 0
        self.posts_filtered = 0
        self.posts_parsed = 0
        self.parse_failures = 0
        self.events_inserted = 0
        self.events_skipped_duplicate = 0
        self.events_updated_duplicate = 0
        self.events_failed_insert = 0
        self.organizers_created = 0
        self.venues_created = 0
        self.bio_links_resolved = 0
        self.retries = 0

    def summary(self):
        return (
            f"\n{'=' * 55}\n"
            f"  SCRAPER RUN SUMMARY\n"
            f"{'=' * 55}\n"
            f"  Profiles found          {self.profiles_found}\n"
            f"  Posts scraped            {self.posts_scraped}\n"
            f"  Posts filtered out       {self.posts_filtered}\n"
            f"  Posts sent to AI         {self.posts_parsed}\n"
            f"  AI parse failures        {self.parse_failures}\n"
            f"  Events inserted          {self.events_inserted}\n"
            f"  Events skipped (dupe)    {self.events_skipped_duplicate}\n"
            f"  Events updated (dupe)    {self.events_updated_duplicate}\n"
            f"  Events failed insert     {self.events_failed_insert}\n"
            f"  Organizers created       {self.organizers_created}\n"
            f"  Venues created           {self.venues_created}\n"
            f"  Bio links resolved       {self.bio_links_resolved}\n"
            f"  Total retries            {self.retries}\n"
            f"{'=' * 55}"
        )


stats = Stats()

# =============================================================================
# UTILITIES
# =============================================================================

# Exceptions that indicate bad data (not transient) — never retried.
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
    # 1. Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 2. Strip markdown code fences
    for pattern in (r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"):
        m = re.search(pattern, text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
    # 3. Find the outermost { … } or [ … ]
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    return None


def normalize_source_url(url):
    """Normalise an Instagram post URL so duplicate checks are consistent."""
    if not url:
        return url
    url = url.split("?")[0].rstrip("/")          # strip query params & trailing slash
    url = re.sub(r"https?://(www\.)?", "https://www.", url)  # canonical scheme + www
    return url


def normalize_title(title):
    """Normalise a title for fuzzy dedup comparison."""
    if not title:
        return ""
    t = title.lower().strip()
    # Replace curly quotes / typographic apostrophes with straight ones
    t = t.replace("\u2018", "'").replace("\u2019", "'")  # ' '
    t = t.replace("\u201c", '"').replace("\u201d", '"')  # " "
    # Collapse whitespace
    t = re.sub(r"\s+", " ", t)
    return t


_BIO_PATTERN = re.compile(r"^(link\s+in\s+bio|bio|in\s+bio|link\s+bio|check\s+bio).*$", re.IGNORECASE)


def _is_bio_reference(ticket_link):
    """Return True if the ticket_link is just a reference to the Instagram bio."""
    if not ticket_link:
        return False
    return bool(_BIO_PATTERN.match(ticket_link.strip()))


def _get_bio_url(ig_handle):
    """Look up the website_url for a given Instagram handle from venues/organizers."""
    if not ig_handle:
        return None
    clean = ig_handle.lower().strip().lstrip("@")
    for table in ("venues", "organizers"):
        try:
            res = with_retry(
                lambda t=table: supabase.table(t).select("website_url").eq("instagram_username", clean).limit(1).execute(),
                f"bio URL lookup @{clean} in {table}",
            )
            if res.data and res.data[0].get("website_url"):
                return res.data[0]["website_url"]
        except Exception:
            pass
    return None


def resolve_ticket_link(ticket_link, post_owner_ig):
    """If ticket_link is a 'bio' reference, resolve it to the actual bio URL."""
    if not _is_bio_reference(ticket_link):
        return ticket_link
    bio_url = _get_bio_url(post_owner_ig)
    if bio_url:
        logger.info(f"  Resolved 'bio' ticket link → {bio_url} (from @{post_owner_ig})")
        stats.bio_links_resolved += 1
        return bio_url
    logger.info(f"  Could not resolve 'bio' ticket link — no website_url for @{post_owner_ig}")
    return None


def _event_completeness_score(record):
    """Score how complete an event record is (higher = more info)."""
    score = 0
    # Important fields worth more
    weights = {
        "title": 3, "date": 3, "location_name": 2, "venue_id": 2,
        "organizer_id": 2, "ticket_link": 2, "price": 1, "time": 1,
        "end_time": 1, "category": 1, "description": 1, "image_url": 1,
        "coordinates": 1, "dresscode": 1, "min_age": 1, "ai_confidence_score": 1,
    }
    for field, weight in weights.items():
        val = record.get(field)
        if val is not None and val != "" and val != "Unknown Event":
            score += weight
    return score


def _to_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ("true", "yes", "1", "si", "sì")
    return default


def _to_int(value, default=None, lo=None, hi=None):
    if value is None:
        return default
    try:
        n = int(re.sub(r"[^\d-]", "", str(value)))
        if lo is not None and n < lo:
            return default
        if hi is not None and n > hi:
            return default
        return n
    except (ValueError, TypeError):
        return default


def validate_and_normalize_event(data):
    """Sanitise / coerce every field coming from OpenAI so it matches the DB schema."""
    if not isinstance(data, dict):
        return None

    # -- title (string, required later — we allow None here) --
    title = data.get("title")
    if title and isinstance(title, str):
        title = title.strip()
    else:
        title = None
    data["title"] = title

    # -- date (YYYY-MM-DD or null) --
    raw_date = data.get("date")
    if raw_date:
        raw_date = str(raw_date).strip()
        try:
            datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError:
            # try other common formats
            for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
                try:
                    raw_date = datetime.strptime(raw_date, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            else:
                logger.warning(f"  [Validation] Unparseable date '{data.get('date')}' → null")
                raw_date = None
    data["date"] = raw_date or None

    # -- time / end_time (strings, pass through) --
    for key in ("time", "end_time"):
        v = data.get(key)
        data[key] = str(v).strip() if v else None

    # -- location_name / organizer_name / description (strings) --
    for key in ("location_name", "location_ig", "organizer_name", "description"):
        v = data.get(key)
        data[key] = str(v).strip() if v and str(v).strip().lower() != "null" else None

    # -- category (must be a list of non-empty strings) --
    cat = data.get("category")
    if isinstance(cat, str):
        cat = [c.strip() for c in re.split(r"[,/;]", cat) if c.strip()]
    elif isinstance(cat, list):
        cat = [str(c).strip() for c in cat if c and str(c).strip()]
    else:
        cat = None
    data["category"] = cat if cat else None

    # -- coordinates ({"lat": float, "lng": float} with sane bounds) --
    coords = data.get("coordinates")
    if isinstance(coords, dict):
        try:
            lat = float(coords.get("lat", 0))
            lng = float(coords.get("lng", 0))
            if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat != 0 or lng != 0):
                coords = {"lat": lat, "lng": lng}
            else:
                coords = None
        except (ValueError, TypeError):
            coords = None
    else:
        coords = None
    data["coordinates"] = coords

    # -- price / ticket_link / dresscode (strings) --
    for key in ("price", "ticket_link", "dresscode"):
        v = data.get(key)
        data[key] = str(v).strip() if v and str(v).strip().lower() != "null" else None

    # -- min_age (int, 0-99) --
    data["min_age"] = _to_int(data.get("min_age"), default=None, lo=0, hi=99)

    # -- booleans --
    data["guestlist_only"] = _to_bool(data.get("guestlist_only"), False)
    data["is_sold_out"] = _to_bool(data.get("is_sold_out"), False)

    # -- ai_confidence_score (int, 1-100) --
    data["ai_confidence_score"] = _to_int(data.get("ai_confidence_score"), default=None, lo=1, hi=100)

    return data


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

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def encode_image(url):
    """Download an image and return its base64 string.  Returns None on failure."""
    def _download():
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=IMAGE_DOWNLOAD_TIMEOUT) as resp:
            # Check Content-Length before reading the whole body
            length = resp.headers.get("Content-Length")
            if length and int(length) > MAX_IMAGE_BYTES:
                logger.warning(f"  Image too large ({int(length)} bytes > {MAX_IMAGE_BYTES}). Skipping.")
                return None
            data = resp.read(MAX_IMAGE_BYTES + 1)
            if len(data) > MAX_IMAGE_BYTES:
                logger.warning(f"  Image exceeded {MAX_IMAGE_BYTES} bytes during read. Skipping.")
                return None
            return base64.b64encode(data).decode("utf-8")

    try:
        return with_retry(_download, f"download image {url[:80]}", max_retries=2)
    except Exception as exc:
        logger.error(f"  Failed to download image after retries: {exc}")
        return None


def get_target_profiles_from_db():
    """Return (handle_list, venue_handles_set, organizer_handles_set).

    In DEBUG_MODE only the debug item's handle is returned.
    """
    if DEBUG_MODE and DEBUG_ITEM:
        handle = DEBUG_ITEM.get("instagram_username", "")
        logger.info(f"DEBUG MODE: only scraping @{handle}")
        h = handle.lower()
        # Guess type from DEBUG_ITEM or default to organizer
        return [h], set(), {h}

    venue_handles = set()
    organizer_handles = set()

    if FETCH_VENUES:
        rows = fetch_all_rows("venues", "instagram_username")
        for r in rows:
            h = (r.get("instagram_username") or "").strip().lower()
            if h:
                venue_handles.add(h)

    if FETCH_ORGANIZERS:
        rows = fetch_all_rows("organizers", "instagram_username")
        for r in rows:
            h = (r.get("instagram_username") or "").strip().lower()
            if h:
                organizer_handles.add(h)

    all_handles = list(venue_handles | organizer_handles)
    logger.info(f"Loaded {len(all_handles)} unique profiles to scrape: {all_handles}")
    return all_handles, venue_handles, organizer_handles


def is_valid_post(timestamp_str):
    """Return True if the post is recent enough according to DAYS_AGO."""
    if DAYS_AGO == 0:
        return True

    if not timestamp_str:
        logger.warning("  [Date] Missing timestamp.")
        return False

    try:
        # Handle common ISO variants: "Z" suffix, "+00:00", naive
        ts = str(timestamp_str).strip()
        ts = ts.replace("Z", "+00:00")
        # Python 3.10- doesn't like bare "+00:00" without 'T'; be lenient:
        for fmt in (None, "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z",
                     "%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
            try:
                if fmt is None:
                    post_dt = datetime.fromisoformat(ts)
                else:
                    post_dt = datetime.strptime(ts, fmt)
                break
            except ValueError:
                continue
        else:
            logger.warning(f"  [Date] Could not parse timestamp '{timestamp_str}'.")
            return False

        # Make timezone-aware if naive
        if post_dt.tzinfo is None:
            post_dt = post_dt.replace(tzinfo=timezone.utc)

        cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS_AGO)
        is_recent = post_dt >= cutoff
        logger.info(f"  [Date] Post {post_dt.date()} | cutoff {cutoff.date()} | recent={is_recent}")
        return is_recent
    except Exception as exc:
        logger.warning(f"  [Date] Unexpected error parsing '{timestamp_str}': {exc}")
        return False


def scrape_instagram_posts(usernames):
    """Call Apify to scrape recent posts for *usernames*.  Returns a list of post dicts."""
    if not usernames:
        return []

    if DAYS_AGO == 0 and MAX_POSTS_PER_PROFILE == 0:
        logger.error("Both DAYS_AGO and MAX_POSTS_PER_PROFILE are 0 — no filter set. Aborting.")
        return []

    logger.info(f"Starting Apify actor '{APIFY_ACTOR_ID}' [{len(usernames)} profiles, "
                f"DAYS_AGO={DAYS_AGO}, MAX_POSTS={MAX_POSTS_PER_PROFILE}]")

    urls = [f"https://www.instagram.com/{u}/" for u in usernames]
    results_limit = MAX_POSTS_PER_PROFILE if MAX_POSTS_PER_PROFILE > 0 else 30

    run_input = {
        "directUrls": urls,
        "resultsType": "posts",
        "resultsLimit": results_limit,
    }

    # -- Call Apify with retry + timeout --
    try:
        run = with_retry(
            lambda: apify_client.actor(APIFY_ACTOR_ID).call(
                run_input=run_input,
                timeout_secs=APIFY_TIMEOUT_SECS,
            ),
            "Apify actor call",
        )
    except Exception as exc:
        logger.error(f"Apify actor call failed: {exc}")
        return []

    run_status = run.get("status", "UNKNOWN")
    if run_status not in ("SUCCEEDED",):
        logger.error(f"Apify actor finished with status '{run_status}' — expected SUCCEEDED.")
        return []

    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        logger.error("Apify run has no defaultDatasetId.")
        return []

    # -- Iterate dataset items --
    try:
        items = list(apify_client.dataset(dataset_id).iterate_items())
    except Exception as exc:
        logger.error(f"Failed to read Apify dataset {dataset_id}: {exc}")
        return []

    logger.info(f"Apify returned {len(items)} raw items.")

    # -- Filter and build post list --
    posts = []
    accepted_per_profile = {}
    seen_urls = set()

    for item in items:
        owner = (item.get("ownerUsername") or "").strip().lower()
        if not owner:
            continue

        accepted_per_profile.setdefault(owner, 0)

        if MAX_POSTS_PER_PROFILE > 0 and accepted_per_profile[owner] >= MAX_POSTS_PER_PROFILE:
            continue

        url = normalize_source_url(item.get("url"))
        timestamp = item.get("timestamp")
        caption = item.get("caption") or ""
        display_url = item.get("displayUrl")

        # Dedup within this run
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)

        logger.info(f"--- Analysing item: {url or '(no url)'} ---")

        if not caption.strip():
            logger.info("  Skipping: no caption.")
            stats.posts_filtered += 1
            continue

        if not is_valid_post(timestamp):
            logger.info("  Skipping: too old or unparseable date.")
            stats.posts_filtered += 1
            continue

        # Truncate very long captions to save tokens
        if len(caption) > MAX_CAPTION_LENGTH:
            logger.info(f"  Caption truncated from {len(caption)} to {MAX_CAPTION_LENGTH} chars.")
            caption = caption[:MAX_CAPTION_LENGTH] + " …"

        posts.append({
            "source_link": url,
            "raw_text": caption,
            "image_url": display_url,
            "organizer_ig": owner,
        })
        accepted_per_profile[owner] += 1
        logger.info("  => Accepted.")

    stats.posts_scraped = len(posts)
    logger.info(f"{len(posts)} posts accepted after filtering ({stats.posts_filtered} filtered out).")
    return posts


def parse_post_with_openai(post):
    """Send a post to OpenAI and return a list of validated event dicts (usually one)."""
    logger.info(f"Calling OpenAI for: {post.get('source_link', '(no link)')}")

    today = datetime.now(timezone.utc)
    today_str = today.strftime("%Y-%m-%d")
    today_day = today.strftime("%A")

    prompt = f"""
Sei un assistente specializzato nell'estrazione di dati su eventi da post di Instagram.
Ecco il testo della didascalia:

"{post['raw_text']}"

ATTENZIONE: Hai a disposizione anche l'immagine del post (il flyer o la locandina). Usa il testo che leggi nell'immagine per dedurre quello che manca nella didascalia (es. "free entry" -> price, indirizzo nella locandina -> address/location_name, titolo a caratteri cubitali -> title). Metti insieme in modo intelligente i dati testuali e quelli visivi.

OGGI è {today_str} ({today_day}). Usa questa data per calcolare date relative ("sabato prossimo", "domani", "questo weekend", ecc.).

Estrai i seguenti campi in formato JSON. Se un dato non è presente o non può essere dedotto né dal testo né dall'immagine, usa null (o false per i booleani).
Ritorna un oggetto JSON con queste chiavi esatte:
- title (string, il titolo principale dell'evento)
- date (string, formato YYYY-MM-DD obbligatorio, es. "2026-04-05")
- time (string, es. "23:00")
- end_time (string, es. "till late")
- location_name (string, il nome del locale/venue)
- location_ig (string, handle Instagram del locale se citato, senza @)
- organizer_name (string, il nome dell'organizzatore)
- category (lista di stringhe, generi musicali es. ["Techno", "House"]. DEVE essere una lista anche con un solo elemento.)
- coordinates (oggetto JSON con "lat" e "lng" se sai dove si trova, altrimenti null)
- price (string, es. "15€" o "Free entry")
- ticket_link (string)
- dresscode (string)
- min_age (integer, es. 18)
- guestlist_only (boolean)
- is_sold_out (boolean)
- ai_confidence_score (integer da 1 a 100)
- description (string, breve riassunto dell'evento)

Se il post contiene PIÙ eventi distinti (es. lineup settimanale), ritorna una lista JSON di oggetti.
Altrimenti ritorna un singolo oggetto JSON.
Rispondi SOLO con il JSON, nient'altro.
"""

    # -- Build multimodal content --
    user_content = [{"type": "text", "text": prompt}]
    base64_img = None

    if post.get("image_url"):
        logger.info("  Downloading image for Vision analysis …")
        base64_img = encode_image(post["image_url"])
        if base64_img:
            data_uri = f"data:image/jpeg;base64,{base64_img}"
            user_content.append({
                "type": "image_url",
                "image_url": {"url": data_uri},
            })
            # Overwrite the expiring CDN URL with the permanent base64 string
            post["image_url"] = data_uri
        else:
            logger.warning("  Could not download image — falling back to text-only analysis.")

    # -- Call OpenAI with retry --
    time.sleep(OPENAI_DELAY_BETWEEN_CALLS)  # simple rate-limit guard

    def _call_openai():
        return openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": user_content}],
            response_format={"type": "json_object"},
        )

    try:
        response = with_retry(_call_openai, "OpenAI chat completion")
    except Exception as exc:
        logger.error(f"  OpenAI call failed: {exc}")
        stats.parse_failures += 1
        return []

    raw_content = (response.choices[0].message.content or "").strip()
    logger.info(f"  OpenAI raw response (first 300 chars): {raw_content[:300]}")

    # -- Parse JSON robustly --
    parsed = extract_json(raw_content)
    if parsed is None:
        logger.error(f"  Could not extract JSON from OpenAI response.")
        stats.parse_failures += 1
        return []

    # -- Normalise to a list of events --
    if isinstance(parsed, dict):
        # Sometimes the AI wraps the list in a key like "events"
        if "events" in parsed and isinstance(parsed["events"], list):
            events_raw = parsed["events"]
        else:
            events_raw = [parsed]
    elif isinstance(parsed, list):
        events_raw = parsed
    else:
        logger.error(f"  Unexpected JSON type: {type(parsed).__name__}")
        stats.parse_failures += 1
        return []

    # -- Validate each event --
    events = []
    for raw in events_raw:
        validated = validate_and_normalize_event(raw)
        if validated is None:
            logger.warning("  Skipping invalid event object from OpenAI.")
            continue

        # Attach post-level metadata
        validated["source_link"] = post.get("source_link")
        validated["image_url"] = post.get("image_url")
        validated["raw_text"] = post.get("raw_text")

        # Fallback organizer name → post owner
        if not validated.get("organizer_name") and post.get("organizer_ig"):
            validated["organizer_name"] = post["organizer_ig"]

        events.append(validated)

    stats.posts_parsed += 1
    logger.info(f"  Extracted {len(events)} event(s) from post.")
    return events


# -- Organizer / Venue lookup -------------------------------------------------

def get_or_create_organizer(name, ig_handle):
    """Find an organizer by ig_handle first, then by name.  Creates one if not found."""
    if not name and not ig_handle:
        return None

    clean_handle = ig_handle.lower().strip() if ig_handle else None
    clean_name = name.strip() if name else None

    # 1. Lookup by Instagram handle (most reliable identifier)
    if clean_handle:
        try:
            res = with_retry(
                lambda: supabase.table("organizers").select("id").eq("instagram_username", clean_handle).execute(),
                f"lookup organizer @{clean_handle}",
            )
            if res.data:
                return res.data[0]["id"]
        except Exception as exc:
            logger.warning(f"  Organizer lookup by handle failed: {exc}")

    # 2. Lookup by name
    if clean_name:
        try:
            res = with_retry(
                lambda: supabase.table("organizers").select("id").eq("name", clean_name).execute(),
                f"lookup organizer '{clean_name}'",
            )
            if res.data:
                return res.data[0]["id"]
        except Exception as exc:
            logger.warning(f"  Organizer lookup by name failed: {exc}")

    # 3. Create new
    new_org = {"name": clean_name or clean_handle, "instagram_username": clean_handle}
    try:
        insert_res = with_retry(
            lambda: supabase.table("organizers").insert(new_org).execute(),
            f"insert organizer '{clean_name or clean_handle}'",
        )
        if insert_res.data:
            stats.organizers_created += 1
            logger.info(f"  Created organizer: {clean_name or clean_handle}")
            return insert_res.data[0]["id"]
    except Exception as exc:
        # Insert might fail due to race condition — try fetching again
        logger.warning(f"  Organizer insert failed ({exc}). Retrying lookup …")
        try:
            if clean_handle:
                res = supabase.table("organizers").select("id").eq("instagram_username", clean_handle).execute()
                if res.data:
                    return res.data[0]["id"]
            if clean_name:
                res = supabase.table("organizers").select("id").eq("name", clean_name).execute()
                if res.data:
                    return res.data[0]["id"]
        except Exception:
            pass

    return None


def get_or_create_venue(name, ig_handle):
    """Find a venue by ig_handle first, then by name.  Creates one if not found."""
    if not name and not ig_handle:
        return None

    clean_handle = ig_handle.lower().strip() if ig_handle else None
    clean_name = name.strip() if name else None

    # 1. Lookup by Instagram handle
    if clean_handle:
        try:
            res = with_retry(
                lambda: supabase.table("venues").select("id").eq("instagram_username", clean_handle).execute(),
                f"lookup venue @{clean_handle}",
            )
            if res.data:
                return res.data[0]["id"]
        except Exception as exc:
            logger.warning(f"  Venue lookup by handle failed: {exc}")

    # 2. Lookup by name
    if clean_name:
        try:
            res = with_retry(
                lambda: supabase.table("venues").select("id").eq("name", clean_name).execute(),
                f"lookup venue '{clean_name}'",
            )
            if res.data:
                return res.data[0]["id"]
        except Exception as exc:
            logger.warning(f"  Venue lookup by name failed: {exc}")

    # 3. Create new
    new_venue = {"name": clean_name or clean_handle, "instagram_username": clean_handle}
    try:
        insert_res = with_retry(
            lambda: supabase.table("venues").insert(new_venue).execute(),
            f"insert venue '{clean_name or clean_handle}'",
        )
        if insert_res.data:
            stats.venues_created += 1
            logger.info(f"  Created venue: {clean_name or clean_handle}")
            return insert_res.data[0]["id"]
    except Exception as exc:
        logger.warning(f"  Venue insert failed ({exc}). Retrying lookup …")
        try:
            if clean_handle:
                res = supabase.table("venues").select("id").eq("instagram_username", clean_handle).execute()
                if res.data:
                    return res.data[0]["id"]
            if clean_name:
                res = supabase.table("venues").select("id").eq("name", clean_name).execute()
                if res.data:
                    return res.data[0]["id"]
        except Exception:
            pass

    return None


# -- Dedup --------------------------------------------------------------------

_DEDUP_SELECT = "id, title, date, time, end_time, location_name, venue_id, organizer_id, image_url, description, category, coordinates, price, ticket_link, dresscode, min_age, guestlist_only, is_sold_out, source_link, raw_text, ai_confidence_score"


def find_existing_event(source_link, title=None, date=None, location_name=None):
    """Return the existing event record dict if a duplicate is found, else None."""
    # Primary: source_link match (check both with and without trailing slash)
    if source_link:
        link_variants = [source_link]
        if source_link.endswith("/"):
            link_variants.append(source_link.rstrip("/"))
        else:
            link_variants.append(source_link + "/")
        try:
            res = with_retry(
                lambda: supabase.table("events").select(_DEDUP_SELECT).in_("source_link", link_variants).limit(1).execute(),
                "dedup check by source_link",
            )
            if res.data:
                return res.data[0]
        except Exception as exc:
            logger.warning(f"  Dedup check (source_link) failed: {exc}")

    # Secondary: title + date + location (catches reposts / link variants)
    if title and date and location_name:
        try:
            res = with_retry(
                lambda: (
                    supabase.table("events")
                    .select(_DEDUP_SELECT)
                    .eq("title", title)
                    .eq("date", date)
                    .eq("location_name", location_name)
                    .limit(1)
                    .execute()
                ),
                "dedup check by title+date+location",
            )
            if res.data:
                return res.data[0]
        except Exception as exc:
            logger.warning(f"  Dedup check (title+date+location) failed: {exc}")

    # Tertiary: normalized title + date + location (catches curly quotes, case diffs)
    norm_title = normalize_title(title)
    if norm_title and date and location_name:
        try:
            res = with_retry(
                lambda: (
                    supabase.table("events")
                    .select(_DEDUP_SELECT)
                    .eq("date", date)
                    .eq("location_name", location_name)
                    .limit(50)
                    .execute()
                ),
                "dedup check by normalized title+date+location",
            )
            for row in (res.data or []):
                if normalize_title(row.get("title")) == norm_title:
                    logger.info(f"  Fuzzy title match: existing '{row['title']}' ≈ new '{title}'")
                    return row
        except Exception as exc:
            logger.warning(f"  Dedup check (normalized title) failed: {exc}")

    # Quaternary: date + location only (same venue, same date = likely same event)
    if date and location_name:
        try:
            res = with_retry(
                lambda: (
                    supabase.table("events")
                    .select(_DEDUP_SELECT)
                    .eq("date", date)
                    .eq("location_name", location_name)
                    .limit(1)
                    .execute()
                ),
                "dedup check by date+location",
            )
            if res.data:
                existing = res.data[0].get("title", "?")
                logger.info(f"  Same venue+date match: existing '{existing}' ≈ new '{title}'")
                return res.data[0]
        except Exception as exc:
            logger.warning(f"  Dedup check (date+location) failed: {exc}")

    return None


# =============================================================================
# MAIN
# =============================================================================

def main():
    logger.info("Starting Instagram Scraper …")

    try:
        # -- 1. Fetch target profiles --
        profiles, venue_handles, organizer_handles = get_target_profiles_from_db()
        stats.profiles_found = len(profiles)

        if not profiles:
            logger.info("No Instagram profiles found. Nothing to do.")
            return

        # -- 2. Scrape posts via Apify --
        posts = scrape_instagram_posts(profiles)

        if not posts:
            logger.info("No posts matched the filter criteria.")
            return

        # -- 3. Process each post --
        for post in posts:
            if _shutdown_requested:
                logger.warning("Shutdown requested — stopping after current post.")
                break

            events = parse_post_with_openai(post)
            if not events:
                logger.warning(f"No events extracted from {post.get('source_link', '(no link)')}")
                continue

            owner_handle = (post.get("organizer_ig") or "").lower()
            owner_is_venue = owner_handle in venue_handles
            owner_is_organizer = owner_handle in organizer_handles

            for event_data in events:
                if _shutdown_requested:
                    break

                logger.info(f"Processing event: {event_data.get('title') or '(untitled)'}")

                # -- Smart organizer / venue assignment --
                if owner_is_venue:
                    # The account we scraped is a venue → use its handle for venue
                    venue_id = get_or_create_venue(
                        event_data.get("location_name") or owner_handle,
                        owner_handle,
                    )
                    # Organizer comes purely from the AI extraction
                    organizer_id = get_or_create_organizer(
                        event_data.get("organizer_name"),
                        event_data.get("location_ig") if event_data.get("location_ig") != owner_handle else None,
                    )
                elif owner_is_organizer:
                    # The account we scraped is an organizer → use its handle for organizer
                    organizer_id = get_or_create_organizer(
                        event_data.get("organizer_name") or owner_handle,
                        owner_handle,
                    )
                    # Venue comes purely from the AI extraction
                    venue_id = get_or_create_venue(
                        event_data.get("location_name"),
                        event_data.get("location_ig"),
                    )
                else:
                    # Unknown owner type — best effort
                    organizer_id = get_or_create_organizer(
                        event_data.get("organizer_name"),
                        owner_handle,
                    )
                    venue_id = get_or_create_venue(
                        event_data.get("location_name"),
                        event_data.get("location_ig"),
                    )

                # -- Resolve "bio" ticket links --
                raw_ticket = event_data.get("ticket_link")
                ticket_link = resolve_ticket_link(raw_ticket, owner_handle)

                # -- Build event record --
                norm_link = normalize_source_url(event_data.get("source_link"))
                event_record = {
                    "title": event_data.get("title") or "Unknown Event",
                    "date": event_data.get("date"),
                    "time": event_data.get("time"),
                    "end_time": event_data.get("end_time"),
                    "location_name": event_data.get("location_name"),
                    "venue_id": venue_id,
                    "organizer_id": organizer_id,
                    "image_url": event_data.get("image_url"),
                    "description": event_data.get("description"),
                    "category": event_data.get("category"),
                    "coordinates": json.dumps(event_data["coordinates"]) if event_data.get("coordinates") else None,
                    "price": event_data.get("price"),
                    "ticket_link": ticket_link,
                    "dresscode": event_data.get("dresscode"),
                    "min_age": event_data.get("min_age"),
                    "guestlist_only": event_data.get("guestlist_only", False),
                    "is_sold_out": event_data.get("is_sold_out", False),
                    "source_link": norm_link,
                    "raw_text": event_data.get("raw_text"),
                    "ai_confidence_score": event_data.get("ai_confidence_score"),
                }

                # -- Dedup check: find existing, compare, update or insert --
                existing = find_existing_event(
                    norm_link,
                    event_record["title"],
                    event_record["date"],
                    event_record["location_name"],
                )

                if existing:
                    # Compare completeness — update if new record is better
                    new_score = _event_completeness_score(event_record)
                    old_score = _event_completeness_score(existing)

                    update_fields = {}

                    # Always fix "bio" ticket_links on existing records
                    old_ticket = existing.get("ticket_link")
                    new_ticket = event_record.get("ticket_link")
                    if _is_bio_reference(old_ticket) and new_ticket and not _is_bio_reference(new_ticket):
                        update_fields["ticket_link"] = new_ticket

                    if new_score > old_score:
                        # Merge: new values fill in gaps in the existing record
                        for key, new_val in event_record.items():
                            old_val = existing.get(key)
                            if new_val is not None and new_val != "" and new_val != old_val:
                                # Don't downgrade a real ticket_link to None
                                if key == "ticket_link" and old_val and not _is_bio_reference(old_val) and not new_val:
                                    continue
                                update_fields[key] = new_val
                            elif old_val is None and new_val is not None:
                                update_fields[key] = new_val

                    if update_fields:
                        try:
                            with_retry(
                                lambda eid=existing["id"], uf=update_fields: (
                                    supabase.table("events").update(uf).eq("id", eid).execute()
                                ),
                                f"update event '{existing.get('title')}'",
                            )
                            stats.events_updated_duplicate += 1
                            logger.info(f"  Updated existing event '{existing.get('title')}' (score {old_score}→{new_score}, fields: {list(update_fields.keys())})")
                        except Exception as exc:
                            logger.error(f"  Failed to update event '{existing.get('title')}': {exc}")
                    else:
                        stats.events_skipped_duplicate += 1
                        logger.info(f"  Event already exists with equal/better data (score {old_score}≥{new_score}) — skipping.")
                    continue

                # -- Insert --
                try:
                    with_retry(
                        lambda rec=event_record: supabase.table("events").insert(rec).execute(),
                        f"insert event '{event_record['title']}'",
                    )
                    stats.events_inserted += 1
                    logger.info(f"  Inserted event: {event_record['title']}")
                except Exception as exc:
                    stats.events_failed_insert += 1
                    logger.error(f"  Failed to insert event '{event_record['title']}': {exc}")

    except KeyboardInterrupt:
        logger.warning("Interrupted by user (KeyboardInterrupt).")
    except Exception as exc:
        logger.error(f"Fatal error in main: {exc}", exc_info=True)
    finally:
        logger.info(stats.summary())


if __name__ == "__main__":
    main()
