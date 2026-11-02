import crypto from "node:crypto";
import { configured, setSessionCookie } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!configured(res)) return;
  const pin = String(req.body?.pin ?? "");
  const real = String(process.env.FAMILY_PIN);
  const ok = pin.length === real.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(real));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
    return res.status(401).json({ error: "Wrong PIN" });
  }
  setSessionCookie(res);
  res.json({ ok: true });
}
