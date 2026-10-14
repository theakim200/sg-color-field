/* Calibrate the Grounded / Ripe territories from labeled samples.
   Usage: node tools/calibrate.js            (reads calibration/samples.csv, writes calibration/proposed-tables.json)
   Samples: territory, status (approved | borderline | outside), hex, note.

   Method (Visual -> Sample -> Measure -> Rule):
   1. Measure every sample in OKLCH.
   2. Per territory, group the approved + borderline samples that sit within 12 degrees of hue into anchors.
      An anchor's box is the L / C extent of its samples.
   3. Each side of the box is pushed outward (up to MARGIN) but stops before any "outside" sample of that territory
      near that hue would fall inside the box. A sample that cannot be excluded without cutting an approved one is a conflict.
   4. Between anchors the boxes are interpolated linearly in hue (around the circle), so every hue gets a region (no hue is
      excluded), and the result is sampled every 15 degrees.
   5. Validate: approved / borderline inside, outside outside. Report conflicts and how thin the margins are. */
const fs = require('fs'), path = require('path');
global.SG = {};
require('../js/color.js');
const C = SG.color, root = path.join(__dirname, '..');

const MARGIN = { L: 0.04, C: 0.015 }, STEP = { L: 0.002, C: 0.0005 }, NEAR = 18, CLUSTER = 12, KEYPOINTS = 72;
const wrap = (h) => ((h % 360) + 360) % 360, hd = C.hueDiff;

