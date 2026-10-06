(() => {
  const ROOT_SELECTOR = '[data-faq]';
  const ITEM_SELECTOR = '[data-faq-item]';
  const TRIGGER_SELECTOR = '[data-faq-trigger]';
  const PANEL_SELECTOR = '[data-faq-panel]';
  const ANSWER_SELECTOR = '[data-faq-answer]';
  const OPEN_FIRST_VALUE_SELECTOR = '[data-faq-open-first-value]';
  const INIT_FLAG = 'faqReady';
  const OPEN_FIRST_ATTR = 'faqOpenFirst';
  const STATE_ATTR = 'faqState';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const TRANSITION_FALLBACK_MS = 700;

  const reducedMotion = window.matchMedia
    ? window.matchMedia(REDUCED_MOTION_QUERY)
    : {matches: false, addEventListener: null};

  let rootCounter = 0;
  let resizeTimer = null;
  let resizeBound = false;

  function initAll(scope = document) {
    scope.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
  }

  function initRoot(root) {
    if (!root || root.dataset[INIT_FLAG] === 'true') {
      refreshRoot(root);
      return;
    }

    root.dataset[INIT_FLAG] = 'true';
    root.dataset.faqInstance = root.dataset.faqInstance || String(++rootCounter);
    root.addEventListener('click', handleRootClick);
    root.addEventListener('keydown', handleRootKeydown);

    setupItems(root);
    applyInitialState(root);
    bindGlobalResize();
  }

  function setupItems(root) {
    getItems(root).forEach((item, index) => setupItem(root, item, index));
  }

  function setupItem(root, item, index) {
    const trigger = item.querySelector(TRIGGER_SELECTOR);
    const panel = item.querySelector(PANEL_SELECTOR);
    if (!trigger || !panel) return;

    const panelId = panel.id || `contextual-faq-${root.dataset.faqInstance}-${index + 1}`;
    panel.id = panelId;
    trigger.type = 'button';
    trigger.setAttribute('aria-controls', panelId);

    if (!item.dataset[STATE_ATTR]) {
      setItemState(item, false, {animate: false});
    }
  }

  function applyInitialState(root) {
    const items = getItems(root);
    const shouldOpenFirst = getOpenFirstValue(root);

    items.forEach((item, index) => {
      setItemState(item, shouldOpenFirst && index === 0, {animate: false});
    });
  }

  function getOpenFirstValue(root) {
    const mirror = root.querySelector(OPEN_FIRST_VALUE_SELECTOR);
    const mirrorValue = parseBooleanLike(mirror ? mirror.textContent : '');
    if (typeof mirrorValue === 'boolean') return mirrorValue;

    return root.dataset[OPEN_FIRST_ATTR] === 'true';
  }

  function parseBooleanLike(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'open'].includes(normalizedValue)) return true;
    if (['false', '0', 'no', 'closed'].includes(normalizedValue)) return false;
    return null;
  }

  function handleRootClick(event) {
    const trigger = event.target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;

    event.preventDefault();
    toggleItem(event.currentTarget, trigger);
  }

  function handleRootKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const trigger = event.target.closest(TRIGGER_SELECTOR);
    if (!trigger) return;

    event.preventDefault();
    toggleItem(event.currentTarget, trigger);
  }

  function toggleItem(root, trigger) {
    if (!root.contains(trigger)) return;

    const item = trigger.closest(ITEM_SELECTOR);
    if (!item || !root.contains(item)) return;

    const isOpen = item.dataset[STATE_ATTR] === 'open';

    getItems(root).forEach((otherItem) => {
      if (otherItem !== item) {
        setItemState(otherItem, false, {animate: true});
      }
    });

    setItemState(item, !isOpen, {animate: true});
  }

  function setItemState(item, open, options = {}) {
    const trigger = item.querySelector(TRIGGER_SELECTOR);
    const panel = item.querySelector(PANEL_SELECTOR);
    const answer = item.querySelector(ANSWER_SELECTOR);
    if (!trigger || !panel) return;

    const animate = options.animate === true && !reducedMotion.matches;

    item.dataset[STATE_ATTR] = open ? 'open' : 'closed';
    trigger.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    setPanelInteractive(panel, open);

    if (!animate) {
      panel.style.height = open ? 'auto' : '0px';
      if (answer) answer.style.removeProperty('visibility');
      return;
    }

    panel.style.overflow = 'hidden';
    window.clearTimeout(panel._faqTransitionTimer);

    if (open) {
      panel.style.height = '0px';
      forceLayout(panel);
      panel.style.height = `${getPanelHeight(panel)}px`;
      panel._faqTransitionTimer = window.setTimeout(() => finishOpen(panel, item), TRANSITION_FALLBACK_MS);
      panel.addEventListener('transitionend', handlePanelTransitionEnd);
      return;
    }

    panel.style.height = `${getPanelHeight(panel)}px`;
    forceLayout(panel);
    panel.style.height = '0px';
    panel._faqTransitionTimer = window.setTimeout(() => finishClosed(panel, item), TRANSITION_FALLBACK_MS);
    panel.addEventListener('transitionend', handlePanelTransitionEnd);
  }

  function handlePanelTransitionEnd(event) {
    if (event.target !== event.currentTarget || event.propertyName !== 'height') return;

    const panel = event.currentTarget;
    const item = panel.closest(ITEM_SELECTOR);
    if (!item) return;

    if (item.dataset[STATE_ATTR] === 'open') {
      finishOpen(panel, item);
    } else {
      finishClosed(panel, item);
    }
  }

  function finishOpen(panel, item) {
    window.clearTimeout(panel._faqTransitionTimer);
    panel.removeEventListener('transitionend', handlePanelTransitionEnd);
    if (item.dataset[STATE_ATTR] !== 'open') return;
    panel.style.height = 'auto';
  }

  function finishClosed(panel, item) {
    window.clearTimeout(panel._faqTransitionTimer);
    panel.removeEventListener('transitionend', handlePanelTransitionEnd);
    if (item.dataset[STATE_ATTR] !== 'closed') return;
    panel.style.height = '0px';
  }

  function refreshRoot(root) {
    if (!root) return;

    setupItems(root);

    getItems(root).forEach((item) => {
      const panel = item.querySelector(PANEL_SELECTOR);
      if (!panel || item.dataset[STATE_ATTR] !== 'open') return;

      if (panel.style.height && panel.style.height !== 'auto') {
        panel.style.height = `${getPanelHeight(panel)}px`;
      }
    });
  }

  function refreshAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(refreshRoot);
  }

  function bindGlobalResize() {
    if (resizeBound) return;
    resizeBound = true;

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refreshAll, 120);
    });
  }

  function getItems(root) {
    return Array.from(root.querySelectorAll(ITEM_SELECTOR));
  }

  function getPanelHeight(panel) {
    const answer = panel.querySelector(ANSWER_SELECTOR);
    return answer ? answer.scrollHeight : panel.scrollHeight;
  }

  function setPanelInteractive(panel, interactive) {
    if (interactive) {
      panel.removeAttribute('inert');
      panel.inert = false;
      return;
    }

    panel.setAttribute('inert', '');
    panel.inert = true;
  }

  function forceLayout(element) {
    return element.offsetHeight;
  }

  window.ContextualFAQ = {
    init: initRoot,
    initAll,
    refresh: refreshRoot,
    refreshAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(), {once: true});
  } else {
    initAll();
  }
})();

