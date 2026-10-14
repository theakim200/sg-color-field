# Fonts

The UI uses two GT America web fonts, both committed here as WOFF2:

- `GTAmerica-Standard-Regular.woff2` (family "GT America", 400): all text, buttons and labels.
- `GTAmerica-Condensed-Bold.woff2` (family "GT America Condensed", 700): color names, "Aa" in the type matrix, step numbers and the intro title.

They are declared at the top of `css/style.css`. Make sure the license you hold covers web use on the domain this is published on.

**Glyph coverage (checked in the browser).** These files do not contain `# : / % + ( ) ? & ' ’ “ ” — · ° ≈ ← → ✓ ✕`. Where the UI needs them (the `#` in HEX values, `/` and `%` in OKLCH, the placeholder `?`) the browser falls back to Helvetica Neue / Arial. The `?` button and the check / cross marks are drawn as SVG. A fuller cut of the same fonts would remove the fallback; nothing else needs to change.

**Italic.** There is no Condensed italic file; none is used in the current design.

The earlier `.otf` trial files are not used any more. `*.otf` stays in `.gitignore` so trial files are never committed by accident.
