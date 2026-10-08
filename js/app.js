/* Front end. Translates the engine's technical results into brand language.
   Layout (left to right):
     left   = 1 Choose an expression, 2 Explore color, 2.5 Explore counterparts (opens/closes)
     stage  = the colors, once, large. Hover a color for its usage guidance.
     right  = 4 Apply: values, which type works on which color, export, library
   Sheets from the top bar: About, Library, Technical (OKLCH, scores, contrast numbers).

   Model: Evergreen is always present. Up to 3 more chips (Grounded g1/g2, Ripe r1/r2).
   The balance handlebar picks a zone; each zone allows specific combinations (js/spectrum.js). */
(function () {
  const { color: C, territories: T, engine: E, spectrum: SP } = SG;
  const { TERRITORIES, CONFIG } = T;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const FIELD = { w: 360, h: 200, Ltop: 0.97, Lbot: 0.2 };
  const CHIP_IDS = ['g1', 'g2', 'r1', 'r2'];
  const terrOf = (id) => (id[0] === 'g' ? 'grounded' : 'ripe');
  const LEVEL = { body: ['Body text', 'good', '✓'], large: ['Large text only', 'warn', 'L'], fail: ['Avoid', 'bad', '✕'] };
  const ROLE_LABEL = { dominant: 'Dominant', supporting: 'Supporting', accent: 'Accent' };
  const LIB_KEY = 'sg-color-field:library:v1';

  const seed = { g1: T.colorAt('grounded', 45, 0.5, 0.5), r1: T.colorAt('ripe', 25, 0.66, 0.6) };
  seed.g2 = E.companion('grounded', seed.g1);
  seed.r2 = E.companion('ripe', seed.r1);

  const S = {
    p: 0.5, picks: {}, sheet: null, active: 'r1', cpOpen: false,
    chips: { ...seed },
    t: Object.fromEntries(CHIP_IDS.map((id) => [id, T.intensityOf(terrOf(id), seed[id])])),
    recs: [], fieldKey: null, fieldBitmap: null, pendingSnap: null,
  };

  /* ---------- derived state ---------- */
  let cur = null; // snapshot for the current render
  function snapshot() {
    const zone = SP.zoneIndex(S.p), z = SP.ZONES[zone];
    const pick = Number.isInteger(S.picks[z.id]) && S.picks[z.id] < z.combos.length ? S.picks[z.id] : SP.defaultPick(z), code = z.combos[pick];
    const ids = SP.ids(code), area = SP.areas(S.p, code), q = SP.parse(code);
    const nOf = (k) => ids.filter((i) => terrOf(i) === k).length;
    const labelOf = (id) => {
      if (id === 'e') return 'Evergreen';
      const k = terrOf(id);
      return TERRITORIES[k].label + (nOf(k) > 1 ? ' ' + id[1] : '');
    };
    const mk = (id) => {
      if (id === 'e') { const spec = E.spec(T.evergreen); return { id, key: 'evergreen', hex: spec.hex, c: spec.oklch, spec, area: 1, label: 'Evergreen' }; }
      const spec = E.spec(S.chips[id]);
      return { id, key: terrOf(id), hex: spec.hex, c: spec.oklch, spec, area: area[id], label: labelOf(id) };
    };
    const order = ['r1', 'r2', 'e', 'g1', 'g2'].filter((id) => id === 'e' || ids.includes(id));
    const items = order.map(mk), byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const ranked = E.hierarchy(items), roles = Object.fromEntries(ranked.map((o) => [o.id, o]));
    cur = { zone, z, pick, code, ids, q, items, byId, ranked, roles, chipItems: items.filter((i) => i.id !== 'e'), hasG: q.g > 0, hasR: q.r > 0, labelOf };
    if (!ids.includes(S.active)) S.active = ids.includes('r1') ? 'r1' : 'g1';
  }
  const activeKey = () => terrOf(S.active);
  const textOn = (hex) => E.bestForeground(hex);
  const inkOrWhite = (hex) => (textOn(hex).name === 'Ink' ? CONFIG.inkHex : '#fff');
  const tagHtml = (t) => `<span class="tag tag-${t.tone}">${t.text}</span>`;
  const rgba = (hex, a) => `rgba(${C.parseHex(hex).join(',')},${a})`;

  function depthPhrase(c, key) {
    const m = T.membership(c);
    if (m.territory !== key) return `Outside ${TERRITORIES[key].label}`;
    return m.status === 'core' ? `Deep in ${TERRITORIES[key].label}` : `Edge of ${TERRITORIES[key].label}`;
  }

  /** Usage guidance for one color. Evergreen is the reference, so it is never compared with itself. */
  function guidanceFor(it) {
    const g = E.guidance(it.hex, it.c);
    let tags = g.tags, note = g.rel.notes[0];
    if (it.key === 'evergreen') {
      tags = tags.filter((t) => !/Evergreen|accent/.test(t.text)).concat({ text: 'Works as a field with large type or logo', tone: 'info' }, { text: 'The constant', tone: 'good' });
      note = 'Evergreen is the constant. Every color is judged against it.';
    }
    return { tags, note, rel: g.rel, best: g.best };
  }

  /* ---------- URL state (shareable) ---------- */
  function writeHash() {
    const q = new URLSearchParams({ v: '2', p: S.p.toFixed(3), c: cur.code, pk: JSON.stringify(S.picks) });
    CHIP_IDS.forEach((id) => q.set(id, E.spec(S.chips[id]).hex.slice(1)));
    history.replaceState(null, '', '#' + q.toString());
  }
  function applyState({ p, picks, hex }) {
    if (typeof p === 'number' && p >= 0 && p <= 1) S.p = p;
    S.picks = {};
    for (const z of SP.ZONES) if (picks && Number.isInteger(picks[z.id]) && picks[z.id] >= 0 && picks[z.id] < z.combos.length) S.picks[z.id] = picks[z.id];
    for (const id of CHIP_IDS) {
      const c = hex && hex[id] && C.fromHex(hex[id]);
      if (!c) continue;
      const k = terrOf(id);
      S.chips[id] = T.membership(c).territory === k ? c : T.snapInto(k, c); // never load a color outside its territory
      S.t[id] = T.intensityOf(k, S.chips[id]);
    }
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.get('v') !== '2') { // v1 links used the opposite slider direction and other zones: keep the colors only
      applyState({ hex: Object.fromEntries(CHIP_IDS.map((id) => [id, q.get(id)])) });
      return;
    }
    let picks = {};
    try { picks = JSON.parse(q.get('pk') || '{}') || {}; } catch (e) { /* ignore */ }
    applyState({ p: parseFloat(q.get('p')), picks, hex: Object.fromEntries(CHIP_IDS.map((id) => [id, q.get(id)])) });
  }

  /* ---------- library (saved combinations, kept in this browser) ---------- */
  let memLib = [];
  function loadLib() {
    try { const v = JSON.parse(localStorage.getItem(LIB_KEY) || 'null'); if (Array.isArray(v)) return v; } catch (e) { /* storage unavailable */ }
    return memLib;
  }
  function saveLib(list) {
    memLib = list;
    try { localStorage.setItem(LIB_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  function addToLibrary() {
    const list = loadLib();
    const hex = Object.fromEntries(CHIP_IDS.map((id) => [id, E.spec(S.chips[id]).hex]));
    list.unshift({ id: Date.now().toString(36), savedAt: Date.now(), p: +S.p.toFixed(3), picks: { ...S.picks }, code: cur.code, hex });
    const ok = saveLib(list.slice(0, 60));
    toast(ok ? 'Added to library' : 'Added for this visit (browser storage is off)');
    if (S.sheet === 'library') renderSheet();
  }

  /* ---------- 1. expression ---------- */
  const overallLabel = (s) => (s >= 0.72 ? ['Strong match', 'good'] : s >= 0.55 ? ['Good match', 'info'] : ['Use with care', 'warn']);

  function renderExpression() {
    $('#balance').value = Math.round(S.p * 1000);
    $('#bal-zones').innerHTML = SP.ZONES.map((z) => `<span class="zone${z.id === cur.z.id ? ' on' : ''}">${z.combos.join('<br>')}</span>`).join('');

    $('#layouts').innerHTML = cur.z.combos.length < 2 ? '' : cur.z.combos.map((code, i) => {
      const q = SP.parse(code);
      const dots = [...SP.ids(code).filter((x) => x[0] === 'g'), 'e', ...SP.ids(code).filter((x) => x[0] === 'r')].map((id) => `<i style="background:${id === 'e' ? CONFIG.evergreenHex : C.toHex(S.chips[id])}"></i>`).join('');
      return `<button class="layout${i === cur.pick ? ' on' : ''}" data-action="layout" data-v="${i}" role="radio" aria-checked="${i === cur.pick}">
        <span class="dots">${dots}</span><span class="lab">${SP.label(code)}<small class="lead">${[cur.z.lead ? (cur.z.lead === 'grounded' ? 'Grounded-led' : 'Ripe-led') : '', q.recommended ? '' : 'not recommended'].filter(Boolean).join(' · ')}</small></span></button>`;
    }).join('');

    const n = cur.q.chips;
    $('#count-note').innerHTML = n >= 3
      ? `<span class="tag tag-warn">3 colors: possible, not recommended</span><span>Two is the recommended maximum.</span>`
      : `<span class="tag tag-good">${n} ${n === 1 ? 'color' : 'colors'} + Evergreen</span>`;
    $('#app').style.setProperty('--tint', rgba(cur.ranked[0].hex, 0.12));
  }

  /* ---------- 2. explore ---------- */
  function renderExplore() {
    const key = activeKey(), terr = TERRITORIES[key];
    $('#tabs').hidden = cur.chipItems.length < 2;
    $('#tabs').innerHTML = cur.chipItems.map((it) => `<button role="tab" aria-selected="${S.active === it.id}" class="${S.active === it.id ? 'on' : ''}" data-action="chip" data-v="${it.id}"><i style="background:${it.hex}"></i>${it.label}</button>`).join('');
    $('#explore-sub').textContent = `${terr.label}: ${terr.character.slice(0, 3).join(' / ')}`;
    $('#intensity-lo').textContent = terr.slider[0];
    $('#intensity-hi').textContent = terr.slider[1];
    $('#intensity').value = Math.round(S.t[S.active] * 100);
    drawField();

    const ev = E.evaluate(cur.chipItems.map((i) => ({ key: i.key, c: i.c }))), [lab, tone] = overallLabel(ev.score);
    $('#combo').innerHTML = `<span class="sub">This combination</span><div class="tags"><span class="tag tag-${tone}">${lab}</span></div><p>${ev.notes.slice(0, 2).join(' ') || 'Evergreen anchors the combination.'}</p>`;
  }

  function buildField(key, t) {
    const { w, h, Ltop, Lbot } = FIELD;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const hue = (x / w) * 360, b = T.bounds(key, hue);
      for (let y = 0; y < h; y++) {
        const L = Ltop - (y / (h - 1)) * (Ltop - Lbot), i = (y * w + x) * 4;
        const dL = Math.min(L - b.Lmin, b.Lmax - L) / (b.Lmax - b.Lmin);
        let ok = dL >= 0;
        if (ok) {
          const fit = C.fitToGamut({ L, C: b.Cmin + t * (b.Cmax - b.Cmin), h: hue });
          if (fit.C < b.Cmin * 0.92) ok = false; // not representable in sRGB at this hue/lightness
          else {
            const [r, g, bl] = C.oklchToRgb8(fit);
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = Math.round(255 * C.clamp(dL / 0.06, 0.35, 1));
          }
        }
        if (!ok) { img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0; img.data[i + 3] = 14; }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function drawField() {
    const key = activeKey(), t = S.t[S.active], cacheKey = key + ':' + t.toFixed(2);
    if (S.fieldKey !== cacheKey) { S.fieldBitmap = buildField(key, t); S.fieldKey = cacheKey; }
    const cv = $('#field'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(S.fieldBitmap, 0, 0);
    const c = S.chips[S.active], { Ltop, Lbot } = FIELD, m = $('#marker');
    m.style.left = (c.h / 360) * 100 + '%';
    m.style.top = ((Ltop - c.L) / (Ltop - Lbot)) * 100 + '%';
    m.style.background = C.toHex(c);
    const ev = $('#ev-marker');
    ev.style.left = (T.evergreen.h / 360) * 100 + '%';
    ev.style.top = ((Ltop - T.evergreen.L) / (Ltop - Lbot)) * 100 + '%';
    ev.style.background = CONFIG.evergreenHex;
  }

  function setChip(id, c) { S.chips[id] = c; S.t[id] = T.intensityOf(terrOf(id), c); }

  function pickFromPointer(ev) {
    const key = activeKey(), r = $('#field').getBoundingClientRect(), { Ltop, Lbot } = FIELD;
    const h = C.clamp((ev.clientX - r.left) / r.width, 0, 0.9999) * 360;
    const L = Ltop - C.clamp((ev.clientY - r.top) / r.height, 0, 1) * (Ltop - Lbot);
    S.chips[S.active] = T.colorAt(key, h, L, S.t[S.active]); // clamps L into the territory at this hue
    schedule();
  }

  function testHex() {
    const msg = $('#test-msg'), c = C.fromHex($('#hex-test').value), key = activeKey(), id = S.active;
    if (!c) { msg.innerHTML = 'Enter a valid HEX, like <b>#E4572E</b>.'; return; }
    if (c.C < 0.02) c.h = S.chips[id].h; // a neutral has no hue; keep the current one
    const m = T.membership(c), mine = TERRITORIES[key].label;
    if (m.territory === key) { setChip(id, c); msg.innerHTML = `Inside ${mine}. Applied.`; fullRender(); return; }
    const other = m.territory && cur.ids.some((x) => terrOf(x) === m.territory) ? m.territory : null;
    const where = m.territory ? `That color belongs to ${TERRITORIES[m.territory].label}.` : 'That color sits outside the Sweetgreen territories.';
    S.pendingSnap = T.snapInto(key, c);
    msg.innerHTML = `${where} Nearest ${mine}: <span class="chip"><i style="background:${C.toHex(S.pendingSnap)}"></i>${C.toHex(S.pendingSnap)}</span>
      <button class="mini" data-action="snap">Use it</button>${other ? `<button class="mini" data-action="goto" data-v="${other[0]}1" data-hex="${C.toHex(c)}">Use as ${TERRITORIES[other].label}</button>` : ''}`;
  }

  /* ---------- 2.5 counterparts ---------- */
  function renderCounterparts() {
    $('#cp-toggle').textContent = S.cpOpen ? 'Close' : 'Open';
    $('#cp-toggle').setAttribute('aria-expanded', S.cpOpen);
    const body = $('#cp-body');
    body.hidden = !S.cpOpen;
    if (!S.cpOpen) return;
    if (cur.hasG && cur.hasR) {
      const from = activeKey(), to = from === 'grounded' ? 'ripe' : 'grounded', target = to[0] + '1';
      S.recs = E.recommend(S.chips[S.active], from, 6);
      body.innerHTML = `<div class="sub" style="margin-bottom:6px">${TERRITORIES[to].label} for ${cur.byId[S.active].label}</div>
        <div class="recs">${S.recs.map((r, i) => {
          const sp = E.spec(r.color), on = cur.byId[target] && cur.byId[target].hex === sp.hex;
          return `<button class="rec${on ? ' on' : ''}" data-action="rec" data-v="${i}" data-target="${target}" title="${r.reason}. Replaces ${cur.labelOf(target)}.">
            <span class="rec-sw" style="background:${sp.hex}"><i style="background:${CONFIG.evergreenHex}"></i></span>
            <b>${sp.hex.slice(1)}</b></button>`; }).join('')}</div>`;
    } else {
      const other = cur.hasG ? 'Ripe' : 'Grounded';
      body.innerHTML = `<div class="cp-invite"><span>Add a ${other} counterpart to see suggestions.</span><button class="btn" data-action="mix">Add ${other}</button></div>`;
    }
  }

  /* ---------- stage: the colors, once ---------- */
  function renderStage() {
    const stack = $('#stack');
    let first = true;
    ['r1', 'r2', 'e', 'g1', 'g2'].forEach((id) => {
      const el = $(`.slot[data-id=${id}]`, stack), it = cur.byId[id];
      if (!it) { el.classList.remove('on', 'first', 'sel'); el.style.flexGrow = 0; el.tabIndex = -1; return; }
      const isFirst = first, role = cur.roles[id]; first = false;
      const g = guidanceFor(it);
      el.classList.add('on'); el.classList.toggle('first', isFirst);
      el.classList.toggle('sel', S.active === id);
      el.classList.toggle('compact', it.area < 0.5);
      el.classList.toggle('small', it.area < 0.6);
      el.style.flexGrow = it.area; el.style.background = it.hex; el.style.color = inkOrWhite(it.hex); el.tabIndex = id === 'e' ? -1 : 0;
      el.setAttribute('aria-label', `${it.label}, ${it.hex}, ${ROLE_LABEL[role.role]}`);
      el.innerHTML = `<span class="b-role"><em>${ROLE_LABEL[role.role]}</em>${role.anchor ? '<em>Anchor</em>' : ''}</span>
        <span class="b-label">${it.label}</span><span class="b-hex">${it.hex}</span>
        <span class="pop" aria-hidden="true"><span class="tags">${g.tags.slice(0, 4).map(tagHtml).join('')}</span><p>${g.note}</p></span>`;
    });
    $('[data-empty=top]', stack).classList.toggle('on', !cur.hasR);
    $('[data-empty=bottom]', stack).classList.toggle('on', !cur.hasG);
  }

  /* ---------- 4. apply ---------- */
  const val = (label, text, copy, hint) => `<button class="val" data-action="copy" data-v="${copy ?? text}" title="${hint || 'Copy ' + label}"><span>${label}</span><code>${text}</code></button>`;

  function crow(o) {
    const s = o.spec, g = guidanceFor(o);
    return `<div class="crow"><span class="crow-sw" style="background:${o.hex}"></span><div style="min-width:0">
      <div class="crow-title"><b>${o.label}</b><span>${ROLE_LABEL[o.role]}${o.anchor ? ' · Anchor' : ''}</span></div>
      <div class="crow-vals">${val('HEX', s.hex)}${val('RGB', s.rgb.join(', '), `rgb(${s.rgb.join(', ')})`)}${val('CMYK', s.cmyk.join(' '), `cmyk(${s.cmyk.join(', ')})`, 'Indicative CMYK; confirm with press proofs')}${val('OKLCH', `${(s.oklch.L * 100).toFixed(1)}% ${s.oklch.C.toFixed(3)} ${s.oklch.h.toFixed(0)}`, s.oklchText)}</div>
      <div class="tags crow-tags">${tagHtml(g.tags[0])}</div></div></div>`;
  }

  function matrixHtml(order) {
    const { whiteHex, inkHex, evergreenHex } = CONFIG;
    const cols = [['White', whiteHex], ['Ink', inkHex], ['Evergreen', evergreenHex], ...cur.chipItems.map((c) => [c.label, c.hex])];
    const head = cols.map(([n, hex]) => `<div class="mx-h" title="${n} type"><i style="background:${hex}"></i></div>`).join('');
    const rows = order.map((o) => {
      const cells = cols.map(([n, hex]) => {
        if (hex.toUpperCase() === o.hex.toUpperCase()) return `<div class="mx same" title="Same color"></div>`;
        const r = E.contrastLevel(hex, o.hex), [lab, , mark] = LEVEL[r.level];
        return `<div class="mx lvl-${r.level}" style="background:${o.hex};color:${hex}" title="${n} on ${o.label}: ${lab}"><span class="a">Aa</span><span class="m">${mark}</span></div>`;
      }).join('');
      return `<div class="mx-r"><i style="background:${o.hex}"></i><span>${o.label}</span></div>${cells}`;
    }).join('');
    return `<div class="matrix" style="grid-template-columns:84px repeat(${cols.length},minmax(0,1fr))"><div></div>${head}${rows}</div>
      <div class="legend"><span><b>✓</b> Body text</span><span><b>L</b> Large text only</span><span><b>✕</b> Avoid</span><span>Columns: type color</span></div>`;
  }

  function renderApply() {
    $('#apply-body').innerHTML = `
      <div class="crows${cur.ranked.length >= 4 ? ' dense' : ''}">${cur.ranked.map(crow).join('')}</div>
      <div class="sub">Type on color</div>
      ${matrixHtml(cur.ranked)}
      <div class="exports">
        <button class="btn" data-action="copy-css">CSS variables</button>
        <button class="btn" data-action="copy-json">JSON</button>
        <button class="btn" data-action="lib-add">Add to library</button>
        <button class="btn btn-primary" data-action="copy-link">Copy link</button>
      </div>`;
    $('#apply-body').style.cssText = 'display:flex;flex-direction:column;gap:12px';
  }

  /* ---------- sheets: Technical, About, Library ---------- */
  const bar = (label, v) => `<div class="bar"><span>${label}</span><i style="--w:${Math.round(C.clamp(v, 0, 1) * 100)}%"></i><em>${v.toFixed(2)}</em></div>`;

  function techHtml() {
    const ev = E.evaluate(cur.chipItems.map((i) => ({ key: i.key, c: i.c })));
    const cards = cur.chipItems.map((it, i) => {
      const m = T.membership(it.c), r = ev.rels[i];
      return `<div class="tcard"><div class="tcard-h"><i style="background:${it.hex}"></i>${it.label} <span class="mono">${it.hex}</span></div>
        <div class="mono">${it.spec.oklchText} · CMYK≈ ${it.spec.cmyk.join(' ')} · RGB ${it.spec.rgb.join(', ')}<br>${depthPhrase(it.c, it.key)} · depth ${m.depth.toFixed(2)} (${m.status})</div>
        <div style="margin-top:6px">${bar('Evergreen fit', r.score)}${Object.entries(r.parts).map(([k, v]) => bar(k, v)).join('')}</div>
        <div class="mono">ΔE(OK) ${r.metrics.dE.toFixed(3)} · ΔL ${r.metrics.dL.toFixed(2)} · hue Δ ${r.metrics.dh.toFixed(0)}° · C ratio ${r.metrics.cRatio.toFixed(2)}</div>
        <div class="tags" style="margin-top:6px">${E.guidance(it.hex, it.c).tags.map(tagHtml).join('')}</div></div>`;
    }).join('');
    const gs = cur.chipItems.filter((i) => i.key === 'grounded'), rs = cur.chipItems.filter((i) => i.key === 'ripe');
    const pairs = [];
    gs.forEach((g) => rs.forEach((r) => pairs.push(`<div class="tcard"><div class="tcard-h">${g.label} ↔ ${r.label}</div>${Object.entries(E.pairCompat(g.c, r.c).parts).map(([n, v]) => bar(n, v)).join('')}</div>`)));
    const fgList = [['White', CONFIG.whiteHex], ['Ink', CONFIG.inkHex], ['Evergreen', CONFIG.evergreenHex], ...cur.chipItems.map((c) => [c.label, c.hex])];
    const rowsT = cur.items.map((o) => `<tr><td>${o.label}</td>${fgList.map(([n, hex]) => {
      if (hex.toUpperCase() === o.hex.toUpperCase()) return '<td>–</td>';
      const r = E.contrastLevel(hex, o.hex); return `<td title="${n} on ${o.label}">${r.ratio.toFixed(1)} / ${Math.abs(r.lc).toFixed(0)}</td>`; }).join('')}</tr>`).join('');
    return `
      <p>Balance ${S.p.toFixed(2)} (0 = Grounded end, 1 = Ripe end) · zone ${cur.z.id} · layout ${cur.code} · ${cur.q.chips} chips${cur.q.recommended ? '' : ' (not recommended)'} · overall ${ev.score.toFixed(2)}</p>
      <section><h4>Each color against Evergreen</h4>${cards}</section>
      ${pairs.length ? `<section><h4>Grounded ↔ Ripe</h4>${pairs.join('')}</section>` : ''}
      <section><h4>Contrast: WCAG ratio / APCA Lc</h4>
        <table class="ttable"><tr><th>bg \\ type</th>${fgList.map(([n]) => `<th>${n.slice(0, 5)}</th>`).join('')}</tr>${rowsT}</table>
        <p style="margin-top:4px">Body text needs ≥ ${E.PARAMS.contrast.bodyWcag}:1 and Lc ≥ ${E.PARAMS.contrast.bodyLc}; large text ≥ ${E.PARAMS.contrast.largeWcag}:1 and Lc ≥ ${E.PARAMS.contrast.largeLc}.</p></section>
      <section><h4>Territory slice at hue ${S.chips[S.active].h.toFixed(0)}°</h4><canvas id="slice" width="360" height="300"></canvas>
        <p>Territories are irregular, hue-dependent regions (shaded boxes), not one universal L/C range. Shaded area is the sRGB gamut. Evergreen is plotted at its own chroma and lightness.</p></section>
      <p>Territory boundaries are provisional until calibrated against Sweetgreen's approved samples. CMYK values are indicative only; confirm with press proofs.</p>`;
  }

  function aboutHtml() {
    const dot = (hex) => `<i style="background:${hex}"></i>`;
    return `
      <p class="lede">A living color system that moves from Grounded to Ripe, always anchored by Evergreen.</p>
      <p>Sweetgreen's color is built around three territories: Grounded, Evergreen, Ripe. It is inspired by the cycle of growth, but it is a spectrum of expression and energy rather than a literal “soil, plant, fruit”.</p>
      <div class="about-territories">
        <div class="about-t"><b>${dot(C.toHex(seed.g1))}Grounded</b><p>Rooted, substantial, calm, tempered, elemental. Earth, terrain, minerals, water, atmosphere. A grounded color can be bright; it is tempered, not muted.</p></div>
        <div class="about-t"><b>${dot(CONFIG.evergreenHex)}Evergreen</b><p>The constant and most recognizable brand color. It anchors every expression while the colors around it change.</p></div>
        <div class="about-t"><b>${dot(C.toHex(seed.r1))}Ripe</b><p>Vibrant, expressive, juicy, abundant, full. Fruit, flowers, crops, blooms. Ripe is heightened, not simply saturated.</p></div>
      </div>
      <p><b style="color:var(--ink)">Grounded isn't muted. It's tempered. Ripe isn't simply saturated. It's heightened.</b></p>
      <p>There is no fixed secondary palette. Grounded and Ripe are territories: controlled but flexible areas of color from which colors are chosen for seasons, ingredients and collaborations. Choose the expression, select within the territory, anchor with Evergreen, and balance Grounded and Ripe as needed.</p>
      <p>This tool keeps the front end intuitive while a technical engine checks territory, the relationship to Evergreen, pairings, hierarchy and legibility behind the scenes. Open <b style="color:var(--ink)">Technical</b> to see the numbers.</p>
      <p>Territory boundaries are provisional until calibrated against approved Sweetgreen samples.</p>`;
  }

  function libraryHtml() {
    const list = loadLib();
    if (!list.length) return `<div class="lib-empty"><p>Nothing saved yet. Use <b style="color:var(--ink)">Add to library</b> in Apply to keep a combination.</p></div><p>Saved combinations stay in this browser only.</p>`;
    return list.map((it) => {
      const ids = SP.ids(it.code), hexes = [...ids.filter((x) => x[0] === 'g'), 'e', ...ids.filter((x) => x[0] === 'r')].map((id) => (id === 'e' ? CONFIG.evergreenHex : '#' + String(it.hex[id]).replace('#', '')));
      const lead = SP.ZONES[SP.zoneIndex(it.p)].lead;
      return `<div class="lib-item"><span class="lib-sw">${hexes.map((h) => `<i style="background:${h}"></i>`).join('')}</span>
        <div class="lib-meta"><b>${SP.label(it.code)}</b><span>${new Date(it.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}${lead ? ' · ' + (lead === 'grounded' ? 'Grounded-led' : 'Ripe-led') : ''}</span></div>
        <div class="lib-actions"><button class="mini" data-action="lib-open" data-v="${it.id}">Open</button><button class="mini" data-action="lib-del" data-v="${it.id}" aria-label="Delete">Delete</button></div></div>`;
    }).join('') + '<p>Saved combinations stay in this browser only.</p>';
  }

  function renderSheet() {
    const dr = $('#drawer');
    dr.hidden = !S.sheet;
    dr.style.top = Math.round($('.top').getBoundingClientRect().bottom + 8) + 'px'; // keep the top bar and its menu reachable
    $$('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.sheet));
    if (!S.sheet) return;
    $('#drawer-title').textContent = { about: 'About', library: 'Library', technical: 'Under the hood' }[S.sheet];
    $('#drawer-body').innerHTML = S.sheet === 'technical' ? techHtml() : S.sheet === 'about' ? aboutHtml() : libraryHtml();
    if (S.sheet === 'technical') drawSlice();
  }

  function drawSlice() {
    const cv = $('#slice');
    if (!cv) return;
    const hue = S.chips[S.active].h, ctx = cv.getContext('2d'), W = cv.width, H = cv.height, Cmax = 0.33, img = ctx.createImageData(W, H);
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
      const c = (x / W) * Cmax, L = 1 - y / H, i = (y * W + x) * 4;
      const inside = C.oklchToLinear({ L, C: c, h: hue }).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = inside ? 236 : 255; img.data[i + 3] = 255;
      if (inside) { const [r, g, b] = C.oklchToRgb8({ L, C: c, h: hue }); img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 70; }
    }
    ctx.putImageData(img, 0, 0);
    const X = (c) => (c / Cmax) * W, Y = (L) => (1 - L) * H;
    for (const [k, col] of [['grounded', '#7a7a7a'], ['ripe', '#111111']]) {
      const b = T.bounds(k, hue);
      ctx.fillStyle = col + '33'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.fillRect(X(b.Cmin), Y(b.Lmax), X(b.Cmax) - X(b.Cmin), Y(b.Lmin) - Y(b.Lmax));
      ctx.strokeRect(X(b.Cmin), Y(b.Lmax), X(b.Cmax) - X(b.Cmin), Y(b.Lmin) - Y(b.Lmax));
      ctx.fillStyle = col; ctx.font = '11px system-ui'; ctx.fillText(TERRITORIES[k].label, X(b.Cmin) + 4, Y(b.Lmax) + 13);
    }
    for (const e of cur.items) { ctx.beginPath(); ctx.arc(X(e.c.C), Y(e.c.L), 6, 0, 7); ctx.fillStyle = e.hex; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#444'; ctx.font = '11px system-ui';
    ctx.fillText(`x: chroma 0–${Cmax}  ·  y: lightness`, 6, H - 6);
  }

  /* ---------- exports ---------- */
  function exportData() {
    const extras = cur.chipItems.map((e) => [e.label, e.hex]);
    return {
      balance: +S.p.toFixed(3), layout: cur.code, chips: cur.q.chips, recommended: cur.q.recommended,
      colors: cur.ranked.map((o) => {
        const g = E.guidance(o.hex, o.c);
        return { name: o.label, territory: o.key, role: o.role, anchor: o.anchor, hex: o.hex, rgb: o.spec.rgb, cmykApprox: o.spec.cmyk, oklch: o.spec.oklchText,
          guidance: g.tags.map((t) => t.text),
          approvedForeground: E.foregrounds(o.hex, extras).filter((f) => f.level !== 'fail').map((f) => ({ fg: f.name, hex: f.fg, use: LEVEL[f.level][0] })) };
      }),
    };
  }
  function exportCss() {
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const d = exportData();
    return ':root {\n' + d.colors.map((c) => `  --sg-${slug(c.name)}: ${c.hex}; /* ${c.territory}, ${c.role}${c.anchor ? ', anchor' : ''}; ${c.oklch} */`).join('\n') + `\n  --sg-ink: ${CONFIG.inkHex};\n}\n`;
  }

  function copy(text, label = 'Copied') {
    const done = () => toast(label);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); } ta.remove();
  }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1700); }

  /* ---------- render orchestration ---------- */
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fullRender(); }); }
  function fullRender() {
    snapshot();
    renderExpression(); renderExplore(); renderCounterparts(); renderStage(); renderApply(); renderSheet(); writeHash();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action, v = b.dataset.v || b.dataset.id;
    if (a === 'layout') { S.picks[cur.z.id] = +v; fullRender(); }
    else if (a === 'chip') { if (v === 'e') { toast('Evergreen is the constant.'); return; } S.active = v; fullRender(); }
    else if (a === 'sheet') { S.sheet = S.sheet === v ? null : v; renderSheet(); }
    else if (a === 'close-sheet') { S.sheet = null; renderSheet(); }
    else if (a === 'cp-toggle') { S.cpOpen = !S.cpOpen; renderCounterparts(); }
    else if (a === 'mix') { S.p = 0.5; fullRender(); }
    else if (a === 'rec') { setChip(b.dataset.target, S.recs[+v].color); fullRender(); }
    else if (a === 'copy') copy(v);
    else if (a === 'copy-css') copy(exportCss(), 'CSS variables copied');
    else if (a === 'copy-json') copy(JSON.stringify(exportData(), null, 2), 'JSON copied');
    else if (a === 'copy-link') { writeHash(); copy(location.href, 'Link copied'); }
    else if (a === 'lib-add') addToLibrary();
    else if (a === 'lib-open') { const it = loadLib().find((x) => x.id === v); if (it) { applyState({ p: it.p, picks: it.picks, hex: it.hex }); S.sheet = null; fullRender(); toast('Opened from library'); } }
    else if (a === 'lib-del') { saveLib(loadLib().filter((x) => x.id !== v)); renderSheet(); }
    else if (a === 'test-hex') testHex();
    else if (a === 'snap') { setChip(S.active, S.pendingSnap); $('#test-msg').textContent = 'Applied the nearest approved color.'; fullRender(); }
    else if (a === 'goto') { S.active = v; setChip(v, C.fromHex(b.dataset.hex)); $('#test-msg').textContent = ''; fullRender(); }
  });

  $('#balance').addEventListener('input', (e) => { S.p = e.target.value / 1000; schedule(); });

  const field = $('#field');
  let dragging = false;
  field.addEventListener('pointerdown', (e) => { dragging = true; field.setPointerCapture(e.pointerId); pickFromPointer(e); });
  field.addEventListener('pointermove', (e) => { if (dragging) pickFromPointer(e); });
  field.addEventListener('pointerup', () => { dragging = false; });
  field.addEventListener('keydown', (e) => {
    const key = activeKey(), c = S.chips[S.active], step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] };
    if (!moves[e.key]) return;
    e.preventDefault();
    S.chips[S.active] = T.colorAt(key, (c.h + moves[e.key][0] + 360) % 360, c.L + moves[e.key][1], S.t[S.active]);
    schedule();
  });
  $('#intensity').addEventListener('input', (e) => {
    const key = activeKey(), c = S.chips[S.active];
    S.t[S.active] = e.target.value / 100; S.chips[S.active] = T.colorAt(key, c.h, c.L, S.t[S.active]); schedule();
  });
  $('#hex-test').addEventListener('keydown', (e) => { if (e.key === 'Enter') testHex(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet(); } });

  /* ---------- init ---------- */
  readHash();
  fullRender();
  window.SGApp = { state: S, snapshot: () => cur, exportData, loadLib };
})();