/* Reveal accordion: one card open at a time, same card height in both states.

   [data-reveal-accordion]              root
   [data-reveal-accordion-lock-height]  on the root: lock cards to the measured height
   [data-reveal-accordion-open-first]   on the root: open the first item when none is `is-open`
   [data-reveal-accordion-item]         card; carries `is-open`
   [data-reveal-accordion-toggle]       click and keyboard target
   [data-reveal-accordion-summary]      closed copy (one child)
   [data-reveal-accordion-detail]       open copy (one child)
   [data-reveal-accordion-more]         read-more strip
   [data-reveal-accordion-icon]         +/- glyph

   Re-measured on resize and after fonts load. Call
   ContextualRevealAccordion.refreshAll() after changing copy at runtime. */
(() => {
  const ROOT_SELECTOR = '[data-reveal-accordion]';
  const ITEM_SELECTOR = '[data-reveal-accordion-item]';
  const TOGGLE_SELECTOR = '[data-reveal-accordion-toggle]';
  const DETAIL_SELECTOR = '[data-reveal-accordion-detail]';
  const MORE_SELECTOR = '[data-reveal-accordion-more]';
  const ICON_SELECTOR = '[data-reveal-accordion-icon]';
  const LOCK_HEIGHT_ATTR = 'data-reveal-accordion-lock-height';
  const OPEN_FIRST_ATTR = 'data-reveal-accordion-open-first';
  const MEASURING_ATTR = 'data-reveal-accordion-measuring';
  const CARD_HEIGHT_PROPERTY = '--rv-card-h';
  const MORE_HEIGHT_PROPERTY = '--rv-more-h';
  const INIT_FLAG = 'revealAccordionReady';
  const OPEN_CLASS = 'is-open';
  const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);

  const measuredWidth = new WeakMap();

  let rootCounter = 0;
  let resizeTimer = null;
  let globalsBound = false;

  function initAll(scope = document) {
    scope.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
  }

  function initRoot(root) {
    if (!root) return;

    if (root.dataset[INIT_FLAG] === 'true') {
      measureRoot(root);
      return;
    }

    root.dataset[INIT_FLAG] = 'true';
    root.dataset.revealAccordionInstance = String(++rootCounter);

    getItems(root).forEach((item, index) => setupItem(root, item, index));
    openFirstIfNone(root);
    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeydown);

    observeRoot(root);
    bindGlobals();
    measureRoot(root);
  }

  // Component instances cannot carry `is-open`, so the root can open the first item.
  function openFirstIfNone(root) {
    if (!root.hasAttribute(OPEN_FIRST_ATTR)) return;

    const items = getItems(root);
    if (!items.length || items.some((item) => item.classList.contains(OPEN_CLASS))) return;
    setItemOpen(items[0], true);
  }

  function setupItem(root, item, index) {
    const toggles = getToggles(item);
    if (!toggles.length) return;

    const detail = item.querySelector(DETAIL_SELECTOR);
    if (detail && !detail.id) {
      detail.id = `reveal-accordion-${root.dataset.revealAccordionInstance}-${index + 1}`;
    }

    toggles.forEach((toggle) => {
      if (!INTERACTIVE_TAGS.has(toggle.tagName)) {
        toggle.setAttribute('role', 'button');
        if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
      }
      if (detail) toggle.setAttribute('aria-controls', detail.id);
    });

    setItemOpen(item, item.classList.contains(OPEN_CLASS));
  }

  function setItemOpen(item, open) {
    item.classList.toggle(OPEN_CLASS, open);
    getToggles(item).forEach((toggle) => toggle.setAttribute('aria-expanded', String(open)));

    const detail = item.querySelector(DETAIL_SELECTOR);
    if (detail) detail.setAttribute('aria-hidden', String(!open));

    const icon = item.querySelector(ICON_SELECTOR);
    if (icon) icon.textContent = open ? '−' : '+';

    // The strip is invisible while the card is open; keep it out of the tab order.
    const more = item.querySelector(MORE_SELECTOR);
    if (more) {
      more.inert = open;
      more.toggleAttribute('inert', open);
    }
  }

  function toggleItem(root, item) {
    const open = !item.classList.contains(OPEN_CLASS);
    getItems(root).forEach((other) => {
      if (other !== item) setItemOpen(other, false);
    });
    setItemOpen(item, open);
  }

  function handleClick(event) {
    const toggle = findToggle(event);
    if (!toggle) return;

    event.preventDefault();
    toggleItem(event.currentTarget, toggle.closest(ITEM_SELECTOR));
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const toggle = findToggle(event);
    // A button or a link already turns Enter/Space into a click of its own.
    if (!toggle || INTERACTIVE_TAGS.has(toggle.tagName)) return;

    event.preventDefault();
    toggleItem(event.currentTarget, toggle.closest(ITEM_SELECTOR));
  }

  function findToggle(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return null;

    const toggle = target.closest(TOGGLE_SELECTOR);
    if (!toggle || !event.currentTarget.contains(toggle)) return null;
    // A whole region can be a toggle; a link inside it still works.
    if (isInteractiveDescendant(target, toggle)) return null;

    return toggle.closest(ITEM_SELECTOR) ? toggle : null;
  }

  function isInteractiveDescendant(target, toggle) {
    let node = target;

    while (node && node !== toggle) {
      if (INTERACTIVE_TAGS.has(node.tagName)) return true;
      const tabindex = node.getAttribute ? node.getAttribute('tabindex') : null;
      if (tabindex !== null && tabindex !== '-1') return true;
      node = node.parentElement;
    }

    return false;
  }

  /* Measure each card closed and open, then give each row its tallest height.
     Cards are grouped into rows by their top edge. */
  function measureRoot(root) {
    if (!root || !root.hasAttribute(LOCK_HEIGHT_ATTR)) return;

    const items = getItems(root);
    if (!items.length) return;

    const openItem = items.find((item) => item.classList.contains(OPEN_CLASS)) || null;

    root.setAttribute(MEASURING_ATTR, '');
    items.forEach((item) => {
      item.style.removeProperty(CARD_HEIGHT_PROPERTY);
      item.style.removeProperty(MORE_HEIGHT_PROPERTY);
      item.classList.remove(OPEN_CLASS);
    });

    const metrics = items.map((item) => {
      const more = item.querySelector(MORE_SELECTOR);
      const rect = item.getBoundingClientRect();
      return {
        item,
        row: Math.round(rect.top),
        height: rect.height,
        moreHeight: more ? more.getBoundingClientRect().height : 0,
      };
    });

    metrics.forEach((entry) => {
      entry.item.classList.add(OPEN_CLASS);
      entry.height = Math.max(entry.height, entry.item.getBoundingClientRect().height);
      entry.item.classList.remove(OPEN_CLASS);
    });

    const rowHeights = new Map();
    metrics.forEach((entry) => {
      rowHeights.set(entry.row, Math.max(rowHeights.get(entry.row) || 0, entry.height));
    });

    metrics.forEach((entry) => {
      entry.item.style.setProperty(CARD_HEIGHT_PROPERTY, `${Math.ceil(rowHeights.get(entry.row))}px`);
      if (entry.moreHeight) {
        entry.item.style.setProperty(MORE_HEIGHT_PROPERTY, `${Math.ceil(entry.moreHeight)}px`);
      }
    });

    if (openItem) openItem.classList.add(OPEN_CLASS);
    root.offsetHeight; // settle the new heights before transitions come back
    root.removeAttribute(MEASURING_ATTR);
    measuredWidth.set(root, Math.round(root.getBoundingClientRect().width));
  }

  function observeRoot(root) {
    if (typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(() => {
      if (root.hasAttribute(MEASURING_ATTR)) return;
      // Only a width change can rewrap the copy; the height is ours to write.
      if (Math.round(root.getBoundingClientRect().width) === measuredWidth.get(root)) return;
      measureRoot(root);
    });

    observer.observe(root);
  }

  function bindGlobals() {
    if (globalsBound) return;
    globalsBound = true;

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refreshAll, 150);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refreshAll).catch(() => {});
    }
  }

  function refreshAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(measureRoot);
  }

  function getItems(root) {
    return Array.from(root.querySelectorAll(ITEM_SELECTOR));
  }

  function getToggles(item) {
    const inner = Array.from(item.querySelectorAll(TOGGLE_SELECTOR));
    // A card can be its own toggle: querySelectorAll never returns the element itself.
    return item.matches(TOGGLE_SELECTOR) ? [item, ...inner] : inner;
  }

  window.ContextualRevealAccordion = {
    init: initAll,
    initRoot,
    refresh: measureRoot,
    refreshAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(), {once: true});
  } else {
    initAll();
  }
})();

