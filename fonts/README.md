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
