// Case Study Template
(() => {
  const LAYOUT_SELECTOR = '[data-case-study-layout]';
  const NAV_SELECTOR = '[data-case-study-nav]';
  const CONTENT_SELECTOR = '[data-case-study-content]';
  const SECTION_SELECTOR = '.story-content-block[data-anchor-section]';
  const NAV_ITEM_SELECTOR = '.story-nav-item[data-anchor-link]';
  const SHARE_SELECTOR = '[data-share]';

  const ACTIVE_CLASS = 'is-active';
  const PIN_MANAGED_CLASS = 'is-case-study-pin-managed';
  const DESKTOP_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const DEFAULT_TOP_OFFSET = 100;

  const state = {
    isReady: false,
    sections: [],
    navItems: [],
    layout: null,
    nav: null,
    content: null,
    observer: null,
    matchMedia: null,
    pin: null,
    navStyle: null,
    pinTopOffset: null,
    pinStylesApplied: false,
  };

  let resizeTimer = null;

  window.CaseStudyTemplate = {
    refresh,
  };

  onMotionReady(initPage);
  window.addEventListener('resize', queueRefresh);
  window.addEventListener(MOTION_POLICY_CHANGE_EVENT, queueRefresh);

  // Init after ScrollSmoother has decided whether desktop motion is enabled.
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

  // Page setup: active nav, anchor scrolling, share links, and sidebar pin.
  function initPage() {
    if (state.isReady) return;

    state.sections = Array.from(document.querySelectorAll(SECTION_SELECTOR));
    state.navItems = Array.from(document.querySelectorAll(NAV_ITEM_SELECTOR));
    state.layout = document.querySelector(LAYOUT_SELECTOR);
    state.nav = document.querySelector(NAV_SELECTOR);
    state.content = document.querySelector(CONTENT_SELECTOR);

    if (state.sections.length === 0 && state.navItems.length === 0 && !state.layout && !state.nav && !state.content) {
      return;
    }

    state.isReady = true;
    setupShareLinks();
    setupActiveNav();
    setupAnchorScroll();
    setupSidebarPin();
    requestGlobalRefresh();
  }

  // Active nav: mirrors the old template IntersectionObserver behavior.
  function setupActiveNav() {
    if (state.sections.length === 0 || state.navItems.length === 0 || !('IntersectionObserver' in window)) {
      updateActiveNavFromScroll();
      return;
    }

    state.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveNavItem(entry.target.dataset.anchorSection);
        }
      });
    }, {
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0,
    });

    state.sections.forEach((section) => state.observer.observe(section));
  }

  // Anchor links: route scrolling through ScrollSmoother when it is active.
  function setupAnchorScroll() {
    state.navItems.forEach((item) => {
      item.addEventListener('click', (event) => {
        const target = getSectionById(item.dataset.anchorLink);
        if (!target) return;

        event.preventDefault();
        setActiveNavItem(item.dataset.anchorLink);
        scrollToSection(target);
      });
    });
  }

  // Sidebar pin: replaces CSS sticky only when ScrollSmoother desktop motion is active.
  function setupSidebarPin() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    clearSidebarPin();

    if (!gsap || !ScrollTrigger || !gsap.matchMedia || !state.layout || !state.nav || !state.content || !shouldUseDesktopMotion()) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    state.matchMedia = gsap.matchMedia();
    state.matchMedia.add(DESKTOP_QUERY, () => {
      if (!shouldUseDesktopMotion() || state.content.offsetHeight <= state.nav.offsetHeight) return undefined;

      applyPinStyles();
      state.pin = ScrollTrigger.create({
        trigger: state.layout,
        endTrigger: state.layout,
        start: () => `top top+=${getTopOffset()}px`,
        end: () => `bottom top+=${getTopOffset() + state.nav.offsetHeight}px`,
        pin: state.nav,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: updateActiveNavFromScroll,
      });

      return clearActivePin;
    });
  }

  // Share links: preserves the existing X, LinkedIn, and email behavior.
  function setupShareLinks() {
    const url = encodeURIComponent(window.location.href);
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

  // Public refresh hook for Webflow/CMS layout changes.
  function refresh() {
    if (!state.isReady) {
      initPage();
      return;
    }

    setupSidebarPin();
    updateActiveNavFromScroll();
    requestGlobalRefresh();
  }

  function scrollToSection(target) {
    const smoother = getSmoother();
    const offset = getTopOffset();
    const shouldSmooth = !window.matchMedia(REDUCED_MOTION_QUERY).matches;

    if (smoother && typeof smoother.scrollTo === 'function') {
      smoother.scrollTo(target, shouldSmooth, `top ${offset}px`);
      return;
    }

    window.scrollTo({
      top: getDocumentScrollTop() + target.getBoundingClientRect().top - offset,
      left: 0,
      behavior: shouldSmooth ? 'smooth' : 'auto',
    });
  }

  function setActiveNavItem(activeId) {
    if (!activeId) return;

    state.navItems.forEach((item) => {
      item.classList.toggle(ACTIVE_CLASS, item.dataset.anchorLink === activeId);
    });
  }

  function updateActiveNavFromScroll() {
    if (state.sections.length === 0 || state.navItems.length === 0) return;

    const activationY = getTopOffset() + (window.innerHeight - getTopOffset()) * 0.45;
    let activeSection = state.sections[0];

    state.sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= activationY) {
        activeSection = section;
      }
    });

    setActiveNavItem(activeSection.dataset.anchorSection);
  }

  function shouldUseDesktopMotion() {
    const motion = window.ContextualHomeMotion;

    if (motion?.shouldUseSmoother && !motion.shouldUseSmoother()) return false;
    if (motion?.shouldUseHeavyScrollEffects) return motion.shouldUseHeavyScrollEffects();

    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  function clearSidebarPin() {
    if (state.matchMedia) {
      const matchMedia = state.matchMedia;
      state.matchMedia = null;
      matchMedia.revert();
    }

    clearActivePin();
  }

  function clearActivePin() {
    if (state.pin) {
      state.pin.kill();
      state.pin = null;
    }

    restorePinStyles();
  }

  function applyPinStyles() {
    state.pinTopOffset = getComputedTopOffset();
    state.navStyle = state.nav.getAttribute('style');
    state.pinStylesApplied = true;
    state.nav.classList.add(PIN_MANAGED_CLASS);
    state.nav.style.position = 'relative';
    state.nav.style.top = 'auto';
  }

  function restorePinStyles() {
    if (!state.nav || !state.pinStylesApplied) return;

    state.nav.classList.remove(PIN_MANAGED_CLASS);
    state.pinTopOffset = null;

    if (state.navStyle === null) {
      state.nav.removeAttribute('style');
    } else {
      state.nav.setAttribute('style', state.navStyle);
    }

    state.navStyle = null;
    state.pinStylesApplied = false;
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, RESIZE_REFRESH_DELAY_MS);
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

  function getSectionById(id) {
    return id ? document.querySelector(`${SECTION_SELECTOR}[data-anchor-section="${escapeAttributeValue(id)}"]`) : null;
  }

  function getSmoother() {
    if (window.ContextualHomeMotion?.getSmoother) return window.ContextualHomeMotion.getSmoother();
    if (window.ScrollSmoother?.get) return window.ScrollSmoother.get();
    return null;
  }

  function getTopOffset() {
    return Number.isFinite(state.pinTopOffset) ? state.pinTopOffset : getComputedTopOffset();
  }

  function getComputedTopOffset() {
    if (!state.nav) return DEFAULT_TOP_OFFSET;

    const value = Number.parseFloat(window.getComputedStyle(state.nav).top);
    return Number.isFinite(value) ? value : DEFAULT_TOP_OFFSET;
  }

  function escapeAttributeValue(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function getDocumentScrollTop() {
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
})();
