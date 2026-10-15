/* Front end for the Figma design (v5). The engine, zones, hash state and library logic are unchanged from v4;
   this file only translates them into the designed panels.

   View model: a 1440 x 810 artboard scaled to fit. The colors sit once on the stage; one panel at a time on the right:
   steps 1 to 4 in the main panel, plus About (beside it) and Library (replaces it).
   Evergreen is always present; up to 3 more chips (Grounded g1/g2, Ripe r1/r2). The balance slider picks a zone
   and each zone allows specific combinations (js/spectrum.js). */
(function () {
  const { color: C, territories: T, engine: E, spectrum: SP, motion: M, keywords: K } = SG;
  const { TERRITORIES, CONFIG } = T;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // phones and small tablets in portrait get the bottom-sheet layout (CSS class .mobile on #art); everything else is the desktop layout
  const MQ = matchMedia('(max-width: 900px) and (min-height: 520px)'), isMobile = () => MQ.matches;
  const FIELD = { w: 360, h: 194, Ltop: 0.97, Lbot: 0.2 };
  const CHIP_IDS = ['g1', 'g2', 'r1', 'r2'];
  const TAGLINE = { ripe: 'Colors that feel vibrant, expressive, and full', grounded: 'Colors that feel rooted, substantial, and tempered' };
  const TAB_ORDER = ['r1', 'r2', 'g1', 'g2']; // tabs and first selection: Ripe before Grounded, 1 before 2
  const STAGE_ORDER = ['r2', 'r1', 'e', 'g1', 'g2']; // a second Ripe stacks above the first
  let STAGE_H = 710;
  const terrOf = (id) => (id[0] === 'g' ? 'grounded' : 'ripe');
  const LEVEL = { pass: ['Pass', 'good'], fail: ['Avoid', 'bad'] };
  const ROLE_LABEL = { dominant: 'Dominant', supporting: 'Supporting', accent: 'Accent' };
  const LIB_KEY = 'sg-color-field:library:v1';
  const ICON = {
    q: '<svg viewBox="0 0 10 16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M1.3 4.9C1.3 2.8 2.8 1.3 5 1.3s3.7 1.3 3.7 3.2c0 1.6-1 2.2-2 2.9-.9.6-1.7 1.2-1.7 2.6"/><circle cx="5" cy="14.2" r=".6" fill="#fff" stroke-width="1.4"/></svg>',
    up: '<svg viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M4.5 8V1.3M1.6 4l2.9-2.9L7.4 4"/></svg>',
    right: '<svg viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M1 4.5h6.7M5 1.6l2.9 2.9L5 7.4"/></svg>',
    check: '<svg viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 4.8l2.3 2.4L8 1.6"/></svg>',
    cross: '<svg viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.1"><path d="M1 1l7 7M8 1L1 8"/></svg>',
    open: '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.2"><path d="M3 9l6-6M4 3h5v5"/></svg>',
    del: '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="1.2"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
  };

  const seed = { g1: T.colorAt('grounded', 45, 0.5, 0.5), r1: T.colorAt('ripe', 25, 0.66, 0.6) };
  seed.g2 = E.companion('grounded', seed.g1);
  seed.r2 = E.companion('ripe', seed.r1);

  const S = {
    p: 0.5, picks: {}, active: 'r1', step: 1, view: 'main',
    chips: { ...seed }, pname: '', picked: { g1: false, g2: false, r1: false, r2: false },
    t: Object.fromEntries(CHIP_IDS.map((id) => [id, T.intensityOf(terrOf(id), seed[id])])),
    recs: [], sug: null, fieldKey: null, fieldBitmap: null, pendingSnap: null, testMsg: '', cpBackup: null,
  };

  /* ---------- derived state ---------- */
  let cur = null;
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
      return { id, key: terrOf(id), hex: spec.hex, c: spec.oklch, spec, area: area[id], label: labelOf(id), picked: !!S.picked[id] };
    };
    const order = STAGE_ORDER.filter((id) => id === 'e' || ids.includes(id));
    const items = order.map(mk), byId = Object.fromEntries(items.map((i) => [i.id, i]));
    const ranked = E.hierarchy(items), roles = Object.fromEntries(ranked.map((o) => [o.id, o]));
    cur = { zone, z, pick, code, ids, q, items, byId, ranked, roles, chipItems: TAB_ORDER.map((id) => byId[id]).filter(Boolean), pickedChips: items.filter((i) => i.id !== 'e' && i.picked), hasG: q.g > 0, hasR: q.r > 0, labelOf };
    if (!ids.includes(S.active)) S.active = TAB_ORDER.find((id) => ids.includes(id));
  }
  const activeKey = () => terrOf(S.active);
  const pickedOnly = (o) => o.id === 'e' || o.picked;
  const markPicked = (id) => { S.picked[id] = true; };
  const DOT_BLANK = '#d4d4d8';
  // same rule as the contrast table (APCA Lc 30+), so a block label never disagrees with the table
  const labelColor = (hex) => E.bestForeground(hex).fg;
  const terrName = (k) => TERRITORIES[k].label;

  /* ---------- URL state (shareable; only written on Apply) ---------- */
  function writeHash() {
    if (S.step !== 4) { if (location.hash) history.replaceState(null, '', location.pathname + location.search); return; }
    const q = new URLSearchParams({ v: '2', p: S.p.toFixed(3), c: cur.code, pk: JSON.stringify(S.picks) });
    CHIP_IDS.forEach((id) => q.set(id, E.spec(S.chips[id]).hex.slice(1)));
    if (S.pname) q.set('nm', S.pname);
    q.set('ch', CHIP_IDS.filter((id) => S.picked[id]).join(','));
    history.replaceState(null, '', '#' + q.toString());
  }
  function applyState({ p, picks, hex, name, picked }) {
    if (typeof p === 'number' && p >= 0 && p <= 1) S.p = p;
    S.picks = {};
    for (const z of SP.ZONES) if (picks && Number.isInteger(picks[z.id]) && picks[z.id] >= 0 && picks[z.id] < z.combos.length) S.picks[z.id] = picks[z.id];
    for (const id of CHIP_IDS) {
      const c = hex && hex[id] && C.fromHex(hex[id]);
      if (!c) continue;
      const k = terrOf(id);
      S.chips[id] = T.membership(c).territory === k ? c : T.snapInto(k, c);
      S.t[id] = T.intensityOf(k, S.chips[id]);
    }
    S.pname = typeof name === 'string' ? name.trim().slice(0, 28) : '';
    for (const id of CHIP_IDS) S.picked[id] = Array.isArray(picked) ? picked.includes(id) : true; // links and saved palettes from before this state: all colors were set
  }
  function readHash() {
    if (!location.hash.slice(1)) return false; // a fresh visit: nothing chosen yet
    const q = new URLSearchParams(location.hash.slice(1));
    const hex = Object.fromEntries(CHIP_IDS.map((id) => [id, q.get(id)]));
    if (q.get('v') !== '2') { applyState({ hex }); return false; }
    let picks = {};
    try { picks = JSON.parse(q.get('pk') || '{}') || {}; } catch (e) { /* ignore */ }
    applyState({ p: parseFloat(q.get('p')), picks, hex, name: q.get('nm') || '', picked: q.has('ch') ? q.get('ch').split(',').filter(Boolean) : null });
    return true;
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
  const libName = (it) => it.name || SP.label(it.code).replace(' + Evergreen', '');
  function addToLibrary() {
    if (!CHIP_IDS.some((id) => S.picked[id])) { toast('Pick a color in Explore color first'); return; }
    const list = loadLib();
    const hex = Object.fromEntries(CHIP_IDS.map((id) => [id, E.spec(S.chips[id]).hex]));
    list.unshift({ id: Date.now().toString(36), savedAt: Date.now(), p: +S.p.toFixed(3), picks: { ...S.picks }, code: cur.code, hex, name: S.pname, picked: CHIP_IDS.filter((id) => S.picked[id]) });
    S.pname = '';
    const ok = saveLib(list.slice(0, 60));
    setView('library');
    if (!ok) toast('Saved for this visit only (browser storage is off)');
  }
  function thumbHtml(it) {
    const ids = SP.ids(it.code), hx = (id) => '#' + String(it.hex[id]).replace('#', '');
    const chips = ['r1', 'r2', 'g1', 'g2'].filter((id) => ids.includes(id) && (!it.picked || it.picked.includes(id))).map(hx), ev = CONFIG.evergreenHex;
    const cell = (c, style) => `<i style="background:${c};${style}"></i>`;
    if (chips.length <= 1) return cell(ev, 'grid-row:1/3') + cell(chips[0] || ev, 'grid-row:1/3');
    if (chips.length === 2) return cell(ev, 'grid-row:1/3') + cell(chips[0], '') + cell(chips[1], '');
    return cell(ev, '') + cell(chips[0], '') + cell(chips[2], '') + cell(chips[1], '');
  }

  /* ---------- stage: the colors, once ---------- */
  const blocks = {};
  function buildStage() {
    STAGE_ORDER.forEach((id) => {
      const b = document.createElement('div'); b.className = 'blk gone'; b.dataset.id = id; b.dataset.action = 'chip'; b.dataset.v = id;
      b.innerHTML = '<div class="face"><span class="lab"></span><span class="sub"></span><div class="binfo"></div></div>'; $('#stage').appendChild(b); blocks[id] = b;
    });
  }
  function sizeStage() {
    const cs = getComputedStyle(document.documentElement), num = (n, d) => parseFloat(cs.getPropertyValue(n)) || d;
    const maxH = num('--stage-max-h', 760), maxW = num('--stage-max-w', 560), my = num('--stage-margin-y', 50);
    const k0 = num('--stage-scale', 1.07), k1 = num('--stage-scale-large', 1.3), from = num('--stage-scale-from', 1440), to = num('--stage-scale-to', 1920);
    if (isMobile()) { // phone layout: marks on top, the color blocks under them, one bottom sheet below
      const M_ = { top: 56, gap: 12, edge: 12 };
      const sheet = Math.min(Math.round(innerHeight * 0.6), 600);
      const st = $('#stage'), art = $('#art');
      STAGE_H = Math.max(150, innerHeight - M_.top - sheet - M_.gap - M_.edge);
      art.style.setProperty('--sw', Math.min(innerWidth - 2 * M_.edge, 640) + 'px'); art.style.setProperty('--ph', sheet + 'px'); art.style.setProperty('--ph-lib', (innerHeight - M_.top - M_.edge) + 'px');
      st.style.setProperty('--blk-r', Math.min(30, STAGE_H / 7).toFixed(1) + 'px');
      st.style.height = STAGE_H + 'px'; st.style.top = M_.top + 'px';
      return;
    }
    const baseH = Math.max(320, Math.min(innerHeight - 2 * my, maxH)), baseW = Math.min(innerWidth * 0.3236, maxW);
    const k = k0 + (k1 - k0) * C.clamp((innerWidth - from) / (to - from), 0, 1);
    STAGE_H = Math.max(320, Math.min(baseH * k, innerHeight - 50)); // never taller than the sidebar (25px margin top and bottom)
    const s = STAGE_H / baseH;                                        // width and corner radius follow the same scale
    const st = $('#stage'), art = $('#art');
    art.style.setProperty('--sw', (baseW * s).toFixed(1) + 'px'); st.style.setProperty('--blk-r', (46.773 * s).toFixed(2) + 'px');
    st.style.height = STAGE_H + 'px'; st.style.top = (innerHeight - STAGE_H) / 2 + 'px';
  }
  /* The selected block shows how type behaves on it: Aa in white, ink and Evergreen; crossed out when APCA Lc is under 30. */
  function infoHtml(it) {
    const cfg = CONFIG;
    return '<div class="bi-aas">' + [cfg.whiteHex, cfg.inkHex, cfg.evergreenHex].map((fg) => {
      const r = E.contrastLevel(fg, it.hex);
      return `<span class="bi-aa ${r.level}" style="color:${fg}" title="${LEVEL[r.level][0]}">Aa</span>`;
    }).join('') + '</div>';
  }
  function renderStage() {
    sizeStage();
    const raw = {}; let sum = 0;
    STAGE_ORDER.forEach((id) => {
      const it = cur.byId[id]; if (!it) return;
      // the engine's visual area, rescaled so a balanced color is as large as Evergreen (as drawn in the design)
      raw[id] = id === 'e' ? 1 : Math.max(0.35, 0.5 + (it.area - 0.25) / 0.95); sum += raw[id];
    });
    let y = 0;
    STAGE_ORDER.forEach((id) => {
      const b = blocks[id], it = cur.byId[id];
      if (!it) { b.classList.add('gone'); b.style.height = '0px'; b.style.top = (id[0] === 'r' ? 0 : STAGE_H) + 'px'; b.classList.remove('sel'); return; }
      const h = (STAGE_H * raw[id]) / sum;
      b.classList.remove('gone'); b.style.top = y + 'px'; b.style.height = h + 'px'; y += h;
      const blank = id !== 'e' && !it.picked;
      b.classList.toggle('blank', blank); b.classList.toggle('room-sub', h >= 70); b.classList.toggle('room-info', h >= 84);
      const face = b.firstChild;
      face.style.backgroundColor = blank ? '' : it.hex; face.style.color = blank ? '' : labelColor(it.hex);
      b.classList.toggle('sel', (S.step === 2 || S.step === 3) && S.active === id);
      b.setAttribute('aria-label', blank ? `${it.label}, not chosen yet` : `${it.label}, ${it.hex}, ${ROLE_LABEL[cur.roles[id].role]}`);
      $('.lab', b).textContent = it.label;
      $('.sub', b).textContent = blank ? TAGLINE[it.key] : '';
      $('.binfo', b).innerHTML = !blank && id !== 'e' && (S.step === 2 || S.step === 3) && S.active === id ? infoHtml(it) : '';
    });
    kickTilt();
  }

  /* ---------- color blocks in 3D ----------
     Same technique as the símon.com labels (read from its CSS): the wrapper (.blk) carries the perspective, the face rotates
     with rotateX / rotateY toward the pointer, the pivot eases to the pointer position, and a hovered (or selected) block
     gets a soft shadow. The selected block (steps 2 and 3) also keeps facing the pointer anywhere on the screen.
     Evergreen is flat: no tilt, no shadow, no press. Numbers are in M.tilt (js/motion.js). */
  const mouse = { x: null, y: null }, pose = {};
  let tiltRaf = 0;
  const kickTilt = () => { if (!tiltRaf) tiltRaf = requestAnimationFrame(tickTilt); };
  function tickTilt() {
    tiltRaf = 0;
    const K = M.tilt, st = $('#stage').getBoundingClientRect(), calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let busy = false;
    STAGE_ORDER.forEach((id) => {
      const b = blocks[id], face = b.firstChild, sel = b.classList.contains('sel'), gone = b.classList.contains('gone');
      const p = pose[id] || (pose[id] = { rx: 0, ry: 0 });
      if (id === 'e') { face.style.transform = ''; b.classList.remove('hot'); return; }
      const w = st.width, h = b.offsetHeight, left = st.left, top = st.top + b.offsetTop, cx = left + w / 2, cy = top + h / 2;
      const over = !gone && mouse.x !== null && mouse.x >= left && mouse.x <= left + w && mouse.y >= top && mouse.y <= top + h;
      let trx = 0, try_ = 0, origin = '50% 50%';
      if (over) {
        const nx = (mouse.x - left) / w, ny = (mouse.y - top) / h;
        try_ = (nx - 0.5) * 2 * K.ry; trx = -(ny - 0.5) * 2 * K.rx; origin = `${(nx * 100).toFixed(1)}% ${(ny * 100).toFixed(1)}%`;
      } else if (sel) {
        const mob = isMobile(), nx = mouse.x === null ? (mob ? 0 : 0.5) : C.clamp((mouse.x - cx) / K.reachX, -1, 1), ny = mouse.y === null ? 0 : C.clamp((mouse.y - cy) / K.reachY, -1, 1);
        try_ = nx * K.ry * (mob ? 0.5 : 1); trx = -ny * K.rx * (mob ? 0.5 : 1);
      }
      const f = calm ? 1 : K.follow, d = Math.abs(trx - p.rx) + Math.abs(try_ - p.ry);
      p.rx += (trx - p.rx) * f; p.ry += (try_ - p.ry) * f;
      if (d > 0.01) busy = true;
      b.classList.toggle('hot', over || sel);
      face.style.transformOrigin = origin;
      face.style.transform = Math.abs(p.rx) + Math.abs(p.ry) < 0.004 && !over && !sel ? '' : `rotateY(${p.ry.toFixed(3)}deg) rotateX(${p.rx.toFixed(3)}deg)`;
    });
    if (busy) kickTilt();
  }
  addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; kickTilt(); });
  ['pointerup', 'pointercancel'].forEach((t) => addEventListener(t, (e) => { if (e.pointerType !== 'mouse') { mouse.x = mouse.y = null; kickTilt(); } })); // a finger has no hover
  document.documentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = null; kickTilt(); });
  addEventListener('resize', kickTilt);

  /* ---------- sliders ---------- */
  function makeSlider(el, pad, onInput, label) {
    const knob = $('.knob', el); el.tabIndex = 0; el.setAttribute('role', 'slider'); el.setAttribute('aria-label', label);
    let v = 0;
    const span = () => el.offsetWidth - knob.offsetWidth - 2 * pad;
    const api = {
      set(nv) { v = Math.min(1, Math.max(0, nv)); knob.style.left = pad + v * span() + 'px'; el.setAttribute('aria-valuenow', Math.round(v * 100)); },
      get: () => v,
    };
    const fromEvent = (e) => { const r = el.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * el.offsetWidth; return (x - pad - knob.offsetWidth / 2) / span(); };
    let drag = false;
    el.addEventListener('pointerdown', (e) => { drag = true; el.setPointerCapture(e.pointerId); api.set(fromEvent(e)); onInput(v); });
    el.addEventListener('pointermove', (e) => { if (drag) { api.set(fromEvent(e)); onInput(v); } });
    el.addEventListener('pointerup', () => { drag = false; });
    el.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: -0.01, ArrowDown: -0.01, ArrowRight: 0.01, ArrowUp: 0.01 }[e.key];
      if (d === undefined) return; e.preventDefault(); api.set(v + d * (e.shiftKey ? 10 : 1)); onInput(v);
    });
    return api;
  }

  /* ---------- main panel ---------- */
  const el = { body: $('#step-body'), foot: $('#foot'), stepper: $('#stepper') };
  let shown = 0, ui = {};

  function renderStepper() {
    el.stepper.innerHTML = [1, 2, 3, 4].map((n) => `${n > 1 ? `<hr class="${n <= S.step ? 'on' : ''}">` : ''}<li class="${n <= S.step ? 'on' : ''}"><button data-action="step" data-v="${n}" aria-label="Step ${n}" ${n === S.step ? 'aria-current="step"' : ''}>${n}</button></li>`).join('');
  }
  function renderFoot() {
    if (S.step !== 4) $('#bottom-extra').innerHTML = '';
    const q = '<button class="btn btn-black q" data-action="about" aria-label="About this tool">' + ICON.q + '</button>';
    el.foot.innerHTML = S.step === 1
      ? `<button class="btn btn-black w250" data-action="next">Next</button>${q}`
      : `<button class="btn btn-gray w123" data-action="back">Back</button>` + (S.step === 4 ? `<button class="btn btn-black w123" data-action="restart">Restart</button>` : `<button class="btn btn-black w123" data-action="next">Next</button>`) + q;
  }
  const hd = (title, sub) => `<div class="hd"><h2>${title}</h2><p id="sub">${sub}</p></div>`;

  function buildStep() {
    ui = {};
    const w = document.createElement('div'); w.className = 'sw s' + S.step;
    if (S.step === 1) {
      w.innerHTML = hd('Choose an expression', 'Slide between Grounded and Ripe') + `
        <div class="stack gap17">
          <div class="stack gap8"><div class="axis"><span>Grounded</span><i><b></b></i><span>Ripe</span></div><div class="track big" id="bal"><span class="knob"></span></div></div>
          <div class="opts" id="opts"><span class="pill"></span></div>
        </div>`;
    } else if (S.step === 2) {
      w.innerHTML = hd('Explore color', '') + `
        <div class="stack gap13 center">
          <div class="tabs" id="tabs"><span class="pill"></span></div>
          <div class="stack gap18">
            <div class="stack gap12">
              <div class="stack gap9">
                <div class="fieldbox" id="fieldbox" tabindex="0" role="application" aria-label="Color field. Horizontal is hue, vertical is lightness. Arrow keys move the selection.">
                  <canvas id="field" width="${FIELD.w}" height="${FIELD.h}"></canvas><span class="mkr ev" id="ev-mkr"><em>Evergreen</em></span><span class="mkr" id="mkr"></span><span class="fax fax-l">Lighter ${ICON.up}</span><span class="fax fax-h">Hue ${ICON.right}</span></div>
                <div class="slab">Saturation</div>
                <div class="track sat" id="int"><span class="knob"></span></div>
              </div>
              <div class="inp"><input id="hex" type="text" placeholder="Have a color in mind? #E4572E" spellcheck="false" autocomplete="off" aria-label="Check a HEX color"><button class="go" data-action="test-hex">Check</button></div>
              <div class="inp"><input id="kw" type="text" placeholder="Try a word: tomato, olive" spellcheck="false" autocomplete="off" aria-label="Suggest colors for a word"><button class="go go-wide" data-action="suggest">Suggest</button></div>
            </div>
            <div class="res" id="res"></div>
          </div>
        </div>`;
    } else if (S.step === 3) {
      w.innerHTML = `<div class="stack gap35 center">${hd('Explore counterparts', '')}<div class="stack gap13 center"><div class="tabs" id="tabs"><span class="pill"></span></div><div id="cp"></div></div></div><div id="reset"></div>`;
    } else {
      w.innerHTML = '<div class="stack gap35 center" id="apply"></div>';
    }
    el.body.replaceChildren(w);
    if (S.step === 1) ui.bal = makeSlider($('#bal'), 2, (v) => { S.p = v; schedule(); }, 'Balance between Grounded and Ripe');
    if (S.step === 2) {
      ui.int = makeSlider($('#int'), 1, (v) => {
        const c = S.chips[S.active]; S.t[S.active] = v; S.chips[S.active] = T.colorAt(activeKey(), c.h, c.L, v); markPicked(S.active); S.testMsg = ''; schedule();
      }, 'Saturation');
      const fb = $('#fieldbox'); let drag = false;
      fb.addEventListener('pointerdown', (e) => { drag = true; fb.setPointerCapture(e.pointerId); pickFromPointer(e); });
      fb.addEventListener('pointermove', (e) => { if (drag) pickFromPointer(e); });
      fb.addEventListener('pointerup', () => { drag = false; });
      fb.addEventListener('keydown', (e) => {
        const c = S.chips[S.active], st = e.shiftKey ? 10 : 2;
        const mv = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] }[e.key];
        if (!mv) return; e.preventDefault();
        S.chips[S.active] = T.colorAt(activeKey(), (c.h + mv[0] + 360) % 360, c.L + mv[1], S.t[S.active]); markPicked(S.active); S.testMsg = ''; schedule();
      });
      $('#hex').addEventListener('keydown', (e) => { if (e.key === 'Enter') testHex(); });
      $('#kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') suggestWord(); });
    }
  }

  function tabsHtml(list) {
    return list.map((it) => `<button class="tab${S.active === it.id ? ' on' : ''}" role="tab" aria-selected="${S.active === it.id}" data-action="chip" data-v="${it.id}"><i style="background:${it.picked ? it.hex : DOT_BLANK}"></i>${esc(it.label)}</button>`).join('');
  }
  // The white highlight is one persistent element that slides to the selected item; only the items are rebuilt.
  function slidePill(box, items, selector) {
    const pill = $('.pill', box); $$(items, box).forEach((n) => n.remove());
    return (html) => {
      pill.insertAdjacentHTML('afterend', html);
      const on = $(selector, box);
      if (!on) { pill.style.opacity = 0; return; }
      const first = !pill.dataset.placed;
      if (first) pill.classList.add('still');
      pill.style.opacity = 1; pill.style.left = on.offsetLeft + 'px'; pill.style.top = on.offsetTop + 'px'; pill.style.width = on.offsetWidth + 'px'; pill.style.height = on.offsetHeight + 'px';
      if (first) { pill.dataset.placed = '1'; pill.offsetWidth; pill.classList.remove('still'); } // eslint-disable-line no-unused-expressions
    };
  }
  function renderTabs() { const t = $('#tabs'); if (t) slidePill(t, '.tab', '.tab.on')(tabsHtml(cur.chipItems)); }

  const overallLabel = (s) => (s >= 0.72 ? ['strong match', 'good'] : s >= 0.55 ? ['good match', 'info'] : ['use with care', 'warn']);

  function renderStep1() {
    ui.bal.set(S.p);
    const order = cur.z.combos.map((code, i) => i).sort((x, y) => SP.parse(cur.z.combos[x]).chips - SP.parse(cur.z.combos[y]).chips); // fewer colors on top
    slidePill($('#opts'), '.opt', '.opt.on')(order.map((i) => {
      const code = cur.z.combos[i], q = SP.parse(code), ids = SP.ids(code);
      const dots = [...ids.filter((x) => x[0] === 'g'), 'e', ...ids.filter((x) => x[0] === 'r')].map((id) => `<i style="background:${id === 'e' ? CONFIG.evergreenHex : S.picked[id] ? C.toHex(S.chips[id]) : DOT_BLANK}"></i>`).join('');
      const lead = cur.z.lead ? (cur.z.lead === 'grounded' ? 'Grounded-led' : 'Ripe-led') : 'Balanced';
      return `<button class="opt${i === cur.pick ? ' on' : ''}" data-action="layout" data-v="${i}" role="radio" aria-checked="${i === cur.pick}">
        <small>${lead}</small><span class="dots">${dots}</span><b>${SP.label(code)}</b>${q.recommended ? '' : '<span class="nr">Not recommended</span>'}</button>`;
    }).join(''));
  }

  function renderStep2() {
    const key = activeKey(), terr = TERRITORIES[key];
    $('#sub').textContent = `${terr.label}: ${terr.character.slice(0, 3).join(' / ')}`;
    renderTabs();
    // gray (no chroma) at this lightness up to the most saturated color the territory allows at this hue
    const cc = S.chips[S.active], top = T.colorAt(key, cc.h, cc.L, 1), stops = Array.from({ length: 9 }, (_, i) => C.toHex(C.fitToGamut({ L: top.L, C: top.C * i / 8, h: top.h })));
    $('#int').style.background = S.picked[S.active] ? `linear-gradient(90deg, ${stops.join(', ')})` : 'linear-gradient(90deg, #e6e6e6, #b9b9b9)'; // gray until a color is chosen
    ui.int.set(S.t[S.active]);
    drawField();

    if (!S.picked[S.active]) {
      $('#res').innerHTML = S.testMsg || `<p>No ${terr.label} color chosen yet</p><p class="t">Click the color field, move the slider or check a HEX to choose one.</p>`;
    } else {
      const ev = E.evaluate(cur.pickedChips.map((i) => ({ key: i.key, c: i.c }))), [lab, tone] = overallLabel(ev.score);
      $('#res').innerHTML = S.testMsg || `<p>This combination <span class="tone-${tone}">${lab}</span></p><p class="t">${esc(ev.notes.slice(0, 2).join(' ') || 'Evergreen anchors the combination.')}</p>`;
    }
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
          if (fit.C < b.Cmin * 0.92) ok = false;
          else { const [r, g, bl] = C.oklchToRgb8(fit); img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = Math.round(255 * C.clamp(dL / 0.06, 0.35, 1)); }
        }
        if (!ok) { img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; img.data[i + 3] = 0; }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function drawField() {
    const key = activeKey(), t = S.t[S.active], ck = key + ':' + t.toFixed(2);
    if (S.fieldKey !== ck) { S.fieldBitmap = buildField(key, t); S.fieldKey = ck; }
    const cv = $('#field'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(S.fieldBitmap, 0, 0);
    const c = S.chips[S.active], { Ltop, Lbot } = FIELD, m = $('#mkr'), ev = $('#ev-mkr');
    m.style.display = S.picked[S.active] ? '' : 'none'; m.style.left = (c.h / 360) * 100 + '%'; m.style.top = ((Ltop - c.L) / (Ltop - Lbot)) * 100 + '%'; m.style.background = C.toHex(c);
    ev.style.left = (T.evergreen.h / 360) * 100 + '%'; ev.style.top = ((Ltop - T.evergreen.L) / (Ltop - Lbot)) * 100 + '%'; ev.style.background = CONFIG.evergreenHex;
  }
  function pickFromPointer(e) {
    const r = $('#field').getBoundingClientRect(), { Ltop, Lbot } = FIELD;
    const h = C.clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360;
    const L = Ltop - C.clamp((e.clientY - r.top) / r.height, 0, 1) * (Ltop - Lbot);
    S.chips[S.active] = T.colorAt(activeKey(), h, L, S.t[S.active]); markPicked(S.active); S.testMsg = ''; schedule();
  }
  function setChip(id, c) { S.chips[id] = c; S.t[id] = T.intensityOf(terrOf(id), c); markPicked(id); }

  /* Word to color: each press steps to the next suggestion for the word, inside the selected territory. */
  function suggestWord() {
    const word = $('#kw').value.trim(), id = S.active, key = activeKey(), hit = K.lookup(word);
    if (!word) { S.testMsg = '<p>Type a color word, like tomato or olive.</p>'; renderStep2(); return; }
    if (!hit) { S.testMsg = `<p>We don't know "${esc(word)}" yet.</p><p class="t">Try a color, fruit or flower name, like tomato, olive or lavender.</p>`; renderStep2(); return; }
    const sig = key + hit.hex;
    if (!S.sug || S.sug.sig !== sig) S.sug = { sig, i: -1, ...K.suggest(key, hit.hex) };
    S.sug.i = (S.sug.i + 1) % S.sug.pool.length;
    setChip(id, S.sug.pool[S.sug.i]);
    const moved = S.sug.i === 0 && S.sug.moved ? ` Moved into ${terrName(key)}.` : '';
    S.testMsg = `<p>${esc(hit.name)} in ${terrName(key)}, ${S.sug.i + 1} of ${S.sug.pool.length}.${moved}</p><p class="t">Press Suggest for another.</p>`;
    fullRender(); $('#kw').value = word;
  }

  function testHex() {
    const c = C.fromHex($('#hex').value), key = activeKey(), id = S.active;
    if (!c) { S.testMsg = '<p>Enter a valid HEX, like #E4572E.</p>'; renderStep2(); return; }
    if (c.C < 0.02) c.h = S.chips[id].h;
    const m = T.membership(c), mine = terrName(key);
    if (m.territory === key) { setChip(id, c); S.testMsg = `<p>Inside ${mine}. Applied.</p>`; fullRender(); return; }
    const other = m.territory && cur.ids.some((x) => terrOf(x) === m.territory) ? m.territory : null;
    const where = m.territory ? `That color belongs to ${terrName(m.territory)}.` : 'That color sits outside the Sweetgreen territories.';
    S.pendingSnap = T.snapInto(key, c);
    S.testMsg = `<p>${where} Nearest ${mine}: <i class="sw-chip" style="background:${C.toHex(S.pendingSnap)}"></i>${C.toHex(S.pendingSnap)}</p>
      <div class="acts"><button class="lnk" data-action="snap">Use it</button>${other ? `<button class="lnk" data-action="goto" data-v="${other[0]}1" data-hex="${C.toHex(c)}">Use as ${terrName(other)}</button>` : ''}</div>`;
    renderStep2();
  }

  function renderStep3() {
    const from = activeKey(), to = from === 'grounded' ? 'ripe' : 'grounded', target = to[0] + '1';
    $('#sub').textContent = cur.hasG && cur.hasR ? `${terrName(to)} counterparts for your ${cur.byId[S.active].label}` : 'Add a counterpart to see suggestions';
    renderTabs();
    $('#reset').innerHTML = '';
    if (cur.hasG && cur.hasR && !S.picked[S.active]) {
      $('#cp').innerHTML = `<div class="stack gap8 center"><p class="invite">Choose your ${cur.byId[S.active].label} in Explore color first, then we'll suggest ${terrName(to)} counterparts that work with it and Evergreen.</p><button class="lnk" data-action="step" data-v="2">Back to Explore color</button></div>`;
    } else if (cur.hasG && cur.hasR) {
      S.recs = E.recommend(S.chips[S.active], from, 6);
      $('#cp').innerHTML = `<div class="grid3">${S.recs.map((r, i) => {
        const sp = E.spec(r.color), on = cur.byId[target] && cur.byId[target].hex === sp.hex;
        return `<button class="rec${on ? ' on' : ''}" style="background:${sp.hex}" data-action="rec" data-v="${i}" data-target="${target}" aria-label="${sp.hex}" title="${esc(r.reason)}. Replaces ${esc(cur.labelOf(target))}."></button>`;
      }).join('')}</div>`;
      $('#reset').innerHTML = '<button class="small-link" data-action="reset-sel">reset selection</button>';
    } else {
      const other = terrName(to);
      $('#cp').innerHTML = `<div class="stack gap8 center"><p class="invite">Want a ${other} counterpart? We'll suggest options that work with your color and Evergreen.</p><button class="lnk" data-action="mix">Add ${other}</button></div>`;
    }
  }

  const val = (cls, label, text, copy) => `<button class="val ${cls}" data-action="copy" data-v="${esc(copy ?? text)}" title="Copy ${label}"><span>${label}</span><code>${text}</code></button>`;
  function renderStep4() {
    const order = ['e', 'r1', 'r2', 'g1', 'g2'].filter((id) => cur.byId[id] && pickedOnly(cur.byId[id])).map((id) => ({ ...cur.byId[id], ...cur.roles[id] }));
    const left = cur.chipItems.filter((i) => !i.picked).map((i) => i.label);
    const rows = order.map((o) => {
      const s = o.spec, role = o.id === 'e' ? 'Anchor' : ROLE_LABEL[o.role] + (o.label === terrName(o.key) ? '' : ' · ' + terrName(o.key));
      return `<div class="crow"><span class="sw" style="background:${o.hex}"></span><div class="stack gap7"><div class="nm">${esc(o.label)}<span>${role}</span></div>
        <div class="vals">${val('', 'HEX', s.hex)}${val('cm', 'CMYK', s.cmyk.join('/'), `cmyk(${s.cmyk.join(', ')})`)}${val('', 'RGB', s.rgb.join(', '), `rgb(${s.rgb.join(', ')})`)}${val('', 'OKLCH', `${(s.oklch.L * 100).toFixed(1)}%/${s.oklch.C.toFixed(3)}/${s.oklch.h.toFixed(0)}`, s.oklchText)}</div></div></div>`;
    }).join('');
    const cols = [['White', CONFIG.whiteHex], ['Ink', CONFIG.inkHex], ['Evergreen', CONFIG.evergreenHex], ...cur.pickedChips.map((c) => [c.label, c.hex])];
    const head = cols.map(([n, hex]) => `<div class="h" title="${esc(n)} type"><i style="background:${hex}"></i></div>`).join('');
    const cells = order.map((o) => cols.map(([n, hex]) => {
      if (hex.toUpperCase() === o.hex.toUpperCase()) return `<div class="c same" title="Same color"></div>`;
      const r = E.contrastLevel(hex, o.hex), mark = r.level === 'pass' ? ICON.check : ICON.cross;
      return `<div class="c lvl-${r.level}" style="background:${o.hex};color:${hex}" title="${esc(n)} on ${esc(o.label)}: ${LEVEL[r.level][0]}"><span class="a">Aa</span><span class="m">${mark}</span></div>`;
    }).join('')).join('');
    $('#apply').innerHTML = hd('Apply', 'How to use these colors') + `
      <div class="stack gap25 center apply-body">
        <div class="stack gap15 rows4">${rows}</div>
        <div class="stack gap13 mxwrap">
          <div class="mx" style="grid-template-columns:repeat(${cols.length},1fr)">${head}${cells}</div>
          <div class="legend"><span>${ICON.check} Pass (APCA 30+)</span><span>${ICON.cross} Avoid</span><span>Columns: type color</span></div>
          ${left.length ? `<p class="lt left">Not chosen yet: ${esc(left.join(', '))}. Left out of this palette.</p>` : ''}
        </div>
      </div>`;
    const extra = `<div class="stack gap20 share">
        <div class="stack gap5"><p>Share this palette</p><div class="row"><button class="lnk" data-action="copy-link">Copy link</button><button class="lnk" data-action="copy-json">JSON</button><button class="lnk" data-action="copy-css">CSS variable</button></div></div>
        <div class="stack gap5"><p>Want to archive this color palette?</p><div class="inp pname"><input id="pname" type="text" maxlength="28" placeholder="Name this palette (optional)" value="${esc(S.pname)}" spellcheck="false" autocomplete="off" aria-label="Palette name"></div><div class="row"><button class="lnk" data-action="lib-add">Add to Library</button><button class="lnk" data-action="lib-show">Open Library</button></div></div>
      </div>`;
    if (isMobile()) { $('#bottom-extra').innerHTML = ''; $('#apply').insertAdjacentHTML('beforeend', extra); } else $('#bottom-extra').innerHTML = extra; // on a phone Share / Archive scroll with the content
  }

  /* ---------- about, library ---------- */
  const ABOUT = [
    'Our color system is inspired by the natural cycle of growth, from the environments that nurture it to the vibrant expressions that emerge from it. Grounded represents the foundation, Ripe represents abundance and expression, and Evergreen is the living thread that connects them. Together, they create a system that can shift in energy and character while remaining distinctly sweetgreen.',
    'Our expanded palette is not a fixed collection of secondary colors. Instead, it is built around two flexible color territories: Grounded and Ripe. Grounded colors feel rooted, substantial, tempered, and elemental. Ripe colors feel vibrant, expressive, abundant, and full. Colors can be selected from either territory or brought together depending on the energy and character of the moment.',
    'These territories give us room to evolve across seasons, ingredients, collaborations, and campaigns without losing cohesion. Every new color should feel at home within its territory and work in relationship with Evergreen.',
  ];
  function renderLibrary() {
    const list = loadLib();
    $('#lib-grid').innerHTML = list.length ? list.map((it) => `<div class="it"><div class="th">${thumbHtml(it)}<span class="hov"><button data-action="lib-del" data-v="${it.id}" aria-label="Delete">${ICON.del}</button><button data-action="lib-open" data-v="${it.id}" aria-label="Open">${ICON.open}</button></span></div><div class="nm">${esc(libName(it))}</div></div>`).join('')
      : '<p class="empty">Nothing saved yet. Use Add to Library on the Apply step to keep a palette. Saved palettes stay in this browser only.</p>';
  }
  // Panels never overlap: moving between Main and Library (or About and Library) first sends the current panel
  // fully off screen, then the next one enters. Main <-> About slide together, as in the design.
  let viewTimer = 0;
  function exitThen(fn) {
    clearTimeout(viewTimer); S.busy = true; $('#art').dataset.view = 'none';
    viewTimer = setTimeout(() => { fn(); S.busy = false; }, M.panel + M.seqGap);
  }
  function setView(v) {
    const from = S.view; if (from === v) return;
    S.view = v;
    const art = $('#art');
    if (v === 'library') renderLibrary();
    if ((from === 'main' && v === 'library') || (from === 'library' && v !== 'library') || (from === 'about' && v === 'library')) exitThen(() => { art.dataset.view = v; });
    else art.dataset.view = v;
  }

  /* ---------- exports ---------- */
  function exportData() {
    const extras = cur.pickedChips.map((e) => [e.label, e.hex]);
    return {
      name: S.pname || undefined, balance: +S.p.toFixed(3), layout: cur.code, chips: cur.q.chips, recommended: cur.q.recommended,
      colors: cur.ranked.filter(pickedOnly).map((o) => {
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

  /* ---------- orchestration ---------- */
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; fullRender(); }); }
  function fullRender() {
    snapshot();
    if (shown !== S.step) { shown = S.step; buildStep(); }
    renderStepper(); renderFoot(); renderStage();
    if (S.step === 1) renderStep1(); else if (S.step === 2) renderStep2(); else if (S.step === 3) renderStep3(); else renderStep4();
    $('#art').dataset.step = S.step;
    writeHash();
  }
  function goStep(n) {
    if (n === 3 && S.step !== 3) S.cpBackup = { chips: { ...S.chips }, t: { ...S.t }, picked: { ...S.picked } };
    if (n === 2 && S.step === 1) S.active = TAB_ORDER.find((id) => cur.ids.includes(id)) || S.active; // Ripe first
    S.step = Math.max(1, Math.min(4, n)); S.testMsg = ''; fullRender();
  }
  function restart() {
    exitThen(() => { resetAll(); $('#art').dataset.view = 'main'; });
  }
  function resetAll() {
    S.p = 0.5; S.picks = {}; S.chips = { ...seed }; S.pname = '';
    for (const id of CHIP_IDS) S.t[id] = T.intensityOf(terrOf(id), seed[id]);
    S.active = 'r1'; for (const id of CHIP_IDS) S.picked[id] = false; goStep(1);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || !$('#art').contains(b) || S.busy) return;
    const a = b.dataset.action, v = b.dataset.v;
    if (S.view === 'library' && ['lib-del', 'lib-open'].indexOf(a) < 0 && a !== 'close-sheet') return;
    if (a === 'next') goStep(S.step + 1);
    else if (a === 'back') goStep(S.step - 1);
    else if (a === 'step') { if (+v <= S.step) goStep(+v); }
    else if (a === 'restart') restart();
    else if (a === 'layout') { S.picks[cur.z.id] = +v; fullRender(); }
    else if (a === 'chip') { if (v === 'e') { toast('Evergreen is the constant.'); return; } if (S.step < 2) return; S.active = v; S.testMsg = ''; fullRender(); }
    else if (a === 'about') setView(S.view === 'about' ? 'main' : 'about');
    else if (a === 'close-sheet') setView('main');
    else if (a === 'mix') { S.p = 0.5; S.testMsg = ''; fullRender(); }
    else if (a === 'rec') { setChip(b.dataset.target, S.recs[+v].color); fullRender(); }
    else if (a === 'reset-sel' && S.cpBackup) { Object.assign(S.chips, S.cpBackup.chips); Object.assign(S.t, S.cpBackup.t); Object.assign(S.picked, S.cpBackup.picked); fullRender(); }
    else if (a === 'copy') copy(v);
    else if (a === 'copy-css') copy(exportCss(), 'CSS variables copied');
    else if (a === 'copy-json') copy(JSON.stringify(exportData(), null, 2), 'JSON copied');
    else if (a === 'copy-link') { writeHash(); copy(location.href, 'Link copied'); }
    else if (a === 'lib-add') addToLibrary();
    else if (a === 'lib-show') setView('library');
    else if (a === 'lib-open') { const it = loadLib().find((x) => x.id === v); if (it) { applyState({ p: it.p, picks: it.picks, hex: it.hex, name: it.name, picked: it.picked }); S.step = 4; shown = 0; setView('main'); fullRender(); toast('Opened from library'); } }
    else if (a === 'lib-del') { saveLib(loadLib().filter((x) => x.id !== v)); renderLibrary(); }
    else if (a === 'test-hex') testHex();
    else if (a === 'suggest') suggestWord();
    else if (a === 'snap') { setChip(S.active, S.pendingSnap); S.testMsg = '<p>Applied the nearest approved color.</p>'; fullRender(); }
    else if (a === 'goto') { S.active = v; setChip(v, C.fromHex(b.dataset.hex)); S.testMsg = ''; fullRender(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'pname') { S.pname = e.target.value.trim().slice(0, 28); writeHash(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !S.busy && S.view !== 'main' && S.view !== 'intro') setView('main'); });

  addEventListener('resize', () => { if (cur) renderStage(); });

  /* ---------- init ---------- */
  M.apply(document.documentElement);
  $('#about-text').innerHTML = ABOUT.map((t) => `<p>${t}</p>`).join('');
  const applyMode = () => { $('#art').classList.toggle('mobile', isMobile()); if (cur) { shown = 0; fullRender(); } };
  applyMode(); (MQ.addEventListener ? MQ.addEventListener('change', applyMode) : MQ.addListener(applyMode));
  buildStage();
  const fromLink = readHash();
  if (fromLink) S.step = 4;
  fullRender();
  const art = $('#art');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]intro=0/.test(location.search);
  if (fromLink || reduce) { art.classList.remove('i-mono'); art.dataset.view = 'main'; }
  else {
    M.runIntro(art, $('#intro'), () => { /* ready */ });
    art.addEventListener('click', () => { if (art.dataset.view === 'intro') M.skip(); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { shown = 0; fullRender(); }); // tab widths depend on the fonts
  window.SGApp = { state: S, snapshot: () => cur, exportData, loadLib, goStep };
})();
