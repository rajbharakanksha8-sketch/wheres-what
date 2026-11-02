const CATS = { ELE: "Electronics & cables", KIT: "Kitchen", CLO: "Clothes & linen", DOC: "Documents", TLS: "Tools & hardware", FES: "Festival", DEC: "Home decor", BKS: "Books & stationery", MSC: "Misc" };
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19.5 9l-5.7 1.6L12 16l-1.8-5.4L4.5 9l5.7-1.4zM19 15l.9 2.4 2.1.6-2.1.7L19 21l-.9-2.3-2.1-.7 2.1-.6z"/></svg>';

const S = { boxes: [], cfg: { locations: [], members: [] }, q: "", loc: "", cat: "", person: "", loaded: false, offline: false, ai: false, sheet: null };
const $ = (s) => document.querySelector(s);
function h(tag, p, ...kids) {
  const el = document.createElement(tag); let val;
  for (const [k, v] of Object.entries(p || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v; else if (k === "text") el.textContent = v; else if (k === "html") el.innerHTML = v;
    else if (k === "value") val = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  if (val !== undefined) el.value = val; return el;
}
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const who = () => $("#who").value || ls.get("ww-who") || "";
const canWrite = () => !S.offline;
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };
const toks = () => S.q.toLowerCase().split(/\s+/).filter(Boolean).map((t) => (t.length > 3 ? t.replace(/s$/, "") : t));
const hay = (b) => [b.code, b.name, b.location, CATS[b.cat] || "", b.notes || "", ...(b.items || []).map((i) => i.name + " " + (i.owner || ""))].join(" ").toLowerCase();
function allPlaces() { const set = new Set(S.cfg.locations); S.boxes.forEach((b) => b.location && set.add(b.location)); return [...set]; }
function filtered() {
  const t = toks();
  return S.boxes.filter((b) => (!S.loc || b.location === S.loc) && (!S.cat || b.cat === S.cat) && (!S.person || (b.items || []).some((i) => i.owner === S.person)) && t.every((x) => hay(b).includes(x)))
    .sort((a, b) => a.code.localeCompare(b.code));
}
function itemHits(b) { const t = toks(); if (!t.length) return []; return (b.items || []).filter((i) => t.some((x) => (i.name + " " + (i.owner || "")).toLowerCase().includes(x))); }
function setStatus(msg) { const el = $("#status"); el.textContent = msg; el.hidden = !msg; }
const photoList = (b) => (b.photoUrls || []).filter((p) => p.url);

/* ---------- server ---------- */
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, { method: opts.method || "GET", credentials: "same-origin", headers: opts.body ? { "Content-Type": "application/json" } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch { throw { code: "offline", message: "No connection. Try again when you're back online." }; }
  let j = null; try { j = await r.json(); } catch {}
  if (r.status === 401 && path !== "/api/login") { showLogin(); throw { code: "auth", message: "Enter the family PIN again." }; }
  if (!r.ok) throw { code: "http", status: r.status, message: (j && j.error) || "Something went wrong. Try again." };
  return j;
}
let loading = false;
async function load() {
  if (loading) return; loading = true;
  try {
    const j = await api("/api/boxes");
    S.boxes = j.boxes; S.cfg = j.settings; S.ai = j.ai; S.loaded = true; S.offline = false; setStatus("");
    ls.set("ww-cache", JSON.stringify({ boxes: j.boxes.map((b) => ({ ...b, photoUrls: [] })), settings: j.settings, at: Date.now() }));
    renderWho(); render(); routeHash(); askWho();
  } catch (e) {
    if (e.code === "auth") return;
    const c = JSON.parse(ls.get("ww-cache") || "null");
    S.loaded = true;
    if (c) { S.boxes = c.boxes; S.cfg = c.settings; S.offline = true; setStatus(`Offline. Showing the list from ${fmtDate(new Date(c.at).toISOString())}. Moving and editing need a connection.`); renderWho(); }
    else setStatus(e.message || "Couldn't load the boxes. Check your connection.");
    render();
  } finally { loading = false; }
}

/* ---------- login / who ---------- */
function showLogin() { $("#login").hidden = false; setTimeout(() => $("#pin").focus(), 50); }
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Checking…"; $("#loginErr").textContent = "";
  try { await api("/api/login", { method: "POST", body: { pin: $("#pin").value } }); $("#login").hidden = true; $("#pin").value = ""; await load(); }
  catch (err) { $("#loginErr").textContent = err.message; $("#pin").select(); }
  finally { btn.disabled = false; btn.textContent = "Open"; }
});
function askWho() {
  if (S.cfg.members.includes(ls.get("ww-who"))) return;
  if (!S.cfg.members.length) return;
  $("#whoGrid").replaceChildren(...S.cfg.members.map((m) => h("button", { class: "btn", onclick: () => { ls.set("ww-who", m); renderWho(); $("#whoGate").hidden = true; } }, m)));
  $("#whoGate").hidden = false;
}
function renderWho() {
  const sel = $("#who"), cur = ls.get("ww-who");
  sel.replaceChildren(...S.cfg.members.map((m) => h("option", { value: m, text: m })));
  if (S.cfg.members.includes(cur)) sel.value = cur;
}

