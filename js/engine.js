/* Back-end color logic. Evaluates a color (or a combination) along several dimensions at once:
   territory membership, Evergreen relationship, cross-territory compatibility, visual hierarchy,
   and contrast. Everything returns plain data; app.js translates it into brand language.
   All thresholds live in PARAMS so they can be tuned against approved samples. */
(function (root) {
  const SG = root.SG;
  const C = SG.color, T = SG.territories;
  const { clamp, ramp, hueDiff } = C;

  const PARAMS = {
    evergreen: { // weights sum to 1
      w: { distinct: 0.30, separation: 0.20, hue: 0.15, chroma: 0.10, dominance: 0.25 },
      distinctRange: [0.08, 0.22],   // OKLab distance that reads as "its own color"
      separationRange: [0.05, 0.25], // |dL| to Evergreen
      maxChromaRatio: 4.2,           // beyond this the color overpowers Evergreen's intensity
      works: 0.72, withCare: 0.50,
    },
    // hue relationship score by angular distance (0..180): analogous and intentional contrast
    // read well; the middle bands are the awkward "almost related" zone.
    hueHarmony: [[0, 0.9], [40, 0.9], [70, 0.6], [100, 0.7], [130, 0.85], [160, 1], [180, 1]],
    pair: { w: { distinct: 0.35, spread: 0.20, chromaBalance: 0.20, hue: 0.25 }, distinctRange: [0.10, 0.28] },
    trio: { relG: 0.3, relR: 0.3, pair: 0.4 },
    contrast: { bodyWcag: 4.5, bodyLc: 60, largeWcag: 3, largeLc: 45 },
  };

  const interp = (tbl, x) => {
    for (let i = 1; i < tbl.length; i++) if (x <= tbl[i][0]) { const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
    return tbl[tbl.length - 1][1];
  };
  const hueHarmony = (dh) => interp(PARAMS.hueHarmony, dh);
  const EV = T.evergreen;

  /* ---------- Evergreen relationship ---------- */
  function evergreenRelationship(c) {
    const P = PARAMS.evergreen;
    const dE = C.deltaE(c, EV), dL = c.L - EV.L, dh = hueDiff(c.h, EV.h), cRatio = c.C / EV.C;
    const parts = {
      distinct: ramp(dE, ...P.distinctRange),
      separation: ramp(Math.abs(dL), ...P.separationRange),
      hue: hueHarmony(dh),
      chroma: cRatio <= P.maxChromaRatio ? 1 : clamp(1 - (cRatio - P.maxChromaRatio) / 2, 0.3, 1),
      dominance: 1,
    };
    // a second green of similar lightness and presence fights Evergreen for the anchor role;
    // chroma is judged relative to Evergreen's own vividness
    const closeHue = 1 - ramp(dh, 20, 60), closeL = 1 - ramp(Math.abs(dL), 0.08, 0.25), closeC = ramp(c.C / EV.C, 0.25, 0.6);
    parts.dominance = 1 - 0.85 * closeHue * closeL * closeC;
    const score = Object.entries(P.w).reduce((s, [k, w]) => s + parts[k] * w, 0);
    const verdict = score >= P.works ? 'works' : score >= P.withCare ? 'care' : 'competes';

    const notes = [];
    if (parts.dominance < 0.6) notes.push('Competes with Evergreen as a green.');
    else if (parts.distinct < 0.5) notes.push('Sits close to Evergreen; it may not read as its own color.');
    if (parts.separation < 0.4 && parts.dominance >= 0.6) notes.push('Similar depth to Evergreen; pair with care.');
    if (dh >= 150 && parts.distinct >= 0.5) notes.push('An intentional contrast to Evergreen.');
    else if (dh <= 40 && parts.distinct >= 0.5) notes.push('A related hue that keeps Evergreen in the family.');
    if (!notes.length) notes.push('Evergreen stays the recognizable anchor.');
    return { score, verdict, parts, metrics: { dE, dL, dh, cRatio }, notes };
  }

  /* ---------- Grounded <-> Ripe ---------- */
  function pairCompat(g, r) {
    const P = PARAMS.pair;
    const dE = C.deltaE(g, r), spread = Math.abs(g.L - r.L), dh = hueDiff(g.h, r.h);
    const parts = {
      distinct: ramp(dE, ...P.distinctRange),
      spread: ramp(spread, 0.04, 0.22),
      chromaBalance: ramp(r.C / Math.max(g.C, 1e-3), 1.0, 2.2),
      hue: hueHarmony(dh),
    };
    const score = Object.entries(P.w).reduce((s, [k, w]) => s + parts[k] * w, 0);
    return { score, parts, metrics: { dE, spread, dh } };
  }

  function trio(g, r) {
    const rg = evergreenRelationship(g), rr = evergreenRelationship(r), p = pairCompat(g, r), w = PARAMS.trio;
    return { score: rg.score * w.relG + rr.score * w.relR + p.score * w.pair, grounded: rg, ripe: rr, pair: p };
  }

  /** Counterparts for a chosen color, drawn only from the other territory's approved core. */
  function recommend(chosen, chosenTerritory, count = 6) {
    const other = chosenTerritory === 'grounded' ? 'ripe' : 'grounded';
    const cands = [];
    for (let h = 0; h < 360; h += 10) {
      const b = T.bounds(other, h);
      for (const lf of [0.15, 0.4, 0.65, 0.9]) for (const t of [0.25, 0.6, 0.9]) {
        const col = T.colorAt(other, h, b.Lmin + lf * (b.Lmax - b.Lmin), t);
        const m = T.membership(col);
        if (m.territory !== other || m.status !== 'core') continue;
        const [g, r] = chosenTerritory === 'grounded' ? [chosen, col] : [col, chosen];
        const rel = evergreenRelationship(col), pair = pairCompat(g, r);
        if (rel.verdict === 'competes') continue;
        cands.push({ color: col, rel, pair, score: 0.4 * rel.score + 0.6 * pair.score });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    const picked = [], used = new Set();
    for (const c of cands) {
      const bucket = Math.floor(c.color.h / 36);
      if (used.has(bucket)) continue;
      used.add(bucket); picked.push(c);
      if (picked.length === count) break;
    }
    return picked.map((c) => ({ ...c, reason: reasonFor(c, chosen, chosenTerritory) }));
  }

  function reasonFor(c, chosen, chosenTerritory) {
    const out = [], name = chosenTerritory === 'grounded' ? 'Grounded' : 'Ripe';
    const dh = c.pair.metrics.dh, dL = c.color.L - chosen.L;
    if (dh >= 140) out.push(`Opposes your ${name} in hue`);
    else if (dh <= 40) out.push(`Stays in your ${name}'s family`);
    if (Math.abs(dL) >= 0.15) out.push(dL > 0 ? `Lighter than your ${name}` : `Deeper than your ${name}`);
    if (c.rel.parts.hue >= 0.95 && out.length < 2) out.push('Strong contrast with Evergreen');
    if (!out.length) out.push('Balanced against Evergreen');
    return out.slice(0, 2).join(' · ');
  }

  /* ---------- Contrast ---------- */
  function contrastLevel(fg, bg) {
    const K = PARAMS.contrast, ratio = C.wcag(fg, bg), lc = C.apca(fg, bg);
    const level = ratio >= K.bodyWcag && Math.abs(lc) >= K.bodyLc ? 'body' : ratio >= K.largeWcag && Math.abs(lc) >= K.largeLc ? 'large' : 'fail';
    return { fg, bg, ratio, lc, level };
  }
  const RANK = { body: 2, large: 1, fail: 0 };

  /** Foreground options for a background (white, ink, Evergreen, plus extras). */
  function foregrounds(bgHex, extras = []) {
    const { whiteHex, inkHex, evergreenHex } = T.CONFIG;
    const opts = [['White', whiteHex], ['Ink', inkHex], ['Evergreen', evergreenHex], ...extras];
    return opts.filter(([, hex]) => hex.toUpperCase() !== bgHex.toUpperCase())
      .map(([name, hex]) => ({ name, ...contrastLevel(hex, bgHex) }));
  }
  function bestForeground(bgHex) {
    const { whiteHex, inkHex } = T.CONFIG;
    return [['White', whiteHex], ['Ink', inkHex]].map(([name, hex]) => ({ name, ...contrastLevel(hex, bgHex) }))
      .sort((a, b) => RANK[b.level] - RANK[a.level] || Math.abs(b.lc) - Math.abs(a.lc))[0];
  }

  /** Brand-use guidance: translates the technical results into usage tags. */
  function guidance(hex, c) {
    const best = bestForeground(hex), { whiteHex, inkHex } = T.CONFIG;
    const asText = [whiteHex, inkHex].map((bg) => contrastLevel(hex, bg));
    const tags = [];
    if (best.level === 'body') tags.push({ text: 'Best for backgrounds', tone: 'good' }, { text: best.name === 'Ink' ? 'Use with dark type' : 'Use with white type', tone: 'info' });
    else if (best.level === 'large') tags.push({ text: 'Large type only on top', tone: 'warn' });
    if (asText.some((x) => x.level === 'body')) tags.push({ text: 'Approved for text', tone: 'good' });
    if (best.level !== 'body' && !asText.some((x) => x.level === 'body')) tags.push({ text: 'Best used as an accent', tone: 'info' });
    if (best.level === 'large') tags.push({ text: 'Not recommended for small text', tone: 'warn' });
    const rel = evergreenRelationship(c);
    if (rel.verdict === 'works') tags.push({ text: 'Works with Evergreen', tone: 'good' });
    else if (rel.verdict === 'care') tags.push({ text: 'Use carefully with Evergreen', tone: 'warn' });
    else tags.push({ text: 'Competes with Evergreen', tone: 'bad' });
    return { tags, best, rel };
  }

  /* ---------- Hierarchy ---------- */
  const ROLE_NOTES = {
    dominant: 'Large fields and backgrounds. Sets the energy.',
    supporting: 'Secondary fields, panels, UI and type.',
    accent: 'Small, deliberate moments: buttons, tags, highlights.',
  };
  /** structure: 'grounded' | 'ripe' | 'both'; lean (for both): 'grounded' | 'balanced' | 'ripe'. */
  function hierarchy(structure, lean, hexes) {
    let order;
    if (structure === 'grounded') order = ['grounded', 'evergreen'];
    else if (structure === 'ripe') order = ['ripe', 'evergreen'];
    else if (lean === 'grounded') order = ['grounded', 'evergreen', 'ripe'];
    else if (lean === 'ripe') order = ['ripe', 'evergreen', 'grounded'];
    else order = ['evergreen', 'grounded', 'ripe'];
    // the dominant color has to be able to host type; otherwise it trades places with the next
    if (order.length > 1 && bestForeground(hexes[order[0]]).level === 'fail' && bestForeground(hexes[order[1]]).level !== 'fail') order = [order[1], order[0], ...order.slice(2)];
    const names = ['dominant', 'supporting', 'accent'];
    return order.map((key, i) => ({ key, role: names[i], note: ROLE_NOTES[names[i]], anchor: key === 'evergreen' }));
  }

  /** Production values for one color. Re-derives OKLCH from the final HEX so the two always agree. */
  function spec(c) {
    const hex = C.toHex(c), final = C.fromHex(hex), [r, g, b] = C.parseHex(hex);
    return { hex, rgb: [r, g, b], cmyk: C.cmyk(hex), oklch: final, oklchText: C.oklchString(final) };
  }

  SG.engine = { PARAMS, hueHarmony, evergreenRelationship, pairCompat, trio, recommend, contrastLevel, foregrounds, bestForeground, guidance, hierarchy, spec };
  if (typeof module !== 'undefined') module.exports = SG.engine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
