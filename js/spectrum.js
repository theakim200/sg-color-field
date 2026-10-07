/* Spectrum rules: which color-chip combinations are allowed at each point of the
   Grounded <-> Ripe balance, and how much visual area each chip gets.

   Notation: G = Grounded chip, E = Evergreen (always present, never counted), R = Ripe chip.
   At most 3 chips excluding Evergreen. Three chips are possible but not recommended.

   The balance value p is the Ripe weight: 0 = Grounded end, 1 = Ripe end (slider runs G -> R).
   Zones are listed from the Grounded end to the Ripe end. In each zone the default layout is
   the first recommended one; "lead" says which territory is visually larger there. */
(function (root) {
  const SG = root.SG;

  const MAX_CHIPS = 3;
  const RECOMMENDED_MAX = 2;

  const ZONES = [
    { id: 'z1', min: 0.0, lead: 'grounded', name: 'Grounded end', combos: ['GGE', 'GE'] },
    { id: 'z2', min: 0.2, lead: 'grounded', name: 'Grounded to center', combos: ['GGER', 'GER'] },
    { id: 'z3', min: 0.4, lead: null, name: 'Center', combos: ['GER'] },
    { id: 'z4', min: 0.6, lead: 'ripe', name: 'Center to Ripe', combos: ['GERR', 'GER'] },
    { id: 'z5', min: 0.8, lead: 'ripe', name: 'Ripe end', combos: ['ERR', 'ER'] },
  ];

  function zoneIndex(p) {
    let idx = 0;
    for (let i = 0; i < ZONES.length; i++) if (p >= ZONES[i].min) idx = i;
    return idx;
  }

  /** Index of the layout used in a zone until the user picks another: the first recommended one. */
  function defaultPick(zone) {
    const i = zone.combos.findIndex((c) => parse(c).recommended);
    return i < 0 ? 0 : i;
  }

  function parse(code) {
    const g = (code.match(/G/g) || []).length, r = (code.match(/R/g) || []).length;
    return { g, r, chips: g + r, recommended: g + r <= RECOMMENDED_MAX, valid: g + r <= MAX_CHIPS && g + r >= 1 && code.includes('E') };
  }

  /** Chip ids present in a combo, e.g. 'GGER' -> ['g1','g2','r1']. */
  function ids(code) {
    const { g, r } = parse(code), out = [];
    for (let i = 1; i <= g; i++) out.push('g' + i);
    for (let i = 1; i <= r; i++) out.push('r' + i);
    return out;
  }

  function label(code) {
    const { g, r } = parse(code), part = (n, name) => (n === 0 ? null : n === 1 ? name : `${n} ${name}`);
    return [part(g, 'Grounded'), 'Evergreen', part(r, 'Ripe')].filter(Boolean).join(' + ');
  }

  // Visual area of a territory as a function of its share of the balance. Evergreen is fixed at 1,
  // so it reads as the anchor in the middle of the range and gives way at the extremes.
  const areaOf = (w) => 0.25 + 0.95 * w;
  const SPLIT = [1, 0.45]; // two chips in one territory: the lead keeps the full area, the companion is a smaller second voice

  /** Effective Grounded / Ripe weights. The center zone is exactly balanced; elsewhere they follow the handle. */
  function weights(p) {
    const w = ZONES[zoneIndex(p)].lead === null ? 0.5 : p;
    return { g: 1 - w, r: w };
  }

  function areas(p, code) {
    const { g, r } = parse(code), w = weights(p), out = { e: 1 };
    const spread = (prefix, n, share) => { const total = areaOf(share); if (n === 1) out[prefix + 1] = total; else if (n === 2) SPLIT.forEach((k, i) => (out[prefix + (i + 1)] = total * k)); };
    spread('g', g, w.g);
    spread('r', r, w.r);
    return out;
  }

  SG.spectrum = { MAX_CHIPS, RECOMMENDED_MAX, ZONES, zoneIndex, defaultPick, parse, ids, label, weights, areas };
  if (typeof module !== 'undefined') module.exports = SG.spectrum;
})(typeof globalThis !== 'undefined' ? globalThis : this);
