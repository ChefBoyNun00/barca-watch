# Barça Watch

A HackerTube-style home for FC Barcelona YouTube videos: the last 14 days from 20+ Barça
channels, ranked by what's breaking out, and playable right on the page.

**Live site:** https://chefboynun00.github.io/barca-watch/

## What it does

- **Breakouts:** videos with at least 2.5× their channel's usual views (median of the
  channel's recent videos that are at least two days old).
- **Stories:** matches group automatically by opponent; a few topics are hand-written.
  A story shows when 3+ channels covered it.
- **Modes:** Matchday, Listen (keeps playing in a corner while you browse), Quick
  catch-up, Deep dive.
- **Player:** YouTube's official embedded player, with speed, captions, autoplay next,
  loop, a sleep timer, resume-where-you-left-off, and keyboard shortcuts.
- **Yours:** Liked, Watch later, History, Continue watching and all settings stay in your
  browser (export/import in Settings moves them between devices).
- **Spoiler-free mode** hides scores and blurs match thumbnails until you've watched.

## How it's built

```
channels.json          the channel list (one entry per channel)
pipeline/              Python: YouTube feeds + channel tabs -> web/data.json
  rules.py             every judgment call: Barça keywords, sections, stories, thresholds
  run.py               runs all steps; refuses to overwrite data if YouTube blocked the reads
web/                   the static site GitHub Pages serves
  index.html, styles.css
  js/config.js         registries: sections, modes, settings, icons
  js/store.js          personal data in localStorage (versioned, migrated)
  js/data.js           loads data.json; filters, sorting, spoiler rules
  js/player.js         the YouTube IFrame player, dock, sleep timer, resume
  js/components.js     cards, grids, list controls
  js/views.js          every page + the route table
  js/app.js            boot, routing, keyboard
.github/workflows/refresh.yml   every 3 hours: refresh data, commit it, deploy
```

## Change things

- **Add a channel:** one entry in `channels.json`.
- **Add a story or change a threshold:** `pipeline/rules.py` only.
- **Add a mode or section:** one entry in `web/js/config.js`.
- **Run the pipeline locally:** `python3 pipeline/run.py` (Python 3.10+, no packages needed),
  then serve `web/` with `python3 -m http.server -d web`.

Don't fetch YouTube watch pages in bulk: a few hundred fast requests trips YouTube's bot
check. The pipeline only reads feeds and channel tabs, one channel at a time.
