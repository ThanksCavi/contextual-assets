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
  const RESIZE_REFRESH_DELAY_MS = 160;

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  let resolveReady;
  let resizeTimer = null;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  window.ContextualHomeMotion = window.ContextualHomeMotion || {};
  Object.assign(window.ContextualHomeMotion, {
    ready,
    refreshAll,
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
        smooth: 0.8,
        effects: false,
        smoothTouch: false,
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
    resizeTimer = window.setTimeout(scheduleSettledRefresh, RESIZE_REFRESH_DELAY_MS);
  }

  function scheduleSettledRefresh() {
    const fontReady = document.fonts?.ready || Promise.resolve();

    Promise.resolve(fontReady)
      .catch(() => null)
      .then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(refreshAll);
        });
      });
  }

  function refreshAll() {
    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }
})();
