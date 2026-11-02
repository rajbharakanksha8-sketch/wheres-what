import { sb, guard, fail } from "./_lib.js";

const clean = (a) => [...new Set((Array.isArray(a) ? a : []).map((s) => (typeof s === "string" ? s.trim().slice(0, 60) : "")).filter(Boolean))].slice(0, 50);

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "PUT") return res.status(405).json({ error: "Use PUT" });
  try {
    const locations = clean(req.body?.locations);
    const members = clean(req.body?.members);
    const { error } = await sb.from("settings").upsert({ id: 1, locations, members });
    if (error) throw error;
    res.json({ ok: true, settings: { locations, members } });
  } catch (e) {
    fail(res, e);
  }
}
