// Run: node tests/engine.test.js
const assert = require('assert');
require('../js/color.js'); require('../js/territories.js'); require('../js/spectrum.js'); require('../js/engine.js');
const { color: C, territories: T, engine: E, spectrum: SP } = globalThis.SG;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ok', name); };

ok('hex <-> oklch round trip', () => {
  for (const hex of ['#00A810', '#FF5A36', '#8A6B4F', '#F2C94C']) assert.strictEqual(C.toHex(C.fromHex(hex)), hex);
});
ok('known contrast: black on white = 21', () => assert(Math.abs(C.wcag('#000000', '#FFFFFF') - 21) < 0.01));
ok('APCA polarity: dark on light > 0, light on dark < 0', () => { assert(C.apca('#000000', '#FFFFFF') > 100); assert(C.apca('#FFFFFF', '#000000') < -100); });

ok('every keypoint centre is a core member of its own territory', () => {
  for (const key of ['grounded', 'ripe']) for (let h = 0; h < 360; h += 30) {
    const b = T.bounds(key, h);
    const c = T.colorAt(key, h, (b.Lmin + b.Lmax) / 2, 0.5);
    const m = T.membership(c);
    assert(m.territory === key && m.status === 'core', `${key} h=${h} -> ${JSON.stringify(m)} ${C.oklchString(c)}`);
  }
});
ok('territories do not overlap at any hue', () => {
  for (let h = 0; h < 360; h += 5) {
    const g = T.bounds('grounded', h), r = T.bounds('ripe', h);
    assert(g.Cmax < r.Cmin || g.Lmax < r.Lmin || r.Lmax < g.Lmin, `overlap at ${h}`);
  }
});
ok('territories are hue-dependent (not one rectangle)', () => {
  assert(T.bounds('ripe', 95).Lmin - T.bounds('ripe', 270).Lmin > 0.25);
});
ok('neutral and Evergreen itself are outside both territories', () => {
  assert.strictEqual(T.membership(C.fromHex('#888888')).territory, null);
  assert.strictEqual(T.membership(T.evergreen).territory, null);
});
ok('snapInto lands inside the territory', () => {
  const c = T.snapInto('ripe', C.fromHex('#7a7a6a'));
  assert.strictEqual(T.membership(c).territory, 'ripe');
});
ok('reachable share of each territory is healthy (gamut check)', () => {
  for (const key of ['grounded', 'ripe']) {
    let tot = 0, good = 0;
    for (let h = 0; h < 360; h += 10) { const b = T.bounds(key, h); for (const lf of [0.1, 0.5, 0.9]) for (const t of [0.1, 0.5, 0.9]) {
      tot++; if (T.membership(T.colorAt(key, h, b.Lmin + lf * (b.Lmax - b.Lmin), t)).territory === key) good++; } }
    assert(good / tot > 0.8, `${key} reachable ${(good / tot).toFixed(2)}`);
  }
});

