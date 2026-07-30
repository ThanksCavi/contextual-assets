// Legacy Case Study Template
(() => {
  const NAV_SELECTOR = '[data-case-study-nav]';
  const SECTION_SELECTOR = '.story-content-block[data-anchor-section]';
  const NAV_ITEM_SELECTOR = '.story-nav-item[data-anchor-link]';
  const SHARE_SELECTOR = '[data-share]';

  const ACTIVE_CLASS = 'is-active';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  const STICKY_REFRESH_EVENT = 'contextual:sticky-sidebar-refresh';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const DEFAULT_TOP_OFFSET = 100;

  const state = {
    isReady: false,
    sections: [],
    navItems: [],
    nav: null,
    observer: null,
  };

  let resizeTimer = null;

  window.CaseStudyTemplate = {
    refresh,
  };

  onMotionReady(initPage);
  window.addEventListener('resize', queueRefresh);
  window.addEventListener(MOTION_POLICY_CHANGE_EVENT, queueRefresh);
  window.addEventListener(STICKY_REFRESH_EVENT, handleStickySidebarRefresh);

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

  // Page setup: active nav, anchor scrolling, and share links.
  function initPage() {
    if (state.isReady) return;

    state.sections = Array.from(document.querySelectorAll(SECTION_SELECTOR));
    state.navItems = Array.from(document.querySelectorAll(NAV_ITEM_SELECTOR));
    state.nav = document.querySelector(NAV_SELECTOR);

    if (state.sections.length === 0 && state.navItems.length === 0 && !state.nav && document.querySelectorAll(SHARE_SELECTOR).length === 0) {
      return;
    }

    state.isReady = true;
    setupShareLinks();
    setupActiveNav();
    setupAnchorScroll();
    refreshStickySidebar();
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

    refreshStickySidebar();
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

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refresh, RESIZE_REFRESH_DELAY_MS);
  }

  function refreshStickySidebar() {
    if (window.ContextualStickySidebar?.refresh && state.nav) {
      window.ContextualStickySidebar.refresh(state.nav);
    }
  }

  function handleStickySidebarRefresh(event) {
    if (!state.nav || event.detail?.sidebar !== state.nav) return;
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

  function getSectionById(id) {
    return id ? document.querySelector(`${SECTION_SELECTOR}[data-anchor-section="${escapeAttributeValue(id)}"]`) : null;
  }

  function getSmoother() {
    if (window.ContextualHomeMotion?.getSmoother) return window.ContextualHomeMotion.getSmoother();
    if (window.ScrollSmoother?.get) return window.ScrollSmoother.get();
    return null;
  }

  function getTopOffset() {
    if (window.ContextualStickySidebar?.getTopOffset && state.nav) {
      return window.ContextualStickySidebar.getTopOffset(state.nav);
    }

    return getComputedTopOffset();
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
