/**
 * Generic sticky sidebar pinning for ScrollSmoother pages.
 *
 * Required markup:
 * - [data-sticky-sidebar-layout] on the shared layout row/container
 * - [data-sticky-sidebar] on the sidebar element to pin
 * - [data-sticky-sidebar-content] on the main content column
 */
(() => {
  const INIT_FLAG = '__contextualStickySidebarInit';
  const LAYOUT_SELECTOR = '[data-sticky-sidebar-layout]';
  const SIDEBAR_SELECTOR = '[data-sticky-sidebar]';
  const CONTENT_SELECTOR = '[data-sticky-sidebar-content]';
  const PIN_MANAGED_CLASS = 'is-sticky-sidebar-pin-managed';
  const DESKTOP_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
  const SMOOTHER_READY_EVENT = 'contextual:smoother-ready';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  const REFRESH_EVENT = 'contextual:sticky-sidebar-refresh';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const MOTION_READY_TIMEOUT_MS = 1200;
  const DEFAULT_TOP_OFFSET = 100;

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  const instances = [];
  let refreshTimer = null;
  let listenersBound = false;

  window.ContextualStickySidebar = {
    refresh,
    refreshAll,
    getTopOffset,
    getInstances: () => instances.slice(),
  };

  onMotionReady(() => {
    refreshAll();
    bindGlobalListeners();
  });

  function onMotionReady(callback) {
    if (window.ContextualHomeMotion?.ready) {
      window.ContextualHomeMotion.ready.then(callback);
      return;
    }

    const run = () => {
      if (window.ContextualHomeMotion?.ready) {
        window.ContextualHomeMotion.ready.then(callback);
      } else {
        waitForSmootherReady(callback);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      requestAnimationFrame(run);
    }
  }

  function waitForSmootherReady(callback) {
    let done = false;
    let timeoutId = null;

    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener(SMOOTHER_READY_EVENT, finish);
      window.clearTimeout(timeoutId);
      callback();
    };

    window.addEventListener(SMOOTHER_READY_EVENT, finish, { once: true });
    timeoutId = window.setTimeout(finish, MOTION_READY_TIMEOUT_MS);
  }

  function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;

    window.addEventListener('resize', queueRefresh);
    window.addEventListener(MOTION_POLICY_CHANGE_EVENT, queueRefresh);
  }

  function refresh(target) {
    if (!target) {
      refreshAll();
      return;
    }

    const instance = ensureInstance(target);
    if (!instance) return;

    setupPin(instance);
    requestGlobalRefresh();
  }

  function refreshAll() {
    discoverInstances();

    instances.forEach((instance) => {
      setupPin(instance);
    });

    if (instances.length > 0) {
      requestGlobalRefresh();
    }
  }

  function discoverInstances() {
    document.querySelectorAll(LAYOUT_SELECTOR).forEach((layout) => {
      ensureInstance(layout);
    });
  }

  function ensureInstance(target) {
    const layout = getLayoutElement(target);
    if (!layout) return null;

    const existing = instances.find((instance) => instance.layout === layout);
    if (existing) return existing;

    const sidebar = layout.matches(SIDEBAR_SELECTOR) ? layout : layout.querySelector(SIDEBAR_SELECTOR);
    const content = layout.matches(CONTENT_SELECTOR) ? layout : layout.querySelector(CONTENT_SELECTOR);
    if (!sidebar || !content) return null;

    const instance = {
      layout,
      sidebar,
      content,
      matchMedia: null,
      pin: null,
      sidebarStyle: null,
      pinTopOffset: null,
      stylesApplied: false,
      resizeObserver: null,
      lastSetupSignature: null,
    };

    instances.push(instance);
    bindInstanceResizeObserver(instance);
    return instance;
  }

  function getLayoutElement(target) {
    if (!target) return null;
    if (target.matches?.(LAYOUT_SELECTOR)) return target;
    return target.closest?.(LAYOUT_SELECTOR) || null;
  }

  function bindInstanceResizeObserver(instance) {
    if (!('ResizeObserver' in window)) return;

    instance.resizeObserver = new ResizeObserver(queueRefresh);
    instance.resizeObserver.observe(instance.layout);
    instance.resizeObserver.observe(instance.sidebar);
    instance.resizeObserver.observe(instance.content);
  }

  function setupPin(instance) {
    const ScrollTrigger = getScrollTrigger();

    const signature = `${instance.layout.offsetHeight}:${instance.sidebar.offsetHeight}:${instance.content.offsetHeight}`;
    if (instance.pin && instance.lastSetupSignature === signature) {
      return;
    }
    instance.lastSetupSignature = signature;

    clearPin(instance);

    if (!ScrollTrigger || !shouldUseDesktopMotion()) {
      return;
    }

    instance.matchMedia = window.gsap.matchMedia();
    instance.matchMedia.add(DESKTOP_QUERY, () => {
      if (!shouldUseDesktopMotion() || instance.content.offsetHeight <= instance.sidebar.offsetHeight) {
        return undefined;
      }

      applyPinStyles(instance);
      instance.pin = ScrollTrigger.create({
        trigger: instance.layout,
        endTrigger: instance.layout,
        start: () => `top top+=${getInstanceTopOffset(instance)}px`,
        end: () => `bottom top+=${getInstanceTopOffset(instance) + instance.sidebar.offsetHeight}px`,
        pin: instance.sidebar,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: () => dispatchRefresh(instance),
      });

      return () => clearActivePin(instance);
    });
  }

  function clearPin(instance) {
    if (instance.matchMedia) {
      const matchMedia = instance.matchMedia;
      instance.matchMedia = null;
      matchMedia.revert();
    }

    clearActivePin(instance);
  }

  function clearActivePin(instance) {
    if (instance.pin) {
      instance.pin.kill();
      instance.pin = null;
    }

    restorePinStyles(instance);
  }

  function applyPinStyles(instance) {
    instance.pinTopOffset = getComputedTopOffset(instance.sidebar);
    instance.sidebarStyle = instance.sidebar.getAttribute('style');
    instance.stylesApplied = true;
    instance.sidebar.classList.add(PIN_MANAGED_CLASS);
    instance.sidebar.style.position = 'relative';
    instance.sidebar.style.top = 'auto';
  }

  function restorePinStyles(instance) {
    if (!instance.sidebar || !instance.stylesApplied) return;

    instance.sidebar.classList.remove(PIN_MANAGED_CLASS);
    instance.pinTopOffset = null;

    if (instance.sidebarStyle === null) {
      instance.sidebar.removeAttribute('style');
    } else {
      instance.sidebar.setAttribute('style', instance.sidebarStyle);
    }

    instance.sidebarStyle = null;
    instance.stylesApplied = false;
  }

  function queueRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshAll, RESIZE_REFRESH_DELAY_MS);
  }

  function getScrollTrigger() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger || !gsap.matchMedia) return null;

    gsap.registerPlugin(ScrollTrigger);
    return ScrollTrigger;
  }

  function shouldUseDesktopMotion() {
    const motion = window.ContextualHomeMotion;

    if (motion?.shouldUseSmoother && !motion.shouldUseSmoother()) return false;
    if (motion?.shouldUseHeavyScrollEffects) return motion.shouldUseHeavyScrollEffects();

    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  function getTopOffset(target) {
    const instance = getInstance(target) || (instances.length === 1 ? instances[0] : null);

    if (instance) {
      return getInstanceTopOffset(instance);
    }

    return getComputedTopOffset(target);
  }

  function getInstance(target) {
    if (!target) return null;

    return instances.find((instance) => {
      if (instance.layout === target || instance.sidebar === target || instance.content === target) return true;
      const layout = getLayoutElement(target);
      return layout && instance.layout === layout;
    }) || null;
  }

  function getInstanceTopOffset(instance) {
    return Number.isFinite(instance.pinTopOffset) ? instance.pinTopOffset : getComputedTopOffset(instance.sidebar);
  }

  function getComputedTopOffset(element) {
    if (!element || !window.getComputedStyle) return DEFAULT_TOP_OFFSET;

    const value = Number.parseFloat(window.getComputedStyle(element).top);
    return Number.isFinite(value) ? value : DEFAULT_TOP_OFFSET;
  }

  function dispatchRefresh(instance) {
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT, {
      detail: {
        layout: instance.layout,
        sidebar: instance.sidebar,
        content: instance.content,
        topOffset: getInstanceTopOffset(instance),
      },
    }));
  }

  function requestGlobalRefresh() {
    if (window.ContextualHomeMotion?.requestRefresh) {
      window.ContextualHomeMotion.requestRefresh();
      return;
    }

    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }
})();
