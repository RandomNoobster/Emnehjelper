# Store screenshots

Captures raw, unedited screenshots of Emnehjelper running on live NTNU pages, for Chrome Web Store artwork. Captions, arrows and layout are added afterwards in an image editor; this tool only produces the plain page captures.

It loads the unpacked extension from `emnehjelper/` into Chromium with Playwright, waits until every value the extension shows has loaded, and saves PNGs to `media/raw/`.

## Usage

```bash
npm install
npm run setup
npm run shots
```

`npm run setup` downloads Playwright's Chromium (once per Playwright version). `npm run shots` runs every step; pass step names to redo only some, and `--out` / `--ext` to change the output or extension folder:

```bash
npm run shots -- course-light course-dark
npm run shots -- --out ../../media/raw-test about
```

A full run takes about two minutes. Check the log for `WARNING:` lines: they mean a capture shows missing data, a warning banner or a cut-off table.

## Steps and outputs

All page captures are 1280x800 at device scale factor 2, so 2560x1600 pixels.

| Step | Output | What it shows |
| --- | --- | --- |
| `study` | `study-plan.png` | MTDT study plan (2024 cohort), Programvaresystemer direction, the 3rd-year semester table with the widest mix of badge colours |
| `study-without` | `study-plan-without.png` | The same view in a browser without the extension, for a before/after image. Needs `study` to have run first |
| `course-light` | `course-page-light.png`, `panel-light.png` | TDT4100 course page with the panel expanded, light mode, and the panel on its own |
| `course-dark` | `course-page-dark.png` | TDT4100 with Chromium's forced dark mode, so the NTNU page is dark too |
| `course-dark-page-light` | `course-page-dark-page-light.png`, `panel-dark.png` | TDT4100 with `prefers-color-scheme: dark`: the panel is dark, the NTNU page stays light. Also the dark panel on its own |
| `about` | `about-popup.png` | The toolbar popup (`about.html`) at 320px wide, as tall as its content |

The page, course and study direction are constants at the top of `capture.mjs`.

## How it works, and why

These are the non-obvious parts; keep them in mind before changing the script.

- **Extensions need full Chromium.** The context is launched with `channel: 'chromium'`. Playwright's default headless shell cannot load extensions. Each browser setup keeps its own persistent profile in `.cache/`, so course data stays cached between runs and NTNU, emnr and the cache worker are not hit again for every run.
- **Karakterweb's bot protection needs no workaround.** karakterweb.no answers HEAD requests from headless Chromium with 403, but the extension sends it none: the Karakterweb link takes its state from the course's Karakterweb data, which comes through the cache worker, just like the emnr link. So everything in the captures (grades, reviews, link states) comes from the extension's own live requests. Do not spoof the user agent or otherwise get around karakterweb.no's bot protection.
- **The 3rd year needs a study direction.** Its tables only appear after a direction is picked in the dropdown, and then each table shows only a few rows behind "vis mer". The script picks `MTDTPS-24` (Programvaresystemer) and clicks "vis mer".
- **NTNU's header is sticky.** The script measures the header's bottom edge and scrolls the semester heading to just below it. `study-without` reuses the same table and offset (saved in `.cache/study-plan-pick.json`), so the before/after images line up.
- **The panel scrolls at 800px.** The course-page panel is capped at the viewport height, so at 1280x800 its last link is cut off. The full-page captures keep that (it is what users see), but for `panel-*.png` the window is made taller so the whole panel shows. The panel's rounded corners are then masked to transparency on a canvas; its drop shadow is cut off at the element's edges.
- **Forced dark mode has side effects.** `--force-dark-mode` with `WebContentsForceDark` darkens the whole NTNU page, but also makes the black "NTNU" logo text nearly invisible and turns the panel's white slider handles dark. That is why `panel-dark.png` comes from the `course-dark-page-light` step instead.
- **"Loaded" means:** every course row is processed, no `.emnehjelper-loading` dots or `.emnehjelper-link-loading` links are left, and every row has its badges. On the course page: the panel is expanded, no service button is still checking its link, and every logo has loaded. Fonts and images are awaited before each capture.

## When it breaks

The script depends on NTNU's markup and on the extension's class names. If NTNU changes its pages or the extension's UI changes, update these:

- NTNU study plan: `div.year` (the 3rd year is index 2), the direction `<select>`, `table.courselist`, `tr.course` / `tr.courserow`, `.directionContent`, `h3.studyperiod`, the "vis mer" text
- Extension: `.emnehjelper-*` classes in `course-list.js`, `.popup` / `.popup-header` / `.popup-content` / `.service-btn*` in `course-page.js`, `#version` in `about.html`
- The study plan URL and cohort (`#year=2024`) will eventually stop showing a 3rd year with data; update `STUDY_PLAN_URL`
