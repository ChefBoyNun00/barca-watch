// The in-app player: YouTube's official IFrame API, wrapped so the rest of the app never touches it.
// One player for the whole visit. On a video page it sits over the page's stage slot; anywhere else
// it shrinks into a corner dock and keeps playing.
import { SPEEDS, WATCHED_AT, RESUME_MIN_SECONDS } from "./config.js";
import { Library } from "./store.js";
import { $ } from "./util.js";

const API_URL = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 12000;
const EMBED_BLOCKED = new Set([101, 150, 153]);   // owner disabled embedding / not playable here

let apiPromise = null;
function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { apiPromise = null; reject(new Error("YouTube's player didn't load. A content blocker may be stopping it.")); }, API_TIMEOUT_MS);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); if (prev) prev(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = API_URL; s.async = true;
    s.onerror = () => { clearTimeout(timer); apiPromise = null; reject(new Error("YouTube's player couldn't be reached.")); };
    document.head.append(s);
  });
  return apiPromise;
}

export const Player = {
  yt: null, ready: false, video: null, state: "idle", error: null,
  queue: [], queueLabel: "", slot: null, slotObserver: null,
  sleep: { mode: 0, endsAt: 0 }, ticker: null, sleepTicker: null,
  listeners: new Set(),

  on(fn) { this.listeners.add(fn); },
  emit() { this.listeners.forEach(f => f(this)); },

  /** Start (or switch to) a video. `queue` is the list it was opened from, for "Up next". */
  async play(v, { queue, label } = {}) {
    if (queue && queue.length) { this.queue = queue; this.queueLabel = label || ""; }
    else if (!this.queue.includes(v.id)) { this.queue = [v.id]; this.queueLabel = ""; }
    const sameVideo = this.video && this.video.id === v.id;
    this.video = v; this.error = null;
    this.showDock();
    this.emit();
    if (sameVideo && this.ready) return;
    const start = this.resumePoint(v);
    try {
      const YT = await loadApi();
      if (!this.yt) {
        this.yt = new YT.Player("yt", {
          host: "https://www.youtube-nocookie.com",
          videoId: v.id,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, start, cc_load_policy: Library.settings.captions ? 1 : 0, iv_load_policy: 3 },
          events: {
            onReady: () => { this.ready = true; this.applySettings(); this.emit(); },
            onStateChange: e => this.onState(e.data),
            onError: e => this.onError(e.data),
          },
        });
      } else if (this.ready) {
        this.yt.loadVideoById({ videoId: v.id, startSeconds: start });
      }
    } catch (err) {
      this.error = { message: err.message, blocked: false };
      this.emit();
    }
  },

  resumePoint(v) {
    if (!Library.settings.resume) return 0;
    const p = Library.entry("progress", v.id);
    if (!p || p.at < RESUME_MIN_SECONDS || (p.dur && p.at > p.dur - 30)) return 0;
    return p.at;
  },

  applySettings() {
    if (!this.ready) return;
    const s = Library.settings;
    if (SPEEDS.includes(s.speed)) this.yt.setPlaybackRate(s.speed);
    try { if (s.captions) this.yt.loadModule("captions"); else this.yt.unloadModule("captions"); } catch (e) { /* not every video has captions */ }
  },

  onState(code) {
    const YTS = window.YT.PlayerState;
    this.state = code === YTS.PLAYING ? "playing" : code === YTS.PAUSED ? "paused" : code === YTS.ENDED ? "ended" : code === YTS.BUFFERING ? "buffering" : this.state;
    if (code === YTS.PLAYING) { this.applySpeedOnly(); this.startTicker(); }
    else this.saveProgress();
    if (code === YTS.ENDED) this.onEnded();
    this.emit();
  },
  applySpeedOnly() { const sp = Library.settings.speed; if (this.ready && this.yt.getPlaybackRate() !== sp) this.yt.setPlaybackRate(sp); },

  onEnded() {
    const v = this.video;
    if (v) { Library.setWatched(v, true); Library.clearProgress(v.id); }
    if (Library.settings.loop) { this.yt.seekTo(0, true); this.yt.playVideo(); return; }
    if (this.sleep.mode === -1) { this.setSleep(0); this.fireSleep(); return; }
    if (Library.settings.autoplayNext) this.next();
  },

  onError(code) {
    this.error = EMBED_BLOCKED.has(code)
      ? { message: "This channel doesn't allow its videos to play on other sites.", blocked: true }
      : { message: `YouTube couldn't play this video (error ${code}).`, blocked: true };
    this.emit();
  },

  startTicker() {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.saveProgress(), 5000);
  },
  saveProgress() {
    if (!this.ready || !this.video) return;
    const t = this.yt.getCurrentTime ? this.yt.getCurrentTime() : 0;
    const d = this.yt.getDuration ? this.yt.getDuration() : 0;
    if (!t || !d) return;
    Library.setProgress(this.video, t, d);
    if (t / d >= WATCHED_AT) Library.setWatched(this.video, true);
  },

  /** The id that plays after the current one, or null. */
  nextId() {
    const i = this.video ? this.queue.indexOf(this.video.id) : -1;
    return i >= 0 && i < this.queue.length - 1 ? this.queue[i + 1] : null;
  },
  next() { const id = this.nextId(); if (id) location.hash = "v-" + id; },

  toggle() { if (!this.ready) return; this.state === "playing" ? this.yt.pauseVideo() : this.yt.playVideo(); },
  seekBy(sec) { if (!this.ready) return; this.yt.seekTo(Math.max(0, this.yt.getCurrentTime() + sec), true); },
  setSpeed(sp) { Library.setting("speed", sp); if (this.ready) this.yt.setPlaybackRate(sp); },
  stepSpeed(dir) { const i = SPEEDS.indexOf(Library.settings.speed); const n = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir))]; this.setSpeed(n); return n; },
  setCaptions(on) { Library.setting("captions", on); this.applySettings(); },
  fullscreen() { const f = $("dock"); if (f.requestFullscreen) f.requestFullscreen().catch(() => {}); },

  // ---- sleep timer: minutes, -1 = end of this video, 0 = off ----
  setSleep(mode) {
    clearInterval(this.sleepTicker);
    this.sleep = { mode, endsAt: mode > 0 ? Date.now() + mode * 60000 : 0 };
    if (mode > 0) this.sleepTicker = setInterval(() => {
      if (Date.now() >= this.sleep.endsAt) { this.setSleep(0); this.fireSleep(); }
      this.emit();
    }, 1000);
    this.emit();
  },
  sleepLeftMs() { return this.sleep.mode > 0 ? Math.max(0, this.sleep.endsAt - Date.now()) : null; },
  fireSleep() {
    if (this.ready) this.yt.pauseVideo();
    this.saveProgress();
    window.dispatchEvent(new CustomEvent("bw-sleep"));
  },

  stop() {
    this.saveProgress();
    if (this.ready) this.yt.stopVideo();
    clearInterval(this.ticker);
    this.video = null; this.state = "idle"; this.error = null;
    this.setSleep(0);
    $("dock").hidden = true;
    this.emit();
  },

  // ---- placement ----
  /** Called by the video page: float the player exactly over `slotEl`. */
  attach(slotEl) {
    this.slot = slotEl;
    const dock = $("dock");
    dock.classList.add("stage"); dock.classList.remove("mini");
    if (this.slotObserver) this.slotObserver.disconnect();
    // Re-place when the slot or anything above it changes size (fonts, images, wrapping titles).
    this.slotObserver = new ResizeObserver(() => this.place());
    this.slotObserver.observe(slotEl);
    this.slotObserver.observe(document.body);
    this.place();
  },
  /** Called on every route that isn't the video page. */
  detach() {
    this.slot = null;
    if (this.slotObserver) { this.slotObserver.disconnect(); this.slotObserver = null; }
    const dock = $("dock");
    dock.classList.remove("stage"); dock.classList.add("mini");
    dock.style.cssText = "";
    dock.hidden = !this.video;
  },
  place() {
    if (!this.slot || !this.slot.isConnected) return;
    const r = this.slot.getBoundingClientRect();
    const dock = $("dock");
    dock.style.top = `${r.top + window.scrollY}px`;
    dock.style.left = `${r.left + window.scrollX}px`;
    dock.style.width = `${r.width}px`;
    dock.style.height = `${r.height}px`;
  },
  showDock() { $("dock").hidden = false; },
};

window.addEventListener("resize", () => Player.place());
