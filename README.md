# Sweetgreen Color Field

A tool for exploring new color without leaving the Sweetgreen world.
**Grounded ← Evergreen → Ripe.** Evergreen is the constant; Grounded and Ripe are explorable territories.

> The front end expresses the brand intuitively; the back end protects it technically.

## Run
Static site, no build step. Open `index.html`, or `python3 -m http.server 8080`.
Tests: `node tests/engine.test.js`

## Layout
One screen, no scrolling: four columns read left to right (1 Choose an expression, 2 Explore color, 3 Build a combination, 4 Apply). Columns fit the viewport height; on very short screens secondary detail (usage tags, notes) is dropped rather than scrolled. Below ~1080px wide the columns stack and the page scrolls.
OKLCH values, scores and contrast numbers are in the **Technical view** drawer (toggle top right, Esc closes), so the main screen stays in brand language.

The previous scrolling layout is archived in `archive/` (single self-contained HTML, commit `6e821b5`).

## Architecture
| File | Role |
|---|---|
| `js/color.js` | OKLCH ↔ sRGB, gamut fitting, OKLab distance, WCAG + APCA, CMYK (indicative) |
| `js/territories.js` | Grounded / Ripe as **hue-dependent regions** (keypoint table every 30°, interpolated), membership + depth, `colorAt`, `snapInto`. Brand constants in `CONFIG` |
| `js/spectrum.js` | The Ripe↔Grounded balance: which chip combinations are allowed in each zone, the 3-chip cap, and the visual area of each chip |
| `js/engine.js` | Evergreen relationship, Grounded↔Ripe compatibility, counterpart recommendation, contrast levels, brand-use guidance tags, Dominant/Supporting/Accent hierarchy, production values. All thresholds in `PARAMS` |
| `js/app.js` | UI: Expression → Explore → Build → Apply. Translates engine output into brand language; numbers appear only under **Technical view** |

## How the spec maps to code
- Territory membership → `territories.membership` (core / edge / outside)
- Evergreen relationship (lightness separation, hue, chroma, perceptual distance, dominance) → `engine.evergreenRelationship`
- Cross-territory compatibility → `engine.pairCompat`, `engine.trio`
- Counterparts from approved territory only → `engine.recommend`
- Contrast & guidance ("Approved for text", "Use with dark type"…) → `engine.guidance`
- Roles follow visual area, no fixed ratios → `engine.hierarchy`
- Multi-chip combinations (every chip vs Evergreen, Grounded×Ripe pairs, same-territory spacing) → `engine.evaluate`; companion chip in the same territory → `engine.companion`
- Output (HEX/RGB/CMYK/OKLCH, combinations, CSS, JSON, shareable link) → `app.js` Apply

## The balance handlebar
Evergreen is always present and never counted. At most **3 other chips**; 3 is possible but flagged *not recommended*.
The handlebar runs **G (left) to R (right)** through five zones. Letters: G Grounded, E Evergreen, R Ripe. The default layout in each zone is the first recommended one.

| Zone | Layouts | Visual weight |
|---|---|---|
| Grounded end | `GGE`, `GE` | Grounded only |
| Grounded to center | `GGER` (3 chips), `GER` | Grounded larger than Ripe |
| Center | `GER` | Grounded and Ripe equal |
| Center to Ripe | `GERR` (3 chips), `GER` | Ripe larger than Grounded |
| Ripe end | `ERR`, `ER` | Ripe only |

Edit `ZONES` in `js/spectrum.js` to change this. Roles (Dominant / Supporting / Accent) follow each chip's visual area, which follows the handle, so Evergreen leads in the middle and gives way toward the ends. Shared links carry `v=2`; older links keep their colors but reset the balance.

## Needs calibration before launch
1. **Territory tables are provisional.** They are seeded from general color knowledge and sRGB gamut limits, not from approved Sweetgreen samples. Follow *Visual → Sample → Measure → Rule*: classify a large set as approved / borderline / outside, measure it in OKLCH, and replace the tables in `territories.js`. The `core`/`edge` margin is `CONFIG.coreDepth`.
2. **Evergreen** is PANTONE 2423 C (RGB 0/168/16, `#00A810`, OKLCH 63% 0.212 143°) in `CONFIG`. **Ink** (`#141A18`) is an assumed dark type color; confirm it. The tool's own UI uses a deeper green (`--deep` in `style.css`) for headings and buttons because white type on Evergreen is only about 3.2:1.
3. **Scoring weights and thresholds** in `engine.PARAMS` (hue harmony curve, Evergreen-fit weights) are first-pass and should be tuned against pairings the brand team judges good or bad.
4. **CMYK** is a naive conversion; use press-profile values for print.
5. Contrast "body text" requires WCAG ≥ 4.5 **and** APCA |Lc| ≥ 60 (`PARAMS.contrast`). Adjust to your accessibility policy.
