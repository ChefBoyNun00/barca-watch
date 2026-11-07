// Every page of the app. Each view returns an array of nodes; ROUTES maps the URL hash to a view.
import { SECTIONS, MODES, GROUPS, LANGS, LENGTHS, SPEEDS, SLEEP, SORTS } from "./config.js";
import { Library } from "./store.js";
import { Player } from "./player.js";
import { el, icon, slug, fmtViews, fmtDur, fmtAgo, fmtDate, toast, ytUrl, thumbUrl } from "./util.js";
import { D, passes, byNew, byRatio, channel, chanGroup, chanHref, videoHref, storyOf, findVideo, showTitle,
  blurThumb, revealed, matchStories, modeVideos, modeByKey } from "./data.js";
import { card, grid, sortedList, filterNote, playAllButton, head, switchRow, segRow, confirmButton, takeContext } from "./components.js";

const initials = name => name.replace(/^(the|el|la)\s+/i, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

function shelf(title, sub, more, body) {
  return el("section", { class: "shelf" },
    el("div", { class: "shelf-head" }, el("div", {}, el("h2", {}, title), sub ? el("p", {}, sub) : null), more), body);
}
function cardsRow(vids, label) {
  const ctx = { ids: vids.map(v => v.id), label };
  return el("div", { class: "grid" }, vids.map(v => card(v, ctx)));
}

// ---------- home ----------
function modeCards() {
  return el("div", { class: "modes" }, MODES.map(m => el("a", { class: "mode", href: "#" + m.key },
    el("b", {}, icon(m.icon), m.label), el("span", {}, m.blurb), el("em", {}, `${modeVideos(m).length} videos`))));
}
function continueVideos() {
  return Library.ids("progress").filter(id => !Library.has("watched", id)).map(findVideo).filter(Boolean);
}
function viewHome() {
  const out = [head("Barça this fortnight", `${D.videos.length} videos from ${Object.keys(D.channels).length} active Barça channels. Pick a mode, or start with the breakouts.`), modeCards()];
  const cont = continueVideos();
  if (cont.length) out.push(shelf("Continue watching", "Pick up where you stopped.",
    cont.length > 4 ? el("a", { class: "more", href: "#continue" }, `See all ${cont.length}`) : null, cardsRow(cont.slice(0, 4), "Continue watching")));
  const later = Library.ids("later").map(id => D.byId.get(id)).filter(v => v && !Library.has("watched", v.id));
  if (later.length) out.push(shelf("Up next for you", "From your Watch later list, not yet watched.",
    el("a", { class: "more", href: "#later" }, `See all ${later.length}`), cardsRow(later.slice(0, 4), "Watch later")));
  const breakouts = D.videos.filter(v => v.breakout && passes(v)).sort(byRatio);
  if (breakouts.length) out.push(shelf("Breakouts", `Pulling at least ${D.site.rules.breakout}× their channel's usual views.`,
    breakouts.length > 8 ? el("a", { class: "more", href: "#breakouts" }, `See all ${breakouts.length}`) : null, cardsRow(breakouts.slice(0, 8), "Breakouts")));
  const stories = el("section", { class: "shelf" }, el("div", { class: "shelf-head" }, el("div", {},
    el("h2", {}, "Stories everyone covered"), el("p", {}, `Matches and stories at least ${D.site.rules.storyMin} channels made videos about. Best performers first.`))));
  for (const s of D.site.stories) {
    const vids = D.videos.filter(v => v.story === s.id && passes(v)).sort(byRatio);
    if (!vids.length) continue;
    stories.append(el("div", { class: "story" },
      el("div", { class: "story-top" }, el("h3", {}, s.label), el("span", { class: "count" }, `${s.channels} channels · ${s.videos} videos`),
        el("a", { class: "more", href: "#story-" + s.id }, "See all")),
      cardsRow(vids.slice(0, 4), s.label)));
  }
  out.push(stories);
  const latest = D.videos.filter(passes);
  out.push(el("section", { class: "shelf" }, el("div", { class: "shelf-head" }, el("div", {}, el("h2", {}, "Latest"), el("p", {}, "Everything, newest first."))),
    filterNote(D.videos.length, latest.length), grid(latest, { pageSize: 16, label: "Latest" })));
  return out;
}

// ---------- lists ----------
function viewSection(key) {
  const s = SECTIONS.find(x => x.key === key);
  const vids = D.videos.filter(s.test);
  return [head(s.label, `${s.blurb} ${vids.length} videos.`), sortedList(vids, { label: s.label })];
}
function viewMode(key) {
  const m = modeByKey(key);
  if (key === "matchday") {
    const out = [head("Matchday", m.blurb)];
    for (const s of matchStories().slice(0, 2)) {
      const vids = D.videos.filter(v => v.story === s.id && passes(v))
        .sort((a, b) => (b.sec === "highlights") - (a.sec === "highlights") || byRatio(a, b));
      out.push(shelf(s.label, `${s.channels} channels · ${s.videos} videos`, playAllButton(vids, s.label),
        grid(vids, { pageSize: 12, label: s.label, empty: "Everything for this match is hidden by your settings." })));
    }
    if (out.length === 1) out.push(el("p", { class: "empty" }, "No match has enough coverage yet."));
    return out;
  }
  const vids = modeVideos(m);
  return [head(m.label, `${m.blurb} ${vids.length} videos.`), el("div", { class: "toolbar" }, playAllButton(vids, m.label)),
    grid(vids, { layout: m.layout, label: m.label, empty: "Nothing fits this mode with your current settings." })];
}
function viewBreakouts() {
  const vids = D.videos.filter(v => v.breakout);
  return [head("Breakouts", `Videos with at least ${D.site.rules.breakout}× their channel's usual views. ${vids.length} videos.`), sortedList(vids, { label: "Breakouts" })];
}
function viewStory(id) {
  const s = D.stories.get(id);
  if (!s) return viewMissing();
  return [head(s.label, `Covered by ${s.channels} channels in ${s.videos} videos.`), sortedList(D.videos.filter(v => v.story === id), { label: s.label })];
}
function viewChannel(sl) {
  const cid = D.chSlug.get(sl);
  if (!cid) return viewMissing();
  const c = D.channels[cid];
  const vids = D.videos.filter(v => v.c === cid);
  const muted = !!Library.settings.muted[cid];
  return [
    el("div", { class: "chhead" }, el("span", { class: "dot" + (c.lang === "es" ? " es" : ""), "aria-hidden": "true" }, initials(c.name)),
      el("div", { class: "head" }, el("h1", {}, c.name),
        el("div", { class: "facts" }, el("span", {}, (GROUPS.find(g => g.key === chanGroup(c)) || {}).label),
          el("span", {}, el("b", {}, vids.length), " Barça videos in 14 days"),
          el("span", {}, "Usual video: ", el("b", {}, fmtViews(c.typical)), " views"),
          el("a", { class: "ytlink", href: "https://www.youtube.com/channel/" + encodeURIComponent(cid), target: "_blank", rel: "noopener" }, "Open on YouTube")))),
    el("div", { class: "toolbar" }, el("button", { class: "btn", type: "button", "aria-pressed": String(muted),
      onclick: () => { Library.setting("muted", { ...Library.settings.muted, [cid]: !muted || undefined }); toast(muted ? `${c.name} unmuted` : `${c.name} muted everywhere else`); } },
      muted ? "Unmute channel" : "Mute channel")),
    sortedList(vids, { filter: false, label: c.name }),
  ];
}
function viewLibrary(list) {
  const names = { liked: "Liked", later: "Watch later", watched: "History", progress: "Continue watching" };
  const hints = { liked: "Tap the heart on any video to keep it here.", later: "Tap the clock on any video to save it for later.",
    watched: "Videos you finish (or watch most of) show up here.", progress: "Videos you start and don't finish show up here." };
  const vids = (list === "progress" ? continueVideos() : Library.ids(list).map(findVideo).filter(Boolean));
  const playable = list === "later" ? vids.filter(v => !Library.has("watched", v.id)) : vids;
  return [head(names[list], "Saved in this browser. Most recent first."),
    el("div", { class: "toolbar" }, list !== "watched" ? playAllButton(playable, names[list]) : null),
    grid(vids, { empty: hints[list], pageSize: 48, label: names[list] })];
}

// ---------- the video page ----------
function upNextFor(v, ctx) {
  if (ctx) return ctx;
  if (Player.video && Player.video.id === v.id && Player.queue.length > 1) return { ids: Player.queue, label: Player.queueLabel };
  const st = storyOf(v);
  const same = st ? D.videos.filter(x => x.story === st.id && x.id !== v.id && passes(x)).sort(byRatio) : [];
  const chan = D.videos.filter(x => x.c === v.c && x.id !== v.id && !same.includes(x) && passes(x)).sort(byNew);
  return { ids: [v.id, ...same, ...chan].map(x => x.id || x).slice(0, 30), label: st ? st.label : channel(v.c).name };
}

export function playerControls() {
  const v = Player.video;
  const s = Library.settings;
  const box = el("div", { class: "pcontrols", id: "pcontrols" });
  if (!v) return box;
  if (Player.error) box.append(el("div", { class: "perror", role: "alert" }, el("span", {}, Player.error.message),
    el("a", { class: "btn", href: ytUrl(v.id), target: "_blank", rel: "noopener" }, icon("yt"), "Watch on YouTube"),
    Player.nextId() ? el("button", { class: "btn", type: "button", onclick: () => Player.next() }, icon("next"), "Skip to next") : null));
  const left = Player.sleepLeftMs();
  const sleepLabel = Player.sleep.mode === -1 ? "Sleep: end of video" : left != null ? `Sleep in ${Math.floor(left / 60000)}:${String(Math.floor(left % 60000 / 1000)).padStart(2, "0")}` : "Sleep timer";
  box.append(
    el("div", { class: "pgroup", role: "group", "aria-label": "Playback speed" }, icon("speed"),
      SPEEDS.map(sp => el("button", { class: "seg", type: "button", "aria-pressed": String(s.speed === sp), onclick: () => Player.setSpeed(sp) }, sp + "×"))),
    el("div", { class: "pgroup" },
      el("button", { class: "seg", type: "button", "aria-pressed": String(s.captions), title: "Captions (c)", onclick: () => Player.setCaptions(!s.captions) }, icon("cc"), "Captions"),
      el("button", { class: "seg", type: "button", "aria-pressed": String(s.autoplayNext), onclick: () => Library.setting("autoplayNext", !s.autoplayNext) }, icon("next"), "Autoplay"),
      el("button", { class: "seg", type: "button", "aria-pressed": String(s.loop), onclick: () => Library.setting("loop", !s.loop) }, icon("loop"), "Loop"),
      el("label", { class: "seg sleep", for: "sleep" }, icon("moon"), el("span", {}, sleepLabel),
        el("select", { id: "sleep", "aria-label": "Sleep timer", onchange: e => { Player.setSleep(Number(e.target.value)); toast(Number(e.target.value) ? "Sleep timer set" : "Sleep timer off"); } },
          SLEEP.map(o => el("option", { value: o.key, selected: (Player.sleep.mode === o.key) || null }, o.label)))),
      el("button", { class: "seg", type: "button", title: "Full screen (f)", onclick: () => Player.fullscreen() }, icon("expand"), "Full screen")));
  const nid = Player.nextId();
  const nv = nid && findVideo(nid);
  if (nv) box.append(el("button", { class: "nextup", type: "button", onclick: () => Player.next() },
    el("span", { class: "k" }, s.autoplayNext ? "Up next · plays automatically" : "Up next"), el("span", { class: "t" }, showTitle(nv)), icon("next")));
  return box;
}

function viewVideo(id) {
  const v = findVideo(id);
  if (!v) return viewMissing();
  const ctx = upNextFor(v, takeContext(id));
  const ch = channel(v.c);
  const watched = Library.has("watched", v.id);
  const st = storyOf(v);
  const copy = el("input", { class: "copyfield", value: ytUrl(v.id), readonly: true, "aria-label": "Video link", hidden: true });
  const slot = el("div", { class: "slot" }, el("img", { src: thumbUrl(v.id), alt: "", class: blurThumb(v) ? "spoiler" : "" }));
  const stage = el("div", { class: "stage" }, slot, playerControls(),
    el("h1", {}, showTitle(v)),
    el("div", { class: "byline" }, el("a", { class: "chan", href: chanHref(v.c) }, ch.name),
      el("span", { class: "meta" }, `${fmtViews(v.views)} views · ${fmtAgo(v)}${v.len ? " · " + fmtDur(v.len) : ""}`),
      v.breakout ? el("span", { class: "x" }, `${v.ratio.toFixed(1)}× usual`) : null),
    el("div", { class: "actions" },
      bigSave("liked", v), bigSave("later", v),
      el("button", { class: "btn", type: "button", "aria-pressed": String(watched), onclick: () => Library.setWatched(v, !watched) }, icon("check"), watched ? "Watched" : "Mark watched"),
      el("button", { class: "btn", type: "button", onclick: async () => {
        try { await navigator.clipboard.writeText(ytUrl(v.id)); toast("Link copied"); }
        catch (e) { copy.hidden = false; copy.focus(); copy.select(); }
      } }, icon("link"), "Copy link"),
      el("a", { class: "btn", href: ytUrl(v.id), target: "_blank", rel: "noopener" }, icon("yt"), "YouTube"),
      Library.settings.spoilerFree && !revealed.has(v.id) && !watched && showTitle(v) !== v.t
        ? el("button", { class: "btn", type: "button", onclick: () => { revealed.add(v.id); window.dispatchEvent(new HashChangeEvent("hashchange")); } }, "Show score") : null),
    copy,
    v.ratio && ch.typical ? el("p", { class: "why" }, v.breakout ? el("b", {}, "Breakout. ") : null,
      `${ch.name} usually gets ${fmtViews(ch.typical)} views; this one has ${v.ratio.toFixed(1)}× that.`) : null,
    v.d && !blurThumb(v) ? el("div", { class: "desc" }, v.d) : null,
    v.gone ? el("p", { class: "why" }, "This video is older than the current 14-day list, so only what you saved about it is shown.") : null);

  const after = ctx.ids.slice(ctx.ids.indexOf(v.id) + 1).map(findVideo).filter(Boolean).slice(0, 10);
  const upCtx = { ids: ctx.ids, label: ctx.label };
  const side = el("aside", { class: "side" },
    after.length ? el("section", { class: "shelf" }, el("div", { class: "shelf-head" }, el("h2", {}, "Up next"), ctx.label ? el("span", { class: "count" }, ctx.label) : null),
      el("div", { class: "grid" }, after.map(x => card(x, upCtx)))) : null,
    st ? el("a", { class: "more", href: "#story-" + st.id }, `Everything on ${st.label}`) : null,
    el("a", { class: "more", href: chanHref(v.c) }, `More from ${ch.name}`));

  // Start playback after this view is in the DOM (the router calls `mount`).
  const nodes = [el("div", { class: "watch" }, stage, side)];
  nodes.mount = () => { Player.play(v, { queue: ctx.ids, label: ctx.label }); Player.attach(slot); };
  return nodes;
}
function bigSave(list, v) {
  const on = Library.has(list, v.id);
  return el("button", { class: "btn", type: "button", "aria-pressed": String(on), onclick: () => Library.toggle(list, v) },
    icon(list === "liked" ? "heart" : "later", list === "liked" ? "heart" : ""), list === "liked" ? (on ? "Liked" : "Like") : (on ? "In Watch later" : "Watch later"));
}

// ---------- settings ----------
function viewSettings() {
  const s = Library.settings;
  const set = (k, v) => Library.setting(k, v);
  const chans = Object.entries(D.channels).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const fileIn = el("input", { type: "file", id: "import-file", accept: "application/json,.json", hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { Library.importJson(await f.text()); toast("Imported. Your lists and settings are merged in."); }
    catch (err) { toast("That file isn't a Barça Watch export."); }
    e.target.value = "";
  } });
  return [head("Settings", Library.persisted ? "Saved in this browser." : "This browser isn't letting the page save, so changes last until you close the tab."),
    el("div", { class: "settings" },
      el("section", { class: "group" }, el("h2", {}, "Player"),
        segRow("Default speed", null, SPEEDS.map(x => ({ key: x, label: x + "×" })), s.speed, v => Player.setSpeed(v)),
        switchRow("set-captions", "Captions", "Turns on YouTube's captions when a video has them.", s.captions, v => Player.setCaptions(v)),
        switchRow("set-autoplay", "Autoplay next", "When a video ends, the next one in the list you opened it from starts.", s.autoplayNext, v => set("autoplayNext", v)),
        switchRow("set-loop", "Loop", "Replays the same video when it ends.", s.loop, v => set("loop", v)),
        switchRow("set-resume", "Resume where I left off", "Reopening a video you didn't finish starts from where you stopped.", s.resume, v => set("resume", v))),
      el("section", { class: "group" }, el("h2", {}, "Watching"),
        switchRow("set-spoiler", "Spoiler-free mode", "Hides scores in titles and blurs match thumbnails until you've watched the video.", s.spoilerFree, v => set("spoilerFree", v)),
        switchRow("set-hidewatched", "Hide watched videos", "Finished videos disappear from lists. They stay in History.", s.hideWatched, v => set("hideWatched", v)),
        switchRow("set-replays", "Hide live replays", "Leaves out watch-alongs and other finished livestreams.", s.hideReplays, v => set("hideReplays", v)),
        segRow("Length", "Applies to every list except your own.", LENGTHS, s.length, v => set("length", v))),
      el("section", { class: "group" }, el("h2", {}, "Languages"),
        el("div", { class: "checks" }, LANGS.map(l => el("label", { class: "check" },
          el("input", { type: "checkbox", id: "set-lang-" + l.key, checked: s.langs[l.key] !== false || null, onchange: e => set("langs", { ...Library.settings.langs, [l.key]: e.target.checked }) }), l.label)))),
      el("section", { class: "group" }, el("h2", {}, "Channels"),
        el("p", { class: "filternote" }, "Untick a channel to mute it. Its videos stay on its own page."),
        el("div", { class: "chanlist" }, chans.map(([cid, c]) => el("label", { class: "check" },
          el("input", { type: "checkbox", id: "set-ch-" + slug(c.name), checked: !s.muted[cid] || null, onchange: e => set("muted", { ...Library.settings.muted, [cid]: !e.target.checked || undefined }) }), c.name)))),
      el("section", { class: "group" }, el("h2", {}, "Look"),
        segRow("Theme", null, [{ key: "system", label: "System" }, { key: "light", label: "Light" }, { key: "dark", label: "Dark" }], s.theme, v => set("theme", v)),
        segRow("Layout", null, [{ key: "grid", label: "Grid" }, { key: "list", label: "List" }], s.layout, v => set("layout", v)),
        segRow("Default sort", null, SORTS, s.sort, v => set("sort", v))),
      el("section", { class: "group" }, el("h2", {}, "Keyboard"),
        el("div", { class: "keys" }, ...[["/", "Search"], ["k or Space", "Play / pause"], ["j / l", "Back / forward 10 seconds"], ["n", "Next video"],
          ["< / >", "Slower / faster"], ["c", "Captions"], ["f", "Full screen"], ["h", "Home"], ["m", "Matchday"], ["w", "Watch later"], ["s", "Settings"]]
          .flatMap(([k, d]) => [el("span", {}, el("kbd", { class: "k" }, k)), el("span", {}, d)]))),
      el("section", { class: "group" }, el("h2", {}, "Your data"),
        el("p", { class: "filternote" }, "Everything personal stays in this browser. To move it to another device, export here and import there."),
        el("div", { class: "toolbar" },
          el("button", { class: "btn", type: "button", onclick: () => {
            const url = URL.createObjectURL(new Blob([Library.exportJson()], { type: "application/json" }));
            const a = el("a", { href: url, download: "barca-watch.json" }); document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } }, "Export"),
          el("label", { class: "btn", for: "import-file" }, "Import"), fileIn),
        el("div", { class: "row" }, el("div", {}, el("span", { class: "lbl" }, "History"), el("p", {}, `${Library.count("watched")} watched, ${Library.count("progress")} in progress.`)),
          confirmButton("Clear history", "Clear watched videos and resume points?", () => { Library.clear("watched"); Library.clear("progress"); toast("History cleared"); })),
        el("div", { class: "row" }, el("div", {}, el("span", { class: "lbl" }, "Reset settings"), el("p", {}, "Puts every setting back to its default. Your lists stay.")),
          confirmButton("Reset", "Reset all settings?", () => { Library.resetSettings(); toast("Settings reset"); })))),
  ];
}

