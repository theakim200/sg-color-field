// Run: node tests/engine.test.js
const assert = require('assert');
require('../js/color.js'); require('../js/territories.js'); require('../js/engine.js');
const { color: C, territories: T, engine: E } = globalThis.SG;
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('  ok', name); };

ok('hex <-> oklch round trip', () => {
  for (const hex of ['#00473C', '#FF5A36', '#8A6B4F', '#F2C94C']) assert.strictEqual(C.toHex(C.fromHex(hex)), hex);
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
  assert.strictEqual(E.evergreenRelationship(C.fromHex('#0B4D40')).verdict, 'competes');
  assert.notStrictEqual(E.evergreenRelationship(T.colorAt('ripe', 25, 0.68, 0.6)).verdict, 'competes');
});
ok('recommend returns approved-territory, non-competing, hue-diverse counterparts', () => {
  const g = T.colorAt('grounded', 45, 0.5, 0.5), recs = E.recommend(g, 'grounded', 6);
  assert(recs.length >= 4, 'got ' + recs.length);
  for (const r of recs) { assert.strictEqual(T.membership(r.color).territory, 'ripe'); assert.notStrictEqual(r.rel.verdict, 'competes'); }
  assert(new Set(recs.map((r) => Math.floor(r.color.h / 36))).size === recs.length);
});
ok('hierarchy: dominant must host type; Evergreen always present', () => {
  const hexes = { evergreen: '#00473C', grounded: '#8A6B4F', ripe: '#FF5A36' };
  for (const lean of ['grounded', 'balanced', 'ripe']) {
    const h = E.hierarchy('both', lean, hexes);
    assert.strictEqual(h.length, 3); assert(h.some((x) => x.key === 'evergreen')); assert.strictEqual(h[0].role, 'dominant');
  }
});
ok('guidance emits brand-use tags', () => {
  const g = E.guidance('#00473C', T.evergreen);
  assert(g.tags.some((t) => t.text === 'Approved for text'));
});
console.log(`\n${n} checks passed`);
