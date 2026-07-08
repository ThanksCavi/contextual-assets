(() => {
  const ROOT_SELECTOR = '[data-faq]';
  const ITEM_SELECTOR = '[data-faq-item]';
  const TRIGGER_SELECTOR = '[data-faq-trigger]';
  const PANEL_SELECTOR = '[data-faq-panel]';
  const ANSWER_SELECTOR = '[data-faq-answer]';
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
    const shouldOpenFirst = root.dataset[OPEN_FIRST_ATTR] === 'true';

    items.forEach((item, index) => {
      setItemState(item, shouldOpenFirst && index === 0, {animate: false});
    });
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
