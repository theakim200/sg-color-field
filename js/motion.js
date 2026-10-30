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
    tilt: { follow: 0.16, ry: 8, rx: 6, reachX: 380, reachY: 320 }, // color blocks in 3D (perspective, shadow and press are CSS: .blk, 30vh)
    fade: 220,        // small content swaps
    intro: {
      mono: 600,      // "sg" monogram shows alone
      toEdges: 1200,   // s and g travel to the screen edges
      title: 350,     // "color farm" fades in and out
      titleHold: 800, // and stays this long
      blocks: 500,    // the three color blocks arrive after the title
      panelDelay: 150 // panel arrives this long after the blocks
    },
  };
  M.apply = function (root) {
    const s = root.style;
    s.setProperty('--ease', M.ease); s.setProperty('--ease-io', M.easeInOut);
    s.setProperty('--t-panel', M.panel + 'ms'); s.setProperty('--t-block', M.block + 'ms');
    s.setProperty('--t-skew', M.skew + 'ms'); s.setProperty('--t-fade', M.fade + 'ms');
    s.setProperty('--t-edges', M.intro.toEdges + 'ms'); s.setProperty('--t-blocks', M.intro.blocks + 'ms'); s.setProperty('--t-pill', M.pill + 'ms'); s.setProperty('--t-title', M.intro.title + 'ms');
  };

  /** Intro timeline. Calls done() when the tool is ready; skip() ends it early. */
  M.runIntro = function (art, host, done) {
    host.innerHTML = '<div class="ititle">color farm</div>';
    const T = M.intro, timers = [];
    let ended = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const finish = () => {
      if (ended) return; ended = true; timers.forEach(clearTimeout);
      art.classList.remove('i-mono', 'i-edges', 'i-title', 'i-blocks'); art.dataset.view = 'main'; host.innerHTML = ''; done();
    };
    art.classList.add('i-mono');
    let t = T.mono;
    at(t, () => art.classList.add('i-edges'));                          // 1. s and g travel to the screen edges
    t += T.toEdges;
    at(t, () => art.classList.add('i-title'));                          // 2. "color farm" title
    t += T.title + T.titleHold;
    at(t, () => art.classList.remove('i-title'));
    t += T.title;
    if (art.classList.contains('mobile')) {
      // phone: the blocks fade in while s and g rise to the top and the sheet slides up, all at once
      at(t, () => { art.classList.add('i-blocks'); art.dataset.view = 'main'; });
      at(t + Math.max(T.blocks, M.panel), finish);
    } else {
      at(t, () => art.classList.add('i-blocks'));                       // 3. then the three color blocks
      t += T.blocks + T.panelDelay;
      at(t, () => { art.dataset.view = 'main'; });                      // 4. then the panel, stage and g re-center
      at(t + M.panel, finish);
    }
    M.skip = finish;
  };
  SG.motion = M;
})();
