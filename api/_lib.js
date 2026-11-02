import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const sb = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const CATS = ["ELE", "KIT", "CLO", "DOC", "TLS", "FES", "DEC", "BKS", "MSC"];
export const CODE_RE = /^[A-Z]{3}-\d{2,3}$/;
export const PHOTO_RE = /^(p|seed)\/[\w.-]+\.jpg$/;
export const BUCKET = "photos";

const COOKIE = "ww_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days on each phone

// Signature includes the PIN, so changing FAMILY_PIN in Vercel logs every phone out.
function sign(v) {
  return crypto
    .createHmac("sha256", `${process.env.SESSION_SECRET}:${process.env.FAMILY_PIN}`)
    .update(v)
    .digest("base64url");
}

export function setSessionCookie(res) {
  const v = String(Date.now() + MAX_AGE * 1000);
  res.setHeader("Set-Cookie", `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function authed(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)ww_session=([^;]+)/);
  if (!m) return false;
  const [v, s] = m[1].split(".");
  if (!v || !s) return false;
  const good = sign(v);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return false;
  return Number(v) > Date.now();
}

export function configured(res) {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FAMILY_PIN", "SESSION_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    res.status(500).json({ error: `Server is missing settings: ${missing.join(", ")}` });
    return false;
  }
  return true;
}

export function guard(req, res) {
  if (!configured(res)) return false;
  if (!authed(req)) {
    res.status(401).json({ error: "Enter the family PIN" });
    return false;
  }
  res.setHeader("Cache-Control", "no-store");
  return true;
}

export async function getSettings() {
  const { data, error } = await sb.from("settings").select("locations, members").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { locations: ["Loft", "TV unit", "Unplaced"], members: [] };
}

export async function ensurePlace(loc) {
  const s = await getSettings();
  if (s.locations.includes(loc)) return;
  const { error } = await sb.from("settings").upsert({ id: 1, locations: [...s.locations, loc], members: s.members });
  if (error) throw error;
}

export async function signPhotos(boxes) {
  const paths = [...new Set(boxes.flatMap((b) => b.photos || []))];
  const map = {};
  if (paths.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    if (error) throw error;
    for (const d of data || []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  }
  for (const b of boxes) b.photoUrls = (b.photos || []).map((p) => ({ path: p, url: map[p] || null }));
  return boxes;
}

export function str(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function fail(res, e) {
  console.error(e);
  res.status(500).json({ error: "Server error. Try again." });
}
