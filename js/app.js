/* Front end. Translates the engine's technical results into brand language.
   Journey, left to right on one screen: Choose an expression -> Explore color -> Build a combination -> Apply.
   Numbers (OKLCH, scores, contrast) live in the Technical view drawer, not in the columns.

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

  const seed = { g1: T.colorAt('grounded', 45, 0.5, 0.5), r1: T.colorAt('ripe', 25, 0.66, 0.6) };
  seed.g2 = E.companion('grounded', seed.g1);
  seed.r2 = E.companion('ripe', seed.r1);

  const S = {
    p: 0.5, picks: {}, tech: false, active: 'r1',
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
    cur = { zone, z, pick, code, ids, q, items, byId, chipItems: items.filter((i) => i.id !== 'e'), hasG: q.g > 0, hasR: q.r > 0, labelOf };
    if (!ids.includes(S.active)) S.active = ids.includes('r1') ? 'r1' : 'g1';
  }
  const activeKey = () => terrOf(S.active);
  const textOn = (hex) => E.bestForeground(hex);
  const inkOrWhite = (hex) => (textOn(hex).name === 'Ink' ? CONFIG.inkHex : '#fff');
  const tagHtml = (t) => `<span class="tag tag-${t.tone}">${t.text}</span>`;

  function depthPhrase(c, key) {
    const m = T.membership(c);
    if (m.territory !== key) return `Outside ${TERRITORIES[key].label}`;
    return m.status === 'core' ? `Deep in ${TERRITORIES[key].label}` : `Edge of ${TERRITORIES[key].label}`;
  }

  /* ---------- URL state (shareable) ---------- */
  function writeHash() {
    const q = new URLSearchParams({ v: '2', p: S.p.toFixed(3), c: cur.code, pk: JSON.stringify(S.picks) });
    CHIP_IDS.forEach((id) => q.set(id, E.spec(S.chips[id]).hex.slice(1)));
    history.replaceState(null, '', '#' + q.toString());
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const p = parseFloat(q.get('p')), current = q.get('v') === '2'; // v1 links used the opposite slider direction and other zones
    if (current && p >= 0 && p <= 1) S.p = p;
    try { if (!current) throw 0; const pk = JSON.parse(q.get('pk') || '{}'); if (pk && typeof pk === 'object') for (const z of SP.ZONES) if (Number.isInteger(pk[z.id]) && pk[z.id] >= 0 && pk[z.id] < z.combos.length) S.picks[z.id] = pk[z.id]; } catch (e) { /* ignore */ }
    for (const id of CHIP_IDS) {
      const c = q.get(id) && C.fromHex(q.get(id));
      if (!c) continue;
      const k = terrOf(id);
      S.chips[id] = T.membership(c).territory === k ? c : T.snapInto(k, c); // never load a color outside its territory
      S.t[id] = T.intensityOf(k, S.chips[id]);
    }
  }

  /* ---------- 1. Expression: balance handlebar + stack ---------- */
  function renderComposer() {
    $('#balance').value = Math.round(S.p * 1000);
    // zone legend, Grounded end (left) to Ripe end (right)
    $('#bal-zones').innerHTML = SP.ZONES.map((z) => `<span class="zone${z.id === cur.z.id ? ' on' : ''}">${z.combos.join('<br>')}</span>`).join('');

    // layout choices inside the current zone
    $('#layouts').innerHTML = cur.z.combos.length < 2 ? '' : cur.z.combos.map((code, i) => {
      const q = SP.parse(code);
      const dots = [...SP.ids(code).filter((x) => x[0] === 'g'), 'e', ...SP.ids(code).filter((x) => x[0] === 'r')].map((id) => `<i style="background:${id === 'e' ? CONFIG.evergreenHex : C.toHex(S.chips[id])}"></i>`).join('');
      return `<button class="layout${i === cur.pick ? ' on' : ''}" data-action="layout" data-v="${i}" role="radio" aria-checked="${i === cur.pick}">
        <span class="dots">${dots}</span><span class="lab">${SP.label(code)}${cur.z.lead ? `<small class="lead">${cur.z.lead === 'grounded' ? 'Grounded-led' : 'Ripe-led'}</small>` : ''}</span>${q.recommended ? '' : '<span class="tag tag-warn">Not recommended</span>'}</button>`;
    }).join('');

    const n = cur.q.chips;
    $('#count-note').innerHTML = n >= 3
      ? `<span class="tag tag-warn">3 colors: possible, not recommended</span><span>Two is the recommended maximum.</span>`
      : `<span class="tag tag-good">${n} ${n === 1 ? 'color' : 'colors'} + Evergreen</span>`;
    renderStack();
  }

  function renderStack() {
    const stack = $('#stack');
    let first = true;
    ['r1', 'r2', 'e', 'g1', 'g2'].forEach((id) => {
      const el = $(`.slot[data-id=${id}]`, stack), it = cur.byId[id];
      if (!it) { el.classList.remove('on', 'first', 'sel'); el.style.flexGrow = 0; el.tabIndex = -1; return; }
      const isFirst = first; first = false;
      el.classList.add('on'); el.classList.toggle('first', isFirst);
      el.classList.toggle('sel', S.active === id);
      el.classList.toggle('compact', it.area < 0.5);
      el.style.flexGrow = it.area; el.style.background = it.hex; el.style.color = inkOrWhite(it.hex); el.tabIndex = id === 'e' ? -1 : 0;
      el.setAttribute('aria-label', `${it.label}, ${it.hex}`);
      el.innerHTML = `<span class="b-label">${it.label}</span><span class="b-hex">${it.hex}</span>`;
    });
    $('[data-empty=top]', stack).classList.toggle('on', !cur.hasR);
    $('[data-empty=bottom]', stack).classList.toggle('on', !cur.hasG);

    // header spectrum follows the selection
    const g = cur.byId.g1 ? cur.byId.g1.hex : CONFIG.evergreenHex, r = cur.byId.r1 ? cur.byId.r1.hex : CONFIG.evergreenHex;
    $('#spectrum-bar').style.background = `linear-gradient(90deg, ${g}, ${CONFIG.evergreenHex} 50%, ${r})`;
  }

  /* ---------- 2. Explore ---------- */
  function renderTabs() {
    const tabs = $('#tabs');
    tabs.hidden = cur.chipItems.length < 2;
    tabs.innerHTML = cur.chipItems.map((it) => `<button role="tab" aria-selected="${S.active === it.id}" class="${S.active === it.id ? 'on' : ''}" data-action="chip" data-v="${it.id}">
      <i style="background:${it.hex}"></i>${it.label}</button>`).join('');
  }

  function renderExploreStatic() {
    const key = activeKey(), terr = TERRITORIES[key];
    $('#explore-sub').textContent = `${terr.label}: ${terr.character.slice(0, 3).join(' / ')}`;
    $('#intensity-label').textContent = `How ${key === 'grounded' ? 'full' : 'heightened'}?`;
    $('#intensity-lo').textContent = terr.slider[0];
    $('#intensity-hi').textContent = terr.slider[1];
    $('#intensity').value = Math.round(S.t[S.active] * 100);
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

  function renderContext() {
    const key = activeKey(), it = cur.byId[S.active], g = E.guidance(it.hex, it.c);
    $('#context').innerHTML = `
      <div class="stage">
        <div class="stage-ev" style="background:${CONFIG.evergreenHex};color:${inkOrWhite(CONFIG.evergreenHex)}"><span>Evergreen</span></div>
        <div class="stage-sel" style="background:${it.hex};color:${g.best.level === 'fail' ? '#fff' : inkOrWhite(it.hex)}">
          <span class="stage-aa">Aa</span><span>${it.label}</span>
        </div>
      </div>
      <div class="hexline"><b>${it.hex}</b><button class="mini" data-action="copy" data-v="${it.hex}" aria-label="Copy HEX">Copy</button><span class="depth">${depthPhrase(it.c, key)}</span></div>
      <div class="tags ctx-tags">${tagHtml(g.tags[g.tags.length - 1])}</div>
      <p class="note">${g.rel.notes.join(' ')}</p>`;
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

  /* ---------- 3. Build ---------- */
  const overallLabel = (s) => (s >= 0.72 ? ['Strong match', 'good'] : s >= 0.55 ? ['Good match', 'info'] : ['Use with care', 'warn']);

  function posterHtml(order) {
    const n = order.length;
    const blocks = order.map((o) => {
      const tag = `<small>${o.label}${o.anchor ? ' · Anchor' : ''}</small>`;
      const inner = o.role === 'dominant' ? `${tag}<h4>In season, right now.</h4><p>Fresh ingredients, thoughtfully grown.</p>`
        : o.role === 'accent' ? `${tag}<span class="pill">Order now</span>` : `${tag}<p>Secondary information.</p>`;
      return `<div class="b b-${o.role}" style="background:${o.hex};color:${inkOrWhite(o.hex)}">${inner}</div>`;
    });
    return `<div class="poster n${n}" style="${n >= 3 ? `grid-template-rows:repeat(${n - 1},1fr)` : ''}" aria-label="Composition preview, illustrative proportions">${blocks.join('')}</div>`;
  }

  function renderBuild() {
    const order = E.hierarchy(cur.items);
    let html = `<div class="roles">${order.map((o) => `
      <div class="role" title="${o.note}"><span class="role-sw" style="background:${o.hex}"></span>
        <div><b>${o.role[0].toUpperCase() + o.role.slice(1)}</b> <span class="role-name">${o.label}${o.anchor ? ' · anchor' : ''}</span><small>${o.note}</small></div></div>`).join('')}</div>`;

    const ev = E.evaluate(cur.chipItems.map((i) => ({ key: i.key, c: i.c }))), [lab, tone] = overallLabel(ev.score);
    html += `<div class="overall"><span class="tag tag-${tone}">${lab}</span>${cur.q.recommended ? '' : '<span class="tag tag-warn">3 colors</span>'}<span>${ev.notes.slice(0, 2).join(' ')}</span></div>`;

    if (cur.hasG && cur.hasR) {
      const from = activeKey(), to = from === 'grounded' ? 'ripe' : 'grounded', target = to[0] + '1';
      S.recs = E.recommend(S.chips[S.active], from, 6);
      html += `<h3 class="sub">${TERRITORIES[to].label} counterparts<small>for ${cur.byId[S.active].label}, replaces ${cur.labelOf(target)}</small></h3>
        <div class="recs">${S.recs.map((r, i) => {
          const sp = E.spec(r.color), on = cur.byId[target] && cur.byId[target].hex === sp.hex;
          return `<button class="rec${on ? ' on' : ''}" data-action="rec" data-v="${i}" data-target="${target}" title="${r.reason}">
            <span class="rec-sw" style="background:${sp.hex}"><i style="background:${CONFIG.evergreenHex}"></i></span>
            <b>${sp.hex}</b><span class="rec-why">${r.reason}</span></button>`; }).join('')}</div>`;
    } else {
      const other = cur.hasG ? 'Ripe' : 'Grounded';
      html += `<div class="invite"><span>Want a ${other} counterpart? We'll suggest options that work with your color and Evergreen.</span>
        <button class="btn" data-action="mix">Add ${other}</button></div>`;
    }
    html += posterHtml(order);
    $('#build-body').innerHTML = html;
  }

  /* ---------- 4. Apply ---------- */
  const val = (label, text, copy) => `<button class="val" data-action="copy" data-v="${copy ?? text}" title="Copy ${label}"><span>${label}</span><code>${text}</code></button>`;

  function crow(o) {
    const g = E.guidance(o.hex, o.c), s = o.spec;
    if (o.key === 'evergreen') g.tags = g.tags.filter((t) => !/Evergreen|accent/.test(t.text)).concat({ text: 'The constant', tone: 'good' });
    return `<div class="crow"><span class="crow-sw" style="background:${o.hex}"></span><div style="min-width:0">
      <div class="crow-title"><b>${o.label}</b><span>${o.role[0].toUpperCase() + o.role.slice(1)}${o.anchor ? ' · Anchor' : ''}</span></div>
      <div class="crow-vals">${val('HEX', s.hex)}${val('RGB', s.rgb.join(', '), `rgb(${s.rgb.join(', ')})`)}${val('CMYK≈', s.cmyk.join(' '), `cmyk(${s.cmyk.join(', ')})`)}${val('OKLCH', s.oklchText.replace(/^oklch\(|\)$/g, ''), s.oklchText)}</div>
      <div class="tags crow-tags">${g.tags.slice(0, 2).map(tagHtml).join('')}</div></div></div>`;
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
    return `<div class="matrix" style="grid-template-columns:86px repeat(${cols.length},minmax(0,1fr))"><div></div>${head}${rows}</div>
      <div class="legend"><span><b>✓</b> Body text</span><span><b>L</b> Large text only</span><span><b>✕</b> Avoid</span><span>Columns: type color</span></div>`;
  }

  function renderApply() {
    const order = E.hierarchy(cur.items);
    $('#apply-body').innerHTML = `
      <div class="crows${order.length >= 4 ? ' dense' : ''}">${order.map(crow).join('')}</div>
      <h3 class="sub">Type on color</h3>
      ${matrixHtml(order)}
      <div class="exports">
        <button class="btn" data-action="copy-css">CSS variables</button>
        <button class="btn" data-action="copy-json">JSON</button>
        <button class="btn btn-primary" data-action="copy-link">Copy link</button>
      </div>`;
  }

  /* ---------- Technical view (drawer) ---------- */
  const bar = (label, v) => `<div class="bar"><span>${label}</span><i style="--w:${Math.round(C.clamp(v, 0, 1) * 100)}%"></i><em>${v.toFixed(2)}</em></div>`;

  function renderTech() {
    const dr = $('#drawer');
    dr.hidden = !S.tech;
    if (!S.tech) return;
    const ev = E.evaluate(cur.chipItems.map((i) => ({ key: i.key, c: i.c })));
    const cards = cur.chipItems.map((it, i) => {
      const m = T.membership(it.c), r = ev.rels[i];
      return `<div class="tcard"><div class="tcard-h"><i style="background:${it.hex}"></i>${it.label} <span class="mono">${it.hex}</span></div>
        <div class="mono">${it.spec.oklchText}<br>${depthPhrase(it.c, it.key)} · depth ${m.depth.toFixed(2)} (${m.status})</div>
        <div style="margin-top:6px">${bar('Evergreen fit', r.score)}${Object.entries(r.parts).map(([k, v]) => bar(k, v)).join('')}</div>
        <div class="mono">ΔE(OK) ${r.metrics.dE.toFixed(3)} · ΔL ${r.metrics.dL.toFixed(2)} · hue Δ ${r.metrics.dh.toFixed(0)}° · C ratio ${r.metrics.cRatio.toFixed(2)}</div>
        <div class="tags" style="margin-top:6px">${E.guidance(it.hex, it.c).tags.map(tagHtml).join('')}</div></div>`;
    }).join('');
    const gs = cur.chipItems.filter((i) => i.key === 'grounded'), rs = cur.chipItems.filter((i) => i.key === 'ripe');
    const pairs = [];
    gs.forEach((g) => rs.forEach((r, k) => pairs.push(`<div class="tcard"><div class="tcard-h">${g.label} ↔ ${r.label}</div>${Object.entries(E.pairCompat(g.c, r.c).parts).map(([n, v]) => bar(n, v)).join('')}</div>`)));
    const fgList = [['White', CONFIG.whiteHex], ['Ink', CONFIG.inkHex], ['Evergreen', CONFIG.evergreenHex], ...cur.chipItems.map((c) => [c.label, c.hex])];
    const rowsT = cur.items.map((o) => `<tr><td>${o.label}</td>${fgList.map(([n, hex]) => {
      if (hex.toUpperCase() === o.hex.toUpperCase()) return '<td>–</td>';
      const r = E.contrastLevel(hex, o.hex); return `<td title="${n} on ${o.label}">${r.ratio.toFixed(1)} / ${Math.abs(r.lc).toFixed(0)}</td>`; }).join('')}</tr>`).join('');
    $('#drawer-body').innerHTML = `
      <p>Balance ${S.p.toFixed(2)} (0 = Grounded end, 1 = Ripe end) · zone ${cur.z.id} · layout ${cur.code} · ${cur.q.chips} chips${cur.q.recommended ? '' : ' (not recommended)'} · overall ${ev.score.toFixed(2)}</p>
      <section><h4>Each color against Evergreen</h4>${cards}</section>
      ${pairs.length ? `<section><h4>Grounded ↔ Ripe</h4>${pairs.join('')}</section>` : ''}
      <section><h4>Contrast: WCAG ratio / APCA Lc</h4>
        <table class="ttable"><tr><th>bg \\ type</th>${fgList.map(([n]) => `<th>${n.slice(0, 5)}</th>`).join('')}</tr>${rowsT}</table>
        <p style="margin-top:4px">Body text needs ≥ ${E.PARAMS.contrast.bodyWcag}:1 and Lc ≥ ${E.PARAMS.contrast.bodyLc}; large text ≥ ${E.PARAMS.contrast.largeWcag}:1 and Lc ≥ ${E.PARAMS.contrast.largeLc}.</p></section>
      <section><h4>Territory slice at hue ${S.chips[S.active].h.toFixed(0)}°</h4><canvas id="slice" width="360" height="300"></canvas>
        <p>Territories are irregular, hue-dependent regions (shaded boxes), not one universal L/C range. Shaded area is the sRGB gamut. Evergreen is plotted at its own chroma and lightness.</p></section>
      <p>Territory boundaries are provisional until calibrated against Sweetgreen's approved samples. CMYK values are indicative only; confirm with press proofs.</p>`;
    drawSlice();
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
    const order = E.hierarchy(cur.items), extras = cur.chipItems.map((e) => [e.label, e.hex]);
    return {
      balance: +S.p.toFixed(3), layout: cur.code, chips: cur.q.chips, recommended: cur.q.recommended,
      colors: order.map((o) => {
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
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600); }

  /* ---------- render orchestration ---------- */
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fullRender(); }); }
  function fullRender() {
    snapshot();
    renderComposer(); renderTabs(); renderExploreStatic(); drawField(); renderContext(); renderBuild(); renderApply(); renderTech(); writeHash();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action, v = b.dataset.v || b.dataset.id;
    if (a === 'layout') { S.picks[cur.z.id] = +v; fullRender(); }
    else if (a === 'chip') { if (v === 'e') { toast('Evergreen is the constant.'); return; } S.active = v; fullRender(); }
    else if (a === 'mix') { S.p = 0.5; fullRender(); }
    else if (a === 'rec') { setChip(b.dataset.target, S.recs[+v].color); fullRender(); }
    else if (a === 'copy') copy(v);
    else if (a === 'copy-css') copy(exportCss(), 'CSS variables copied');
    else if (a === 'copy-json') copy(JSON.stringify(exportData(), null, 2), 'JSON copied');
    else if (a === 'copy-link') { writeHash(); copy(location.href, 'Link copied'); }
    else if (a === 'test-hex') testHex();
    else if (a === 'snap') { setChip(S.active, S.pendingSnap); $('#test-msg').textContent = 'Applied the nearest approved color.'; fullRender(); }
    else if (a === 'goto') { S.active = v; setChip(v, C.fromHex(b.dataset.hex)); $('#test-msg').textContent = ''; fullRender(); }
    else if (a === 'close-tech') { S.tech = false; $('#tech-toggle').checked = false; fullRender(); }
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
  $('#tech-toggle').addEventListener('change', (e) => { S.tech = e.target.checked; fullRender(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.tech) { S.tech = false; $('#tech-toggle').checked = false; fullRender(); } });

  /* ---------- init ---------- */
  readHash();
  fullRender();
  window.SGApp = { state: S, snapshot: () => cur, exportData };
})();
