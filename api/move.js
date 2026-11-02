import { sb, guard, ensurePlace, str, fail, CODE_RE } from "./_lib.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const code = str(req.body?.code, 10).toUpperCase();
    const to = str(req.body?.to, 80);
    const by = str(req.body?.by, 40);
    if (!CODE_RE.test(code) || !to) return res.status(400).json({ error: "Pick where the box is going." });
    const { data: box, error } = await sb.from("boxes").select("location, history").eq("code", code).maybeSingle();
    if (error) throw error;
    if (!box) return res.status(404).json({ error: `${code} no longer exists.` });
    if (box.location === to) return res.json({ ok: true });
    const now = new Date().toISOString();
    const history = [...(box.history || []), { from: box.location, to, at: now, by }];
    const { error: e2 } = await sb.from("boxes").update({ location: to, history, updated_at: now, updated_by: by }).eq("code", code);
    if (e2) throw e2;
    await ensurePlace(to);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
}
