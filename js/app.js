/* Front end. Translates the engine's technical results into brand language.
   Journey: Choose an expression -> Explore color -> Build a combination -> Apply. */
(function () {
  const { color: C, territories: T, engine: E } = SG;
  const { TERRITORIES, CONFIG } = T;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const FIELD = { w: 360, h: 200, Ltop: 0.97, Lbot: 0.2 };
  const STRUCTURES = {
    grounded: { title: 'Evergreen + Grounded', blurb: 'A more rooted, substantial, tempered expression.' },
    ripe: { title: 'Evergreen + Ripe', blurb: 'A more vibrant, heightened, expressive direction.' },
    both: { title: 'Evergreen + Grounded + Ripe', blurb: 'A broader expression spanning the full system.' },
  };
  const LEANS = { grounded: 'Grounded-led', balanced: 'Balanced', ripe: 'Ripe-led' };

  const S = {
    structure: 'both', lean: 'balanced', active: 'ripe', tech: false,
    color: { grounded: T.colorAt('grounded', 45, 0.5, 0.5), ripe: T.colorAt('ripe', 25, 0.66, 0.6) },
    t: { grounded: 0.5, ripe: 0.6 },
    recs: [], fieldKey: null, fieldBitmap: null,
  };

  /* ---------- derived state ---------- */
  function palette() {
    const mk = (key, c) => { const spec = E.spec(c); return { key, hex: spec.hex, c: spec.oklch, spec }; };
    const p = { evergreen: mk('evergreen', T.evergreen) };
    if (S.structure !== 'ripe') p.grounded = mk('grounded', S.color.grounded);
    if (S.structure !== 'grounded') p.ripe = mk('ripe', S.color.ripe);
    return p;
  }
  const labelOf = (key) => (key === 'evergreen' ? 'Evergreen' : TERRITORIES[key].label);
  const activeKey = () => (S.structure === 'both' ? S.active : S.structure);
  const textOn = (hex) => E.bestForeground(hex);
  const tagHtml = (t) => `<span class="tag tag-${t.tone}">${t.text}</span>`;
  const fmtRgb = (a) => a.join(', ');

  function depthPhrase(c, key) {
    const m = T.membership(c);
    if (m.territory !== key) return `Outside ${labelOf(key)}`;
    return m.status === 'core' ? `Deep in ${labelOf(key)}` : `At the edge of ${labelOf(key)}`;
  }

  /* ---------- URL state (shareable) ---------- */
  function writeHash() {
    const p = palette(), q = new URLSearchParams({ s: S.structure, l: S.lean });
    if (p.grounded) q.set('g', p.grounded.hex.slice(1));
    if (p.ripe) q.set('r', p.ripe.hex.slice(1));
    history.replaceState(null, '', '#' + q.toString());
  }
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (STRUCTURES[q.get('s')]) S.structure = q.get('s');
    if (LEANS[q.get('l')]) S.lean = q.get('l');
    for (const [k, key] of [['g', 'grounded'], ['r', 'ripe']]) {
      const c = q.get(k) && C.fromHex(q.get(k));
      if (!c) continue;
      S.color[key] = T.membership(c).territory === key ? c : T.snapInto(key, c); // never load a color outside the territory
      S.t[key] = T.intensityOf(key, S.color[key]);
    }
    S.active = S.structure === 'grounded' ? 'grounded' : 'ripe';
  }

  /* ---------- 1. Expression ---------- */
  function renderExpression() {
    const p = palette(), g = S.color.grounded, r = S.color.ripe;
    const stripe = (keys) => keys.map((k) => `<i style="background:${k === 'evergreen' ? CONFIG.evergreenHex : C.toHex(k === 'grounded' ? g : r)}"></i>`).join('');
    $('#expression-cards').innerHTML = Object.entries(STRUCTURES).map(([k, v]) => {
      const keys = k === 'grounded' ? ['grounded', 'evergreen'] : k === 'ripe' ? ['evergreen', 'ripe'] : ['grounded', 'evergreen', 'ripe'];
      return `<button class="card${S.structure === k ? ' on' : ''}" data-action="structure" data-v="${k}" role="radio" aria-checked="${S.structure === k}">
        <span class="stripe">${stripe(keys)}</span><b>${v.title}</b><span>${v.blurb}</span></button>`;
    }).join('');
    $('#lean').hidden = S.structure !== 'both';
    $$('#lean [data-action=lean]').forEach((b) => { const on = b.dataset.v === S.lean; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    // header spectrum follows the current selection
    const gHex = p.grounded ? p.grounded.hex : CONFIG.evergreenHex, rHex = p.ripe ? p.ripe.hex : CONFIG.evergreenHex;
    $('#spectrum-bar').style.background = `linear-gradient(90deg, ${gHex}, ${CONFIG.evergreenHex} 50%, ${rHex})`;
  }

  /* ---------- 2. Explore ---------- */
  function renderTabs() {
    const tabs = $('#tabs');
    tabs.hidden = S.structure !== 'both';
    if (S.structure !== 'both') return;
    tabs.innerHTML = ['grounded', 'ripe'].map((k) => `<button role="tab" aria-selected="${S.active === k}" class="${S.active === k ? 'on' : ''}" data-action="tab" data-v="${k}">
      <i style="background:${C.toHex(S.color[k])}"></i>${TERRITORIES[k].label}</button>`).join('');
  }

  function renderExploreStatic() {
    const key = activeKey(), terr = TERRITORIES[key];
    $('#explore-sub').textContent = `${terr.label}: ${terr.character.join(' / ')}. Only colors that belong to this world are available.`;
    $('#intensity-label').textContent = `How ${terr.slider[1] === 'Fuller' ? 'full' : 'heightened'}?`;
    $('#intensity-lo').textContent = terr.slider[0];
    $('#intensity-hi').textContent = terr.slider[1];
    $('#intensity').value = Math.round(S.t[key] * 100);
  }

  function buildField(key) {
    const t = S.t[key], { w, h, Ltop, Lbot } = FIELD;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const hue = (x / w) * 360, b = T.bounds(key, hue);
      for (let y = 0; y < h; y++) {
        const L = Ltop - (y / (h - 1)) * (Ltop - Lbot), i = (y * w + x) * 4;
        const dL = Math.min(L - b.Lmin, b.Lmax - L) / (b.Lmax - b.Lmin);
        let ok = dL >= 0;
        if (ok) {
          const target = b.Cmin + t * (b.Cmax - b.Cmin), fit = C.fitToGamut({ L, C: target, h: hue });
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
    const key = activeKey(), cacheKey = key + ':' + S.t[key].toFixed(2);
    if (S.fieldKey !== cacheKey) { S.fieldBitmap = buildField(key); S.fieldKey = cacheKey; }
    const cv = $('#field'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(S.fieldBitmap, 0, 0);
    const c = S.color[key], { Ltop, Lbot } = FIELD;
    const m = $('#marker');
    m.style.left = (c.h / 360) * 100 + '%';
    m.style.top = ((Ltop - c.L) / (Ltop - Lbot)) * 100 + '%';
    m.style.background = C.toHex(c);
    const ev = $('#ev-marker');
    ev.style.left = (T.evergreen.h / 360) * 100 + '%';
    ev.style.top = ((Ltop - T.evergreen.L) / (Ltop - Lbot)) * 100 + '%';
    ev.style.background = CONFIG.evergreenHex;
  }

  function renderContext() {
    const key = activeKey(), p = palette(), cur = p[key];
    const g = E.guidance(cur.hex, cur.c), fg = g.best;
    const evFg = textOn(CONFIG.evergreenHex);
    $('#context').innerHTML = `
      <div class="stage">
        <div class="stage-ev" style="background:${CONFIG.evergreenHex};color:${evFg.name === 'Ink' ? CONFIG.inkHex : '#fff'}"><span>Evergreen</span></div>
        <div class="stage-sel" style="background:${cur.hex};color:${fg.level === 'fail' ? '#fff' : fg.name === 'Ink' ? CONFIG.inkHex : '#fff'}">
          <span class="stage-aa">Aa</span><span>${labelOf(key)}</span>
        </div>
      </div>
      <div class="ctx-meta">
        <div class="hexline"><b>${cur.hex}</b><button class="mini" data-action="copy" data-v="${cur.hex}" aria-label="Copy HEX">Copy</button></div>
        <div class="depth">${depthPhrase(cur.c, key)}</div>
        <div class="tags">${g.tags.map(tagHtml).join('')}</div>
        <p class="note">${g.rel.notes.join(' ')}</p>
        <div class="tech-only mono">
          ${cur.spec.oklchText}<br>
          Territory depth ${T.membership(cur.c).depth.toFixed(2)} · Evergreen fit ${g.rel.score.toFixed(2)}<br>
          ΔE(OK) to Evergreen ${g.rel.metrics.dE.toFixed(3)} · hue Δ ${g.rel.metrics.dh.toFixed(0)}°
        </div>
      </div>`;
  }

  function setColor(key, c) {
    S.color[key] = c; S.t[key] = T.intensityOf(key, c);
  }

  function pickFromPointer(ev) {
    const key = activeKey(), r = $('#field').getBoundingClientRect(), { Ltop, Lbot } = FIELD;
    const h = C.clamp((ev.clientX - r.left) / r.width, 0, 0.9999) * 360;
    const L = Ltop - C.clamp((ev.clientY - r.top) / r.height, 0, 1) * (Ltop - Lbot);
    S.color[key] = T.colorAt(key, h, L, S.t[key]); // clamps L into the territory at this hue
    schedule();
  }

  function testHex() {
    const msg = $('#test-msg'), v = $('#hex-test').value, c = C.fromHex(v), key = activeKey();
    if (!c) { msg.innerHTML = 'Enter a valid HEX, like <b>#E4572E</b>.'; return; }
    if (c.C < 0.02) c.h = S.color[key].h; // a neutral has no hue; keep the current one
    const m = T.membership(c), mine = TERRITORIES[key].label;
    if (m.territory === key) {
      setColor(key, c); msg.innerHTML = `Inside ${mine}. Applied.`; fullRender();
    } else {
      const other = m.territory && S.structure === 'both' ? m.territory : null;
      const where = m.territory ? `That color belongs to ${TERRITORIES[m.territory].label}.` : `That color sits outside the Sweetgreen territories.`;
      S.pendingSnap = T.snapInto(key, c);
      msg.innerHTML = `${where} Nearest approved ${mine}: <span class="chip"><i style="background:${C.toHex(S.pendingSnap)}"></i>${C.toHex(S.pendingSnap)}</span>
        <button class="mini" data-action="snap">Use it</button>${other ? `<button class="mini" data-action="goto" data-v="${other}" data-hex="${C.toHex(c)}">Explore in ${TERRITORIES[other].label}</button>` : ''}`;
    }
  }

  /* ---------- 3. Build ---------- */
  function overallLabel(score) { return score >= 0.72 ? ['Strong match', 'good'] : score >= 0.55 ? ['Good match', 'info'] : ['Use with care', 'warn']; }

  function posterHtml(p, order) {
    const blocks = order.map((o) => {
      const e = p[o.key], f = textOn(e.hex), col = f.name === 'Ink' ? CONFIG.inkHex : '#fff';
      const inner = o.role === 'dominant'
        ? `<small>${labelOf(o.key)}${o.anchor ? ' · Anchor' : ''}</small><h4>In season, right now.</h4><p>Fresh ingredients, thoughtfully grown.</p>`
        : o.role === 'supporting'
          ? `<small>${labelOf(o.key)}${o.anchor ? ' · Anchor' : ''}</small><p>Supporting panel with secondary information.</p>`
          : `<small>${labelOf(o.key)}${o.anchor ? ' · Anchor' : ''}</small><span class="pill">Order now</span>`;
      return `<div class="b b-${o.role}" style="background:${e.hex};color:${col}">${inner}</div>`;
    });
    return `<div class="poster n${order.length}">${blocks.join('')}</div>`;
  }

  function renderBuild() {
    const p = palette(), hexes = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.hex]));
    const order = E.hierarchy(S.structure, S.lean, hexes);
    let html = '';

    // roles
    html += `<div class="roles">${order.map((o) => `
      <div class="role"><span class="role-sw" style="background:${p[o.key].hex}"></span>
        <div><b>${o.role[0].toUpperCase() + o.role.slice(1)}</b> <span class="role-name">${labelOf(o.key)}${o.anchor ? ' · brand anchor' : ''}</span>
        <p>${o.note}</p></div></div>`).join('')}</div>`;

    if (S.structure === 'both') {
      const tr = E.trio(p.grounded.c, p.ripe.c), [lab, tone] = overallLabel(tr.score);
      const notes = [];
      notes.push(tr.pair.parts.spread >= 0.5 ? 'Clear lightness difference between Grounded and Ripe.' : 'Grounded and Ripe sit at similar depth; let type and Evergreen create the contrast.');
      if (tr.pair.parts.distinct < 0.4) notes.push('The two colors sit close together.');
      html += `<div class="overall"><span class="tag tag-${tone}">${lab}</span><span>${notes.join(' ')}</span>
        <span class="tech-only mono">trio ${tr.score.toFixed(2)} · pair ${tr.pair.score.toFixed(2)} · G/EV ${tr.grounded.score.toFixed(2)} · R/EV ${tr.ripe.score.toFixed(2)}</span></div>`;

      const from = S.active, to = from === 'grounded' ? 'ripe' : 'grounded';
      S.recs = E.recommend(S.color[from], from, 6);
      html += `<h3 class="sub">${TERRITORIES[to].label} counterparts for your ${TERRITORIES[from].label} color</h3>
        <div class="recs">${S.recs.map((r, i) => {
          const hex = C.toHex(r.color), sp = E.spec(r.color), cur = E.spec(S.color[to]).hex === sp.hex;
          return `<button class="rec${cur ? ' on' : ''}" data-action="rec" data-v="${i}">
            <span class="rec-sw" style="background:${hex}"><i style="background:${CONFIG.evergreenHex}"></i></span>
            <b>${sp.hex}</b><span class="rec-why">${r.reason}</span>
            <span class="tech-only mono">fit ${r.score.toFixed(2)} · EV ${r.rel.score.toFixed(2)}</span></button>`; }).join('')}</div>`;
    } else {
      const other = S.structure === 'grounded' ? 'ripe' : 'grounded';
      html += `<div class="invite"><span>Want a ${TERRITORIES[other].label} counterpart? We'll suggest options that work with your color and Evergreen.</span>
        <button class="btn" data-action="structure" data-v="both">Add ${TERRITORIES[other].label}</button></div>`;
    }
    html += `<h3 class="sub">Composition <small>Illustrative proportions, not fixed ratios</small></h3>${posterHtml(p, order)}`;
    $('#build-body').innerHTML = html;
  }

  /* ---------- 4. Apply ---------- */
  const LEVEL = { body: ['Body text', 'good'], large: ['Large text only', 'warn'], fail: ['Avoid', 'bad'] };

  function comboRows(p, order) {
    const extras = Object.values(p).filter((e) => e.key !== 'evergreen').map((e) => [labelOf(e.key), e.hex]);
    return order.map((o) => {
      const e = p[o.key];
      const fgs = E.foregrounds(e.hex, extras).filter((f) => !(o.key === 'evergreen' && f.name === 'Evergreen'));
      const tiles = fgs.map((f) => {
        const [lab, tone] = LEVEL[f.level];
        return `<div class="combo lvl-${f.level}" style="background:${e.hex};color:${f.fg}">
          <span class="aa">Aa</span><span class="combo-fg">${f.name}</span>
          <span class="combo-lab tag tag-${tone}">${lab}</span>
          <span class="tech-only mono">${f.ratio.toFixed(1)}:1 · Lc ${Math.abs(f.lc).toFixed(0)}</span></div>`;
      }).join('');
      return `<div class="combo-row"><div class="combo-bg"><span style="background:${e.hex}"></span>On ${labelOf(o.key)}</div><div class="combo-tiles">${tiles}</div></div>`;
    }).join('');
  }

  function valueRow(label, val, copy) {
    return `<div class="val"><span>${label}</span><code>${val}</code><button class="mini" data-action="copy" data-v="${copy ?? val}" aria-label="Copy ${label}">Copy</button></div>`;
  }

  function colorCard(e, o) {
    const g = E.guidance(e.hex, e.c), s = e.spec;
    if (e.key === 'evergreen') g.tags = g.tags.filter((t) => !/Evergreen|accent/.test(t.text)).concat({ text: 'Works as a field with large type or logo', tone: 'info' }, { text: 'The constant', tone: 'good' });
    return `<article class="ccard">
      <div class="ccard-sw" style="background:${e.hex};color:${textOn(e.hex).name === 'Ink' ? CONFIG.inkHex : '#fff'}">
        <b>${labelOf(e.key)}</b><span>${o.role[0].toUpperCase() + o.role.slice(1)}${o.anchor ? ' · Anchor' : ''}</span></div>
      <div class="ccard-body">
        <div class="tags">${g.tags.map(tagHtml).join('')}</div>
        ${valueRow('HEX', s.hex)}${valueRow('RGB', fmtRgb(s.rgb), `rgb(${fmtRgb(s.rgb)})`)}
        ${valueRow('CMYK≈', s.cmyk.join(', '), `cmyk(${s.cmyk.join(', ')})`)}${valueRow('OKLCH', s.oklchText.replace(/^oklch\(|\)$/g, ''), s.oklchText)}
      </div></article>`;
  }

  function renderApply() {
    const p = palette(), hexes = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.hex]));
    const order = E.hierarchy(S.structure, S.lean, hexes);
    $('#apply-body').innerHTML = `
      <div class="ccards">${order.map((o) => colorCard(p[o.key], o)).join('')}</div>
      <h3 class="sub">Approved combinations <small>Which type works on which color</small></h3>
      <div class="combos">${comboRows(p, order)}</div>
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
    if (S.tech) drawSlice(p);
  }

  function drawSlice(p) {
    const key = activeKey(), hue = S.color[key].h, cv = $('#slice');
    if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, Cmax = 0.33;
    const img = ctx.createImageData(W, H);
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
    for (const e of Object.values(p)) {
      ctx.beginPath(); ctx.arc(X(e.c.C), Y(e.c.L), 6, 0, 7); ctx.fillStyle = e.hex; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#444'; ctx.font = '11px system-ui';
    ctx.fillText(`Slice at hue ${hue.toFixed(0)}°  ·  x: chroma 0–${Cmax}  ·  y: lightness`, 6, H - 6);
    $('#hood-text').innerHTML = `<p>Territories are irregular, hue-dependent regions (shaded boxes at this hue), not one universal L/C range. Shaded area is the sRGB gamut. Dots show current colors; Evergreen is plotted at its own chroma and lightness.</p>
      <ul>${Object.values(p).filter((e) => e.key !== 'evergreen').map((e) => `<li><b>${labelOf(e.key)}</b> ${depthPhrase(e.c, e.key)} (depth ${T.membership(e.c).depth.toFixed(2)})</li>`).join('')}</ul>`;
  }

  /* ---------- exports ---------- */
  function exportData() {
    const p = palette(), hexes = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.hex]));
    const order = E.hierarchy(S.structure, S.lean, hexes), extras = Object.values(p).filter((e) => e.key !== 'evergreen').map((e) => [labelOf(e.key), e.hex]);
    return {
      structure: S.structure, lean: S.structure === 'both' ? S.lean : null,
      colors: order.map((o) => {
        const e = p[o.key], g = E.guidance(e.hex, e.c);
        return { name: labelOf(o.key), role: o.role, anchor: o.anchor, hex: e.hex, rgb: e.spec.rgb, cmykApprox: e.spec.cmyk, oklch: e.spec.oklchText,
          guidance: g.tags.map((t) => t.text),
          approvedForeground: E.foregrounds(e.hex, extras).filter((f) => f.level !== 'fail').map((f) => ({ fg: f.name, hex: f.fg, use: LEVEL[f.level][0] })) };
      }),
    };
  }
  function exportCss() {
    const d = exportData();
    return ':root {\n' + d.colors.map((c) => `  --sg-${c.name.toLowerCase()}: ${c.hex}; /* ${c.role}${c.anchor ? ', anchor' : ''}; ${c.oklch} */`).join('\n')
      + `\n  --sg-ink: ${CONFIG.inkHex};\n}\n`;
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
    document.body.classList.toggle('tech', S.tech);
    renderExpression(); renderTabs(); renderExploreStatic(); drawField(); renderContext(); renderBuild(); renderApply(); writeHash();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action, v = b.dataset.v;
    if (a === 'structure') { S.structure = v; if (v !== 'both') S.active = v; fullRender(); if (v === 'both' && b.closest('#build')) $('#build').scrollIntoView({ behavior: 'smooth' }); }
    else if (a === 'lean') { S.lean = v; fullRender(); }
    else if (a === 'tab') { S.active = v; fullRender(); }
    else if (a === 'rec') { const to = S.active === 'grounded' ? 'ripe' : 'grounded'; setColor(to, S.recs[+v].color); fullRender(); }
    else if (a === 'copy') copy(v);
    else if (a === 'copy-css') copy(exportCss(), 'CSS variables copied');
    else if (a === 'copy-json') copy(JSON.stringify(exportData(), null, 2), 'JSON copied');
    else if (a === 'copy-link') { writeHash(); copy(location.href, 'Link copied'); }
    else if (a === 'test-hex') testHex();
    else if (a === 'snap') { setColor(activeKey(), S.pendingSnap); $('#test-msg').textContent = 'Applied the nearest approved color.'; fullRender(); }
    else if (a === 'goto') { S.active = v; setColor(v, C.fromHex(b.dataset.hex)); $('#test-msg').textContent = ''; fullRender(); }
  });

  const field = $('#field');
  let dragging = false;
  field.addEventListener('pointerdown', (e) => { dragging = true; field.setPointerCapture(e.pointerId); pickFromPointer(e); });
  field.addEventListener('pointermove', (e) => { if (dragging) pickFromPointer(e); });
  field.addEventListener('pointerup', () => { dragging = false; });
  field.addEventListener('keydown', (e) => {
    const key = activeKey(), c = S.color[key], step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, 0.01], ArrowDown: [0, -0.01] };
    if (!moves[e.key]) return;
    e.preventDefault();
    S.color[key] = T.colorAt(key, (c.h + moves[e.key][0] + 360) % 360, c.L + moves[e.key][1], S.t[key]);
    schedule();
  });
  $('#intensity').addEventListener('input', (e) => {
    const key = activeKey(), c = S.color[key];
    S.t[key] = e.target.value / 100; S.color[key] = T.colorAt(key, c.h, c.L, S.t[key]); schedule();
  });
  $('#hex-test').addEventListener('keydown', (e) => { if (e.key === 'Enter') testHex(); });
  $('#tech-toggle').addEventListener('change', (e) => { S.tech = e.target.checked; fullRender(); });

  /* ---------- init ---------- */
  readHash();
  const ev = $('#ev-marker'); ev.style.left = '0';
  fullRender();
  window.SGApp = { state: S, palette, exportData };
})();
