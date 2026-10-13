/* Motion: every duration and easing lives here so it can be replaced with the final values from the design.
   The numbers below are PLACEHOLDERS estimated from the start and end frames; they are not read from Figma. */
(function () {
  const M = {
    ease: 'cubic-bezier(.22,.8,.24,1)',
    easeInOut: 'cubic-bezier(.65,0,.35,1)',
    panel: 650,       // panels sliding in and out, stage and "g" re-centering with them
    block: 500,       // color block resize when the balance changes
    skew: 420,        // selected color block tilting into its pose
    seqGap: 60,       // pause between one panel leaving and the next one entering
    pill: 380,        // the white highlight sliding between tabs / layout options
    tilt: { follow: 0.18, enter: 0.14, skew: 14, rotate: 3.5, skewY: 6, shift: 10, reachX: 380, reachY: 320 }, // selected block facing the mouse
    fade: 220,        // small content swaps
    intro: {
      mono: 700,      // "sg" monogram shows alone
      toEdges: 800,   // s and g travel to the screen edges
      stack: 130,     // gap between photos stacking up at the center
      hold: 450,      // pause with the full stack
      collapse: 450,  // photos leave
      title: 350,     // "color farm" fades in and out
      titleHold: 800, // and stays this long
      blocks: 500,    // the three color blocks arrive once the photos are gone
      panelDelay: 150 // panel arrives this long after the blocks
    },
  };
  M.apply = function (root) {
    const s = root.style;
    s.setProperty('--ease', M.ease); s.setProperty('--ease-io', M.easeInOut);
    s.setProperty('--t-panel', M.panel + 'ms'); s.setProperty('--t-block', M.block + 'ms');
    s.setProperty('--t-skew', M.skew + 'ms'); s.setProperty('--t-fade', M.fade + 'ms');
    s.setProperty('--t-edges', M.intro.toEdges + 'ms'); s.setProperty('--t-collapse', M.intro.collapse + 'ms'); s.setProperty('--t-blocks', M.intro.blocks + 'ms'); s.setProperty('--t-pill', M.pill + 'ms'); s.setProperty('--t-title', M.intro.title + 'ms');
  };

  /** Intro timeline. Calls done() when the tool is ready; skip() ends it early. */
  const IMGS = [ // file, width, height in px (from the design); every photo is centered on the screen
    ['a', 181, 201], ['b', 141, 251], ['c', 203, 225], ['d', 157, 200],
    ['e', 115, 171], ['f', 228, 171], ['g', 203, 269], ['h', 157, 220],
  ];
  M.runIntro = function (art, host, done) {
    host.innerHTML = '<div class="ititle">color farm</div>' + IMGS.map(([f, w, h]) => `<img src="assets/intro/${f}.webp" alt="" style="left:50%;top:50%;margin:${-h / 2}px 0 0 ${-w / 2}px;width:${w}px;height:${h}px">`).join('');
    const imgs = [...host.children].filter((n) => n.tagName === 'IMG'), T = M.intro, timers = [];
    let ended = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const finish = () => {
      if (ended) return; ended = true; timers.forEach(clearTimeout);
      art.classList.remove('i-mono', 'i-edges', 'i-collapse', 'i-title', 'i-blocks'); art.dataset.view = 'main'; host.innerHTML = ''; done();
    };
    art.classList.add('i-mono');
    let t = T.mono;
    at(t, () => art.classList.add('i-edges'));
    t += 250;
    imgs.forEach((im, i) => at(t + i * T.stack, () => im.classList.add('on')));
    t += imgs.length * T.stack + T.hold;
    at(t, () => art.classList.add('i-collapse'));                       // 1. photos leave
    t += T.collapse;
    at(t, () => art.classList.add('i-title'));                          // 2. "color farm" title
    t += T.title + T.titleHold;
    at(t, () => art.classList.remove('i-title'));
    t += T.title;
    at(t, () => art.classList.add('i-blocks'));                         // 3. then the three color blocks
    t += T.blocks + T.panelDelay;
    at(t, () => { art.dataset.view = 'main'; });                        // 4. then the panel, stage and g re-center
    at(t + M.panel, finish);
    M.skip = finish;
  };
  SG.motion = M;
})();