/* ---------- main view ---------- */
function chip(label, count, pressed, on, cls) { return h("button", { class: "chip" + (cls ? " " + cls : ""), "aria-pressed": pressed ? "true" : "false", onclick: on }, label, count != null ? h("b", { text: count }) : null); }
function render() {
  const places = allPlaces();
  $("#placeChips").replaceChildren(chip("All places", S.boxes.length, !S.loc, () => { S.loc = ""; render(); }),
    ...places.map((p) => chip(p, S.boxes.filter((b) => b.location === p).length, S.loc === p, () => { S.loc = S.loc === p ? "" : p; render(); })));
  const cats = [...new Set(S.boxes.map((b) => b.cat))].filter(Boolean).sort();
  const people = [...new Set(S.boxes.flatMap((b) => (b.items || []).map((i) => i.owner)).filter(Boolean))].sort();
  $("#typeChips").replaceChildren(...cats.map((c) => chip(CATS[c] || c, null, S.cat === c, () => { S.cat = S.cat === c ? "" : c; render(); })),
    ...people.map((p) => chip(p, null, S.person === p, () => { S.person = S.person === p ? "" : p; render(); }, "person")));
  $("#typeChips").hidden = !cats.length && !people.length;
  const grid = $("#grid"), list = filtered();
  if (!S.loaded && !S.boxes.length) { grid.replaceChildren(...[0, 1, 2, 3].map(() => h("div", { class: "skel", "aria-hidden": "true" }))); $("#summary").textContent = "Opening boxes…"; }
  else if (!S.boxes.length) { grid.replaceChildren(h("div", { class: "empty" }, h("strong", { text: "No boxes yet" }), "Tap Add box, take a photo of the box and what's inside, and say where it's kept.")); $("#summary").textContent = ""; }
  else if (!list.length) { grid.replaceChildren(h("div", { class: "empty" }, h("strong", { text: S.q ? `Nothing matches "${S.q}"` : "No boxes here" }), 'Try a broader word like "cable" or clear the filters.')); $("#summary").textContent = ""; }
  else {
    grid.replaceChildren(...list.map(card));
    const n = places.filter((p) => S.boxes.some((b) => b.location === p)).length;
    $("#summary").textContent = list.length === S.boxes.length ? `${S.boxes.length} box${S.boxes.length > 1 ? "es" : ""} in ${n} place${n > 1 ? "s" : ""}` : `${list.length} of ${S.boxes.length} boxes`;
  }
  $("#fab").hidden = !canWrite() || !S.loaded;
  $("#qclear").hidden = !S.q;
  if (S.sheet && S.sheet.mode === "view") renderView(S.sheet.code);
}
function card(b) {
  const hits = itemHits(b), items = (b.items || []).map((i) => i.name), ph = photoList(b);
  const shown = items.slice(0, 4).join(", ") + (items.length > 4 ? ` +${items.length - 4} more` : "");
  return h("button", { class: "card", onclick: () => openView(b.code), "aria-label": `${b.code} ${b.name}, in ${b.location}` },
    h("div", { class: "ph" }, ph.length ? h("img", { src: ph[0].url, alt: "", loading: "lazy", onerror: (e) => e.target.remove() }) : null, h("div", { class: "nophoto", text: ph.length ? "" : b.code })),
    h("div", { class: "cbody" }, h("span", { class: "tape", text: b.code }), h("h3", { text: b.name || CATS[b.cat] || "Box" }),
      h("div", { class: "loc", html: PIN }, b.location || "Unplaced"),
      hits.length ? h("p", { class: "hit" }, "Found: " + hits.map((i) => i.name).join(", ")) : h("p", { class: "items", text: shown || "No items listed" })));
}

