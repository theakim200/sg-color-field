# Fonts

The UI is set in **GT America Compressed**. The files used so far are the **Trial** cuts (Bold, Bold Italic, Black, Black Italic, Light Italic), which are not committed to this repository (`.gitignore`) because the trial license is for evaluation only.

To run with the font locally, place these files in this folder:

- `GTAmerica-Compressed-Bold-Trial.otf`
- `GTAmerica-Compressed-Black-Trial.otf`
- (optional, not currently used) `…-Bold-Italic-Trial.otf`, `…-Black-Italic-Trial.otf`, `…-Light-Italic-Trial.otf`

Without them the page falls back to Helvetica Neue / Arial.

Before launch, license GT America (web) and replace the trial files; then update the `@font-face` URLs in `css/style.css` if the file names differ.

Trial limits seen in the supplied files: no upright Regular or Light, and no glyphs for `# : ; / ( ) + · % ° ≈ ← → ↑ ↓ ✓ ✕`. Those characters fall back to the next font in the stack.
