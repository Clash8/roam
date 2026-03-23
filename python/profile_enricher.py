import os
import json
import logging
from urllib.parse import urlparse
from os.path import join, dirname
from dotenv import load_dotenv
from apify_client import ApifyClient
from openai import OpenAI
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

dotenv_path = join(dirname(__file__), '../.env')
load_dotenv(dotenv_path)

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([APIFY_TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY]):
    logger.error("Missing required environment variables.")
    exit(1)

apify_client = ApifyClient(APIFY_TOKEN)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Apify Actor specifically designed to grab profile details (bio, links, etc.)
APIFY_PROFILE_SCRAPER_ID = "apify/instagram-profile-scraper"

def extract_instagram_handle(url):
    if not url: return None
    path = urlparse(url).path.strip('/')
    parts = path.split('/')
    if parts: return parts[0].lower()
    return None

def analyze_profile_with_openai(profile_data, is_venue):
    prompt = f"""
    Sei un assistente che estrae dati di contatto da un profilo Instagram.
    Dati restituiti dallo scraper: {json.dumps(profile_data, ensure_ascii=False)}
    
    1. 'name': Riscrivi il 'fullName' usando le normali maiuscole, rimuovendo emoji o frasi strane.
    2. 'website_url': Estrai il link dal campo 'externalUrl' o dalla 'biography'.
    """
    if is_venue:
        prompt += "3. 'address': Se è un locale, ricava l'indirizzo esatto, città, o CAP dal campo 'businessAddressJSON' o leggendolo in 'biography'. Solo il nome della location fisica.\n"
    
    prompt += "Ritorna SOLO un oggetto JSON con queste chiavi esatte: name, website_url"
    if is_venue: prompt += ", address"
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        logger.error(f"Error parsing with OpenAI: {e}")
        return None

def main():
    logger.info("Fetching venues and organizers from DB...")
    venues_map = {}
    organizers_map = {}
    usernames = []
    
    res_v = supabase.table("venues").select("id, instagram_url").execute()
    for row in res_v.data:
        handle = extract_instagram_handle(row.get("instagram_url"))
        if handle:
            venues_map[handle] = row["id"]
            usernames.append(handle)
            
    res_o = supabase.table("organizers").select("id, instagram_url").execute()
    for row in res_o.data:
        handle = extract_instagram_handle(row.get("instagram_url"))
        if handle:
            organizers_map[handle] = row["id"]
            usernames.append(handle)
            
    if not usernames:
        logger.info("No instagram URLs found in DB.")
        return
        
    logger.info(f"Targeting {len(usernames)} profiles for metadata enrichment...")
    
    # Execute Apify Actor
    run_input = { "usernames": usernames }
    run = apify_client.actor(APIFY_PROFILE_SCRAPER_ID).call(run_input=run_input)
    
    for item in apify_client.dataset(run["defaultDatasetId"]).iterate_items():
        handle = item.get("username", "").lower()
        if not handle: continue
            
        profile_data = {
            "fullName": item.get("fullName"),
            "biography": item.get("biography"),
            "externalUrl": item.get("externalUrl"),
            "businessAddressJSON": item.get("businessAddressJSON")
        }
        
        is_venue = handle in venues_map
        is_org = handle in organizers_map
        
        logger.info(f"Processing profile data for @{handle}...")
        parsed = analyze_profile_with_openai(profile_data, is_venue)
        if not parsed: continue
            
        if is_venue:
            logger.info(f"Updating venue @{handle}: {parsed}")
            supabase.table("venues").update({
                "name": parsed.get("name") or profile_data["fullName"] or handle,
                "website_url": parsed.get("website_url"),
                "address": parsed.get("address")
            }).eq("id", venues_map[handle]).execute()
            
        elif is_org:
            logger.info(f"Updating organizer @{handle}: {parsed}")
            supabase.table("organizers").update({
                "name": parsed.get("name") or profile_data["fullName"] or handle,
                "website_url": parsed.get("website_url")
            }).eq("id", organizers_map[handle]).execute()

    logger.info("Profile enrichment completed!")

if __name__ == "__main__":
    main()
