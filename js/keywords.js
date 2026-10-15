/* Word to color: the CSS named colors plus a few brand words (food, flowers, earth), English and Korean, resolved to a
   starting color. suggest() then builds a deterministic pool of different colors near that hue, all inside one territory,
   and the app steps through it one press at a time. Add words to BRAND; each is "name": "#RRGGBB". */
(function (root) {
  'use strict';
  const SG = root.SG = root.SG || {}, C = SG.color, T = SG.territories;

  const CSS = `aliceblue F0F8FF antiquewhite FAEBD7 aqua 00FFFF aquamarine 7FFFD4 azure F0FFFF beige F5F5DC bisque FFE4C4 black 000000 blanchedalmond FFEBCD blue 0000FF blueviolet 8A2BE2 brown A52A2A burlywood DEB887 cadetblue 5F9EA0 chartreuse 7FFF00 chocolate D2691E coral FF7F50 cornflowerblue 6495ED cornsilk FFF8DC crimson DC143C cyan 00FFFF darkblue 00008B darkcyan 008B8B darkgoldenrod B8860B darkgray A9A9A9 darkgreen 006400 darkgrey A9A9A9 darkkhaki BDB76B darkmagenta 8B008B darkolivegreen 556B2F darkorange FF8C00 darkorchid 9932CC darkred 8B0000 darksalmon E9967A darkseagreen 8FBC8F darkslateblue 483D8B darkslategray 2F4F4F darkslategrey 2F4F4F darkturquoise 00CED1 darkviolet 9400D3 deeppink FF1493 deepskyblue 00BFFF dimgray 696969 dimgrey 696969 dodgerblue 1E90FF firebrick B22222 floralwhite FFFAF0 forestgreen 228B22 fuchsia FF00FF gainsboro DCDCDC ghostwhite F8F8FF gold FFD700 goldenrod DAA520 gray 808080 green 008000 greenyellow ADFF2F grey 808080 honeydew F0FFF0 hotpink FF69B4 indianred CD5C5C indigo 4B0082 ivory FFFFF0 khaki F0E68C lavender E6E6FA lavenderblush FFF0F5 lawngreen 7CFC00 lemonchiffon FFFACD lightblue ADD8E6 lightcoral F08080 lightcyan E0FFFF lightgoldenrodyellow FAFAD2 lightgray D3D3D3 lightgreen 90EE90 lightgrey D3D3D3 lightpink FFB6C1 lightsalmon FFA07A lightseagreen 20B2AA lightskyblue 87CEFA lightslategray 778899 lightslategrey 778899 lightsteelblue B0C4DE lightyellow FFFFE0 lime 00FF00 limegreen 32CD32 linen FAF0E6 magenta FF00FF maroon 800000 mediumaquamarine 66CDAA mediumblue 0000CD mediumorchid BA55D3 mediumpurple 9370DB mediumseagreen 3CB371 mediumslateblue 7B68EE mediumspringgreen 00FA9A mediumturquoise 48D1CC mediumvioletred C71585 midnightblue 191970 mintcream F5FFFA mistyrose FFE4E1 moccasin FFE4B5 navajowhite FFDEAD navy 000080 oldlace FDF5E6 olive 808000 olivedrab 6B8E23 orange FFA500 orangered FF4500 orchid DA70D6 palegoldenrod EEE8AA palegreen 98FB98 paleturquoise AFEEEE palevioletred DB7093 papayawhip FFEFD5 peachpuff FFDAB9 peru CD853F pink FFC0CB plum DDA0DD powderblue B0E0E6 purple 800080 rebeccapurple 663399 red FF0000 rosybrown BC8F8F royalblue 4169E1 saddlebrown 8B4513 salmon FA8072 sandybrown F4A460 seagreen 2E8B57 seashell FFF5EE sienna A0522D silver C0C0C0 skyblue 87CEEB slateblue 6A5ACD slategray 708090 slategrey 708090 snow FFFAFA springgreen 00FF7F steelblue 4682B4 tan D2B48C teal 008080 thistle D8BFD8 tomato FF6347 turquoise 40E0D0 violet EE82EE wheat F5DEB3 white FFFFFF whitesmoke F5F5F5 yellow FFFF00 yellowgreen 9ACD32`.split(/\s+/);

  const BRAND = {
    // fruit and vegetables
    strawberry: '#E23B4E', raspberry: '#C2185B', cherry: '#C21E3A', pomegranate: '#B3202E', beet: '#8E2A55', radish: '#D6336C',
    carrot: '#ED7F22', pumpkin: '#E8741E', mango: '#F6A21E', apricot: '#F7A667', peach: '#FFB27A', lemon: '#F4D03F', banana: '#F5D54A',
    corn: '#F2C94C', mustard: '#D4A017', lime: '#9BC53D', apple: '#8DB600', pear: '#C7D36F', avocado: '#6B8E23', basil: '#4C8C3A',
    kale: '#3E6B45', spinach: '#3B7A3B', pea: '#8CC152', cucumber: '#7FA650', artichoke: '#8A9A5B', eggplant: '#5B3A6E', plum: '#6E2C5A',
    blueberry: '#4B5FA8', grape: '#6F4E9E', fig: '#6B3F5E', cabbage: '#7E4A8F', onion: '#B5679A', garlic: '#E9E1D0',
    // flowers
    rose: '#D6455D', poppy: '#E5412D', marigold: '#EDA21E', sunflower: '#F2B705', lavender: '#9F8FD0', iris: '#5B5BD6', peony: '#E58FA6', lilac: '#B79BD1',
    // earth and materials
    clay: '#B5654A', terracotta: '#C8643B', rust: '#B4502C', soil: '#5B4636', mud: '#6B5640', sand: '#D8C3A0', stone: '#8D8578', moss: '#6B7B3A',
    bark: '#5E4632', cocoa: '#6B4226', coffee: '#5A3B2A', cinnamon: '#9C5A32', honey: '#E3A82B', oat: '#D9C9A3', cream: '#F3E9D2', slate: '#5E6B73',
    sea: '#3E7C8A', lake: '#4A7C96', sky: '#6FB1D6', ocean: '#2F6F8F', forest: '#2F5D3A', olive: '#7A7A2E', sage: '#8FA38A', mint: '#8FD1B0',
    // Korean
    빨강: '#E5352B', 빨간색: '#E5352B', 토마토: '#E8412F', 딸기: '#E23B4E', 주황: '#F28C28', 오렌지: '#F28C28', 노랑: '#F6D32D', 노란색: '#F6D32D', 레몬: '#F4D03F',
    초록: '#2E9B3F', 연두: '#8CC152', 라임: '#9BC53D', 올리브: '#7A7A2E', 청록: '#3E8C86', 하늘: '#6FB1D6', 파랑: '#2F6FD0', 남색: '#1F3A7A', 보라: '#7B4FB5',
    분홍: '#F28FB2', 핑크: '#F28FB2', 갈색: '#8B5A36', 베이지: '#D8C3A0', 흙: '#5B4636', 당근: '#ED7F22', 가지: '#5B3A6E', 아보카도: '#6B8E23', 호박: '#E8741E',
  };

  const TABLE = Object.create(null);
  for (let i = 0; i < CSS.length; i += 2) TABLE[CSS[i]] = '#' + CSS[i + 1];
  Object.assign(TABLE, BRAND); // brand words win over CSS names of the same spelling

  /** Resolve a typed word (any case, extra spaces) to { name, hex }, or null when it is not in the table. */
  function lookup(word) {
    const w = String(word || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!w) return null;
    if (TABLE[w]) return { name: w, hex: TABLE[w] };
    const hit = Object.keys(TABLE).find((k) => w.length > 2 && (k === w + 's' || w === k + 's' || k.replace(/\s/g, '') === w));
    return hit ? { name: hit, hex: TABLE[hit] } : null;
  }

  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const seedOf = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

  /** A pool of different colors inside one territory, near the word's hue. Item 0 is the word's own color moved into the territory. */
  function suggest(key, hex, want = 18) {
    const base = C.fromHex(hex), rnd = mulberry(seedOf(key + hex));
    if (base.C < 0.02) base.h = 0; // grays have no hue: start at red
    const first = T.snapInto(key, base), pool = [first], apart = (c) => pool.every((p) => C.deltaE(p, c) > 0.03);
    for (const spread of [7, 12, 18, 24]) { // stay close to the word's own hue: tomato must not drift into pink or orange-yellow
      for (let i = 0; i < 250 && pool.length < want; i++) {
        const h = (base.h + (rnd() * 2 - 1) * spread + 360) % 360, L = base.L + (rnd() * 2 - 1) * 0.12;
        const c = T.colorAt(key, h, L, 0.1 + rnd() * 0.9);
        if (T.membership(c).territory === key && T.hueDiff(c.h, base.h) <= 24 && apart(c)) pool.push(c);
      }
      if (pool.length >= want) break;
    }
    return { pool, moved: C.deltaE(base, first) > 0.05 };
  }

  SG.keywords = { lookup, suggest, count: Object.keys(TABLE).length };
  if (typeof module !== 'undefined') module.exports = SG.keywords;
})(typeof globalThis !== 'undefined' ? globalThis : this);