/* Placeholder links (href="#"): cancel the jump to the top, nothing else. */
(() => {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('a[href="#"]')) event.preventDefault();
  });
})();

/* Scroll indicator: a visible scrollbar for horizontal rows below 992px, where
   touch browsers hide the native one. Applies to [data-horizontal-scroll] and
   [data-horizontal-scroll-dark], on the container or on a section around it. */
(() => {
  const ROOT_SELECTOR = '[data-horizontal-scroll], [data-horizontal-scroll-dark]';
  const DARK_SELECTOR = '[data-horizontal-scroll-dark]';
  const INIT_FLAG = 'scrollIndicatorReady';
  const EDGE = 2; // px tolerance for fractional scroll widths
  const MIN_THUMB = 24; // px, minimum thumb width

  const entries = [];
  let resizeTimer = null;
  let globalBound = false;

  function initAll(scope = document) {
    scope.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
    bindGlobal();
  }

  function initRoot(root) {
    candidates(root).forEach(track);
  }

  // The row itself, then scrolling descendants. Re-swept on resize and load.
  function candidates(root) {
    const inner = Array.from(root.querySelectorAll('*')).filter(scrollsHorizontally);
    return [root, ...inner];
  }

  function scrollsHorizontally(el) {
    // Cheap test first.
    if (el.scrollWidth - el.clientWidth <= EDGE) return false;
    return isScrollable(el);
  }

  function isScrollable(el) {
    const overflowX = window.getComputedStyle(el).overflowX;
    return overflowX === 'auto' || overflowX === 'scroll';
  }

  function track(el) {
    if (!el || el.dataset[INIT_FLAG] === 'true') return;
    el.dataset[INIT_FLAG] = 'true';

    const entry = {el, indicator: null, thumb: null};
    entries.push(entry);

    el.addEventListener('scroll', () => paint(entry), {passive: true});
    if (window.ResizeObserver) new ResizeObserver(() => refresh(entry)).observe(el);

    refresh(entry);
  }

  function refresh(entry) {
    const el = entry.el;
    const canScroll = el.scrollWidth - el.clientWidth > EDGE && isScrollable(el);

    // Build lazily, so non-scrolling rows leave their parent untouched.
    if (canScroll && !entry.indicator) build(entry);
    if (!entry.indicator) return;

    entry.indicator.hidden = !canScroll;
    if (!canScroll) return;

    place(entry);
    paint(entry);
  }

  function build(entry) {
    const el = entry.el;
    const parent = el.parentElement;
    if (!parent) return;

    if (window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const indicator = document.createElement('div');
    indicator.setAttribute('data-scroll-indicator', el.closest(DARK_SELECTOR) ? 'dark' : '');
    indicator.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.setAttribute('data-scroll-indicator-thumb', '');
    indicator.appendChild(thumb);
    parent.appendChild(indicator);

    el.classList.add('is-scroll-indicated');
    entry.indicator = indicator;
    entry.thumb = thumb;
    reveal(entry);
  }

  // Fade in with the row when it enters the viewport.
  function reveal(entry) {
    const show = () => entry.indicator.classList.add('is-revealed');
    if (!window.IntersectionObserver) {
      show();
      return;
    }

    const observer = new IntersectionObserver((records) => {
      if (!records.some((record) => record.isIntersecting)) return;
      show();
      observer.disconnect();
    }, {threshold: 0.15});

    observer.observe(entry.el);
  }

  // Offsets, not rects: they ignore the row's reveal transform.
  // Pinned to the row's bottom edge; the gap is the CSS margin-top.
  function place(entry) {
    const el = entry.el;
    const indicator = entry.indicator;

    indicator.style.left = `${el.offsetLeft + el.clientLeft}px`;
    indicator.style.top = `${el.offsetTop + el.clientTop + el.clientHeight}px`;
    indicator.style.width = `${el.clientWidth}px`;
  }

  function paint(entry) {
    const el = entry.el;
    if (!entry.indicator || entry.indicator.hidden) return;

    const max = el.scrollWidth - el.clientWidth;
    const trackWidth = entry.indicator.clientWidth;
    const width = Math.max(MIN_THUMB, Math.round(trackWidth * (el.clientWidth / el.scrollWidth)));
    const progress = max > 0 ? Math.min(1, Math.max(0, el.scrollLeft / max)) : 0;

    entry.thumb.style.width = `${width}px`;
    entry.thumb.style.transform = `translateX(${(trackWidth - width) * progress}px)`;
  }

  function refreshAll() {
    initAll();
    entries.forEach(refresh);
  }

  function bindGlobal() {
    if (globalBound) return;
    globalBound = true;

    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refreshAll, 150);
    });

    // Late fonts and images can change the overflow.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refreshAll).catch(() => {});
    }
    window.addEventListener('load', refreshAll);
  }

  window.ContextualScrollIndicator = {
    init: initAll,
    initRoot,
    refresh: refreshAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll(), {once: true});
  } else {
    initAll();
  }
})();

