// Reusable UI pieces. Each returns DOM; none reads the URL or decides routing.
import { SORTS } from "./config.js";
import { Library } from "./store.js";
import { el, icon, fmtViews, fmtDur, fmtAgo, thumbUrl } from "./util.js";
import { channel, chanHref, videoHref, storyOf, showTitle, blurThumb, passes, SORT_FN } from "./data.js";

// ---- play queue context: the list a video was opened from becomes its "Up next" ----
let pendingContext = null;
export function setContext(ids, label) { pendingContext = { ids, label }; }
export function takeContext(id) {
  const c = pendingContext; pendingContext = null;
  return c && c.ids.includes(id) ? c : null;
}

export function saveButton(list, v) {
  const on = Library.has(list, v.id);
  const label = list === "liked" ? (on ? "Unlike" : "Like") : (on ? "Remove from Watch later" : "Watch later");
  return el("button", { class: "save", type: "button", "aria-pressed": String(on), "aria-label": label, title: label,
    onclick: e => { e.preventDefault(); e.stopPropagation(); Library.toggle(list, v); } },
    icon(list === "liked" ? "heart" : "later", list === "liked" ? "heart" : ""));
}

function progressBar(v) {
  const p = Library.entry("progress", v.id);
  if (Library.has("watched", v.id)) return el("span", { class: "seen", style: "width:100%" });
  if (p && p.dur) return el("span", { class: "seen", style: `width:${Math.min(100, Math.round(p.at / p.dur * 100))}%` });
  return null;
}

/** One video card. `context` = {ids, label} for the list it sits in. */
export function card(v, context) {
  const ch = channel(v.c);
  const watched = Library.has("watched", v.id);
  const saved = Library.has("liked", v.id) || Library.has("later", v.id);
  const open = () => context && setContext(context.ids, context.label);
  const blur = blurThumb(v);
  const thumb = el("div", { class: "thumb" + (blur ? " spoiler" : "") },
    el("a", { class: "thumb-link", href: videoHref(v.id), tabindex: "-1", "aria-hidden": "true", onclick: open },
      el("img", { src: thumbUrl(v.id), alt: "", loading: "lazy", decoding: "async", onerror: e => e.target.remove() }),
      blur ? el("span", { class: "spoil" }, el("span", {}, "Spoiler-free")) : null,
      v.len ? el("span", { class: "dur" + (v.live ? " live" : "") }, (v.live ? "Replay · " : "") + fmtDur(v.len)) : null,
      watched ? el("span", { class: "seenlabel" }, "Watched") : null,
      progressBar(v)),
    el("span", { class: "saves" + (saved ? " on" : "") }, saveButton("liked", v), saveButton("later", v)));
  const tags = [];
  if (v.breakout) tags.push(el("span", { class: "x", title: `${ch.name} usually gets ${fmtViews(ch.typical)} views` }, `${v.ratio.toFixed(1)}× usual`));
  const st = storyOf(v);
  if (st) tags.push(el("a", { class: "tag", href: "#story-" + st.id }, st.label));
  return el("article", { class: "card", "data-id": v.id }, thumb,
    el("div", { class: "body" },
      el("a", { class: "title", href: videoHref(v.id), title: showTitle(v), onclick: open }, showTitle(v)),
      el("a", { class: "chan", href: chanHref(v.c) }, ch.name),
      el("span", { class: "meta" }, `${fmtViews(v.views)} views · ${fmtAgo(v)}`),
      tags.length ? el("div", { class: "tags" }, tags) : null));
}

/** A paged grid. Cards opened from it queue the rest of this list as "Up next". */
export function grid(videos, { pageSize = 24, empty = "Nothing here yet.", layout, label = "" } = {}) {
  if (!videos.length) return el("p", { class: "empty" }, empty);
  const context = { ids: videos.map(v => v.id), label };
  const box = el("div", { class: "grid" + ((layout || Library.settings.layout) === "list" ? " list" : "") });
  const more = el("button", { class: "showmore", type: "button", onclick: () => page() });
  let shown = 0;
  function page() {
    box.append(...videos.slice(shown, shown + pageSize).map(v => card(v, context)));
    shown = Math.min(videos.length, shown + pageSize);
    more.textContent = `Show more (${videos.length - shown} left)`;
    more.hidden = shown >= videos.length;
  }
  page();
  return el("div", { class: "list-wrap" }, box, more);
}

export function filterNote(total, shown) {
  const hidden = total - shown;
  return hidden > 0 ? el("p", { class: "filternote" }, `${hidden} hidden by your settings · `, el("a", { href: "#settings" }, "Change")) : null;
}

/** "Play all": starts the first video here with the whole list queued. */
export function playAllButton(vids, label) {
  const ordered = [...vids].sort((a, b) => Library.has("watched", a.id) - Library.has("watched", b.id));
  if (ordered.length < 2) return null;
  return el("a", { class: "btn primary", href: videoHref(ordered[0].id),
    onclick: () => setContext(ordered.map(v => v.id), label) }, icon("play"), `Play all ${ordered.length}`);
}

/** Sort bar + filtered, paged grid. */
export function sortedList(all, { filter = true, layout, label = "" } = {}) {
  const holder = el("div", { class: "list-wrap" });
  const vids = filter ? all.filter(passes) : all;
  let current = SORT_FN[Library.settings.sort] ? Library.settings.sort : "new";
  function draw() {
    const sorted = [...vids].sort(SORT_FN[current]);
    const bar = el("div", { class: "toolbar", role: "group", "aria-label": "Sort" },
      SORTS.map(s => el("button", { class: "seg", type: "button", "aria-pressed": String(s.key === current), onclick: () => { current = s.key; draw(); } }, s.label)),
      playAllButton(sorted, label));
    holder.replaceChildren(...[bar, filter ? filterNote(all.length, vids.length) : null,
      grid(sorted, { layout, label, empty: all.length ? "Everything here is hidden by your settings." : "Nothing here yet." })].filter(Boolean));
  }
  draw();
  return holder;
}

export function head(title, text) { return el("div", { class: "head" }, el("h1", {}, title), text ? el("p", {}, text) : null); }

export function switchRow(id, label, help, checked, onChange) {
  return el("div", { class: "row" }, el("div", {}, el("label", { for: id }, label), help ? el("p", {}, help) : null),
    el("span", { class: "switch" }, el("input", { id, type: "checkbox", role: "switch", checked: checked || null, onchange: e => onChange(e.target.checked) }), el("span", {})));
}
export function segRow(label, help, options, value, onPick) {
  return el("div", { class: "row" }, el("div", {}, el("span", { class: "lbl" }, label), help ? el("p", {}, help) : null),
    el("div", { class: "toolbar", role: "group", "aria-label": label },
      options.map(o => el("button", { class: "seg", type: "button", "aria-pressed": String(o.key === value), onclick: () => onPick(o.key) }, o.label))));
}
export function confirmButton(label, ask, run) {
  const box = el("div", { class: "confirm" });
  const idle = () => box.replaceChildren(el("button", { class: "btn danger", type: "button", onclick: () => box.replaceChildren(
    el("span", {}, ask), el("button", { class: "btn danger", type: "button", onclick: () => { run(); idle(); } }, "Yes, clear"),
    el("button", { class: "btn", type: "button", onclick: idle }, "Cancel")) }, label));
  idle();
  return box;
}

