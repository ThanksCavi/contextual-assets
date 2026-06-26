// Success Story Template
(() => {
  const INIT_FLAG = '__contextualSuccessStoryTemplateInit';
  const ROOT_SELECTOR = '[data-ss-template="success-stories"]';
  const NAV_SELECTOR = '.ss-story-nav';
  const NAV_ITEM_SELECTOR = '.ss-story-nav a[href^="#"], .ss-story-nav [data-anchor-link], .ss-story-nav [data-ss-anchor-link]';
  const SECTION_SELECTOR = '.ss-section[id][data-ss-section]';
  const SHARE_SELECTOR = '[data-share]';
  const STICKY_SIDEBAR_SELECTOR = '[data-sticky-sidebar]';
  const LAYOUT_STABILITY_SELECTOR = '.story-content-section, .story-closing, .related-stories';
  const LAYOUT_MEDIA_SELECTOR = 'img, iframe, video';

  const ACTIVE_CLASS = 'is-active';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  const STICKY_REFRESH_EVENT = 'contextual:sticky-sidebar-refresh';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const LAYOUT_REFRESH_DELAY_MS = 80;
  const LAYOUT_SIZE_EPSILON_PX = 1;
  const DEFAULT_TOP_OFFSET = 100;
  const ACTIVE_LINE_RATIO = 0.45;
  const ACTIVE_SCROLL_SETTLE_TOLERANCE_PX = 4;
  const ACTIVE_SCROLL_LOCK_TIMEOUT_MS = 2600;

  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  const state = {
    isReady: false,
    root: null,
    nav: null,
    sidebar: null,
    sections: [],
    navItems: [],
    scrollRaf: null,
    activeLockId: '',
    activeLockRaf: null,
    layoutObserver: null,
    layoutRefreshTimer: null,
    layoutElementSizes: new WeakMap(),
    observedLayoutElements: new WeakSet(),
    observedMediaElements: new WeakSet(),
  };

  let resizeTimer = null;

  window.SuccessStoryTemplate = {
    refresh,
  };

  onMotionReady(initPage);
  window.addEventListener('scroll', queueActiveNavUpdate, { passive: true });
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('resize', queueRefresh);
  window.addEventListener(MOTION_POLICY_CHANGE_EVENT, queueRefresh);
  window.addEventListener(STICKY_REFRESH_EVENT, handleStickySidebarRefresh);

  function onMotionReady(callback) {
    if (window.ContextualHomeMotion?.ready) {
      window.ContextualHomeMotion.ready.then(callback);
      return;
    }

    const run = () => {
      if (window.ContextualHomeMotion?.ready) {
        window.ContextualHomeMotion.ready.then(callback);
      } else {
        callback();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      requestAnimationFrame(run);
    }
  }

  function initPage() {
    if (state.isReady) return;

    collectElements();

    if (state.sections.length === 0 && state.navItems.length === 0 && document.querySelectorAll(SHARE_SELECTOR).length === 0) {
      return;
    }

    state.isReady = true;
    setupShareLinks();
    setupAnchorScroll();
    setupLayoutStabilityRefresh();
    refreshStickySidebar();
    updateActiveNavFromScroll();
    scrollToInitialHash();
    requestGlobalRefresh();
  }

  function collectElements() {
    state.root = document.querySelector(ROOT_SELECTOR);
    state.nav = document.querySelector(NAV_SELECTOR);
    state.sidebar = state.nav ? state.nav.closest(STICKY_SIDEBAR_SELECTOR) : document.querySelector(STICKY_SIDEBAR_SELECTOR);
    state.sections = Array.from((state.root || document).querySelectorAll(SECTION_SELECTOR))
      .filter((section) => section.dataset.ssEmpty !== 'true');
    state.navItems = Array.from(document.querySelectorAll(NAV_ITEM_SELECTOR))
      .filter((item) => getNavTargetId(item) && item.dataset.ssEmpty !== 'true');
  }

  function setupAnchorScroll() {
    if (!state.nav || state.nav.dataset.ssNavInit === 'true') return;

    state.nav.dataset.ssNavInit = 'true';
    state.nav.addEventListener('click', handleNavClick, true);
  }

  function handleNavClick(event) {
    const item = event.target.closest(NAV_ITEM_SELECTOR);
    if (!item || !state.nav.contains(item)) return;

    const targetId = getNavTargetId(item);
    const target = getSectionById(targetId);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    lockActiveNavUntilSettled(targetId, target);
    updateHash(targetId);
    scrollToSection(target);
  }

  function setupShareLinks() {
    const url = encodeURIComponent(window.location.href.split('#')[0]);
    const title = encodeURIComponent(document.title);
    const links = {
      x: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      email: `mailto:?subject=${title}&body=${url}`,
    };

    document.querySelectorAll(SHARE_SELECTOR).forEach((link) => {
      const type = link.dataset.share;
      if (!links[type]) return;

      link.href = links[type];

      if (type !== 'email') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  }

  function refresh() {
    collectElements();

    if (!state.isReady) {
      initPage();
      return;
    }

    setupAnchorScroll();
    setupLayoutStabilityRefresh();
    refreshStickySidebar();
    updateActiveNavFromScroll();
    requestGlobalRefresh();
  }

  function scrollToInitialHash() {
    const targetId = getHashTargetId();
    const target = getSectionById(targetId);
    if (!target) return;

    lockActiveNavUntilSettled(targetId, target);

    requestAnimationFrame(() => {
      scrollToSection(target, { forceAuto: true });
    });
  }

  function scrollToSection(target, options = {}) {
    const offset = getTopOffset();
    const smoother = getSmoother();
    const position = `top ${offset}px`;

    if (smoother && typeof smoother.scrollTo === 'function') {
      // ScrollSmoother smooth jumps move native scroll ahead of the visual
      // transform, which can activate downstream pinned ScrollTriggers early.
      smoother.scrollTo(target, false, position);
      refreshScrollTriggersAfterProgrammaticScroll();
      return;
    }

    const shouldSmooth = !options.forceAuto && !window.matchMedia(REDUCED_MOTION_QUERY).matches;

    window.scrollTo({
      top: getDocumentScrollTop() + target.getBoundingClientRect().top - offset,
      left: 0,
      behavior: shouldSmooth ? 'smooth' : 'auto',
    });

    refreshScrollTriggersAfterProgrammaticScroll();
  }

  function queueActiveNavUpdate() {
    if (state.activeLockId) {
      setActiveNavItem(state.activeLockId);
      return;
    }

    if (state.scrollRaf) return;

    state.scrollRaf = requestAnimationFrame(() => {
      state.scrollRaf = null;
      updateActiveNavFromScroll();
    });
  }

  function handleHashChange() {
    const targetId = getHashTargetId();
    const target = getSectionById(targetId);
    if (!target) return;

    lockActiveNavUntilSettled(targetId, target);
    scrollToSection(target, { forceAuto: true });
  }

  function lockActiveNavUntilSettled(activeId, target) {
    if (!activeId || !target) return;

    if (state.activeLockRaf) {
      cancelAnimationFrame(state.activeLockRaf);
      state.activeLockRaf = null;
    }

    state.activeLockId = activeId;
    setActiveNavItem(activeId);

    const startedAt = Date.now();

    const checkSettled = () => {
      const targetTop = target.getBoundingClientRect().top;
      const targetOffset = getTopOffset();
      const isSettled = Math.abs(targetTop - targetOffset) <= ACTIVE_SCROLL_SETTLE_TOLERANCE_PX;
      const timedOut = Date.now() - startedAt >= ACTIVE_SCROLL_LOCK_TIMEOUT_MS;

      if (isSettled || timedOut) {
        state.activeLockId = '';
        state.activeLockRaf = null;
        setActiveNavItem(activeId);
        return;
      }

      state.activeLockRaf = requestAnimationFrame(checkSettled);
    };

    state.activeLockRaf = requestAnimationFrame(checkSettled);
  }

  function updateActiveNavFromScroll() {
    if (state.activeLockId) {
      setActiveNavItem(state.activeLockId);
      return;
    }

    if (state.sections.length === 0 || state.navItems.length === 0) return;

    const offset = getTopOffset();
    const activationY = offset + (window.innerHeight - offset) * ACTIVE_LINE_RATIO;
    let activeSection = state.sections[0];

    state.sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= activationY) {
        activeSection = section;
      }
    });

    setActiveNavItem(activeSection.id);
  }

  function setActiveNavItem(activeId) {
    if (!activeId) return;

    state.navItems.forEach((item) => {
      const isActive = getNavTargetId(item) === activeId;
      item.classList.toggle(ACTIVE_CLASS, isActive);

      if (isActive) {
        item.setAttribute('aria-current', 'true');
      } else {
        item.removeAttribute('aria-current');
      }
    });
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, RESIZE_REFRESH_DELAY_MS);
  }

  function setupLayoutStabilityRefresh() {
    // Lazy CMS media can change section heights after downstream pins are measured.
    const elements = getLayoutStabilityElements();
    if (elements.length === 0) return;

    observeLayoutElements(elements);
    observeMediaElements(elements);
  }

  function getLayoutStabilityElements() {
    const elements = Array.from(document.querySelectorAll(LAYOUT_STABILITY_SELECTOR));

    if (state.root?.matches?.(LAYOUT_STABILITY_SELECTOR)) {
      elements.unshift(state.root);
    }

    return elements;
  }

  function observeLayoutElements(elements) {
    if (!('ResizeObserver' in window)) return;

    if (!state.layoutObserver) {
      state.layoutObserver = new ResizeObserver(handleLayoutResize);
    }

    elements.forEach((element) => {
      if (state.observedLayoutElements.has(element)) return;

      state.observedLayoutElements.add(element);
      state.layoutElementSizes.set(element, getElementSize(element));
      state.layoutObserver.observe(element);
    });
  }

  function handleLayoutResize(entries) {
    let shouldRefresh = false;

    entries.forEach((entry) => {
      const previous = state.layoutElementSizes.get(entry.target);
      const next = getElementSize(entry.target);

      state.layoutElementSizes.set(entry.target, next);

      if (!previous) return;

      const widthChanged = Math.abs(next.width - previous.width) >= LAYOUT_SIZE_EPSILON_PX;
      const heightChanged = Math.abs(next.height - previous.height) >= LAYOUT_SIZE_EPSILON_PX;

      if (widthChanged || heightChanged) {
        shouldRefresh = true;
      }
    });

    if (shouldRefresh) {
      queueLayoutStabilityRefresh();
    }
  }

  function observeMediaElements(elements) {
    elements.forEach((element) => {
      element.querySelectorAll(LAYOUT_MEDIA_SELECTOR).forEach(bindMediaRefresh);
    });
  }

  function bindMediaRefresh(element) {
    if (state.observedMediaElements.has(element)) return;

    state.observedMediaElements.add(element);

    if (element instanceof HTMLImageElement) {
      if (element.complete && element.naturalWidth > 0) {
        refreshWhenImageDecoded(element);
        return;
      }

      element.addEventListener('load', queueLayoutStabilityRefresh, { once: true });
      element.addEventListener('error', queueLayoutStabilityRefresh, { once: true });
      return;
    }

    if (element instanceof HTMLVideoElement) {
      if (element.readyState >= 1) {
        queueLayoutStabilityRefresh();
        return;
      }

      element.addEventListener('loadedmetadata', queueLayoutStabilityRefresh, { once: true });
      element.addEventListener('error', queueLayoutStabilityRefresh, { once: true });
      return;
    }

    element.addEventListener('load', queueLayoutStabilityRefresh, { once: true });
  }

  function refreshWhenImageDecoded(image) {
    if (typeof image.decode !== 'function') {
      queueLayoutStabilityRefresh();
      return;
    }

    image.decode()
      .then(queueLayoutStabilityRefresh)
      .catch(queueLayoutStabilityRefresh);
  }

  function queueLayoutStabilityRefresh() {
    clearTimeout(state.layoutRefreshTimer);

    state.layoutRefreshTimer = window.setTimeout(() => {
      state.layoutRefreshTimer = null;
      refreshAfterLayoutStabilizes();
    }, LAYOUT_REFRESH_DELAY_MS);
  }

  function refreshAfterLayoutStabilizes() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        refreshStickySidebar();
        updateActiveNavFromScroll();
        requestGlobalRefresh({ delay: 0, waitForFonts: false });
      });
    });
  }

  function getElementSize(element) {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  function refreshStickySidebar() {
    if (window.ContextualStickySidebar?.refresh && state.sidebar) {
      window.ContextualStickySidebar.refresh(state.sidebar);
    }
  }

  function handleStickySidebarRefresh(event) {
    if (state.sidebar && event.detail?.sidebar && event.detail.sidebar !== state.sidebar) return;
    updateActiveNavFromScroll();
  }

  function requestGlobalRefresh(options = {}) {
    if (window.ContextualHomeMotion?.requestRefresh) {
      window.ContextualHomeMotion.requestRefresh(options);
      return;
    }

    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }

  function refreshScrollTriggersAfterProgrammaticScroll() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.ScrollTrigger?.sort?.();
        window.ScrollTrigger?.refresh?.(true);
      });
    });
  }

  function getNavTargetId(item) {
    const explicitId = (item.dataset.anchorLink || item.dataset.ssAnchorLink || '').trim();
    if (explicitId) return explicitId;

    const href = item.getAttribute('href') || '';
    if (!href.startsWith('#') || href === '#') return '';

    return decodeHash(href.slice(1));
  }

  function getHashTargetId() {
    const hash = window.location.hash || '';
    return hash.length > 1 ? decodeHash(hash.slice(1)) : '';
  }

  function getSectionById(id) {
    return id ? document.getElementById(id) : null;
  }

  function getSmoother() {
    if (window.ContextualHomeMotion?.getSmoother) return window.ContextualHomeMotion.getSmoother();
    if (window.ScrollSmoother?.get) return window.ScrollSmoother.get();
    return null;
  }

  function getTopOffset() {
    if (window.ContextualStickySidebar?.getTopOffset && state.sidebar) {
      return window.ContextualStickySidebar.getTopOffset(state.sidebar);
    }

    return getComputedTopOffset();
  }

  function getComputedTopOffset() {
    const target = state.nav || state.sidebar;
    if (!target) return DEFAULT_TOP_OFFSET;

    const value = Number.parseFloat(window.getComputedStyle(target).top);
    return Number.isFinite(value) ? value : DEFAULT_TOP_OFFSET;
  }

  function updateHash(targetId) {
    if (!targetId || window.location.hash === `#${targetId}`) return;

    if (window.history?.pushState) {
      window.history.pushState(null, '', `#${targetId}`);
    }
  }

  function decodeHash(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function getDocumentScrollTop() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
})();
