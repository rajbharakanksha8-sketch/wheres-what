// Loads the 5 starting boxes and their photos into Supabase. Safe to run more than once.
// Run: node --env-file=.env.local seed/seed.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const data = JSON.parse(fs.readFileSync(path.join(dir, "data.json"), "utf8"));

const { error: be } = await sb.storage.createBucket("photos", { public: false });
if (be && !/already exists/i.test(be.message)) throw be;

for (const b of data.boxes) {
  const photos = [];
  for (const f of b.photoFiles) {
    const p = `seed/${f}`;
    const { error } = await sb.storage.from("photos").upload(p, fs.readFileSync(path.join(dir, "photos", f)), { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    photos.push(p);
  }
  const at = b.history[0].at;
  const { error } = await sb.from("boxes").upsert({
    code: b.code, cat: b.cat, name: b.name, location: b.location, items: b.items, notes: b.notes,
    photos, history: b.history, created_at: at, updated_at: at, updated_by: "Akanksha",
  });
  if (error) throw error;
  console.log(`✓ ${b.code}  ${photos.length} photos`);
}

const { error: se } = await sb.from("settings").upsert({ id: 1, ...data.settings });
if (se) throw se;
console.log("✓ settings (places + family members)");
console.log("Done.");
