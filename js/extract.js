/* Photo to color: the main tones of an image. Pixels are clustered with k-means in OKLab, near-white, near-black and gray
   pixels are mostly ignored (backgrounds, shadows), and clusters are ranked by size and vividness. */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {}, C = SG.color;
  const hex2 = (n) => n.toString(16).padStart(2, '0');

  /** data: RGBA bytes (ImageData.data). Returns up to k hex strings, most prominent first. */
  function dominant(data, k = 5) {
    const pts = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const c = C.fromHex('#' + hex2(data[i]) + hex2(data[i + 1]) + hex2(data[i + 2]));
      if (c.L > 0.96 || c.L < 0.12 || c.C < 0.03) continue;
      pts.push({ x: c.L, y: c.C * Math.cos(c.h * Math.PI / 180), z: c.C * Math.sin(c.h * Math.PI / 180), w: 1 });
    }
    if (!pts.length) return [];
    const cent = [];                                          // farthest-point seeding keeps distinct tones apart
    cent.push({ ...pts[0] });
    while (cent.length < Math.min(k, pts.length)) {
      let best = null, bd = -1;
      for (const p of pts) { const d = Math.min(...cent.map((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2)); if (d > bd) { bd = d; best = p; } }
      if (bd < 0.0008) break;
      cent.push({ ...best });
    }
    let groups = [];
    for (let it = 0; it < 12; it++) {
      groups = cent.map(() => ({ n: 0, x: 0, y: 0, z: 0 }));
      for (const p of pts) {
        let bi = 0, bd = Infinity;
        cent.forEach((c, i) => { const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2; if (d < bd) { bd = d; bi = i; } });
        const g = groups[bi]; g.n++; g.x += p.x; g.y += p.y; g.z += p.z;
      }
      groups.forEach((g, i) => { if (g.n) { cent[i] = { x: g.x / g.n, y: g.y / g.n, z: g.z / g.n }; } });
    }
    return groups.map((g, i) => ({ g, c: cent[i] })).filter((o) => o.g.n)
      .map((o) => { const ch = Math.hypot(o.c.y, o.c.z); return { score: o.g.n * (0.4 + ch * 3), hex: C.toHex(C.fitToGamut({ L: o.c.x, C: ch, h: (Math.atan2(o.c.z, o.c.y) * 180 / Math.PI + 360) % 360 })) }; })
      .sort((a, b) => b.score - a.score).map((o) => o.hex);
  }

  SG.extract = { dominant };
  if (typeof module !== 'undefined') module.exports = SG.extract;
})(typeof globalThis !== 'undefined' ? globalThis : this);