// ---------- misc ----------
function viewChannels() {
  return [head("Channels", "Every channel with Barça uploads in the last 14 days."),
    ...railGroups().map(g => shelf(g.label, null, null, el("div", { class: "navlist" }, g.items)))];
}
function viewSearch(q) {
  const terms = slug(q).split("-").filter(Boolean);
  const hay = v => slug(v.t + " " + channel(v.c).name + " " + ((storyOf(v) || {}).label || ""));
  return [head(`Results for “${q}”`, null), sortedList(D.videos.filter(v => terms.every(t => hay(v).includes(t))), { label: `“${q}”` })];
}
function viewHow() {
  const r = D.site.rules;
  return [head("How it works", `Updated ${fmtDate(D.site.snapshot)}.`), el("section", { class: "how" },
    el("ul", {},
      el("li", { html: `<strong>Sources.</strong> Each channel's YouTube feed, plus its Videos, Live and Shorts tabs, refreshed every 3 hours. Only the last ${r.windowDays} days are kept. Shorts, scheduled streams and videos that aren't about Barça are left out.` }),
      el("li", { html: `<strong>Breakouts.</strong> A channel's <em>usual</em> number is the median views of its recent videos that are at least two days old. A breakout has at least <strong>${r.breakout}×</strong> that, and at least ${fmtViews(r.minViews)} views.` }),
      el("li", { html: `<strong>Stories.</strong> Matches group automatically by opponent; a few topics are written by hand. A story shows on Home when at least <strong>${r.storyMin} channels</strong> covered it.` }),
      el("li", { html: `<strong>Playing.</strong> Videos play here through YouTube's own embedded player, so views count for the channels. A few channels block playback on other sites; those get a YouTube button instead.` }),
      el("li", { html: `<strong>Fair warning.</strong> Views are counted at each refresh, so the newest videos look smaller than they will. Dates marked “about” come from YouTube's rounded labels.` })),
    D.site.quiet.length ? el("p", {}, `No uploads in the last ${r.windowDays} days: ${D.site.quiet.map(q => q.name).join(", ")}.`) : null,
    (D.site.filtered || []).length ? el("p", {}, `Posted only Shorts or non-Barça videos: ${D.site.filtered.map(q => q.name).join(", ")}.`) : null)];
}
function viewMissing() { return [head("Not found", "That page isn't in the current list."), el("a", { class: "more", href: "#home" }, "Back to Home")]; }

