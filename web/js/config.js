// Registries and defaults. Adding a section, mode, setting or sleep option = one entry here.

export const STORAGE_KEY = "bw-site";
export const STORAGE_VERSION = 1;
export const WATCHED_CAP = 600;          // history entries kept per browser
export const PROGRESS_CAP = 300;         // resume points kept per browser
export const WATCHED_AT = 0.8;           // played this share of a video = watched
export const RESUME_MIN_SECONDS = 30;    // don't offer to resume before this point
export const DATA_URL = "data.json";

export const SECTIONS = [
  { key: "highlights", label: "Highlights", icon: "play", blurb: "Match highlights, goals, the women's team and La Masia games.", test: v => v.sec === "highlights" },
  { key: "talk", label: "Talk & Analysis", icon: "chat", blurb: "Reviews, reactions, tactics and matchday shows.", test: v => v.sec === "talk" },
  { key: "podcasts", label: "Podcasts", icon: "mic", blurb: "Episodes from the Barça podcasts.", test: v => v.sec === "podcasts" },
  { key: "news", label: "News", icon: "news", blurb: "Club news, press conferences, injuries and transfer talk.", test: v => v.sec === "news" },
  { key: "longs", label: "Longs", icon: "long", blurb: "Everything over 20 minutes: watch-alongs, full press conferences, full matches and long shows.", test: v => v.len > 1200 },
];

// Modes are curated views. `pick` gets the filtered videos plus helpers and returns an ordered list.
export const MODES = [
  { key: "matchday", label: "Matchday", icon: "ball", blurb: "Highlights first, then reactions and press, for the latest matches." },
  { key: "listen", label: "Listen", icon: "mic", layout: "list",
    blurb: "Podcasts and long talk shows. Start one and keep browsing: it plays on in the corner.",
    pick: (vs, h) => vs.filter(v => v.sec === "podcasts" || (v.sec === "talk" && v.len > 1200)).sort(h.byNew) },
  { key: "catch-up", label: "Quick catch-up", icon: "bolt", blurb: "Under 10 minutes, from the last two days, biggest first.",
    pick: (vs, h) => { let r = vs.filter(v => v.len && v.len < 600 && h.ageH(v) <= 48); if (r.length < 8) r = vs.filter(v => v.len && v.len < 600 && h.ageH(v) <= 96); return r.sort(h.byRatio); } },
  { key: "deep-dive", label: "Deep dive", icon: "layers", blurb: "Analysis and tactics over 12 minutes. No watch-along replays.",
    pick: (vs, h) => vs.filter(v => v.sec === "talk" && v.len >= 720 && !v.live).sort(h.byRatio) },
];

export const GROUPS = [
  { key: "official", label: "Official" }, { key: "english", label: "English" },
  { key: "podcast", label: "Podcasts" }, { key: "spanish", label: "Spanish" }, { key: "found", label: "Found by search" },
];
export const LANGS = [{ key: "en", label: "English" }, { key: "es", label: "Spanish" }, { key: "fr", label: "French" }, { key: "multi", label: "Official club channel" }];
export const LENGTHS = [{ key: "any", label: "Any length" }, { key: "short", label: "Under 10 min" }, { key: "mid", label: "10–20 min" }, { key: "long", label: "Over 20 min" }];
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const SLEEP = [{ key: 0, label: "Off" }, { key: 15, label: "15 min" }, { key: 30, label: "30 min" }, { key: 45, label: "45 min" }, { key: 60, label: "1 hour" }, { key: -1, label: "End of video" }];

export const DEFAULT_SETTINGS = {
  theme: "system", layout: "grid", sort: "new",
  spoilerFree: false, hideWatched: false, hideReplays: false, length: "any",
  langs: { en: true, es: true, fr: true, multi: true }, muted: {},
  // player
  speed: 1, captions: false, autoplayNext: true, loop: false, resume: true,
};

export const SORTS = [
  { key: "new", label: "Newest" }, { key: "views", label: "Most watched" }, { key: "ratio", label: "Biggest vs usual" },
];

export const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  long: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  later: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 15l2.5 4M9.5 15L7 19M8 10L3.5 8.5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  yt: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  next: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 10.2a2 2 0 1 0 0 3.6M17 10.2a2 2 0 1 0 0 3.6"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  speed: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};