/* ---------- sheet ---------- */
function openSheet(state) { S.sheet = state; $("#sheet").hidden = false; document.body.style.overflow = "hidden"; }
function closeSheet() { S.sheet = null; $("#sheet").hidden = true; document.body.style.overflow = ""; if (location.hash) history.replaceState(null, "", location.pathname + location.search); }
function bar(title, onBack, right) { return h("div", { class: "sbar" }, h("button", { class: "back", html: BACK, onclick: onBack }, "Back"), h("h2", { text: title }), right || null); }
function openView(code) { openSheet({ mode: "view", code }); if (location.hash !== "#" + code) location.hash = code; renderView(code); $("#sheet").scrollTop = 0; }
function renderView(code) {
  const b = S.boxes.find((x) => x.code === code), root = $("#sheetIn");
  if (!b) { root.replaceChildren(bar("", closeSheet), h("div", { class: "empty" }, h("strong", { text: `No box called ${code}` }), "It may have been deleted.")); return; }
  const items = b.items || [], hist = [...(b.history || [])].reverse(), ph = photoList(b);
  const moveWrap = h("div");
  root.replaceChildren(
    bar("", closeSheet, canWrite() ? h("button", { class: "btn", onclick: () => openEdit(b) }, "Edit") : null),
    ph.length ? h("div", { class: "strip" }, ph.map((p) => h("img", { src: p.url, alt: "Photo of " + b.code, onclick: () => lightbox(p.url) }))) : null,
    h("div", { class: "dhead" }, h("span", { class: "tape", text: b.code }), h("span", { class: "cat", text: CATS[b.cat] || "" }), h("h2", { text: b.name || "Box" })),
    h("div", { class: "section" }, h("h4", { text: "Kept at" }),
      h("div", { class: "place" }, h("div", { class: "big", html: PIN }, b.location || "Unplaced"),
        canWrite() ? h("button", { class: "btn primary", onclick: () => showMove(moveWrap, b) }, "Move box") : null), moveWrap),
    h("div", { class: "section" }, h("h4", { text: `Inside · ${items.length} item${items.length === 1 ? "" : "s"}` }),
      items.length ? h("ul", { class: "ilist" }, items.map((i) => h("li", {}, h("span", { text: i.name }), i.owner ? h("span", { class: "owner", text: "@" + i.owner }) : null))) : h("p", { class: "hint", text: "Nothing listed yet." })),
    b.notes ? h("div", { class: "section" }, h("h4", { text: "Notes" }), h("p", { style: "margin:0;white-space:pre-wrap", text: b.notes })) : null,
    hist.length ? h("div", { class: "section" }, h("h4", { text: "History" }), h("ul", { class: "hist" }, hist.map((e) => h("li", {},
      h("div", { text: e.from ? `Moved from ${e.from} to ${e.to}` : `Put in ${e.to}` }), h("div", { class: "when", text: [e.by, fmtDate(e.at)].filter(Boolean).join(" · ") }))))) : null,
    canWrite() ? h("div", { class: "row", style: "margin-top:8px" }, delBtn(b)) : null);
}
function showMove(wrap, b) {
  const places = allPlaces().filter((p) => p !== b.location);
  const sel = h("select", { id: "moveTo", "aria-label": "Move to" }, places.map((p) => h("option", { value: p, text: p })), h("option", { value: "__new", text: "New place…" }));
  const nw = h("input", { id: "moveNew", placeholder: "e.g. Bedroom wardrobe top", hidden: true });
  const err = h("div", { class: "err" });
  sel.addEventListener("change", () => { nw.hidden = sel.value !== "__new"; if (!nw.hidden) nw.focus(); });
  if (!places.length) { sel.value = "__new"; nw.hidden = false; }
  const go = h("button", { class: "btn primary", onclick: async () => {
    const to = (sel.value === "__new" ? nw.value : sel.value).trim(); if (!to) { err.textContent = "Type the new place."; return; }
    go.disabled = true; go.textContent = "Moving…";
    try { await api("/api/move", { method: "POST", body: { code: b.code, to, by: who() } }); await load(); }
    catch (e) { go.disabled = false; go.textContent = "Move here"; err.textContent = e.message; }
  } }, "Move here");
  wrap.replaceChildren(h("div", { class: "moveform" }, h("label", { class: "flabel", for: "moveTo", text: "Move to" }), sel, nw, h("div", { class: "row" }, go, h("button", { class: "btn", onclick: () => wrap.replaceChildren() }, "Cancel")), err));
}
function delBtn(b) {
  let armed = false, t;
  const btn = h("button", { class: "btn danger", onclick: async () => {
    if (!armed) { armed = true; btn.classList.add("armed"); btn.textContent = "Tap again to delete"; t = setTimeout(() => { armed = false; btn.classList.remove("armed"); btn.textContent = "Delete box"; }, 4000); return; }
    clearTimeout(t); btn.disabled = true; btn.textContent = "Deleting…";
    try { await api("/api/boxes?code=" + encodeURIComponent(b.code), { method: "DELETE" }); closeSheet(); await load(); }
    catch (e) { btn.disabled = false; btn.textContent = "Delete box"; note(btn, e.message); }
  } }, "Delete box");
  return btn;
}
function note(el, msg) { const n = h("div", { class: "err", text: msg }); el.after(n); setTimeout(() => n.remove(), 5000); }
function lightbox(src) { $("#lbimg").src = src; $("#lightbox").hidden = false; }
$("#lightbox").addEventListener("click", () => { $("#lightbox").hidden = true; });

