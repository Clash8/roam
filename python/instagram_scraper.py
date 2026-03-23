import os
import json
import logging
from urllib.parse import urlparse
import urllib.request
import base64
from datetime import datetime, timedelta, timezone
from os.path import join, dirname
from dotenv import load_dotenv
from apify_client import ApifyClient
from openai import OpenAI
from supabase import create_client, Client

# --- CONFIGURATION ---
DAYS_AGO = 4                   # 0 = Ignora data. N = Prende solo post pubblicati negli ultimi N giorni.
MAX_POSTS_PER_PROFILE = 3      # 0 = Ignora limite. N = Prende massimo N post per ogni profilo analizzato.

FETCH_VENUES = True
FETCH_ORGANIZERS = True

# Debug mode overrides the DB fetch and only scrapes this specific item
DEBUG_MODE = False
DEBUG_ITEM = {"idx":3,"id":"d71a91c8-ece8-436c-87b1-10155f2e1e16","name":"Groove Therapy","website_url":"https://linktr.ee/groovetherapy_","instagram_url":"https://www.instagram.com/groovetherapy_ent/","created_at":"2026-03-23 18:25:43.421236+00"}
# ---------------------

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
dotenv_path = join(dirname(__file__), '../.env')
load_dotenv(dotenv_path)

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([APIFY_TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    logger.error("Missing required environment variables. Please check your .env file.")
    exit(1)

apify_client = ApifyClient(APIFY_TOKEN)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

APIFY_ACTOR_ID = "apify/instagram-scraper"

def extract_instagram_handle(url):
    """Extracts username handle from an instagram URL."""
    if not url: return None
    path = urlparse(url).path.strip('/')
    parts = path.split('/')
    if parts:
        return parts[0]
    return None

def encode_image(url):
    """Downloads an image from a URL and returns its base64 string representation."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return base64.b64encode(response.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to download or encode image: {e}")
        return None

def get_target_profiles_from_db():
    if DEBUG_MODE and DEBUG_ITEM:
        handle = extract_instagram_handle(DEBUG_ITEM.get("instagram_url"))
        logger.info(f"DEBUG MODE ON: Only scraping {handle}")
        return [handle.lower()] if handle else []

    handles = set()
    logger.info("Fetching target Instagram profiles from database...")
    
    if FETCH_VENUES:
        res_v = supabase.table("venues").select("instagram_url").execute()
        for row in res_v.data:
            handle = extract_instagram_handle(row.get("instagram_url"))
            if handle: handles.add(handle.lower())
            
    if FETCH_ORGANIZERS:
        res_o = supabase.table("organizers").select("instagram_url").execute()
        for row in res_o.data:
            handle = extract_instagram_handle(row.get("instagram_url"))
            if handle: handles.add(handle.lower())
            
    logger.info(f"Loaded {len(handles)} unique profiles to scrape: {list(handles)}")
    return list(handles)

def is_valid_post(timestamp_str):
    if DAYS_AGO == 0:
        logger.info("  [Date Filter] DAYS_AGO è 0, ignoro filtro data.")
        return True
        
    if not timestamp_str: 
        logger.warning("  [Date Filter] Missing timestamp.")
        return False
        
    try:
        post_date = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00")).date()
        target_date = (datetime.now(timezone.utc) - timedelta(days=DAYS_AGO)).date()
        
        is_match = (post_date >= target_date)
        logger.info(f"  [Date Filter] Post date: {post_date} | Target (>=): {target_date} | Match? {is_match}")
        return is_match
    except ValueError:
        logger.error(f"  [Date Filter] Invalid timestamp format: {timestamp_str}")
        return False

def scrape_instagram_posts(usernames):
    if not usernames:
        return []

    if DAYS_AGO == 0 and MAX_POSTS_PER_PROFILE == 0:
        logger.error("ATTENZIONE: Entrambi DAYS_AGO e MAX_POSTS_PER_PROFILE sono zero! Nessun filtro impostato, lo scraper verrebbe invaso. Operazione annullata.")
        return []

    logger.info(f"Starting Apify actor '{APIFY_ACTOR_ID}' [DAYS_AGO: {DAYS_AGO}, MAX_POSTS_PER_PROFILE: {MAX_POSTS_PER_PROFILE}]")
    
    urls = [f"https://www.instagram.com/{u}/" for u in usernames]
    
    # Se MAX\_POSTS\_PER\_PROFILE = 0, dobbiamo dire ad Apify di prelevare tutti i post che può per poi valutarli tramite la data
    results_limit = MAX_POSTS_PER_PROFILE if MAX_POSTS_PER_PROFILE > 0 else 30
    
    run_input = {
        "directUrls": urls,
        "resultsType": "posts",
        "resultsLimit": results_limit,
    }
    
    run = apify_client.actor(APIFY_ACTOR_ID).call(run_input=run_input)
    logger.info(f"Apify actor execution finished. Dataset ID: {run['defaultDatasetId']}")
    
    items = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())
    logger.info(f"Total raw items returned from Apify matching search criteria: {len(items)}")

    posts = []
    accepted_per_profile = {}
    
    for item in items:
        owner = item.get("ownerUsername")
        if not owner:
            continue
            
        if owner not in accepted_per_profile:
            accepted_per_profile[owner] = 0
            
        # In modalità MAX_POSTS_PER_PROFILE > 0 manteniamo un counter locale per assicurarci di dividere equamente i post sui profili
        if MAX_POSTS_PER_PROFILE > 0 and accepted_per_profile[owner] >= MAX_POSTS_PER_PROFILE:
            logger.info(f"  [Limit Filter] Max posts ({MAX_POSTS_PER_PROFILE}) raggiunti per il profilo {owner}, i successivi vengono ignorati.")
            continue

        url = item.get("url")
        timestamp = item.get("timestamp")
        caption = item.get("caption")
        display_url = item.get("displayUrl")
        
        logger.info(f"--- Analyzing item: {url} ---")
        
        if not caption:
            logger.warning("  Skipping: No caption found for this post.")
            continue
            
        if not is_valid_post(timestamp):
            logger.info("  Skipping: Post is older than target date.")
            continue
            
        posts.append({
            "source_link": url,
            "raw_text": caption,
            "image_url": display_url,
            "organizer_ig": owner
        })
        accepted_per_profile[owner] += 1
        logger.info("  => Post accepted into parsing queue.")
        
    logger.info(f"Scraped {len(posts)} posts accepted after filtering.")
    return posts

def parse_post_with_openai(post):
    """Uses OpenAI to extract structured event data from a raw Instagram post."""
    logger.info(f"Calling OpenAI via gpt-4o-mini for post: {post['source_link']}")
    
    prompt = f"""
    Sei un assistente specializzato nell'estrazione di dati su eventi da post di Instagram.
    Ecco il testo della didascalia:
    
    "{post['raw_text']}"
    
    ATTENZIONE: Hai a disposizione anche l'immagine del post (il flyer o la locandina). Usa il testo che leggi nell'immagine per dedurre quello che manca nella didascalia (es. "free entry" -> price, indirizzo nella locandina -> address/location_name, titolo a caratteri cubitali -> title). Metti insieme in modo intelligente i dati testuali e quelli visivi.
    
    Estrai i seguenti campi in formato JSON (rispondi SOLO con il JSON, nient'altro). Se un dato non è presente o non può essere dedotto né dal testo né dall'immagine, usa null (o false per i booleani).
    Ritorna un oggetto JSON con queste chiavi esatte:
    - title (string, il titolo principale dell'evento, cercalo nel flyer se la didascalia è vaga o assente)
    - date (string, formato YYYY-MM-DD, prova a dedurlo o usa l'anno corrente)
    - time (string, es. "23:00")
    - end_time (string, es. "till late")
    - location_name (string, il nome del locale/venue, cerca sia nel flyer che nel testo)
    - location_ig (string, handle o nome IG del locale se citato)
    - organizer_name (string, il nome dell'organizzatore)
    - category (lista di stringhe, generi musicali es. ["Techno", "House"])
    - coordinates (oggetto JSON con "lat" e "lng", cerca di stimarlo se sai dove si trova, altrimenti null)
    - price (string, es. "15€" o "Free entry", cerca prezzi o "free entry" nel flyer)
    - ticket_link (string)
    - dresscode (string)
    - min_age (integer)
    - guestlist_only (boolean)
    - is_sold_out (boolean)
    - ai_confidence_score (integer da 1 a 100 indicando quanto sei sicuro dei dati estratti incrociando immagine e testo)
    - description (string, un breve riassunto dell'evento)
    """

    user_content = [{"type": "text", "text": prompt}]
    
    if post.get("image_url"):
        logger.info("  Downloading image and encoding to base64 for Vision analysis...")
        base64_img = encode_image(post["image_url"])
        if base64_img:
            data_uri = f"data:image/jpeg;base64,{base64_img}"
            user_content.append({
                "type": "image_url",
                "image_url": { "url": data_uri }
            })
            # Overwrite the expiring CDN URL with the permanent Base64 string so it gets saved to the DB
            post["image_url"] = data_uri
        else:
            logger.warning("  Could not download image. Falling back to text-only analysis.")
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": user_content}],
            response_format={ "type": "json_object" }
        )
        content = response.choices[0].message.content
        logger.info(f"OpenAI raw response: {content[:300]}...")
        
        parsed = json.loads(content)
        parsed["source_link"] = post["source_link"]
        parsed["image_url"] = post["image_url"]
        parsed["raw_text"] = post["raw_text"]
        
        if not parsed.get("organizer_name") and post.get("organizer_ig"):
            parsed["organizer_name"] = post["organizer_ig"]
            
        return parsed
    except json.JSONDecodeError as je:
        logger.error(f"OpenAI failed to return valid JSON! Error: {je}")
        logger.error(f"Raw content returned by OpenAI was: {content}")
        return None
    except Exception as e:
        logger.error(f"Error parsing with OpenAI API: {e}")
        return None

def get_or_create_organizer(name, ig_handle):
    if not name: return None
    instagram_url = f"https://instagram.com/{ig_handle}" if ig_handle else None
    res = supabase.table("organizers").select("id").eq("name", name).execute()
    if res.data: return res.data[0]["id"]
        
    new_org = { "name": name, "instagram_url": instagram_url }
    insert_res = supabase.table("organizers").insert(new_org).execute()
    if insert_res.data:
        logger.info(f"Created new organizer: {name}")
        return insert_res.data[0]["id"]
    return None

def get_or_create_venue(name, ig_handle):
    if not name: return None
    instagram_url = f"https://instagram.com/{ig_handle}" if ig_handle else None
    res = supabase.table("venues").select("id").eq("name", name).execute()
    if res.data: return res.data[0]["id"]
        
    new_venue = { "name": name, "instagram_url": instagram_url }
    insert_res = supabase.table("venues").insert(new_venue).execute()
    if insert_res.data:
        logger.info(f"Created new venue: {name}")
        return insert_res.data[0]["id"]
    return None

def main():
    logger.info("Starting Instagram Scraper (DB Sync)...")
    
    profiles = get_target_profiles_from_db()
    if not profiles:
        logger.info("No instagram profiles found. Exiting.")
        return
        
    posts = scrape_instagram_posts(profiles)
    
    if not posts:
        logger.info("No posts matching criteria found. Exiting.")
        return
        
    for post in posts:
        event_data = parse_post_with_openai(post)
        if not event_data: 
            logger.error(f"Failed to process event for {post.get('source_link')}")
            continue
            
        logger.info(f"Extracted event: {event_data.get('title')}")
        
        organizer_ig = post.get("organizer_ig")
        organizer_id = get_or_create_organizer(event_data.get("organizer_name"), organizer_ig)
        venue_id = get_or_create_venue(event_data.get("location_name"), event_data.get("location_ig"))
        
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
            "coordinates": event_data.get("coordinates"),
            "price": event_data.get("price"),
            "ticket_link": event_data.get("ticket_link"),
            "dresscode": event_data.get("dresscode"),
            "min_age": event_data.get("min_age"),
            "guestlist_only": event_data.get("guestlist_only") if event_data.get("guestlist_only") is not None else False,
            "is_sold_out": event_data.get("is_sold_out") if event_data.get("is_sold_out") is not None else False,
            "source_link": event_data.get("source_link"),
            "raw_text": event_data.get("raw_text"),
            "ai_confidence_score": event_data.get("ai_confidence_score", 0)
        }
        
        existing = supabase.table("events").select("id").eq("source_link", event_record["source_link"]).execute()
        if existing.data:
            logger.info(f"Event already exists for link {event_record['source_link']}. Skipping insertion.")
        else:
            supabase.table("events").insert(event_record).execute()
            logger.info("Successfully inserted new event to Supabase events table.")

if __name__ == "__main__":
    main()
