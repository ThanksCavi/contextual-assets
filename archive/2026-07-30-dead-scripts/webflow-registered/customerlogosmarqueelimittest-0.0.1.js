(() => {
  const MODULE_SELECTOR = '.module-customer-logos';
  const STRIP_SELECTOR = '.mcl-strip';
  const LIST_SELECTOR = '.mcl-list';
  const ITEM_SELECTOR = '.mcl-item';

  // Marquee speed in px per second.
  const SPEED = 24;

  // Minimum original content width relative to the viewport width.
  const MIN_CONTENT_MULTIPLIER = 1.5;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const modules = new Map();

  function initAll() {
    document.querySelectorAll(MODULE_SELECTOR).forEach(initModule);
  }

  function initModule(module) {
    const strip = module.querySelector(STRIP_SELECTOR);
    const list = module.querySelector(LIST_SELECTOR);

    if (!strip || !list || modules.has(module)) return;

    const state = {
      module,
      strip,
      list,
      rafId: null,
      lastTime: 0,
      x: 0,
      loopWidth: 0,
      originals: Array.from(list.children).map(node => node.cloneNode(true)),
    };

    modules.set(module, state);
    buildTrack(state);

    if (!prefersReducedMotion.matches) {
      start(state);
    }
  }

  function buildTrack(state) {
    const { strip, list, originals } = state;

    stop(state);

    // Reset the track to the original item set.
    list.innerHTML = '';
    originals.forEach(node => list.appendChild(node.cloneNode(true)));

    // Apply only the inline styles required for marquee behavior.
    list.style.display = 'flex';
    list.style.flexWrap = 'nowrap';
    list.style.willChange = 'transform';
    list.style.transform = 'translate3d(0, 0, 0)';

    Array.from(list.children).forEach(item => {
      item.style.flex = 'none';
    });

    const stripWidth = strip.getBoundingClientRect().width;
    let originalWidth = getContentWidth(list);

    // Duplicate the original set until the track is long enough.
    while (originalWidth < stripWidth * MIN_CONTENT_MULTIPLIER) {
      originals.forEach(node => list.appendChild(makeClone(node)));
      originalWidth = getContentWidth(list);
    }

    // Append one full duplicate set to enable a seamless loop.
    const currentBaseChildren = Array.from(list.children).map(node => node.cloneNode(true));
    currentBaseChildren.forEach(node => list.appendChild(makeClone(node)));

    state.loopWidth = getContentWidth(list) / 2;
    state.x = 0;
    state.lastTime = 0;
  }

  function makeClone(node) {
    const clone = node.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');

    // Remove cloned interactive elements from the focus order.
    clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach(el => {
      el.setAttribute('tabindex', '-1');
    });

    return clone;
  }

  function getContentWidth(list) {
    const children = Array.from(list.children);
    if (!children.length) return 0;

    const first = children[0].getBoundingClientRect();
    const last = children[children.length - 1].getBoundingClientRect();

    return last.right - first.left;
  }

  function start(state) {
    stop(state);
    state.rafId = requestAnimationFrame(time => tick(state, time));
  }

  function stop(state) {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function tick(state, time) {
    if (!state.lastTime) state.lastTime = time;

    const delta = (time - state.lastTime) / 1000;
    state.lastTime = time;

    state.x -= SPEED * delta;

    if (Math.abs(state.x) >= state.loopWidth) {
      state.x += state.loopWidth;
    }

    state.list.style.transform = `translate3d(${state.x}px, 0, 0)`;
    state.rafId = requestAnimationFrame(nextTime => tick(state, nextTime));
  }

  function rebuildAll() {
    modules.forEach(state => {
      buildTrack(state);
      if (!prefersReducedMotion.matches) {
        start(state);
      }
    });
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildAll, 150);
  }

  prefersReducedMotion.addEventListener('change', () => {
    modules.forEach(state => {
      if (prefersReducedMotion.matches) {
        stop(state);
        state.list.style.transform = 'translate3d(0, 0, 0)';
      } else {
        buildTrack(state);
        start(state);
      }
    });
  });

  window.addEventListener('resize', onResize);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();