/* ---------- edit ---------- */
function nextCode(cat) { let n = 0; S.boxes.forEach((b) => { const m = b.code.match(/^([A-Z]{3})-(\d+)$/); if (m && m[1] === cat) n = Math.max(n, +m[2]); }); return cat + "-" + String(n + 1).padStart(2, "0"); }
function openEdit(b) {
  const isNew = !b;
  const d = { isNew, photos: b ? photoList(b).map((p) => ({ path: p.path, url: p.url })) : [], pending: [], removed: [], orig: b };
  openSheet({ mode: "edit" }); $("#sheet").scrollTop = 0;
  const catSel = h("select", { id: "fCat", disabled: !isNew }, Object.entries(CATS).map(([k, v]) => h("option", { value: k, text: `${k} · ${v}` }))); catSel.value = b ? b.cat : "MSC";
  const code = h("input", { id: "fCode", value: b ? b.code : nextCode(catSel.value), disabled: !isNew, autocapitalize: "characters" });
  catSel.addEventListener("change", () => { code.value = nextCode(catSel.value); });
  const name = h("input", { id: "fName", value: b ? b.name : "", placeholder: "e.g. Airtel box, Diwali lights" });
  const places = allPlaces();
  const locSel = h("select", { id: "fLoc" }, places.map((p) => h("option", { value: p, text: p })), h("option", { value: "__new", text: "New place…" }));
  locSel.value = b && b.location ? b.location : places.includes("Unplaced") ? "Unplaced" : places[0] || "__new";
  const locNew = h("input", { id: "fLocNew", placeholder: "e.g. Loft above kitchen", hidden: locSel.value !== "__new" });
  locSel.addEventListener("change", () => { locNew.hidden = locSel.value !== "__new"; if (!locNew.hidden) locNew.focus(); });
  const thumbs = h("div", { class: "thumbs" });
  const file = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, id: "fFile" });
  file.addEventListener("change", async () => {
    for (const f of file.files) { try { const blob = await shrink(f); d.pending.push({ blob, url: URL.createObjectURL(blob) }); } catch { note(thumbs, "Couldn't read one photo. Try a JPEG or PNG."); } }
    file.value = ""; drawThumbs();
  });
  function drawThumbs() {
    thumbs.replaceChildren(
      ...d.photos.map((p) => h("div", { class: "thumb" }, h("img", { src: p.url, alt: "" }), h("button", { "aria-label": "Remove photo", onclick: () => { d.photos = d.photos.filter((x) => x !== p); d.removed.push(p.path); drawThumbs(); } }, "×"))),
      ...d.pending.map((p) => h("div", { class: "thumb" }, h("img", { src: p.url, alt: "" }), h("button", { "aria-label": "Remove photo", onclick: () => { d.pending = d.pending.filter((x) => x !== p); drawThumbs(); } }, "×"))),
      h("label", { class: "addphoto", for: "fFile", html: CAM + "Add photo" }));
  }
  drawThumbs();
  const dl = h("datalist", { id: "members" }, S.cfg.members.map((m) => h("option", { value: m })));
  const rows = h("div");
  const addRow = (it = {}) => {
    const r = h("div", { class: "irow" }, h("input", { class: "iname", value: it.name || "", placeholder: "Item, e.g. HDMI cables", "aria-label": "Item" }),
      h("input", { class: "iown", value: it.owner || "", placeholder: "Whose?", list: "members", "aria-label": "Belongs to" }),
      h("button", { "aria-label": "Remove item", onclick: () => r.remove() }, "×"));
    rows.append(r); return r;
  };
  (b && b.items && b.items.length ? b.items : [{}]).forEach(addRow);
  const aiMsg = h("span", { class: "hint" });
  const aiBtn = S.ai ? h("button", { class: "btn", html: SPARK, onclick: () => suggest(d, rows, addRow, aiBtn, aiMsg) }, "List items from photos") : null;
  const notes = h("textarea", { id: "fNotes", rows: 2, value: b ? b.notes || "" : "", placeholder: "Anything else, e.g. soundbar's cable is in ELE-02" });
  const err = h("div", { class: "err" }), save = h("button", { class: "btn primary" }, isNew ? "Save box" : "Save changes");
  save.addEventListener("click", () => saveDraft(d, { catSel, code, name, locSel, locNew, rows, notes }, save, err));
  $("#sheetIn").replaceChildren(
    bar(isNew ? "New box" : "Edit " + b.code, () => (b ? openView(b.code) : closeSheet())),
    h("div", { class: "two" }, h("div", { class: "field" }, h("label", { for: "fCat", text: "Type" }), catSel), h("div", { class: "field" }, h("label", { for: "fCode", text: "Code on the box" }), code)),
    h("div", { class: "field" }, h("label", { for: "fName", text: "Name" }), name),
    h("div", { class: "field" }, h("label", { for: "fLoc", text: "Kept at" }), locSel, locNew),
    h("div", { class: "field" }, h("span", { class: "flabel", text: "Photos" }), h("span", { class: "hint", text: "One of the box with its code, one of the inside." }), thumbs, file),
    h("div", { class: "field" }, h("span", { class: "flabel", text: "What's inside" }), aiBtn ? h("div", { class: "ai" }, aiBtn, aiMsg) : null, rows, dl,
      h("button", { class: "btn", style: "justify-self:start", onclick: () => addRow().querySelector("input").focus() }, "+ Add item")),
    h("div", { class: "field" }, h("label", { for: "fNotes", text: "Notes" }), notes),
    h("div", { class: "savebar" }, save, h("button", { class: "btn", onclick: () => (b ? openView(b.code) : closeSheet()) }, "Cancel")), err);
}
async function shrink(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const w = bmp.width, hh = bmp.height, k = Math.min(1, 1600 / Math.max(w, hh));
  const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(hh * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error("encode"))), "image/jpeg", 0.85));
}
const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
async function suggest(d, rows, addRow, btn, msg) {
  const images = [];
  for (const p of d.pending.slice(0, 4)) images.push(await toB64(p.blob));
  const paths = d.photos.map((p) => p.path).slice(0, 4 - images.length);
  if (!images.length && !paths.length) { msg.textContent = "Add a photo of the inside first."; return; }
  btn.disabled = true; msg.textContent = "Looking at the photos…";
  try {
    const { items } = await api("/api/suggest", { method: "POST", body: { images, paths } });
    const have = new Set([...rows.querySelectorAll(".iname")].map((i) => i.value.trim().toLowerCase()).filter(Boolean));
    [...rows.querySelectorAll(".irow")].forEach((r) => { if (!r.querySelector(".iname").value.trim() && !r.querySelector(".iown").value.trim()) r.remove(); });
    let added = 0;
    for (const s of items || []) { const n = String(s).trim(); if (n && !have.has(n.toLowerCase())) { addRow({ name: n }); have.add(n.toLowerCase()); added++; } }
    msg.textContent = added ? `Added ${added}. Remove anything that's wrong.` : "Nothing new spotted.";
  } catch (e) { msg.textContent = e.message; }
  finally { btn.disabled = false; }
}
async function saveDraft(d, f, btn, err) {
  err.textContent = "";
  const code = f.code.value.trim().toUpperCase();
  if (!/^[A-Z]{3}-\d{2,3}$/.test(code)) { err.textContent = "Code should look like ELE-03: three letters, a dash, a number."; return; }
  if (d.isNew && S.boxes.some((b) => b.code === code)) { err.textContent = `${code} already exists. Use ${nextCode(code.slice(0, 3))} instead.`; return; }
  const loc = (f.locSel.value === "__new" ? f.locNew.value : f.locSel.value).trim();
  if (!loc) { err.textContent = "Say where the box is kept."; return; }
  const items = [...f.rows.querySelectorAll(".irow")].map((r) => ({ name: r.querySelector(".iname").value.trim(), owner: r.querySelector(".iown").value.trim() })).filter((i) => i.name);
  btn.disabled = true;
  try {
    const photos = d.photos.map((p) => p.path);
    for (let i = 0; i < d.pending.length; i++) {
      btn.textContent = `Uploading photo ${i + 1} of ${d.pending.length}…`;
      const r = await api("/api/upload", { method: "POST", body: { data: await toB64(d.pending[i].blob) } });
      photos.push(r.path);
      d.photos.push({ path: r.path, url: r.url }); d.pending[i].done = true;
    }
    d.pending = d.pending.filter((p) => !p.done);
    btn.textContent = "Saving…";
    await api("/api/boxes", { method: "POST", body: { isNew: d.isNew, by: who(), removedPhotos: d.removed,
      box: { code, cat: f.catSel.value, name: f.name.value.trim() || CATS[f.catSel.value], location: loc, items, notes: f.notes.value.trim(), photos } } });
    await load(); openView(code);
  } catch (e) { btn.disabled = false; btn.textContent = d.isNew ? "Save box" : "Save changes"; err.textContent = e.message; }
}