/* FOOTER: copyright year and mobile link accordions */
(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const year = document.getElementById('copyright-year');
    if (year) year.textContent = new Date().getFullYear();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const mobileBreakpoint = window.matchMedia('(max-width: 991px)');
    const accordions = document.querySelectorAll('.footer-accordion');

    function initFooterAccordions() {
      accordions.forEach((accordion) => {
        const toggle = accordion.querySelector('.footer-toggle');
        const content = accordion.querySelector('.footer-links');

        if (!toggle || !content) return;

        if (toggle.dataset.footerAccordionInit === 'true') return;
        toggle.dataset.footerAccordionInit = 'true';

        toggle.setAttribute('aria-expanded', 'false');
        content.style.maxHeight = '0px';

        toggle.addEventListener('click', (event) => {
          if (!mobileBreakpoint.matches) return;

          event.preventDefault();

          const isOpen = accordion.classList.contains('is-open');

          accordion.classList.toggle('is-open', !isOpen);
          toggle.setAttribute('aria-expanded', String(!isOpen));

          content.style.maxHeight = isOpen ? '0px' : `${content.scrollHeight}px`;
        });

        content.querySelectorAll('a').forEach((link) => {
          link.addEventListener('click', (event) => {
            event.stopPropagation();
          });
        });
      });
    }

    function resetFooterAccordions() {
      accordions.forEach((accordion) => {
        const toggle = accordion.querySelector('.footer-toggle');
        const content = accordion.querySelector('.footer-links');

        if (!toggle || !content) return;

        accordion.classList.remove('is-open');

        if (mobileBreakpoint.matches) {
          toggle.setAttribute('aria-expanded', 'false');
          content.style.maxHeight = '0px';
        } else {
          toggle.setAttribute('aria-expanded', 'true');
          content.style.maxHeight = 'none';
        }
      });
    }

    initFooterAccordions();
    resetFooterAccordions();

    mobileBreakpoint.addEventListener('change', resetFooterAccordions);
  });
})();
