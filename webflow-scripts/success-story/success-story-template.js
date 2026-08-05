// Success Story Template
(() => {
  const INIT_FLAG = '__contextualSuccessStoryTemplateInit';
  const ROOT_SELECTOR = '[data-ss-template="success-stories"]';
  const NAV_SELECTOR = '.ss-story-nav';
  const NAV_ITEM_SELECTOR = '.ss-story-nav a[href^="#"]';
  const SECTION_SELECTOR = '.ss-section[id][data-ss-section]';
  const SHARE_SELECTOR = '[data-share]';
  const STICKY_SIDEBAR_SELECTOR = '[data-sticky-sidebar]';

  const ACTIVE_CLASS = 'is-active';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  const STICKY_REFRESH_EVENT = 'contextual:sticky-sidebar-refresh';
  const RESIZE_REFRESH_DELAY_MS = 160;
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
  };

  let resizeTimer = null;

  window.SuccessStoryTemplate = {
    refresh,
  };

  onMotionReady(initPage);
  window.addEventListener('scroll', queueActiveNavUpdate, { passive: true });
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
    refreshStickySidebar();
    updateActiveNavFromScroll();
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
    refreshStickySidebar();
    updateActiveNavFromScroll();
    requestGlobalRefresh();
  }

  function scrollToSection(target) {
    const offset = getTopOffset();
    const shouldSmooth = !window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const behavior = shouldSmooth ? 'smooth' : 'auto';
    const position = `top ${offset}px`;

    if (window.ContextualHomeMotion?.scrollTo) {
      window.ContextualHomeMotion.scrollTo(target, {
        behavior,
        position,
      });
      return;
    }

    const smoother = getSmoother();
    if (smoother && typeof smoother.scrollTo === 'function') {
      smoother.scrollTo(target, shouldSmooth, position);
      return;
    }

    window.scrollTo({
      top: getDocumentScrollTop() + target.getBoundingClientRect().top - offset,
      left: 0,
      behavior,
    });
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

  function refreshStickySidebar() {
    if (window.ContextualStickySidebar?.refresh && state.sidebar) {
      window.ContextualStickySidebar.refresh(state.sidebar);
    }
  }

  function handleStickySidebarRefresh(event) {
    if (state.sidebar && event.detail?.sidebar && event.detail.sidebar !== state.sidebar) return;
    updateActiveNavFromScroll();
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

  function getNavTargetId(item) {
    const href = item.getAttribute('href') || '';
    if (!href.startsWith('#') || href === '#') return '';

    return decodeHash(href.slice(1));
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
