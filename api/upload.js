import crypto from "node:crypto";
import { sb, guard, fail, BUCKET } from "./_lib.js";

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const b64 = typeof req.body?.data === "string" ? req.body.data : "";
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: "Photo must be a JPEG." });
    if (buf.length > 3.5 * 1024 * 1024) return res.status(413).json({ error: "Photo is too large." });
    const path = `p/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg" });
    if (error) throw error;
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
    res.json({ path, url: data?.signedUrl || null });
  } catch (e) {
    fail(res, e);
  }
}
