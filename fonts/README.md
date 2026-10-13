# Fonts

The UI is set in **GT America Compressed**. The files used so far are the **Trial** cuts (Bold, Bold Italic, Black, Black Italic, Light Italic), which are not committed to this repository (`.gitignore`) because the trial license is for evaluation only.

To run with the font locally, place these files in this folder:

- `GTAmerica-Compressed-Bold-Trial.otf`
- `GTAmerica-Compressed-Black-Trial.otf`
- (optional, not currently used) `…-Bold-Italic-Trial.otf`, `…-Black-Italic-Trial.otf`, `…-Light-Italic-Trial.otf`

Without them the display type falls back to Helvetica Neue / Arial.

**Where it is used.** GT America Compressed Bold is the display face (`--font-display`: column titles, color names, hex headline, big numerals). Body copy, labels and data use the system sans (`--font-text`) because the trial files include no Regular or Light upright. When a lighter GT America cut is licensed, add an `@font-face` for it and set `--font-text` to it to use GT America everywhere.

Before launch, license GT America (web) and replace the trial files; then update the `@font-face` URLs in `css/style.css` if the file names differ.

Trial limits seen in the supplied files: no upright Regular or Light, and no glyphs for `# : ; / ( ) + · % ° ≈ ← → ↑ ↓ ✓ ✕`. Those characters fall back to the next font in the stack.

## v5 (Figma design)
v5 uses **GT America Standard Regular** (`GTAmerica-Standard-Regular-Trial.otf`) for all panel text and buttons, and **Compressed Bold** (plus Bold Italic for the tilted selected block) for color names, "Aa" and step numbers. Files needed in this folder: `GTAmerica-Standard-Regular-Trial.otf`, `GTAmerica-Compressed-Bold-Trial.otf`, `GTAmerica-Compressed-Bold-Italic-Trial.otf`. They remain gitignored; without them the UI falls back to Helvetica / Arial.

**Glyph coverage (checked).** All three trial files are genuine GT America (names read from the font files: "GT America Trial Rg", "Cm Bd", "Cm Bd It"). They have no glyphs for `# : / % + ( ) ? & ' ’ “ ” — · ° ≈ ← → ✓ ✕`. In the UI those characters (for example the `#` in HEX values, `/` and `%` in OKLCH, the `?` placeholder text) fall back to Helvetica Neue / Arial. The `?` button and the check / cross marks are drawn as SVG. The licensed fonts will cover them.

## v5: Condensed Bold
The design's `Cn_Bd` is **Condensed Bold** (`GTAmerica-Condensed-Bold-Trial.otf`, read from the file: "GT America Trial Cn Bd"). Earlier files were Compressed (narrower) and are no longer used. There is no Condensed italic file, so the italic on the selected block is synthesized by the browser.
