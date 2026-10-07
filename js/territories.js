/* Territory definitions: Grounded and Ripe as irregular, hue-dependent regions of OKLCH space.
   Each territory is a table of keypoints every 30 degrees of hue: [hue, Lmin, Lmax, Cmin, Cmax].
   Bounds between keypoints are interpolated, so the region is NOT one rectangle.

   PROVISIONAL: these values are a seed, set from general color knowledge, not from Sweetgreen's
   approved samples. Methodology: Visual -> Sample -> Measure -> Rule. Replace the tables with
   values measured from the approved/borderline/outside sample set (see README). */
(function (root) {
  const SG = root.SG;
  const { clamp, lerp, hueDiff, fitToGamut, fromHex } = SG.color;

  const CONFIG = {
    evergreenHex: '#00A810', // PANTONE 2423 C, RGB 0/168/16. Single source for the brand anchor
    inkHex: '#111111',        // dark type color used in contrast tests (assumed; confirm)
    whiteHex: '#FFFFFF',
    coreDepth: 0.15,          // inside by >= 15% of the local range = "core"; 0..15% = "edge"
  };

  //                 hue   Lmin  Lmax  Cmin  Cmax
  const GROUNDED = [
    [0,   0.38, 0.62, 0.060, 0.130],
    [30,  0.38, 0.64, 0.065, 0.135],
    [60,  0.45, 0.72, 0.065, 0.115],
    [90,  0.55, 0.80, 0.065, 0.110],
    [120, 0.45, 0.76, 0.055, 0.120],
    [150, 0.38, 0.72, 0.050, 0.105],
    [180, 0.38, 0.70, 0.040, 0.085],
    [210, 0.38, 0.72, 0.040, 0.085],
    [240, 0.36, 0.70, 0.040, 0.095],
    [270, 0.36, 0.66, 0.045, 0.105],
    [300, 0.36, 0.64, 0.050, 0.105],
    [330, 0.37, 0.63, 0.055, 0.115],
  ];
  const RIPE = [
    [0,   0.56, 0.72, 0.170, 0.250],
    [30,  0.62, 0.73, 0.160, 0.225],
    [60,  0.70, 0.80, 0.135, 0.175],
    [90,  0.82, 0.91, 0.110, 0.160],
    [120, 0.70, 0.88, 0.150, 0.210],
    [150, 0.68, 0.86, 0.150, 0.220],
    [180, 0.66, 0.84, 0.100, 0.135],
    [210, 0.60, 0.78, 0.090, 0.130],
    [240, 0.55, 0.72, 0.120, 0.160],
    [270, 0.46, 0.64, 0.160, 0.260],
    [300, 0.50, 0.70, 0.150, 0.280],
    [330, 0.56, 0.76, 0.190, 0.270],
  ];

  const TERRITORIES = {
    grounded: {
      key: 'grounded', label: 'Grounded', table: GROUNDED,
      character: ['Rooted', 'Substantial', 'Calm', 'Tempered', 'Elemental'],
      slider: ['Tempered', 'Fuller'],
      blurb: 'Earth, terrain, minerals, water, atmosphere. Tempered, not muted.',
    },
    ripe: {
      key: 'ripe', label: 'Ripe', table: RIPE,
      character: ['Vibrant', 'Expressive', 'Juicy', 'Abundant', 'Full'],
      slider: ['Bright', 'Heightened'],
      blurb: 'Fruit, flowers, crops, blooms. Heightened, not just saturated.',
    },
  };

  /** Interpolated {Lmin, Lmax, Cmin, Cmax} of a territory at hue h. */
  function bounds(key, h) {
    const t = TERRITORIES[key].table;
    const hh = ((h % 360) + 360) % 360;
    const i = Math.floor(hh / 30) % 12, f = (hh % 30) / 30;
    const a = t[i], b = t[(i + 1) % 12];
    return { Lmin: lerp(a[1], b[1], f), Lmax: lerp(a[2], b[2], f), Cmin: lerp(a[3], b[3], f), Cmax: lerp(a[4], b[4], f) };
  }

  /** Signed normalised depth: >0 inside (0.5 = dead center), <0 outside. */
  function depthIn(key, c) {
    const b = bounds(key, c.h);
    const dL = Math.min(c.L - b.Lmin, b.Lmax - c.L) / (b.Lmax - b.Lmin);
    const dC = Math.min(c.C - b.Cmin, b.Cmax - c.C) / (b.Cmax - b.Cmin);
    return Math.min(dL, dC);
  }

  /** Territory membership of an OKLCH color. */
  function membership(c) {
    const g = depthIn('grounded', c), r = depthIn('ripe', c);
    const best = g >= r ? 'grounded' : 'ripe';
    const depth = Math.max(g, r);
    const status = depth >= CONFIG.coreDepth ? 'core' : depth >= 0 ? 'edge' : 'outside';
    return { territory: depth >= 0 ? best : null, nearest: best, depth, status };
  }

  /** Color inside a territory at hue h, lightness L, intensity t (0..1 across the local chroma range). */
  function colorAt(key, h, L, t) {
    const b = bounds(key, h);
    return fitToGamut({ L: clamp(L, b.Lmin, b.Lmax), C: lerp(b.Cmin, b.Cmax, t), h });
  }

  /** Position of a color's chroma within its territory's local chroma range (0..1). */
  function intensityOf(key, c) {
    const b = bounds(key, c.h);
    return clamp((c.C - b.Cmin) / (b.Cmax - b.Cmin), 0, 1);
  }

  /** Nearest approved color in a territory (clamps into the local region, slightly inset). */
  function snapInto(key, c) {
    const b = bounds(key, c.h), inset = 0.04;
    const L = clamp(c.L, lerp(b.Lmin, b.Lmax, inset), lerp(b.Lmax, b.Lmin, inset));
    const C = clamp(c.C, lerp(b.Cmin, b.Cmax, inset), lerp(b.Cmax, b.Cmin, inset));
    return fitToGamut({ L, C, h: c.h });
  }

  const evergreen = fromHex(CONFIG.evergreenHex);

  SG.territories = { CONFIG, TERRITORIES, bounds, depthIn, membership, colorAt, intensityOf, snapInto, evergreen, hueDiff };
  if (typeof module !== 'undefined') module.exports = SG.territories;
})(typeof globalThis !== 'undefined' ? globalThis : this);
