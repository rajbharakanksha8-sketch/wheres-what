import { clearSessionCookie } from "./_lib.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  clearSessionCookie(res);
  res.json({ ok: true });
}
