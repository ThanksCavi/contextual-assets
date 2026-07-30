// Industry Patterns Accordion
(function industryPatternsBootstrap(globalObject, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (globalObject) {
    globalObject.IndustryPatterns = api;
  }

  if (typeof document !== 'undefined') {
    onReady(document, () => api.init(document));
  }

  function onReady(documentRef, callback) {
    if (documentRef.readyState === 'loading') {
      documentRef.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }
})(typeof window !== 'undefined' ? window : null, function createIndustryPatternsApi() {
  'use strict';

  const ROOT_SELECTOR = '[data-industry-patterns]';
  const CARD_SELECTOR = '[data-industry-pattern]';
  const SUMMARY_SELECTOR = '[data-industry-pattern-summary]';
  const DETAILS_SELECTOR = '[data-industry-pattern-details]';
  const TOGGLE_SELECTOR = '[data-industry-pattern-toggle]';
  const INITIALIZED_ATTRIBUTE = 'data-industry-patterns-initialized';
  const OPEN_CLASS = 'is-open';
  const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);

  let generatedId = 0;

  function init(scope) {
    if (!scope) return 0;

    const roots = [];

    if (typeof scope.matches === 'function' && scope.matches(ROOT_SELECTOR)) {
      roots.push(scope);
    }

    if (typeof scope.querySelectorAll === 'function') {
      scope.querySelectorAll(ROOT_SELECTOR).forEach(root => {
        if (!roots.includes(root)) roots.push(root);
      });
    }

    roots.forEach(initRoot);
    return roots.length;
  }

  function initRoot(root) {
    if (root.hasAttribute(INITIALIZED_ATTRIBUTE)) return;

    root.setAttribute(INITIALIZED_ATTRIBUTE, '');

    const patterns = [];
    let hasMalformedCard = false;

    root.querySelectorAll(CARD_SELECTOR).forEach((card, index) => {
      const pattern = collectPattern(card, root, index);

      if (pattern) {
        patterns.push(pattern);
      } else {
        hasMalformedCard = true;
      }
    });

    if (hasMalformedCard) {
      console.warn('[industry-patterns] Ignored a card missing data-industry-pattern-summary, data-industry-pattern-details, or data-industry-pattern-toggle.');
    }

    patterns.forEach(pattern => preparePattern(pattern, patterns));
  }

  function collectPattern(card, root, index) {
    const summary = card.querySelector(SUMMARY_SELECTOR);
    const details = card.querySelector(DETAILS_SELECTOR);
    const toggle = card.querySelector(TOGGLE_SELECTOR);

    if (!summary || !details || !toggle) return null;

    return { card, summary, details, toggle, root, index };
  }

  function preparePattern(pattern, patterns) {
    prepareDetails(pattern);
    prepareToggle(pattern, patterns);
    setPatternOpen(pattern, false);
  }

  function prepareDetails(pattern) {
    const { details } = pattern;

    if (!hasUniqueId(details, pattern.root)) {
      details.id = createDetailsId(pattern.root);
    }

    if (!details.hasAttribute('role')) {
      details.setAttribute('role', 'button');
    }

    if (!details.hasAttribute('aria-label')) {
      details.setAttribute('aria-label', 'Close industry pattern details');
    }

    details.addEventListener('click', event => handleDetailsClick(event, pattern));
    details.addEventListener('keydown', event => handleDetailsKeydown(event, pattern));
  }

  function prepareToggle(pattern, patterns) {
    pattern.toggle.type = 'button';
    pattern.toggle.setAttribute('aria-controls', pattern.details.id);
    pattern.toggle.addEventListener('click', event => handleToggleClick(event, pattern, patterns));
  }

  function handleToggleClick(event, pattern, patterns) {
    const shouldOpen = !pattern.card.classList.contains(OPEN_CLASS);

    patterns.forEach(candidate => {
      if (candidate !== pattern) setPatternOpen(candidate, false);
    });

    setPatternOpen(pattern, shouldOpen);

    if (shouldOpen && event.detail === 0) {
      pattern.details.focus({ preventScroll: true });
    }
  }

  function handleDetailsClick(event, pattern) {
    if (!pattern.card.classList.contains(OPEN_CLASS)) return;
    if (isInteractiveDescendant(event.target, pattern.details)) return;

    setPatternOpen(pattern, false);
  }

  function handleDetailsKeydown(event, pattern) {
    if (!pattern.card.classList.contains(OPEN_CLASS)) return;
    if (!isActivationKey(event) || isInteractiveDescendant(event.target, pattern.details)) return;

    event.preventDefault();
    setPatternOpen(pattern, false);
    pattern.toggle.focus({ preventScroll: true });
  }

  function setPatternOpen(pattern, isOpen) {
    pattern.card.classList.toggle(OPEN_CLASS, isOpen);
    pattern.toggle.setAttribute('aria-expanded', String(isOpen));
    pattern.toggle.toggleAttribute('hidden', isOpen);
    pattern.details.tabIndex = isOpen ? 0 : -1;
    pattern.details.setAttribute('aria-hidden', String(!isOpen));
  }

  function hasUniqueId(element, root) {
    if (!element.id) return false;

    const documentRef = getDocument(root);
    return !documentRef || documentRef.getElementById(element.id) === element;
  }

  function createDetailsId(root) {
    const documentRef = getDocument(root);
    let id;

    do {
      generatedId += 1;
      id = `industry-pattern-details-${generatedId}`;
    } while (documentRef && documentRef.getElementById(id));

    return id;
  }

  function getDocument(element) {
    if (element.ownerDocument) return element.ownerDocument;

    let current = element;

    while (current.parentElement) {
      current = current.parentElement;
    }

    return typeof current.getElementById === 'function' ? current : null;
  }

  function isInteractiveDescendant(target, container) {
    let current = target;

    while (current && current !== container) {
      if (isInteractiveElement(current)) return true;
      current = current.parentElement;
    }

    return false;
  }

  function isInteractiveElement(element) {
    const tagName = typeof element.tagName === 'string' ? element.tagName.toLowerCase() : '';

    if (INTERACTIVE_TAGS.has(tagName)) return true;
    if (typeof element.hasAttribute !== 'function' || !element.hasAttribute('tabindex')) return false;

    return element.getAttribute('tabindex') !== '-1';
  }

  function isActivationKey(event) {
    return event.key === 'Enter' || event.key === ' ';
  }

  return { init };
});
