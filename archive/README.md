# Archive

## v1: scrolling layout (commit `6e821b5`)
`sweetgreen-color-field-v1-scroll.html` is the whole tool in one self-contained file (no other files needed). Open it by double-click.
Four steps stacked vertically and read by scrolling: balance handlebar (G to R), explore, build, apply.
Restore the source of this version with `git checkout 6e821b5`.

## v2: iOS-tone four columns (commit `a20de7f`)
`sweetgreen-color-field-v2-ios-columns.html` is the whole tool in one self-contained file. It does not embed GT America (the trial files are not kept in this repository), so display type falls back to Helvetica/Arial. A copy with the fonts embedded was handed over separately.
Four columns read left to right on one screen (expression, explore, build, apply), iOS-style cards with soft shadows, GT America Compressed for display and the system sans for text.
Restore the source of this version with `git checkout a20de7f`.

## v3: central stage with surrounding tools (commit `e384a4e`)
`sweetgreen-color-field-v3-stage.html`: the colors once on a central stage (each block carries its role and usable type colors, plus a Blocks / Composition view), a left expression panel, a right selected-color panel, a counterpart dock and a top bar. Single self-contained file, GT America not embedded.
Restore the source with `git checkout e384a4e`.