/* ---------- settings ---------- */
function openSettings() { openSheet({ mode: "settings" }); $("#sheet").scrollTop = 0; renderSettings(); }
async function saveCfg(c) { const j = await api("/api/settings", { method: "PUT", body: c }); S.cfg = j.settings; renderWho(); render(); renderSettings(); }
function renderSettings() {
  const err = h("div", { class: "err" });
  const listFor = (key, label, inUse) => {
    const inp = h("input", { id: "add-" + key, placeholder: key === "locations" ? "e.g. Bedroom loft" : "Name" });
    const add = async () => { const v = inp.value.trim(); if (!v || S.cfg[key].includes(v)) return; try { await saveCfg({ ...S.cfg, [key]: [...S.cfg[key], v] }); } catch (e) { err.textContent = e.message; } };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    return h("div", { class: "section" }, h("h4", { text: label }),
      h("ul", { class: "slist" }, S.cfg[key].map((v) => h("li", {}, h("span", { text: v }), canWrite() ? h("button", { onclick: async () => {
        const n = inUse(v);
        if (n) { err.textContent = key === "locations" ? `${n} box${n > 1 ? "es are" : " is"} in ${v}. Move ${n > 1 ? "them" : "it"} first.` : `${v} owns ${n} item${n > 1 ? "s" : ""}. Change those first.`; return; }
        try { await saveCfg({ ...S.cfg, [key]: S.cfg[key].filter((x) => x !== v) }); } catch (e) { err.textContent = e.message; }
      } }, "Remove") : null))),
      canWrite() ? h("div", { class: "addrow" }, inp, h("button", { class: "btn", onclick: add }, "Add")) : null);
  };
  $("#sheetIn").replaceChildren(bar("Places and people", closeSheet),
    listFor("locations", "Places in the house", (v) => S.boxes.filter((b) => b.location === v).length),
    listFor("members", "Family members", (v) => S.boxes.reduce((n, b) => n + (b.items || []).filter((i) => i.owner === v).length, 0)),
    err,
    h("div", { class: "section" }, h("h4", { text: "This phone" }),
      h("button", { class: "btn danger", onclick: async () => { try { await api("/api/logout", { method: "POST" }); } catch {} closeSheet(); showLogin(); } }, "Lock this phone")));
}

