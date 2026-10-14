# sweetgreen color farm

A tool for exploring new color without leaving the Sweetgreen world.
**Grounded ← Evergreen → Ripe.** Evergreen is the constant; Grounded and Ripe are explorable territories.

> The front end expresses the brand intuitively; the back end protects it technically.

## Run
Static site, no build step. Open `index.html`, or `python3 -m http.server 8080`.
Tests: `node tests/engine.test.js`

## Layout (v5, from the Figma design)
Fluid layout on the full window (margin 25px, gutter 20px, no scrolling). Panels run the full height between the margins and are 332px wide (Library 567px). The colors sit once at the center of the free area; blocks span the height minus 50px top and bottom, at most 760px. One panel at a time on the right.
- **Intro**: `sg` monogram, `s` and `g` travel to the edges while photos stack, then the color blocks and the panel arrive. Click to skip; skipped for shared links and `prefers-reduced-motion` (or `?intro=0`).
- **Stage**: Ripe / Evergreen / Grounded blocks (radius 46.773). Height follows the balance (rescaled so a balanced color is as large as Evergreen, as drawn). Blocks are 3D, using the technique read from the símon.com source files: each block sits in a wrapper with CSS `perspective: 30vh`, the face rotates (`rotateX` / `rotateY`) toward the pointer with the pivot easing to the pointer, a hovered block gets a soft shadow (`0 .5rem 2rem -.15rem`), pressing squeezes it to .95. The selected block (steps 2 and 3) keeps facing the pointer. Evergreen is flat. Angles and easing are in `M.tilt`.
- **Not chosen yet**: Ripe and Grounded start as an empty slot (light gray fill, dashed-look outline, gray label and a "Not chosen yet" hint) until a color is picked in step 2 (field, slider, HEX, or a counterpart). Unchosen colors are left out of Apply, exports, the Library thumbnail and the matrix.
- **Panel steps**: 1 Choose an expression (balance slider G to R, layouts) · 2 Explore color (tabs, color field, intensity, HEX check, how it reads) · 3 Explore counterparts (tabs, 3 × 2 suggestions, reset selection) · 4 Apply (HEX / CMYK / RGB / OKLCH, type-on-color matrix, Copy link / JSON / CSS variable, Name this palette, Add to Library / Open Library; Share and Archive sit at the bottom, above the buttons).
- **`?`** opens About beside the panel; **Library** replaces the panel (the panel slides fully out, then Library slides in; Restart does the same out-and-in) (hover a palette for ✕ delete / ↗ open). Esc closes both.
- **Palette name** is an addition that is not in the Figma design: a name field above Add to Library in step 4. It becomes the Library label and goes into exports and share links.
- The Technical view of v4 is not in the design and is not in the UI; the numbers remain in the engine and in the v4 archive.

All motion durations and easings live in `js/motion.js`. They are **placeholders estimated from the start and end frames**, not values from the prototype.

Earlier layouts are archived in `archive/` (v1 scrolling, v2 iOS four columns, v3 central stage, v4 merged layout), each a single self-contained HTML plus a commit hash.

## Look
From the design: white page, `#eee` panel (radius 23), black/gray buttons (radius 13), `#c1c1c1` inactive steps, `#767676` secondary text. Letter-spacing is normalized to -3% (the design mixes 3.3% and 4%). Evergreen is `#00A810`.
Type: GT America Standard Regular for text; GT America Condensed Bold for color names, "Aa", step numbers and the intro title (WOFF2 files in `fonts/`, see `fonts/README.md`).

Spacing is flex + gap, mirroring the Figma auto layout (read from the frames, not measured from screenshots): `.panel .in` is a column with space-between (`.body` on top, `.bottom` with the buttons under it); steps are `.stack` columns whose gap comes from a `.gapN` class (value in px). No absolute positioning is used for content (only for overlays: the sliding pill, field marker, Check button).

Layout knobs in `css/style.css` (`:root`): `--stage-max-h` (tallest the color blocks get, 760px), `--stage-margin-y` (space above and below them, 50px), `--sw` on `#art` (block width, 32.36vw up to 560px).

## Architecture
| File | Role |
|---|---|
| `js/color.js` | OKLCH ↔ sRGB, gamut fitting, OKLab distance, WCAG + APCA, CMYK (indicative) |
| `js/territories.js` | Grounded / Ripe as **hue-dependent regions** (keypoint table every 30°, interpolated), membership + depth, `colorAt`, `snapInto`. Brand constants in `CONFIG` |
| `js/spectrum.js` | The Ripe↔Grounded balance: which chip combinations are allowed in each zone, the 3-chip cap, and the visual area of each chip |
| `js/engine.js` | Evergreen relationship, Grounded↔Ripe compatibility, counterpart recommendation, contrast levels, brand-use guidance tags, Dominant/Supporting/Accent hierarchy, production values. All thresholds in `PARAMS` |
| `js/motion.js` | Intro timeline and every duration / easing (placeholders) |
| `js/app.js` | UI: stepper panel, stage, About, Library. Translates engine output into brand language |

## How the spec maps to code
- Territory membership → `territories.membership` (core / edge / outside)
- Evergreen relationship (lightness separation, hue, chroma, perceptual distance, dominance) → `engine.evergreenRelationship`
- Cross-territory compatibility → `engine.pairCompat`, `engine.trio`
- Counterparts from approved territory only → `engine.recommend`
- Contrast & guidance ("Approved for text", "Use with dark type"…) → `engine.guidance`
- Roles follow visual area, no fixed ratios → `engine.hierarchy`
- Multi-chip combinations (every chip vs Evergreen, Grounded×Ripe pairs, same-territory spacing) → `engine.evaluate`; companion chip in the same territory → `engine.companion`
- Output (HEX/RGB/CMYK/OKLCH, combinations, CSS, JSON, shareable link) → `app.js` (right panel, stage, top bar)

## The balance handlebar
Evergreen is always present and never counted. At most **3 other chips**. Two Grounded or two Ripe (so `GGE`, `GGER`, `GERR`, `ERR`) are possible but flagged *not recommended*; layouts are listed fewest colors first. A second Ripe stacks above the first.
The handlebar runs **G (left) to R (right)** through five zones. Letters: G Grounded, E Evergreen, R Ripe. The default layout in each zone is the first recommended one (`GE`, `GER`, `GER`, `GER`, `ER`).

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
2. **Evergreen** is PANTONE 2423 C (RGB 0/168/16, `#00A810`, OKLCH 63% 0.212 143°) in `CONFIG`. **Ink** (`#111111`) is an assumed dark type color; confirm it. The tool's own UI uses black for headings and buttons because white type on Evergreen is only about 3.2:1.
3. **Scoring weights and thresholds** in `engine.PARAMS` (hue harmony curve, Evergreen-fit weights) are first-pass and should be tuned against pairings the brand team judges good or bad.
4. **CMYK** is a naive conversion; use press-profile values for print.
5. Contrast "body text" requires WCAG ≥ 4.5 **and** APCA |Lc| ≥ 60 (`PARAMS.contrast`). Adjust to your accessibility policy.
