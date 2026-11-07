// Boot, routing, navigation and keyboard. Views decide what a page shows; this file decides which page.
import { Library } from "./store.js";
import { Player } from "./player.js";
import { $, el, icon, fmtAgoMs, fmtDate, toast } from "./util.js";
import { D, loadData, newerSnapshotAvailable, showTitle } from "./data.js";
import { ROUTES, buildRail, CHIPS, viewSearch, viewMissing, playerControls } from "./views.js";
import { card } from "./components.js";

let currentRoute = null;

function applyTheme() {
  const t = Library.settings.theme;
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

function buildNav() {
  $("rail").replaceChildren(...buildRail());
  $("chips").replaceChildren(...CHIPS().map(([k, l]) => el("a", { href: "#" + k, "data-nav": k }, l)));
}
function markNav(key) {
  document.querySelectorAll("[data-nav]").forEach(a => {
    if (a.dataset.nav === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $("gear").toggleAttribute("aria-current", key === "settings");
}

function currentHash() { return decodeURIComponent(location.hash.replace(/^#/, "")); }

function render() {
  const q = $("q").value.trim();
  const h = currentHash();
  let nodes, nav = null;
  if (q) { nodes = viewSearch(q); currentRoute = { live: false }; }
  else {
    const route = ROUTES.find(r => r.match(h)) || { render: viewMissing };
    nodes = route.render(h);
    nav = typeof route.nav === "function" ? route.nav(h) : route.nav;
    currentRoute = route;
  }
  $("view").replaceChildren(...nodes.filter(Boolean));
  markNav(nav);
  if (currentRoute.video && nodes.mount) nodes.mount(); else Player.detach();
  document.title = currentRoute.video && Player.video ? `${showTitle(Player.video)} · Barça Watch` : "Barça Watch";
}

// Library changes: settings re-render the page; list changes on browse pages swap cards in place so
// scroll position and "Show more" paging survive. The player lives outside the page, so re-rendering
// a video page never interrupts playback.
function onLibrary(why) {
  if (why === "settings") applyTheme();
  const y = window.scrollY;
  const focusId = document.activeElement && document.activeElement.id;
  buildNav();
  if (why === "lists" && currentRoute && !currentRoute.live && !currentRoute.video) {
    document.querySelectorAll("#view .card").forEach(c => {
      const v = D.byId.get(c.dataset.id);
      if (!v) return;
      const ids = [...c.closest(".grid").querySelectorAll(".card")].map(x => x.dataset.id);
      c.replaceWith(card(v, { ids, label: "" }));
    });
    markNav(typeof currentRoute.nav === "string" ? currentRoute.nav : null);
  } else render();
  window.scrollTo(0, y);
  if (focusId && $(focusId)) $(focusId).focus();
}

function refreshControls() {
  const old = $("pcontrols");
  if (old) old.replaceWith(playerControls());
}
function refreshDock() {
  const v = Player.video;
  $("dock-title").textContent = v ? showTitle(v) : "";
  $("dock-title").href = v ? "#v-" + v.id : "#";
}

function showSleepOverlay() {
  const close = () => $("layer").replaceChildren();
  $("layer").replaceChildren(el("div", { class: "overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "slp" },
    el("div", { class: "box" }, el("h2", { id: "slp" }, "Paused"),
      el("p", {}, "Your sleep timer stopped the video. It'll pick up from here next time."),
      el("div", { class: "actions" },
        el("button", { class: "btn", type: "button", onclick: () => { close(); Player.toggle(); } }, "Keep watching"),
        el("button", { class: "btn primary", type: "button", onclick: close }, "Done")))));
  $("layer").querySelector(".btn.primary").focus();
}

function showLoadError(err) {
  $("view").replaceChildren(el("div", { class: "empty", role: "alert" },
    el("p", {}, err.message || "Couldn't load the videos."),
    el("button", { class: "btn", type: "button", onclick: () => boot() }, "Try again")));
}

async function checkForNewer() {
  if (document.hidden || !D.snap) return;
  if (await newerSnapshotAvailable()) toast("New videos are in.", { label: "Load them", run: async () => { await loadData({ fresh: true }); stampUpdate(); buildNav(); render(); } });
}
function stampUpdate() {
  $("stamp").textContent = "Updated " + fmtAgoMs(Date.now() - D.snap, false);
  $("stamp").title = fmtDate(D.site.snapshot);
}

// ---- keyboard ----
const NAV_KEYS = { h: "home", m: "matchday", w: "later", s: "settings" };
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = /input|textarea|select/i.test(document.activeElement.tagName);
  if (e.key === "/" && !typing) { e.preventDefault(); $("q").focus(); return; }
  if (e.key === "Escape") { if (document.activeElement === $("q")) { $("q").value = ""; render(); } $("layer").replaceChildren(); return; }
  if (typing) return;
  if (Player.video) {
    const k = e.key;
    if (k === " " || k === "k") { e.preventDefault(); Player.toggle(); return; }
    if (k === "j") { Player.seekBy(-10); return; }
    if (k === "l") { Player.seekBy(10); return; }
    if (k === "n") { Player.next(); return; }
    if (k === "f") { Player.fullscreen(); return; }
    if (k === "c") { Player.setCaptions(!Library.settings.captions); toast(Library.settings.captions ? "Captions on" : "Captions off"); return; }
    if (k === ">" || k === ".") { toast(`Speed ${Player.stepSpeed(1)}×`); return; }
    if (k === "<" || k === ",") { toast(`Speed ${Player.stepSpeed(-1)}×`); return; }
  }
  if (NAV_KEYS[e.key]) location.hash = NAV_KEYS[e.key];
}

async function boot() {
  try {
    await loadData();
  } catch (err) { showLoadError(err); return; }
  stampUpdate();
  buildNav();
  render();
}

// ---- wiring (once) ----
$("gear").append(icon("gear"));
applyTheme();
Library.on(onLibrary);
Player.on(() => { refreshControls(); refreshDock(); });
$("dock-close").addEventListener("click", () => Player.stop());
let qTimer;
$("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(render, 150); });
document.addEventListener("keydown", onKey);
window.addEventListener("hashchange", () => { if ($("q").value) $("q").value = ""; render(); window.scrollTo(0, 0); });
window.addEventListener("bw-sleep", showSleepOverlay);
document.addEventListener("visibilitychange", checkForNewer);
setInterval(checkForNewer, 30 * 60 * 1000);
boot();
