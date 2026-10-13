/* Motion: every duration and easing lives here so it can be replaced with the final values from the design.
   The numbers below are PLACEHOLDERS estimated from the start and end frames; they are not read from Figma. */
(function () {
  const M = {
    ease: 'cubic-bezier(.22,.8,.24,1)',
    easeInOut: 'cubic-bezier(.65,0,.35,1)',
    panel: 650,       // panels sliding in and out, stage and "g" re-centering with them
    block: 500,       // color block resize when the balance changes
    skew: 420,        // selected color block tilting into its pose
    fade: 220,        // small content swaps
    intro: {
      mono: 700,      // "sg" monogram shows alone
      toEdges: 800,   // s and g travel to the screen edges
      stack: 130,     // gap between photos stacking up at the center
      hold: 450,      // pause with the full stack
      collapse: 500,  // photos leave and the color blocks arrive
      panelDelay: 250 // panel arrives this long after the blocks
    },
  };
  M.apply = function (root) {
    const s = root.style;
    s.setProperty('--ease', M.ease); s.setProperty('--ease-io', M.easeInOut);
    s.setProperty('--t-panel', M.panel + 'ms'); s.setProperty('--t-block', M.block + 'ms');
    s.setProperty('--t-skew', M.skew + 'ms'); s.setProperty('--t-fade', M.fade + 'ms');
    s.setProperty('--t-edges', M.intro.toEdges + 'ms'); s.setProperty('--t-collapse', M.intro.collapse + 'ms');
  };

  /** Intro timeline. Calls done() when the tool is ready; skip() ends it early. */
  const IMGS = [ // file, x, y, w, h in artboard pixels (from the design)
    ['a', 630, 305, 181, 201], ['b', 650, 279, 141, 251], ['c', 619, 293, 203, 225], ['d', 642, 305, 157, 200],
    ['e', 662, 491, 115, 171], ['f', 834, 319, 228, 171], ['g', 619, 270, 203, 269], ['h', 642, 295, 157, 220],
  ];
  M.runIntro = function (art, host, done) {
    host.innerHTML = IMGS.map(([f, x, y, w, h]) => `<img src="assets/intro/${f}.webp" alt="" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">`).join('');
    const imgs = [...host.children], T = M.intro, timers = [];
    let ended = false;
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const finish = () => {
      if (ended) return; ended = true; timers.forEach(clearTimeout);
      art.classList.remove('i-mono', 'i-edges', 'i-collapse'); art.dataset.view = 'main'; host.innerHTML = ''; done();
    };
    art.classList.add('i-mono');
    let t = T.mono;
    at(t, () => art.classList.add('i-edges'));
    t += 250;
    imgs.forEach((im, i) => at(t + i * T.stack, () => im.classList.add('on')));
    t += imgs.length * T.stack + T.hold;
    at(t, () => art.classList.add('i-collapse'));
    at(t + T.panelDelay, () => { art.dataset.view = 'main'; });
    at(t + Math.max(T.collapse, M.panel) + T.panelDelay, finish);
    M.skip = finish;
  };
  SG.motion = M;
})();
