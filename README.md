# Sweetgreen Color Field

A tool for exploring new color without leaving the Sweetgreen world.
**Grounded ← Evergreen → Ripe.** Evergreen is the constant; Grounded and Ripe are explorable territories.

> The front end expresses the brand intuitively; the back end protects it technically.

## Run
Static site, no build step. Open `index.html`, or `python3 -m http.server 8080`.
Tests: `node tests/engine.test.js`

## Architecture
| File | Role |
|---|---|
| `js/color.js` | OKLCH ↔ sRGB, gamut fitting, OKLab distance, WCAG + APCA, CMYK (indicative) |
| `js/territories.js` | Grounded / Ripe as **hue-dependent regions** (keypoint table every 30°, interpolated), membership + depth, `colorAt`, `snapInto`. Brand constants in `CONFIG` |
| `js/engine.js` | Evergreen relationship, Grounded↔Ripe compatibility, counterpart recommendation, contrast levels, brand-use guidance tags, Dominant/Supporting/Accent hierarchy, production values. All thresholds in `PARAMS` |
| `js/app.js` | UI: Expression → Explore → Build → Apply. Translates engine output into brand language; numbers appear only under **Technical view** |

## How the spec maps to code
- Territory membership → `territories.membership` (core / edge / outside)
- Evergreen relationship (lightness separation, hue, chroma, perceptual distance, dominance) → `engine.evergreenRelationship`
- Cross-territory compatibility → `engine.pairCompat`, `engine.trio`
- Counterparts from approved territory only → `engine.recommend`
- Contrast & guidance ("Approved for text", "Use with dark type"…) → `engine.guidance`
- Roles, no fixed ratios → `engine.hierarchy`
- Output (HEX/RGB/CMYK/OKLCH, combinations, CSS, JSON, shareable link) → `app.js` Apply

## Needs calibration before launch
1. **Territory tables are provisional.** They are seeded from general color knowledge and sRGB gamut limits, not from approved Sweetgreen samples. Follow *Visual → Sample → Measure → Rule*: classify a large set as approved / borderline / outside, measure it in OKLCH, and replace the tables in `territories.js`. The `core`/`edge` margin is `CONFIG.coreDepth`.
2. **Evergreen** is set to `#00473C` and **Ink** to `#141A18` in `CONFIG`. Confirm against the brand master.
3. **Scoring weights and thresholds** in `engine.PARAMS` (hue harmony curve, Evergreen-fit weights) are first-pass and should be tuned against pairings the brand team judges good or bad.
4. **CMYK** is a naive conversion; use press-profile values for print.
5. Contrast "body text" requires WCAG ≥ 4.5 **and** APCA |Lc| ≥ 60 (`PARAMS.contrast`). Adjust to your accessibility policy.
