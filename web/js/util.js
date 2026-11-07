// Small, dependency-free helpers. No app state lives here.
import { ICONS } from "./config.js";

export const $ = id => document.getElementById(id);

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}

export function icon(name, cls) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = ICONS[name] || "";
  return s;
}

export const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function fmtViews(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function fmtDur(s) {
  if (!s) return "";
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function fmtAgoMs(ms, approx) {
  const days = ms / 864e5, pre = approx ? "about " : "";
  if (days < 1 / 24) return "just now";
  if (days < 1) { const h = Math.round(days * 24); return `${pre}${h} hour${h === 1 ? "" : "s"} ago`; }
  if (days < 14) { const n = Math.floor(days); return `${pre}${n} day${n === 1 ? "" : "s"} ago`; }
  const w = Math.floor(days / 7); return `${pre}${w} week${w === 1 ? "" : "s"} ago`;
}

export const publishedMs = v => new Date(v.p.length > 10 ? v.p : v.p + "T12:00Z").getTime();
export const fmtAgo = v => fmtAgoMs(Date.now() - publishedMs(v), !v.exact);
export const fmtDate = iso => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function toast(msg, action) {
  const t = el("div", { class: "toast", role: "status" }, el("span", {}, msg),
    action ? el("button", { type: "button", onclick: () => { t.remove(); action.run(); } }, action.label) : null);
  document.body.append(t);
  setTimeout(() => t.remove(), action ? 9000 : 2400);
}

export const ytUrl = (id, t) => "https://www.youtube.com/watch?v=" + encodeURIComponent(id) + (t ? `&t=${Math.floor(t)}s` : "");
export const thumbUrl = id => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
