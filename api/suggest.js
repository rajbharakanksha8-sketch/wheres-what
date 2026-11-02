import { sb, guard, fail, PHOTO_RE, BUCKET } from "./_lib.js";

const PROMPT =
  'These photos show a storage box in an Indian home and what is inside it. List the distinct item TYPES you can see, ' +
  'named the way a family member would search for them later (for example "HDMI cables", "Phone chargers", "Brass diyas", "Bike jacket"). ' +
  "Use plurals for groups. Mention a brand only when it is clearly printed and helps identify the item. " +
  "Skip the box itself, packaging, plastic bags and paper wrapping. At most 15 items. " +
  'Reply with only a JSON array of short strings, e.g. ["HDMI cables","LAN cables"].';

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: "Photo listing is off. Add ANTHROPIC_API_KEY in Vercel to turn it on." });
  try {
    const imgs = (Array.isArray(req.body?.images) ? req.body.images : [])
      .filter((d) => typeof d === "string" && d.length < 3_000_000)
      .slice(0, 4);
    for (const p of Array.isArray(req.body?.paths) ? req.body.paths : []) {
      if (imgs.length >= 4) break;
      if (typeof p !== "string" || !PHOTO_RE.test(p)) continue;
      const { data } = await sb.storage.from(BUCKET).download(p);
      if (data) imgs.push(Buffer.from(await data.arrayBuffer()).toString("base64"));
    }
    if (!imgs.length) return res.status(400).json({ error: "Add a photo of the inside first." });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              ...imgs.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } })),
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!r.ok) {
      console.error("Anthropic", r.status, await r.text());
      return res.status(502).json({ error: r.status === 429 ? "Too many requests. Try again in a minute." : "Couldn't read the photos this time." });
    }
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = text.match(/\[[\s\S]*\]/);
    let items = [];
    try { items = JSON.parse(m ? m[0] : "[]"); } catch { items = []; }
    items = (Array.isArray(items) ? items : []).map((s) => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 15);
    res.json({ items });
  } catch (e) {
    fail(res, e);
  }
}
