/**
 * ScrollSmoother runtime
 * Uses the Webflow-provided GSAP plugins and the Designer-defined
 * #smooth-wrapper > #smooth-content structure.
 */
(() => {
  const WRAPPER_SELECTOR = '#smooth-wrapper';
  const CONTENT_SELECTOR = '#smooth-content';
  const INIT_FLAG = '__contextualHomeScrollSmootherInit';
  const READY_EVENT = 'contextual:smoother-ready';
  const REQUEST_REFRESH_DELAY_MS = 80;
  const RESIZE_REFRESH_DELAY_MS = 160;

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  let resolveReady;
  let refreshTimer = null;
  let refreshToken = 0;
  let resizeTimer = null;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  window.ContextualHomeMotion = window.ContextualHomeMotion || {};
  Object.assign(window.ContextualHomeMotion, {
    ready,
    refreshAll,
    requestRefresh,
    getSmoother,
    scrollBy,
    scrollTo,
    getScrollTop,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollSmoother, { once: true });
  } else {
    initScrollSmoother();
  }

  function initScrollSmoother() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const ScrollSmoother = window.ScrollSmoother;
    const wrapper = document.querySelector(WRAPPER_SELECTOR);
    const content = document.querySelector(CONTENT_SELECTOR);

    if (!gsap || !ScrollTrigger || !ScrollSmoother) {
      console.warn('[home-scroll-smoother] Webflow GSAP ScrollTrigger/ScrollSmoother is not available.');
      markReady(null);
      return;
    }

    if (!wrapper || !content || !wrapper.contains(content)) {
      console.warn('[home-scroll-smoother] Expected #smooth-wrapper > #smooth-content structure was not found.');
      markReady(null);
      return;
    }

    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    let smoother = ScrollSmoother.get && ScrollSmoother.get();

    if (!smoother) {
      smoother = ScrollSmoother.create({
        wrapper,
        content,
        smooth: 2,
        effects: true,
        effectsPrefix: 'smoother-',
        smoothTouch: false,
        normalizeScroll: false,
      });
    }

    markReady(smoother);

    window.addEventListener('load', scheduleSettledRefresh, { once: true });
    window.addEventListener('resize', queueSettledRefresh);
  }

  function markReady(smoother) {
    window.ContextualHomeMotion.smoother = smoother;
    resolveReady(window.ContextualHomeMotion);
    window.dispatchEvent(new CustomEvent(READY_EVENT, {
      detail: {
        smoother,
      },
    }));
    scheduleSettledRefresh();
  }

  function queueSettledRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => requestRefresh(), RESIZE_REFRESH_DELAY_MS);
  }

  function requestRefresh(options = {}) {
    const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : REQUEST_REFRESH_DELAY_MS;

    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => scheduleSettledRefresh(options), delay);
  }

  function scheduleSettledRefresh(options = {}) {
    const token = ++refreshToken;
    const shouldWaitForFonts = options.waitForFonts !== false;
    const fontReady = shouldWaitForFonts ? document.fonts?.ready || Promise.resolve() : Promise.resolve();

    Promise.resolve(fontReady)
      .catch(() => null)
      .then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (token === refreshToken) {
              refreshAll();
            }
          });
        });
      });
  }

  function refreshAll() {
    clearTimeout(refreshTimer);

    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }

  function scrollBy(options = {}) {
    const top = Number(options.top) || 0;
    const left = Number(options.left) || 0;

    if (left) {
      window.scrollBy({
        top,
        left,
        behavior: options.behavior || 'auto',
      });
      return;
    }

    scrollTo(getScrollTop() + top, options);
  }

  function scrollTo(target, options = {}) {
    const smoother = getSmoother();
    const behavior = options.behavior || 'auto';
    const shouldSmooth = behavior === 'smooth';
    const scrollTarget = typeof target === 'number' ? clampScrollTop(target) : target;

    if (smoother && typeof smoother.scrollTo === 'function') {
      smoother.scrollTo(scrollTarget, shouldSmooth, options.position);
      return;
    }

    if (typeof target === 'number') {
      window.scrollTo({
        top: scrollTarget,
        left: 0,
        behavior,
      });
      return;
    }

    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({
        behavior,
        block: options.block || 'start',
        inline: options.inline || 'nearest',
      });
    }
  }

  function getScrollTop() {
    const smoother = getSmoother();

    try {
      if (smoother && typeof smoother.scrollTop === 'function') {
        return Number(smoother.scrollTop()) || 0;
      }
    } catch (error) {
      return window.scrollY || window.pageYOffset || 0;
    }

    return window.scrollY || window.pageYOffset || 0;
  }

  function getSmoother() {
    if (window.ContextualHomeMotion?.smoother) {
      return window.ContextualHomeMotion.smoother;
    }

    if (window.ScrollSmoother && typeof window.ScrollSmoother.get === 'function') {
      return window.ScrollSmoother.get();
    }

    return null;
  }

  function clampScrollTop(value) {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
      document.body.scrollHeight - window.innerHeight,
    );

    return Math.max(0, Math.min(maxScroll, value));
  }
})();
