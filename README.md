# Where's What

Family app for Akanksha, Kalpak and Rupak: search any item, see which labelled box it's in and where that box is kept.

## How it's built
- `public/`: the PWA (index.html, app.js, styles.css, manifest, service worker, icons). Vanilla JS, no build step.
- `api/`: Vercel serverless functions. All database and photo access happens here with the Supabase service role key.
  - `login` / `logout`: family PIN → signed HttpOnly cookie, valid 180 days per phone. Changing `FAMILY_PIN` logs everyone out.
  - `boxes`: GET list (with 6-hour signed photo URLs), POST create/update, DELETE.
  - `move`: change a box's place and append to its history.
  - `settings`: places in the house and family members.
  - `upload`: JPEG photo upload (the phone shrinks photos to 1600px first).
  - `suggest`: sends box photos to Claude and returns an item list. Needs `ANTHROPIC_API_KEY`.
- `supabase/schema.sql`: tables `boxes` and `settings` (RLS on, no policies) + private `photos` bucket.
- `seed/`: the first 5 boxes (ELE-01, ELE-02, MSC-01, DEC-01, FES-01) with photos. `npm run seed`.

## Box codes
Three-letter type + number, written in marker on the box:
ELE electronics & cables · KIT kitchen · CLO clothes & linen · DOC documents · TLS tools · FES festival · DEC home decor · BKS books · MSC misc.

## Data
Lives in your Supabase project (Postgres + Storage). Back up with Supabase → Database → Backups, or export the `boxes` table as CSV.

## Cost
Supabase free tier + Vercel Hobby: ₹0. Photo item-listing: a small charge per photo set on your Anthropic account. Set a monthly limit in the Anthropic Console.
