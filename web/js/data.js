// The video data: loading data.json, lookup indexes, filters and spoiler rules.
// The pipeline's JSON goes through `normalize` once, so the rest of the app never sees the raw file.
import { DATA_URL, MODES } from "./config.js";
import { Library } from "./store.js";
import { slug, publishedMs } from "./util.js";

export const D = { site: null, videos: [], byId: new Map(), channels: {}, chSlug: new Map(), stories: new Map(), snap: 0 };

function normalize(site) {
  if (!site || !Array.isArray(site.videos) || !site.channels) throw new Error("The video list is in an unexpected format.");
  return site;
}

export async function loadData({ fresh = false } = {}) {
  const res = await fetch(DATA_URL, { cache: fresh ? "no-cache" : "default" });
  if (!res.ok) throw new Error(`Couldn't load the video list (HTTP ${res.status}).`);
  const site = normalize(await res.json());
  D.site = site;
  D.videos = site.videos;
  D.byId = new Map(site.videos.map(v => [v.id, v]));
  D.channels = site.channels;
  D.chSlug = new Map(Object.entries(site.channels).map(([id, c]) => [slug(c.name), id]));
  D.stories = new Map(site.stories.map(s => [s.id, s]));
  D.snap = new Date(site.snapshot).getTime();
  return site;
}

export async function newerSnapshotAvailable() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) return false;
    const site = await res.json();
    return new Date(site.snapshot).getTime() > D.snap;
  } catch (e) { return false; }
}

// ---- sorting ----
export const byNew = (a, b) => b.p.localeCompare(a.p);
export const byViews = (a, b) => b.views - a.views;
export const byRatio = (a, b) => (b.ratio || 0) - (a.ratio || 0);
export const SORT_FN = { new: byNew, views: byViews, ratio: byRatio };
export const ageH = v => (D.snap - publishedMs(v)) / 36e5;

// ---- lookups ----
export const channel = cid => D.channels[cid] || { name: "Unknown channel", typical: 0, lang: "en", group: "english" };
export const chanGroup = c => c.found ? "found" : c.group;
export const chanHref = cid => "#ch-" + slug(channel(cid).name);
export const videoHref = id => "#v-" + id;
export const storyOf = v => (v.story && D.stories.get(v.story)) || null;

// A video that isn't in the current snapshot can still be shown from what the library saved about it.
export function findVideo(id) {
  const v = D.byId.get(id);
  if (v) return v;
  for (const list of ["liked", "later", "watched", "progress"]) {
    const e = Library.entry(list, id);
    if (e) return { id, t: e.t, c: e.c, len: e.len, p: e.p, exact: true, views: e.views || 0, gone: true };
  }
  return null;
}

// ---- filters from settings ----
function lengthOk(v, mode) {
  if (!v.len || mode === "any") return true;
  return mode === "short" ? v.len < 600 : mode === "mid" ? v.len >= 600 && v.len <= 1200 : v.len > 1200;
}
export function passes(v) {
  const s = Library.settings;
  return s.langs[channel(v.c).lang] !== false && !s.muted[v.c] && lengthOk(v, s.length)
    && !(s.hideWatched && Library.has("watched", v.id)) && !(s.hideReplays && v.live);
}

// ---- spoilers ----
const SCORE = /(?<![\d-])(\d{1,2})\s*(?:[-–—:]|\s(?:vs\.?|v)\s)\s*(\d{1,2})(?![\d-])/gi;
const HAS_SCORE = new RegExp(SCORE.source, "i");
export const revealed = new Set();
export const spoilerOn = v => Library.settings.spoilerFree && !Library.has("watched", v.id) && !revealed.has(v.id);
export const showTitle = v => spoilerOn(v) ? v.t.replace(SCORE, "?–?") : v.t;
const isMatchy = v => v.sec === "highlights" || (storyOf(v) || {}).kind === "match" || HAS_SCORE.test(v.t);
export const blurThumb = v => spoilerOn(v) && isMatchy(v);

// ---- modes ----
export const matchStories = () => [...D.stories.values()].filter(s => s.kind === "match").sort((a, b) => b.latest.localeCompare(a.latest));
export function modeVideos(m) {
  if (m.key === "matchday") return matchStories().slice(0, 2).flatMap(s => D.videos.filter(v => v.story === s.id && passes(v)));
  return m.pick(D.videos.filter(passes), { byNew, byRatio, ageH });
}
export const modeByKey = key => MODES.find(m => m.key === key);
