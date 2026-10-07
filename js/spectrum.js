/* Spectrum rules: which color-chip combinations are allowed at each point of the
   Ripe <-> Grounded balance, and how much visual area each chip gets.

   Notation: G = Grounded chip, E = Evergreen (always present, never counted), R = Ripe chip.
   At most 3 chips excluding Evergreen. Three chips are possible but not recommended.

   The balance value p runs 0 (Ripe end) .. 1 (Grounded end). Zones are listed from the
   Grounded end to the Ripe end; the first combo of each zone is its default. */
(function (root) {
  const SG = root.SG;

  const MAX_CHIPS = 3;
  const RECOMMENDED_MAX = 2;

  const ZONES = [
    { id: 'z1', min: 0.8, combos: ['GGE'] },
    { id: 'z2', min: 0.6, combos: ['GE', 'GER'] },
    { id: 'z3', min: 0.4, combos: ['GER', 'GGER'] },
    { id: 'z4', min: 0.2, combos: ['ERR', 'GERR'] },
    { id: 'z5', min: 0.0, combos: ['ER'] },
  ];

  function zoneIndex(p) {
    for (let i = 0; i < ZONES.length; i++) if (p >= ZONES[i].min) return i;
    return ZONES.length - 1;
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

  function areas(p, code) {
    const { g, r } = parse(code), out = { e: 1 };
    const spread = (prefix, n, w) => { const total = areaOf(w); if (n === 1) out[prefix + 1] = total; else if (n === 2) SPLIT.forEach((s, i) => (out[prefix + (i + 1)] = total * s)); };
    spread('g', g, p);
    spread('r', r, 1 - p);
    return out;
  }

  SG.spectrum = { MAX_CHIPS, RECOMMENDED_MAX, ZONES, zoneIndex, parse, ids, label, areas };
  if (typeof module !== 'undefined') module.exports = SG.spectrum;
})(typeof globalThis !== 'undefined' ? globalThis : this);
