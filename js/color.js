/* Color math: OKLCH <-> sRGB, gamut fitting, distance, contrast (WCAG + APCA).
   Pure functions, no DOM. Attaches to the global SG namespace (works in browser and Node). */
(function (root) {
  const SG = (root.SG = root.SG || {});
  const RAD = Math.PI / 180;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
  const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  function oklchToLinear({ L, C, h }) {
    const a = C * Math.cos(h * RAD), b = C * Math.sin(h * RAD);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  }

  function linearToOklch([r, g, b]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.hypot(a, bb);
    let h = Math.atan2(bb, a) / RAD;
    if (h < 0) h += 360;
    return { L, C, h: C < 1e-4 ? 0 : h };
  }

  const inGamut = (lin, eps = 1e-4) => lin.every((v) => v >= -eps && v <= 1 + eps);

  /** Reduce chroma (hue and lightness fixed) until the color fits inside sRGB. */
  function fitToGamut(c) {
    if (inGamut(oklchToLinear(c))) return { L: c.L, C: c.C, h: c.h };
    let lo = 0, hi = c.C;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ L: c.L, C: mid, h: c.h }))) lo = mid; else hi = mid;
    }
    return { L: c.L, C: lo, h: c.h };
  }

  function oklchToRgb8(c) {
    const f = fitToGamut(c);
    return oklchToLinear(f).map((v) => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 1) * 255));
  }

  const hex2 = (n) => n.toString(16).padStart(2, '0');
  const toHex = (c) => '#' + oklchToRgb8(c).map(hex2).join('').toUpperCase();

  function parseHex(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    let s = m[1];
    if (s.length === 3) s = s.split('').map((x) => x + x).join('');
    return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
  }
  function fromHex(hex) {
    const rgb = parseHex(hex);
    return rgb ? linearToOklch(rgb.map((v) => toLinear(v / 255))) : null;
  }

  function deltaE(a, b) {
    const ax = a.C * Math.cos(a.h * RAD), ay = a.C * Math.sin(a.h * RAD);
    const bx = b.C * Math.cos(b.h * RAD), by = b.C * Math.sin(b.h * RAD);
    return Math.hypot(a.L - b.L, ax - bx, ay - by);
  }

  function wcag(fgHex, bgHex) {
    const Y = (hex) => { const [r, g, b] = parseHex(hex).map((v) => toLinear(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const [hi, lo] = [Y(fgHex), Y(bgHex)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /** APCA-W3 0.98G-4g. Returns signed Lc (positive = dark text on light bg). */
  function apca(fgHex, bgHex) {
    const Y = (hex) => {
      const [r, g, b] = parseHex(hex).map((v) => Math.pow(v / 255, 2.4));
      const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
      return y >= 0.022 ? y : y + Math.pow(0.022 - y, 1.414);
    };
    const yt = Y(fgHex), yb = Y(bgHex);
    if (Math.abs(yb - yt) < 0.0005) return 0;
    const s = yb > yt ? (Math.pow(yb, 0.56) - Math.pow(yt, 0.57)) * 1.14 : (Math.pow(yb, 0.65) - Math.pow(yt, 0.62)) * 1.14;
    if (Math.abs(s) < 0.1) return 0;
    return (s > 0 ? s - 0.027 : s + 0.027) * 100;
  }

  /** Naive device-independent CMYK. Indicative only; real print values need a press profile. */
  function cmyk(hex) {
    const [r, g, b] = parseHex(hex).map((v) => v / 255);
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return [0, 0, 0, 100];
    return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100));
  }

  const oklchString = (c) => `oklch(${(c.L * 100).toFixed(1)}% ${c.C.toFixed(3)} ${c.h.toFixed(1)})`;

  SG.color = { clamp, lerp, ramp, hueDiff, oklchToLinear, linearToOklch, fitToGamut, oklchToRgb8, toHex, parseHex, fromHex, deltaE, wcag, apca, cmyk, oklchString };
  if (typeof module !== 'undefined') module.exports = SG.color;
})(typeof globalThis !== 'undefined' ? globalThis : this);
