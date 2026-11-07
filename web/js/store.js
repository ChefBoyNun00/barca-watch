// Library: everything personal (liked, watch later, history, resume points, settings).
// Saved in this browser's localStorage under one versioned key. Export/import moves it between devices.
import { STORAGE_KEY, STORAGE_VERSION, WATCHED_CAP, PROGRESS_CAP, DEFAULT_SETTINGS } from "./config.js";

function blank() {
  return { v: STORAGE_VERSION, liked: {}, later: {}, watched: {}, progress: {}, settings: { ...DEFAULT_SETTINGS } };
}

// Every stored shape goes through here, so an old or partial save can never break the page.
export function migrate(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const s = d.settings || {};
  return {
    v: STORAGE_VERSION,
    liked: { ...(d.liked || {}) }, later: { ...(d.later || {}) },
    watched: { ...(d.watched || {}) }, progress: { ...(d.progress || {}) },
    settings: { ...DEFAULT_SETTINGS, ...s, langs: { ...DEFAULT_SETTINGS.langs, ...(s.langs || {}) }, muted: { ...(s.muted || {}) } },
  };
}

function read() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? migrate(JSON.parse(raw)) : blank(); }
  catch (e) { return blank(); }
}
let persistOk = true;
function write(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); persistOk = true; }
  catch (e) { persistOk = false; }  // private mode or full storage: keep working in memory
}

function prune(map, cap) {
  const ids = Object.keys(map);
  if (ids.length <= cap) return map;
  const keep = ids.sort((a, b) => map[b].ts - map[a].ts).slice(0, cap);
  return Object.fromEntries(keep.map(id => [id, map[id]]));
}

const snap = v => ({ ts: Date.now(), t: v.t, c: v.c, len: v.len, p: v.p, views: v.views });

export const Library = {
  state: read(),
  listeners: new Set(),
  get persisted() { return persistOk; },
  on(fn) { this.listeners.add(fn); },
  commit(next, why) { this.state = next; write(next); this.listeners.forEach(f => f(why)); },

  has(list, id) { return !!this.state[list][id]; },
  entry(list, id) { return this.state[list][id]; },
  ids(list) { return Object.entries(this.state[list]).sort((a, b) => b[1].ts - a[1].ts).map(([id]) => id); },
  count(list) { return Object.keys(this.state[list]).length; },
  get settings() { return this.state.settings; },

  toggle(list, v) {
    const map = { ...this.state[list] };
    if (map[v.id]) delete map[v.id]; else map[v.id] = snap(v);
    this.commit({ ...this.state, [list]: map }, "lists");
  },
  setWatched(v, on) {
    if (this.has("watched", v.id) === on) return;
    const map = { ...this.state.watched };
    if (on) map[v.id] = snap(v); else delete map[v.id];
    this.commit({ ...this.state, watched: prune(map, WATCHED_CAP) }, "lists");
  },
  // Resume points are written often while playing, so they skip the listeners (no re-render).
  setProgress(v, seconds, duration) {
    const map = { ...this.state.progress, [v.id]: { ...snap(v), at: Math.floor(seconds), dur: Math.floor(duration || v.len || 0) } };
    this.state = { ...this.state, progress: prune(map, PROGRESS_CAP) };
    write(this.state);
  },
  clearProgress(id) {
    if (!this.state.progress[id]) return;
    const map = { ...this.state.progress }; delete map[id];
    this.state = { ...this.state, progress: map }; write(this.state);
  },
  clear(list) { this.commit({ ...this.state, [list]: {} }, "lists"); },
  setting(key, value) { this.commit({ ...this.state, settings: { ...this.state.settings, [key]: value } }, "settings"); },
  resetSettings() { this.commit({ ...this.state, settings: { ...DEFAULT_SETTINGS } }, "settings"); },

  exportJson() { return JSON.stringify(this.state, null, 1); },
  importJson(text) {
    const incoming = migrate(JSON.parse(text));  // throws on bad JSON; the caller shows the error
    const merge = k => ({ ...this.state[k], ...incoming[k] });
    this.commit({ ...this.state, liked: merge("liked"), later: merge("later"), watched: prune(merge("watched"), WATCHED_CAP),
      progress: prune(merge("progress"), PROGRESS_CAP), settings: incoming.settings }, "settings");
  },
};