function readSamples(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map((l) => {
    const m = l.match(/^(\w+),(\w+),(#\w+),"(.*)"$/); const o = C.fromHex(m[3]);
    return { t: m[1], s: m[2], hex: m[3].toUpperCase(), note: m[4], L: o.L, C: o.C, h: o.h };
  });
}
const circMean = (hs) => wrap(Math.atan2(hs.reduce((a, h) => a + Math.sin(h * Math.PI / 180), 0), hs.reduce((a, h) => a + Math.cos(h * Math.PI / 180), 0)) * 180 / Math.PI);

function anchorsFor(terr, samples) {
  const inn = samples.filter((x) => x.t === terr && x.s !== 'outside').sort((a, b) => a.h - b.h);
  const out = samples.filter((x) => x.t === terr && x.s === 'outside');
  const clusters = [];
  for (const s of inn) { const c = clusters.find((k) => k.some((m) => hd(m.h, s.h) <= CLUSTER)); if (c) c.push(s); else clusters.push([s]); }
  const conflicts = [];
  const anchors = clusters.map((k) => {
    const h = circMean(k.map((s) => s.h));
    const box = { Lmin: Math.min(...k.map((s) => s.L)), Lmax: Math.max(...k.map((s) => s.L)), Cmin: Math.min(...k.map((s) => s.C)), Cmax: Math.max(...k.map((s) => s.C)) };
    const base = { ...box };
    const near = out.filter((o) => hd(o.h, h) <= NEAR);
    const inside = (b, o) => o.L >= b.Lmin && o.L <= b.Lmax && o.C >= b.Cmin && o.C <= b.Cmax;
    for (const o of near) if (inside(box, o)) conflicts.push({ territory: terr, hue: Math.round(h), sample: o.hex, note: o.note, why: 'sits inside the box of the approved + borderline samples at this hue' });
    // grow each side toward its margin while no outside sample enters the box
    for (const side of ['Lmin', 'Lmax', 'Cmin', 'Cmax']) {
      const dim = side[0], dir = side.endsWith('min') ? -1 : 1, lim = MARGIN[dim];
      let moved = 0;
      while (moved + STEP[dim] <= lim) {
        const trial = { ...box, [side]: box[side] + dir * STEP[dim] };
        if (near.some((o) => inside(trial, o) && !inside(box, o))) break;
        box[side] = trial[side]; moved += STEP[dim];
      }
    }
    box.Cmin = Math.max(0.01, box.Cmin);
    return { hue: h, box, base, samples: k.map((s) => s.hex) };
  }).sort((a, b) => a.hue - b.hue);
  return { anchors, conflicts };
}

function table(anchors) {
  const rows = [];
  for (let i = 0; i < KEYPOINTS; i++) {
    const h = (360 / KEYPOINTS) * i;
    let lo = null, hi = null, dlo = 1e9, dhi = 1e9;
    for (const a of anchors) { const d = wrap(h - a.hue); if (d < dlo) { dlo = d; lo = a; } const e = wrap(a.hue - h); if (e < dhi) { dhi = e; hi = a; } }
    const total = dlo + dhi, t = total === 0 ? 0 : dlo / total;
    const lerp = (k) => lo.box[k] + (hi.box[k] - lo.box[k]) * t;
    rows.push([h, +lerp('Lmin').toFixed(3), +lerp('Lmax').toFixed(3), +lerp('Cmin').toFixed(4), +lerp('Cmax').toFixed(4)]);
  }
  return rows;
}

function validate(tables, samples) {
  require('../js/territories.js');
  const T = SG.territories;
  const keep = { g: T.TERRITORIES.grounded.table, r: T.TERRITORIES.ripe.table };
  T.TERRITORIES.grounded.table = tables.grounded; T.TERRITORIES.ripe.table = tables.ripe;
  const res = samples.map((s) => { const d = T.depthIn(s.t, s); return { ...s, depth: d, ok: s.s === 'outside' ? d < 0 : d >= 0 }; });
  T.TERRITORIES.grounded.table = keep.g; T.TERRITORIES.ripe.table = keep.r;
  return res;
}

if (require.main === module) {
  const samples = readSamples(path.join(root, 'calibration/samples.csv'));
  const g = anchorsFor('grounded', samples), r = anchorsFor('ripe', samples);
  // repair pass: interpolation between anchors can leave an outside sample marginally inside; tighten the nearest anchor's side
  // by the smallest amount that excludes it, as long as no approved / borderline sample is lost
  const A = { grounded: g.anchors, ripe: r.anchors };
  let tables = { grounded: table(A.grounded), ripe: table(A.ripe) };
  for (let pass = 0; pass < 40; pass++) {
    const bad = validate(tables, samples).filter((c) => c.s === 'outside' && !c.ok);
    if (!bad.length) break;
    const o = bad[0], anchors = A[o.t], near = anchors.slice().sort((a, b) => hd(a.hue, o.h) - hd(b.hue, o.h)).slice(0, 2);
    let done = false;
    for (const a of near) {
      // move one side of the anchor's box toward the sample in small steps until it is excluded, unless that loses an inside sample
      for (const side of ['Cmin', 'Cmax', 'Lmin', 'Lmax']) {
        const dim = side[0], up = side.endsWith('min'), st = STEP[dim], old = a.box[side];
        let ok = false;
        for (let k = 1; k <= 40; k++) {
          a.box[side] = old + (up ? 1 : -1) * st * k;
          const trial = { grounded: table(A.grounded), ripe: table(A.ripe) }, v = validate(trial, samples);
          if (v.some((c) => c.s !== 'outside' && !c.ok)) break;
          if (v.find((c) => c.hex === o.hex && c.t === o.t).ok) { tables = trial; ok = true; break; }
        }
        if (ok) { done = true; break; }
        a.box[side] = old;
      }
      if (done) break;
    }
    if (!done) break;
  }
  const checks = validate(tables, samples);
  const out = { method: 'see tools/calibrate.js', margin: MARGIN, keypoints: KEYPOINTS, anchors: A, conflicts: [...g.conflicts, ...r.conflicts], tables, checks: checks.map((c) => ({ t: c.t, s: c.s, hex: c.hex, note: c.note, L: c.L, C: c.C, h: c.h, depth: +c.depth.toFixed(3), ok: c.ok })) };
  fs.writeFileSync(path.join(root, 'calibration/proposed-tables.json'), JSON.stringify(out, null, 1));
  const bad = checks.filter((c) => !c.ok);
  console.log('anchors', JSON.stringify({ grounded: g.anchors.map((a) => Math.round(a.hue)), ripe: r.anchors.map((a) => Math.round(a.hue)) }));
  console.log('checks:', checks.length, 'ok:', checks.length - bad.length, 'failed:', bad.length);
  for (const c of bad) console.log('  FAIL', c.t, c.s, c.hex, 'depth', c.depth.toFixed(3), c.note);
  console.log('conflicts (outside samples inside the approved box):', out.conflicts.length); for (const c of out.conflicts) console.log('  ', JSON.stringify(c));
  const thin = checks.filter((c) => c.ok && c.s === 'outside' && c.depth > -0.02);
  console.log('thin margins (outside samples within 0.02 of the border):', thin.map((c) => c.t + ' ' + c.hex + ' ' + c.depth.toFixed(3)).join(' | ') || 'none');
}
if (require.main === module && process.argv.includes('--apply')) {
  const P = JSON.parse(fs.readFileSync(path.join(root, 'calibration/proposed-tables.json'), 'utf8')).tables;
  const fmt = (name, rows) => `  const ${name} = [\n${rows.map((r) => `    [${r.join(', ')}],`).join('\n')}\n  ];\n`;
  const file = path.join(root, 'js/territories.js');
  let src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('  //                 hue   Lmin  Lmax  Cmin  Cmax'), b = src.indexOf('  const TERRITORIES = {');
  const block = `  // GENERATED by tools/calibrate.js from calibration/samples.csv (labeled approved / borderline / outside colors).\n  // Do not edit by hand: change the samples and run  node tools/calibrate.js --apply\n  //                 hue   Lmin  Lmax  Cmin  Cmax\n${fmt('GROUNDED', P.grounded)}${fmt('RIPE', P.ripe)}\n`;
  fs.writeFileSync(file, src.slice(0, a) + block + src.slice(b));
  console.log('territories.js updated with', P.grounded.length, 'keypoints per territory');
}
module.exports = { readSamples, anchorsFor, table, validate };
