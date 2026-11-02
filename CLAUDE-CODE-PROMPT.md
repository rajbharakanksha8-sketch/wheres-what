Deploy this project, "Where's What": a family PWA (installable phone app) that tracks which storage box holds what and where each box is kept in our home. Read README.md first. The code is complete; your job is setup, verification and deployment. Don't redesign or rewrite features.

Stack: static PWA in /public + Vercel Node serverless functions in /api + Supabase (Postgres + private Storage bucket "photos"). Login is a single shared family PIN checked server-side; the browser never talks to Supabase directly.

Do this in order, and ask me for anything you need as you go:

1. Check Node is 20.6 or newer, then `npm install`.
2. `.env.local` already exists with SESSION_SECRET and ANTHROPIC_API_KEY filled in. Don't change those. Supabase: I'll create a project at supabase.com (Mumbai region, ap-south-1) if I haven't yet. Ask me for the Project URL and the service_role key (Project Settings → API) and fill them into `.env.local`.
3. Ask me for the family PIN (4–8 digits) and fill FAMILY_PIN in `.env.local`.
4. Run `supabase/schema.sql`. If I give you the database connection string (Project Settings → Database), run it with psql. Otherwise print the SQL, tell me to paste it into the Supabase SQL Editor and click Run, and wait for my OK.
5. Run `npm run seed`. It should print ✓ for ELE-01, ELE-02, MSC-01, DEC-01, FES-01 and settings.
6. Create a private GitHub repo named `wheres-what` and push (gh CLI if available; otherwise walk me through it). Make sure `.env.local` is NOT committed.
7. Deploy to Vercel: `npx vercel link`, then add every variable from `.env.local` to Production with `npx vercel env add` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FAMILY_PIN, SESSION_SECRET, ANTHROPIC_API_KEY if given, ANTHROPIC_MODEL), then `npx vercel --prod`. Connect the GitHub repo so future pushes auto-deploy. Use the project name `wheres-what` so the address is wheres-what.vercel.app, or the closest free name.
8. Verify on the live URL:
   - `/` loads and shows the PIN screen; a wrong PIN is refused; the right PIN opens the app.
   - `GET /api/boxes` without the cookie returns 401.
   - With a session: the 5 boxes come back with working photo URLs. Searching "hdmi" finds ELE-02. Moving a box adds a history line; move it back afterwards.
   - `/manifest.webmanifest` and `/sw.js` load, and the app is installable (Chrome Lighthouse PWA check or DevTools → Application).
   - `POST /api/suggest` with `{"paths":["seed/ele02-inside.jpg"]}` returns an item list. If Anthropic rejects the key, tell me in one line and carry on; everything else must still work.
9. Finish by giving me the live URL, the PIN reminder, and these phone steps for Akanksha, Kalpak and Rupak:
   - Android (Chrome): open the URL → ⋮ → Add to Home screen / Install app.
   - iPhone (Safari): open the URL → Share → Add to Home Screen.
   - Open the app, enter the PIN, then tap your name.

Rules: never print or commit secrets. If anything fails, fix the root cause and tell me in one line what you changed.