ok('a near-copy of Evergreen competes; a warm ripe contrast works', () => {
  assert.strictEqual(E.evergreenRelationship(C.fromHex('#10A818')).verdict, 'competes');
  assert.notStrictEqual(E.evergreenRelationship(T.colorAt('ripe', 25, 0.68, 0.6)).verdict, 'competes');
});
ok('recommend returns approved-territory, non-competing, hue-diverse counterparts', () => {
  const g = T.colorAt('grounded', 45, 0.5, 0.5), recs = E.recommend(g, 'grounded', 6);
  assert(recs.length >= 4, 'got ' + recs.length);
  for (const r of recs) { assert.strictEqual(T.membership(r.color).territory, 'ripe'); assert.notStrictEqual(r.rel.verdict, 'competes'); }
  assert(new Set(recs.map((r) => Math.floor(r.color.h / 36))).size === recs.length);
});
ok('hierarchy follows area; Evergreen always present; dominant can host type', () => {
  const mk = (p, code) => { const A = SP.areas(p, code), hex = { e: '#00A810', g1: '#8A6B4F', g2: '#5C6B7A', r1: '#FF5A36', r2: '#F2A93B' };
    return SP.ids(code).concat('e').map((id) => ({ id, key: id === 'e' ? 'evergreen' : id[0] === 'g' ? 'grounded' : 'ripe', hex: hex[id], area: A[id] })); };
  for (const [p, code] of [[0.1, 'GGE'], [0.1, 'GE'], [0.3, 'GGER'], [0.3, 'GER'], [0.5, 'GER'], [0.7, 'GER'], [0.7, 'GERR'], [0.9, 'ERR'], [0.9, 'ER']]) {
    const h = E.hierarchy(mk(p, code));
    assert(h.some((x) => x.key === 'evergreen')); assert.strictEqual(h[0].role, 'dominant');
    assert(E.bestForeground(h[0].hex).level !== 'fail', code);
  }
  assert.strictEqual(E.hierarchy(mk(0.5, 'GER'))[0].key, 'evergreen', 'balanced: Evergreen leads');
  assert.strictEqual(E.hierarchy(mk(0.05, 'GGE'))[0].key, 'grounded', 'Grounded end: Grounded leads');
  assert.strictEqual(E.hierarchy(mk(0.95, 'ER'))[0].key, 'ripe', 'Ripe end: Ripe leads');
});
ok('spectrum: every combo has at most 3 chips (Evergreen excluded) and 3-chip combos are flagged', () => {
  const all = SP.ZONES.flatMap((z) => z.combos);
  assert.deepStrictEqual([...new Set(all)].sort(), ['ER', 'ERR', 'GE', 'GER', 'GERR', 'GGE', 'GGER']);
  for (const c of all) { const q = SP.parse(c); assert(q.valid && q.chips <= SP.MAX_CHIPS, c); assert.strictEqual(q.recommended, q.chips <= 2, c); }
  assert.strictEqual(SP.parse('GGER').recommended, false); assert.strictEqual(SP.parse('GERR').recommended, false);
});
ok('spectrum: zones are exactly the agreed layouts, Grounded end -> Ripe end', () => {
  assert.deepStrictEqual(SP.ZONES.map((z) => z.combos), [['GGE', 'GE'], ['GGER', 'GER'], ['GER'], ['GERR', 'GER'], ['ERR', 'ER']]);
  assert.deepStrictEqual(SP.ZONES.map((z) => z.lead), ['grounded', 'grounded', null, 'ripe', 'ripe']);
  assert.strictEqual(SP.zoneIndex(0), 0); assert.strictEqual(SP.zoneIndex(1), 4);
  for (let p = 0; p <= 1; p += 0.01) assert(SP.zoneIndex(p) >= 0);
  assert(SP.ZONES[0].combos.every((c) => !c.includes('R')), 'Grounded end has no Ripe');
  assert(SP.ZONES[4].combos.every((c) => !c.includes('G')), 'Ripe end has no Grounded');
});
ok('spectrum: default layout is the first recommended one (never a 3-chip layout)', () => {
  assert.deepStrictEqual(SP.ZONES.map((z) => z.combos[SP.defaultPick(z)]), ['GGE', 'GER', 'GER', 'GER', 'ERR']);
});
ok('spectrum: center GER is balanced; side GERs lean Grounded / Ripe', () => {
  const mid = SP.areas(0.5, 'GER'), mid2 = SP.areas(0.45, 'GER'), mid3 = SP.areas(0.55, 'GER');
  assert.strictEqual(mid.g1, mid.r1); assert.strictEqual(mid2.g1, mid2.r1); assert.strictEqual(mid3.g1, mid3.r1);
  const gSide = SP.areas(0.3, 'GER'), rSide = SP.areas(0.7, 'GER');
  assert(gSide.g1 > gSide.r1, 'Grounded larger in the Grounded-to-center zone');
  assert(rSide.r1 > rSide.g1, 'Ripe larger in the center-to-Ripe zone');
  assert(Math.abs(gSide.g1 - rSide.r1) < 1e-9, 'mirror images');
});
ok('spectrum: area shifts monotonically with the handle outside the center', () => {
  assert(SP.areas(0.1, 'GE').g1 > SP.areas(0.3, 'GER').g1); assert(SP.areas(0.9, 'ER').r1 > SP.areas(0.7, 'GER').r1);
});
ok('companion stays in the same territory, distinct and not competing with Evergreen', () => {
  for (const [k, h] of [['grounded', 45], ['grounded', 250], ['ripe', 25], ['ripe', 300]]) {
    const b = T.bounds(k, h), a = T.colorAt(k, h, (b.Lmin + b.Lmax) / 2, 0.5), c = E.companion(k, a);
    assert.strictEqual(T.membership(c).territory, k); assert(C.deltaE(a, c) > 0.07, `${k} ${h}`);
    assert.notStrictEqual(E.evaluate([{ key: k, c }]).rels[0].verdict, 'competes');
  }
});
ok('evaluate handles 1, 2 and 3 chips; 3 chips are not recommended', () => {
  const g = T.colorAt('grounded', 45, 0.5, 0.5), r = T.colorAt('ripe', 25, 0.66, 0.6), g2 = E.companion('grounded', g);
  assert.strictEqual(E.evaluate([{ key: 'ripe', c: r }]).recommended, true);
  const two = E.evaluate([{ key: 'grounded', c: g }, { key: 'ripe', c: r }]);
  assert(two.recommended && two.cross.length === 1);
  const three = E.evaluate([{ key: 'grounded', c: g }, { key: 'grounded', c: g2 }, { key: 'ripe', c: r }]);
  assert(!three.recommended && three.cross.length === 2 && three.same.length === 1 && three.score > 0 && three.score <= 1);
});
ok('guidance: bright Evergreen is large-type only (white 3.2:1, ink Lc 44)', () => {
  const g = E.guidance('#00A810', T.evergreen);
  assert(g.tags.some((t) => t.text === 'Large type only on top'));
  assert(!g.tags.some((t) => t.text === 'Approved for text'));
});
ok('a deep, tempered color gets body-text approval', () => {
  assert(E.guidance('#2B3A55', C.fromHex('#2B3A55')).tags.some((t) => t.text === 'Approved for text'));
});
console.log(`\n${n} checks passed`);