// ---------- nav (shared with the rail) ----------
function navLink(key, label, ic, count, cls) {
  return el("a", { class: "nav" + (cls ? " " + cls : ""), href: "#" + key, "data-nav": key }, ic, el("span", { class: "lbl" }, label), count ? el("em", {}, count) : null);
}
export function railGroups() {
  const all = Object.entries(D.channels);
  return GROUPS.map(g => ({ label: g.label,
    items: all.filter(([, c]) => chanGroup(c) === g.key).sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, c]) => navLink("ch-" + slug(c.name), c.name,
        el("span", { class: "dot" + (c.lang === "es" ? " es" : ""), "aria-hidden": "true" }, c.lang === "multi" ? "FC" : c.lang.toUpperCase()),
        D.videos.filter(v => v.c === id).length, Library.settings.muted[id] ? "muted" : "")) })).filter(g => g.items.length);
}
export function buildRail() {
  const count = test => D.videos.filter(v => test(v) && passes(v)).length;
  return [
    el("div", { class: "navlist" }, navLink("home", "Home", icon("home")), SECTIONS.map(s => navLink(s.key, s.label, icon(s.icon), count(s.test)))),
    el("div", {}, el("h3", {}, "Modes"), el("div", { class: "navlist" }, MODES.map(m => navLink(m.key, m.label, icon(m.icon), modeVideos(m).length)))),
    el("div", {}, el("h3", {}, "You"), el("div", { class: "navlist" },
      navLink("continue", "Continue watching", icon("play"), continueVideos().length),
      navLink("liked", "Liked", icon("heart"), Library.count("liked")),
      navLink("later", "Watch later", icon("later"), Library.count("later")),
      navLink("history", "History", icon("history"), Library.count("watched")))),
    ...railGroups().map(g => el("div", {}, el("h3", {}, g.label), el("div", { class: "navlist" }, g.items))),
    el("div", { class: "navlist" }, navLink("settings", "Settings", icon("gear")), navLink("how", "How it works", icon("info"))),
  ];
}
export const CHIPS = () => [["home", "Home"], ...MODES.map(m => [m.key, m.label]), ...SECTIONS.map(s => [s.key, s.label]),
  ["continue", "Continue"], ["liked", "Liked"], ["later", "Watch later"], ["history", "History"], ["channels", "Channels"], ["settings", "Settings"], ["how", "How it works"]];

