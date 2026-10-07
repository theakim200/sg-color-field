/* Front end. Translates the engine's technical results into brand language.
   Journey: Choose an expression (balance handlebar) -> Explore color -> Build a combination -> Apply.

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

  const seed = { g1: T.colorAt('grounded', 45, 0.5, 0.5), r1: T.colorAt('ripe', 25, 0.66, 0.6) };
  seed.g2 = E.companion('grounded', seed.g1);
  seed.r2 = E.companion('ripe', seed.r1);

  const S = {
    p: 0.5, picks: {}, season: '', tech: false, active: 'r1',
    chips: { ...seed },
    t: Object.fromEntries(CHIP_IDS.map((id) => [id, T.intensityOf(terrOf(id), seed[id])])),
    names: { g1: '', g2: '', r1: '', r2: '' },
    recs: [], fieldKey: null, fieldBitmap: null, pendingSnap: null,
  };

  /* ---------- derived state ---------- */
  let cur = null; // snapshot for the current render
  function snapshot() {
    const zone = SP.zoneIndex(S.p), z = SP.ZONES[zone];
    const pick = Math.min(S.picks[z.id] || 0, z.combos.length - 1), code = z.combos[pick];
    const ids = SP.ids(code), area = SP.areas(S.p, code), q = SP.parse(code);
    const nOf = (k) => ids.filter((i) => terrOf(i) === k).length;
    const labelOf = (id) => {
      if (id === 'e') return 'Evergreen';
      const k = terrOf(id);
      return TERRITORIES[k].label + (nOf(k) > 1 ? ' ' + id[1] : '');
    };
    const mk = (id) => {
      if (id === 'e') { const spec = E.spec(T.evergreen); return { id, key: 'evergreen', hex: spec.hex, c: spec.oklch, spec, name: '', area: 1, label: 'Evergreen' }; }
      const spec = E.spec(S.chips[id]);
      return { id, key: terrOf(id), hex: spec.hex, c: spec.oklch, spec, name: S.names[id].trim(), area: area[id], label: labelOf(id) };
    };
    const order = ['r1', 'r2', 'e', 'g1', 'g2'].filter((id) => id === 'e' || ids.includes(id));
    const items = order.map(mk), byId = Object.fromEntries(items.map((i) => [i.id, i]));
    cur = { zone, z, pick, code, ids, q, items, byId, chipItems: items.filter((i) => i.id !== 'e'), hasG: q.g > 0, hasR: q.r > 0, labelOf };
    if (!ids.includes(S.active)) S.active = ids.includes('r1') ? 'r1' : 'g1';
  }
  const activeKey = () => terrOf(S.active);
  const textOn = (hex) => E.bestForeground(hex);
  const inkOrWhite = (hex) => (textOn(hex).name === 'Ink' ? CONFIG.inkHex : '#fff');
  const nameOf = (it) => (it.name ? `${it.name}` : it.label);
  const tagHtml = (t) => `<span class="tag tag-${t.tone}">${t.text}</span>`;

  function depthPhrase(c, key) {
    const m = T.membership(c);
    if (m.territory !== key) return `Outside ${TERRITORIES[key].label}`;
    return m.status === 'core' ? `Deep in ${TERRITORIES[key].label}` : `At the edge of ${TERRITORIES[key].label}`;
  }

  /* ---------- URL state (shareable) ---------- */
  function writeHash() {
    const q = new URLSearchParams({ p: S.p.toFixed(3), c: cur.code, pk: JSON.stringify(S.picks) });
    CHIP_IDS.forEach((id) => q.set(id, E.spec(S.chips[id]).hex.slice(1)));
    if (CHIP_IDS.some((id) => S.names[id])) q.set('n', JSON.stringify(CHIP_IDS.map((id) => S.names[id])));
    if (S.season) q.set('t', S.season);
    history.replaceState(null, '', '#' + q.toString());
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const p = parseFloat(q.get('p'));
    if (p >= 0 && p <= 1) S.p = p;
    try { const pk = JSON.parse(q.get('pk') || '{}'); if (pk && typeof pk === 'object') for (const z of SP.ZONES) if (Number.isInteger(pk[z.id]) && pk[z.id] >= 0 && pk[z.id] < z.combos.length) S.picks[z.id] = pk[z.id]; } catch (e) { /* ignore */ }
    for (const id of CHIP_IDS) {
      const c = q.get(id) && C.fromHex(q.get(id));
      if (!c) continue;
      const k = terrOf(id);
      S.chips[id] = T.membership(c).territory === k ? c : T.snapInto(k, c); // never load a color outside its territory
      S.t[id] = T.intensityOf(k, S.chips[id]);
    }
    try { const n = JSON.parse(q.get('n') || '[]'); CHIP_IDS.forEach((id, i) => { if (typeof n[i] === 'string') S.names[id] = n[i].slice(0, 28); }); } catch (e) { /* ignore */ }
    if (q.get('t')) S.season = q.get('t').slice(0, 32);
  }

  /* ---------- 1. Expression: balance handlebar + stack ---------- */
  function renderComposer() {
    $('#balance').value = Math.round(S.p * 1000);
    $('#season').value !== S.season && ($('#season').value = S.season);

    // zone legend, Ripe end (left) to Grounded end (right)
    $('#bal-zones').innerHTML = [...SP.ZONES].reverse().map((z) => `<span class="zone${z.id === cur.z.id ? ' on' : ''}">${z.combos.join('<br>')}</span>`).join('');

    // layout choices inside the current zone
    $('#layouts').innerHTML = cur.z.combos.length < 2 ? '' : '<div class="layouts-title">Chip layout</div>' + cur.z.combos.map((code, i) => {
      const q = SP.parse(code);
      const dots = [...SP.ids(code).filter((x) => x[0] === 'g'), 'e', ...SP.ids(code).filter((x) => x[0] === 'r')].map((id) => `<i style="background:${id === 'e' ? CONFIG.evergreenHex : C.toHex(S.chips[id])}"></i>`).join('');
      return `<button class="layout${i === cur.pick ? ' on' : ''}" data-action="layout" data-v="${i}" role="radio" aria-checked="${i === cur.pick}">
        <span class="dots">${dots}</span><span class="lab">${SP.label(code)}</span>${q.recommended ? '' : '<span class="tag tag-warn">Not recommended</span>'}</button>`;
    }).join('');

    const n = cur.q.chips;
    $('#count-note').innerHTML = n >= 3
      ? `<span class="tag tag-warn">3 colors: possible, not recommended</span><span>More color dilutes the system and leaves Evergreen less room to anchor. Two is the recommended maximum.</span>`
      : `<span class="tag tag-good">${n} ${n === 1 ? 'color' : 'colors'} + Evergreen</span><span class="tech-only mono">${cur.code} · ${SP.label(cur.code)}</span>`;

    renderNames();
    renderStack();
  }

  let namesSig = '';
  function renderNames() {
    const sig = cur.ids.join(',') + '|' + CHIP_IDS.map((id) => C.toHex(S.chips[id])).join('');
    const host = $('#names');
    if (namesSig.split('|')[0] === cur.ids.join(',') && host.children.length) { // only refresh swatches, keep focus in inputs
      $$('.name-row i', host).forEach((el) => { el.style.background = cur.byId[el.dataset.id].hex; });
      namesSig = sig; return;
    }
    namesSig = sig;
    host.innerHTML = cur.chipItems.map((it) => `<label class="name-row"><i data-id="${it.id}" style="background:${it.hex}"></i>
      <input type="text" data-name="${it.id}" maxlength="28" placeholder="Name this color" value="${it.name.replace(/"/g, '&quot;')}" autocomplete="off" aria-label="Name for ${it.label}"><small>${it.label}</small></label>`).join('');
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
      el.setAttribute('aria-label', `${it.label}${it.name ? ', ' + it.name : ''}, ${it.hex}`);
      el.innerHTML = `<span class="b-label">${it.label}</span><span class="b-name">${it.name || ''}</span><span class="b-hex">${it.hex}</span>`;
    });
    const top = $('[data-empty=top]', stack), bot = $('[data-empty=bottom]', stack);
    top.classList.toggle('on', !cur.hasR); bot.classList.toggle('on', !cur.hasG);
    // header spectrum follows the selection
    const g = cur.byId.g1 ? cur.byId.g1.hex : CONFIG.evergreenHex, r = cur.byId.r1 ? cur.byId.r1.hex : CONFIG.evergreenHex;
    $('#spectrum-bar').style.background = `linear-gradient(90deg, ${g}, ${CONFIG.evergreenHex} 50%, ${r})`;
  }

  /* ---------- 2. Explore ---------- */
  function renderTabs() {
    const tabs = $('#tabs');
    tabs.hidden = cur.chipItems.length < 2;
    tabs.innerHTML = cur.chipItems.map((it) => `<button role="tab" aria-selected="${S.active === it.id}" class="${S.active === it.id ? 'on' : ''}" data-action="chip" data-v="${it.id}">
      <i style="background:${it.hex}"></i>${it.name || it.label}</button>`).join('');
  }

  function renderExploreStatic() {
    const key = activeKey(), terr = TERRITORIES[key];
    $('#explore-sub').textContent = `${terr.label}: ${terr.character.join(' / ')}. Only colors that belong to this world are available.`;
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
        if (!ok) { img.data[i] = 20; img.data[i + 1] = 40; img.data[i + 2] = 35; img.data[i + 3] = 14; }
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
          <span class="stage-aa">Aa</span><span>${it.name || it.label}</span>
        </div>
      </div>
      <div class="ctx-meta">
        <div class="hexline"><b>${it.hex}</b><button class="mini" data-action="copy" data-v="${it.hex}" aria-label="Copy HEX">Copy</button></div>
        <div class="depth">${depthPhrase(it.c, key)}</div>
        <div class="tags">${g.tags.map(tagHtml).join('')}</div>
        <p class="note">${g.rel.notes.join(' ')}</p>
        <div class="tech-only mono">
          ${it.spec.oklchText}<br>
          Territory depth ${T.membership(it.c).depth.toFixed(2)} · Evergreen fit ${g.rel.score.toFixed(2)}<br>
          ΔE(OK) to Evergreen ${g.rel.metrics.dE.toFixed(3)} · hue Δ ${g.rel.metrics.dh.toFixed(0)}°
        </div>
      </div>`;
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
    msg.innerHTML = `${where} Nearest approved ${mine}: <span class="chip"><i style="background:${C.toHex(S.pendingSnap)}"></i>${C.toHex(S.pendingSnap)}</span>
      <button class="mini" data-action="snap">Use it</button>${other ? `<button class="mini" data-action="goto" data-v="${other}1" data-hex="${C.toHex(c)}">Use it as ${TERRITORIES[other].label}</button>` : ''}`;
  }

  /* ---------- 3. Build ---------- */
  const overallLabel = (s) => (s >= 0.72 ? ['Strong match', 'good'] : s >= 0.55 ? ['Good match', 'info'] : ['Use with care', 'warn']);

  function posterHtml(order) {
    const n = order.length, head = S.season.trim();
    const blocks = order.map((o) => {
      const col = inkOrWhite(o.hex), tag = `<small>${nameOf(o)}${o.anchor ? ' · Anchor' : ''}</small>`;
      const inner = o.role === 'dominant'
        ? `${tag}<h4>${head ? head : 'In season, right now.'}</h4><p>Fresh ingredients, thoughtfully grown.</p>`
        : o.role === 'accent' ? `${tag}<span class="pill">Order now</span>` : `${tag}<p>Supporting panel with secondary information.</p>`;
      return `<div class="b b-${o.role}" style="background:${o.hex};color:${col}">${inner}</div>`;
    });
    return `<div class="poster n${n}" style="${n >= 3 ? `grid-template-rows:repeat(${n - 1},1fr)` : ''}">${blocks.join('')}</div>`;
  }

  function renderBuild() {
    const order = E.hierarchy(cur.items);
    let html = `<div class="roles">${order.map((o) => `
      <div class="role"><span class="role-sw" style="background:${o.hex}"></span>
        <div><b>${o.role[0].toUpperCase() + o.role.slice(1)}</b> <span class="role-name">${nameOf(o)}${o.anchor ? ' · brand anchor' : ''}</span>
        <p>${o.note}</p></div></div>`).join('')}</div>`;

    const ev = E.evaluate(cur.chipItems.map((i) => ({ key: i.key, c: i.c }))), [lab, tone] = overallLabel(ev.score);
    html += `<div class="overall"><span class="tag tag-${tone}">${lab}</span>${cur.q.recommended ? '' : '<span class="tag tag-warn">3 colors: not recommended</span>'}<span>${ev.notes.join(' ')}</span>
      <span class="tech-only mono">score ${ev.score.toFixed(2)} · Evergreen fit ${ev.rels.map((r) => r.score.toFixed(2)).join('/')}${ev.cross.length ? ' · pairs ' + ev.cross.map((x) => x.score.toFixed(2)).join('/') : ''}</span></div>`;

    if (cur.hasG && cur.hasR) {
      const from = activeKey(), to = from === 'grounded' ? 'ripe' : 'grounded', target = to[0] + '1';
      S.recs = E.recommend(S.chips[S.active], from, 6);
      html += `<h3 class="sub">${TERRITORIES[to].label} counterparts for your ${cur.byId[S.active].name || cur.byId[S.active].label} <small>Replaces ${cur.labelOf(target)}</small></h3>
        <div class="recs">${S.recs.map((r, i) => {
          const sp = E.spec(r.color), on = cur.byId[target] && cur.byId[target].hex === sp.hex;
          return `<button class="rec${on ? ' on' : ''}" data-action="rec" data-v="${i}" data-target="${target}">
            <span class="rec-sw" style="background:${sp.hex}"><i style="background:${CONFIG.evergreenHex}"></i></span>
            <b>${sp.hex}</b><span class="rec-why">${r.reason}</span>
            <span class="tech-only mono">fit ${r.score.toFixed(2)} · EV ${r.rel.score.toFixed(2)}</span></button>`; }).join('')}</div>`;
    } else {
      const other = cur.hasG ? 'Ripe' : 'Grounded';
      html += `<div class="invite"><span>Want a ${other} counterpart? Slide toward the middle and we'll suggest options that work with your color and Evergreen.</span>
        <button class="btn" data-action="mix">Add ${other}</button></div>`;
    }
    html += `<h3 class="sub">Composition <small>Illustrative proportions, not fixed ratios</small></h3>${posterHtml(order)}`;
    $('#build-body').innerHTML = html;
  }

  /* ---------- 4. Apply ---------- */
  const LEVEL = { body: ['Body text', 'good'], large: ['Large text only', 'warn'], fail: ['Avoid', 'bad'] };

  function comboRows(order) {
    const extras = cur.chipItems.map((e) => [nameOf(e), e.hex]);
    return order.map((o) => {
      const fgs = E.foregrounds(o.hex, extras).filter((f) => !(o.key === 'evergreen' && f.name === 'Evergreen'));
      const tiles = fgs.map((f) => {
        const [lab, tone] = LEVEL[f.level];
        return `<div class="combo lvl-${f.level}" style="background:${o.hex};color:${f.fg}">
          <span class="aa">Aa</span><span class="combo-fg">${f.name}</span>
          <span class="combo-lab tag tag-${tone}">${lab}</span>
          <span class="tech-only mono">${f.ratio.toFixed(1)}:1 · Lc ${Math.abs(f.lc).toFixed(0)}</span></div>`;
      }).join('');
      return `<div class="combo-row"><div class="combo-bg"><span style="background:${o.hex}"></span>On ${nameOf(o)}</div><div class="combo-tiles">${tiles}</div></div>`;
    }).join('');
  }

  const valueRow = (label, val, copy) => `<div class="val"><span>${label}</span><code>${val}</code><button class="mini" data-action="copy" data-v="${copy ?? val}" aria-label="Copy ${label}">Copy</button></div>`;

  function colorCard(o) {
    const g = E.guidance(o.hex, o.c), s = o.spec;
    if (o.key === 'evergreen') g.tags = g.tags.filter((t) => !/Evergreen|accent/.test(t.text)).concat({ text: 'Works as a field with large type or logo', tone: 'info' }, { text: 'The constant', tone: 'good' });
    return `<article class="ccard">
      <div class="ccard-sw" style="background:${o.hex};color:${inkOrWhite(o.hex)}">
        <b>${nameOf(o)}</b><span>${o.name ? o.label + ' · ' : ''}${o.role[0].toUpperCase() + o.role.slice(1)}${o.anchor ? ' · Anchor' : ''}</span></div>
      <div class="ccard-body">
        <div class="tags">${g.tags.map(tagHtml).join('')}</div>
        ${valueRow('HEX', s.hex)}${valueRow('RGB', s.rgb.join(', '), `rgb(${s.rgb.join(', ')})`)}
        ${valueRow('CMYK≈', s.cmyk.join(', '), `cmyk(${s.cmyk.join(', ')})`)}${valueRow('OKLCH', s.oklchText.replace(/^oklch\(|\)$/g, ''), s.oklchText)}
      </div></article>`;
  }

  function renderApply() {
    const order = E.hierarchy(cur.items);
    $('#apply-body').innerHTML = `
      <div class="ccards">${order.map(colorCard).join('')}</div>
      <h3 class="sub">Approved combinations <small>Which type works on which color</small></h3>
      <div class="combos">${comboRows(order)}</div>
      <div class="exports">
        <button class="btn" data-action="copy-css">Copy CSS variables</button>
        <button class="btn" data-action="copy-json">Copy JSON</button>
        <button class="btn btn-primary" data-action="copy-link">Copy shareable link</button>
      </div>
      <div class="tech-only under-hood">
        <h3 class="sub">Under the hood</h3>
        <div class="hood-grid"><canvas id="slice" width="360" height="300" aria-label="Lightness and chroma slice at the active hue"></canvas>
        <div id="hood-text"></div></div>
      </div>`;
    if (S.tech) drawSlice();
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
    for (const [k, col] of [['grounded', '#8a6b4f'], ['ripe', '#e4572e']]) {
      const b = T.bounds(k, hue);
      ctx.fillStyle = col + '33'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.fillRect(X(b.Cmin), Y(b.Lmax), X(b.Cmax) - X(b.Cmin), Y(b.Lmin) - Y(b.Lmax));
      ctx.strokeRect(X(b.Cmin), Y(b.Lmax), X(b.Cmax) - X(b.Cmin), Y(b.Lmin) - Y(b.Lmax));
      ctx.fillStyle = col; ctx.font = '11px system-ui'; ctx.fillText(TERRITORIES[k].label, X(b.Cmin) + 4, Y(b.Lmax) + 13);
    }
    for (const e of cur.items) { ctx.beginPath(); ctx.arc(X(e.c.C), Y(e.c.L), 6, 0, 7); ctx.fillStyle = e.hex; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#444'; ctx.font = '11px system-ui';
    ctx.fillText(`Slice at hue ${hue.toFixed(0)}°  ·  x: chroma 0–${Cmax}  ·  y: lightness`, 6, H - 6);
    $('#hood-text').innerHTML = `<p>Territories are irregular, hue-dependent regions (shaded boxes at this hue), not one universal L/C range. Shaded area is the sRGB gamut. Dots show current colors; Evergreen is plotted at its own chroma and lightness.</p>
      <ul>${cur.chipItems.map((e) => `<li><b>${nameOf(e)}</b> ${depthPhrase(e.c, e.key)} (depth ${T.membership(e.c).depth.toFixed(2)})</li>`).join('')}</ul>
      <p>Balance ${S.p.toFixed(2)} (1 = Grounded end) · zone ${cur.z.id} · layout ${cur.code}</p>`;
  }

  /* ---------- exports ---------- */
  function exportData() {
    const order = E.hierarchy(cur.items), extras = cur.chipItems.map((e) => [nameOf(e), e.hex]);
    return {
      season: S.season || null, balance: +S.p.toFixed(3), layout: cur.code, chips: cur.q.chips, recommended: cur.q.recommended,
      colors: order.map((o) => {
        const g = E.guidance(o.hex, o.c);
        return { name: o.name || o.label, territory: o.key, role: o.role, anchor: o.anchor, hex: o.hex, rgb: o.spec.rgb, cmykApprox: o.spec.cmyk, oklch: o.spec.oklchText,
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
    document.body.classList.toggle('tech', S.tech);
    renderComposer(); renderTabs(); renderExploreStatic(); drawField(); renderContext(); renderBuild(); renderApply(); writeHash();
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
  });

  $('#balance').addEventListener('input', (e) => { S.p = e.target.value / 1000; schedule(); });
  $('#season').addEventListener('input', (e) => { S.season = e.target.value; schedule(); });
  $('#names').addEventListener('input', (e) => { const id = e.target.dataset.name; if (id) { S.names[id] = e.target.value; schedule(); } });

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

  /* ---------- init ---------- */
  readHash();
  fullRender();
  window.SGApp = { state: S, snapshot: () => cur, exportData };
})();
