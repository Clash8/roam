# 🚀 Tracker MVP: Aggregatore Eventi Roma (Relazionale)

## Obiettivo
Pipeline automatizzata: Scraping (Apify) -> Parsing (OpenAI) -> DB Relazionale (Supabase) -> UI (Vercel).

---

## FASE 1: Setup Account e Chiavi API
- [ ] **Apify:** Crea account, vai su Settings -> Integrations -> Copia `API Token`.
- [ ] **OpenAI:** Crea account, aggiungi credito (5$), genera `Secret Key`.
- [ ] **Supabase:** Crea progetto. Copia `Connection String` (URI) dal DB e la `anon` public key dalle API.

## FASE 2: Il Database Relazionale (Supabase SQL)
Creiamo 3 tabelle interconnesse. Esegui questi step nell'SQL Editor di Supabase.

- [ ] **1. Crea la tabella `venues` (Locali - es. The Sanctuary)**
  - `id` (UUID, Primary Key)
  - `name` (Text)
  - `address` (Text)
  - `website_url` (Text, nullable)
  - `instagram_url` (Text, nullable)
  - `created_at` (Timestamp)

- [ ] **2. Crea la tabella `organizers` (Organizzatori - es. Croccant3)**
  - `id` (UUID, Primary Key)
  - `name` (Text)
  - `website_url` (Text, nullable)
  - `instagram_url` (Text, nullable)
  - `created_at` (Timestamp)
  *(Nota: niente indirizzo qui, sono nomadi).*

- [ ] **3. Crea la tabella `events` (Eventi) collegandola alle precedenti**
  - `id` (UUID, Primary Key)
  - `title` (Text)
  - `date` (Date)
  - `time` (Text)
  - `end_time` (Text) *-- es. "til late"*
  - `location_name` (Text) *-- Nome del posto come fallback*
  - `venue_id` (UUID, Foreign Key -> venues.id, nullable)
  - `organizer_id` (UUID, Foreign Key -> organizers.id, nullable)
  - `image_url` (Text)
  - `description` (Text)
  - `category` (Text array) *-- es. ["Techno", "Aperitivo"]*
  - `coordinates` (JSON) *-- es. {"lat": 41.9, "lng": 12.5}*
  - `price` (Text)
  - `ticket_link` (Text)
  - `dresscode` (Text)
  - `min_age` (Integer)
  - `guestlist_only` (Boolean, default false)
  - `is_sold_out` (Boolean, default false)
  - `source_link` (Text)
  - `raw_text` (Text) *-- Il testo originale di IG per debug*
  - `ai_confidence_score` (Integer) *-- Da 1 a 100*
  - `created_at` (Timestamp)

- [ ] **4. Permessi:** Crea una policy RLS (Row Level Security) per tutte e tre le tabelle per permettere la lettura pubblica (`SELECT`).

## FASE 3: Lo Script Python (Il "Cervello")
- [ ] Crea file `scraper.py` e installa: `pip install apify-client openai supabase`.
- [ ] **3.1 - Scraping:** Usa Apify per scaricare i post di un target (es. il profilo IG di *croccant3*).
- [ ] **3.2 - Parsing (OpenAI):** Passa il testo a GPT-4o-mini chiedendo un JSON che combaci ESATTAMENTE con i campi della tabella `events`.
- [ ] **3.3 - Gestione Relazioni (Logica del DB):**
  - Prima di inserire l'evento, lo script controlla se il locale e l'organizzatore esistono già nelle rispettive tabelle usando l'URL di Instagram come riferimento.
  - Se non esistono, lo script inserisce la nuova *venue* o *organizer* e ne recupera l'`id`.
- [ ] **3.4 - Inserimento Evento:** Invia l'evento alla tabella `events` agganciando i relativi `venue_id` e `organizer_id`.

## FASE 4: Automazione (GitHub Actions)
- [ ] Crea Repository pubblica.
- [ ] Aggiungi in *Secrets*: `APIFY_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
- [ ] Crea il file `.github/workflows/daily_scraper.yml`.
- [ ] Imposta il Cron Job (`0 3 * * *` per le 3 di notte), setup Python, installazione requisiti e run di `scraper.py`.

## FASE 5: Il Frontend (Vercel)
- [ ] Crea progetto web (React/Next.js).
- [ ] Collega il frontend a Supabase. Ora puoi fare *join* dei dati! Quando scarichi un evento, scarica automaticamente anche i dati del locale e dell'organizzatore associati.
- [ ] Crea la UI e metti online su Vercel collegando la repo.