/* ---------- wiring ---------- */
$("#q").addEventListener("input", (e) => { S.q = e.target.value.trim(); render(); });
$("#qclear").addEventListener("click", () => { $("#q").value = ""; S.q = ""; render(); $("#q").focus(); });
$("#who").addEventListener("change", (e) => ls.set("ww-who", e.target.value));
$("#settingsBtn").addEventListener("click", openSettings);
$("#fab").addEventListener("click", () => openEdit(null));
function routeHash() {
  const c = decodeURIComponent(location.hash.slice(1));
  if (c && S.boxes.some((b) => b.code === c) && !(S.sheet && S.sheet.mode === "edit")) { if (!S.sheet || S.sheet.code !== c) openView(c); }
  else if (!c && S.sheet && S.sheet.mode === "view") closeSheet();
}
window.addEventListener("hashchange", routeHash);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#lightbox").hidden) $("#lightbox").hidden = true; else if (S.sheet && S.sheet.mode !== "edit") closeSheet(); } });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !(S.sheet && S.sheet.mode === "edit") && !document.querySelector(".moveform")) load(); });
setInterval(() => { if (document.visibilityState === "visible" && !(S.sheet && S.sheet.mode === "edit") && !document.querySelector(".moveform")) load(); }, 30000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
render(); load();