export { viewSearch, viewMissing };
export const ROUTES = [
  { match: h => h === "" || h === "home", render: viewHome, nav: "home" },
  ...SECTIONS.map(s => ({ match: h => h === s.key, render: () => viewSection(s.key), nav: s.key })),
  ...MODES.map(m => ({ match: h => h === m.key, render: () => viewMode(m.key), nav: m.key })),
  { match: h => h === "breakouts", render: viewBreakouts, nav: "home" },
  { match: h => h === "continue", render: () => viewLibrary("progress"), nav: "continue", live: true },
  { match: h => h === "liked", render: () => viewLibrary("liked"), nav: "liked", live: true },
  { match: h => h === "later", render: () => viewLibrary("later"), nav: "later", live: true },
  { match: h => h === "history", render: () => viewLibrary("watched"), nav: "history", live: true },
  { match: h => h === "settings", render: viewSettings, nav: "settings", live: true },
  { match: h => h === "channels", render: viewChannels, nav: "channels" },
  { match: h => h === "how", render: viewHow, nav: "how" },
  { match: h => h.startsWith("story-"), render: h => viewStory(h.slice(6)), nav: "home" },
  { match: h => h.startsWith("ch-"), render: h => viewChannel(h.slice(3)), nav: h => h },
  { match: h => h.startsWith("v-"), render: h => viewVideo(h.slice(2)), nav: null, video: true },
];
