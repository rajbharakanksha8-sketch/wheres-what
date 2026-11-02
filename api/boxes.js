import { sb, guard, getSettings, ensurePlace, signPhotos, str, fail, CATS, CODE_RE, PHOTO_RE, BUCKET } from "./_lib.js";

const COLS = "code, cat, name, location, items, notes, photos, history, updated_at, updated_by";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  try {
    if (req.method === "GET") return await list(res);
    if (req.method === "POST") return await save(req, res);
    if (req.method === "DELETE") return await remove(req, res);
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    fail(res, e);
  }
}

async function list(res) {
  const { data, error } = await sb.from("boxes").select(COLS).order("code");
  if (error) throw error;
  const boxes = await signPhotos(data || []);
  res.json({ boxes, settings: await getSettings(), ai: Boolean(process.env.ANTHROPIC_API_KEY) });
}

async function save(req, res) {
  const { box = {}, isNew = false, removedPhotos = [] } = req.body || {};
  const by = str(req.body?.by, 40);
  const code = str(box.code, 10).toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: "Code should look like ELE-03." });
  const location = str(box.location, 80);
  if (!location) return res.status(400).json({ error: "Say where the box is kept." });
  const items = (Array.isArray(box.items) ? box.items : [])
    .slice(0, 100)
    .map((i) => ({ name: str(i?.name, 120), owner: str(i?.owner, 40) }))
    .filter((i) => i.name)
    .map((i) => (i.owner ? i : { name: i.name }));
  const photos = (Array.isArray(box.photos) ? box.photos : []).filter((p) => typeof p === "string" && PHOTO_RE.test(p)).slice(0, 20);

  const { data: existing, error: e1 } = await sb.from("boxes").select("*").eq("code", code).maybeSingle();
  if (e1) throw e1;
  if (isNew && existing) return res.status(409).json({ error: `${code} already exists.` });
  if (!isNew && !existing) return res.status(404).json({ error: `${code} was deleted by someone else.` });

  const cat = existing ? existing.cat : CATS.includes(box.cat) ? box.cat : code.slice(0, 3);
  const now = new Date().toISOString();
  const history = existing ? [...(existing.history || [])] : [{ to: location, at: now, by }];
  if (existing && existing.location !== location) history.push({ from: existing.location, to: location, at: now, by });

  const row = {
    code, cat,
    name: str(box.name, 120) || code,
    location, items,
    notes: str(box.notes, 2000),
    photos, history,
    created_at: existing ? existing.created_at : now,
    updated_at: now,
    updated_by: by,
  };
  const { error: e2 } = await sb.from("boxes").upsert(row);
  if (e2) throw e2;
  await ensurePlace(location);

  const drop = (Array.isArray(removedPhotos) ? removedPhotos : []).filter((p) => PHOTO_RE.test(p) && !photos.includes(p));
  if (drop.length) await sb.storage.from(BUCKET).remove(drop);
  res.json({ ok: true });
}

async function remove(req, res) {
  const code = str(req.query?.code, 10).toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: "Bad code" });
  const { data: existing } = await sb.from("boxes").select("photos").eq("code", code).maybeSingle();
  const { error } = await sb.from("boxes").delete().eq("code", code);
  if (error) throw error;
  if (existing?.photos?.length) await sb.storage.from(BUCKET).remove(existing.photos);
  res.json({ ok: true });
}
