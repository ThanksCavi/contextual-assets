const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { init } = require('./industry-patterns.js');

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  contains(name) {
    return this.names.has(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);

    if (shouldAdd) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }

    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.tabIndex = -1;
    this.type = '';
    this.focusCount = 0;
    this.focusOptions = null;

    Object.entries(attributes).forEach(([name, value]) => this.setAttribute(name, value));
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  append(...children) {
    children.forEach(child => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const shouldAdd = force === undefined ? !this.hasAttribute(name) : Boolean(force);

    if (shouldAdd) {
      this.setAttribute(name, '');
    } else {
      this.removeAttribute(name);
    }

    return shouldAdd;
  }

  matches(selector) {
    const attributeMatch = /^\[([^\]]+)\]$/.exec(selector);
    return Boolean(attributeMatch && this.hasAttribute(attributeMatch[1]));
  }

  querySelectorAll(selector) {
    const matches = [];

    const visit = element => {
      element.children.forEach(child => {
        if (child.matches(selector)) matches.push(child);
        visit(child);
      });
    };

    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, overrides = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      detail: 0,
      key: '',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...overrides,
    };

    (this.listeners.get(type) || []).slice().forEach(listener => listener(event));
    return event;
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }

  focus(options) {
    this.focusCount += 1;
    this.focusOptions = options;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('document');
    this.readyState = 'complete';
  }

  getElementById(id) {
    let match = null;

    const visit = element => {
      element.children.forEach(child => {
        if (!match && child.id === id) match = child;
        if (!match) visit(child);
      });
    };

    visit(this);
    return match;
  }
}

function createCard(options = {}) {
  const card = new FakeElement('article', { 'data-industry-pattern': '' });
  const summary = new FakeElement('div', { 'data-industry-pattern-summary': '' });
  const details = new FakeElement('div', { 'data-industry-pattern-details': '' });
  const detailsContent = new FakeElement('div');
  const link = new FakeElement('a');
  const toggle = new FakeElement('button', { 'data-industry-pattern-toggle': '' });

  detailsContent.append(link);
  details.append(detailsContent);
  card.append(summary);
  if (!options.missingDetails) card.append(details);
  card.append(toggle);

  return { card, summary, details, detailsContent, link, toggle };
}

function createFixture(rootCardCounts = [2]) {
  const document = new FakeDocument();
  const roots = [];
  const cardsByRoot = [];

  rootCardCounts.forEach(cardCount => {
    const root = new FakeElement('section', { 'data-industry-patterns': '' });
    const cards = [];

    for (let index = 0; index < cardCount; index += 1) {
      const pattern = createCard();
      root.append(pattern.card);
      cards.push(pattern);
    }

    document.append(root);
    roots.push(root);
    cardsByRoot.push(cards);
  });

  return { document, roots, cardsByRoot };
}

test('initializes cards closed with accessible relationships', () => {
  const { document, cardsByRoot } = createFixture([1]);
  const [pattern] = cardsByRoot[0];

  init(document);

  assert.equal(pattern.card.classList.contains('is-open'), false);
  assert.equal(pattern.toggle.type, 'button');
  assert.equal(pattern.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(pattern.toggle.getAttribute('aria-controls'), pattern.details.id);
  assert.equal(pattern.toggle.hasAttribute('hidden'), false);
  assert.equal(pattern.details.getAttribute('role'), 'button');
  assert.equal(pattern.details.getAttribute('aria-label'), 'Close industry pattern details');
  assert.equal(pattern.details.getAttribute('aria-hidden'), 'true');
  assert.equal(pattern.details.tabIndex, -1);
});

test('keeps one card open per section while sections remain independent', () => {
  const { document, cardsByRoot } = createFixture([2, 1]);
  const [first, second] = cardsByRoot[0];
  const [otherRootPattern] = cardsByRoot[1];

  init(document);
  first.toggle.dispatch('click', { detail: 1 });
  otherRootPattern.toggle.dispatch('click', { detail: 1 });

  assert.equal(first.card.classList.contains('is-open'), true);
  assert.equal(otherRootPattern.card.classList.contains('is-open'), true);

  second.toggle.dispatch('click', { detail: 1 });

  assert.equal(first.card.classList.contains('is-open'), false);
  assert.equal(first.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(second.card.classList.contains('is-open'), true);
  assert.equal(second.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(second.toggle.hasAttribute('hidden'), true);
  assert.equal(second.details.getAttribute('aria-hidden'), 'false');
});

test('closes from the details surface but preserves interactive descendants', () => {
  const { document, cardsByRoot } = createFixture([1]);
  const [pattern] = cardsByRoot[0];

  init(document);
  pattern.toggle.dispatch('click', { detail: 1 });
  pattern.details.dispatch('click', { target: pattern.link });
  assert.equal(pattern.card.classList.contains('is-open'), true);

  pattern.details.dispatch('click', { target: pattern.detailsContent });
  assert.equal(pattern.card.classList.contains('is-open'), false);

  pattern.toggle.dispatch('click', { detail: 0 });
  assert.equal(pattern.details.focusCount, 1);
  assert.deepEqual(pattern.details.focusOptions, { preventScroll: true });

  const keyEvent = pattern.details.dispatch('keydown', { key: ' ' });
  assert.equal(keyEvent.defaultPrevented, true);
  assert.equal(pattern.card.classList.contains('is-open'), false);
  assert.equal(pattern.toggle.focusCount, 1);
  assert.deepEqual(pattern.toggle.focusOptions, { preventScroll: true });
});

test('ignores malformed cards and does not bind valid cards twice', () => {
  const { document, roots, cardsByRoot } = createFixture([1]);
  const [pattern] = cardsByRoot[0];
  roots[0].append(createCard({ missingDetails: true }).card);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(message);

  try {
    init(document);
    init(document);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /industry-patterns/);
  assert.equal(roots[0].hasAttribute('data-industry-patterns-initialized'), true);
  assert.equal(pattern.toggle.listenerCount('click'), 1);
  assert.equal(pattern.details.listenerCount('click'), 1);
  assert.equal(pattern.details.listenerCount('keydown'), 1);
});

test('keeps animation styles scoped to the industry patterns contract', () => {
  const css = readFileSync(join(__dirname, 'industry-patterns.css'), 'utf8');

  assert.match(css, /\[data-industry-pattern-summary\]/);
  assert.match(css, /\[data-industry-pattern-details\]/);
  assert.match(css, /\[data-industry-pattern\]\.is-open \[data-industry-pattern-summary\]/);
  assert.match(css, /\[data-industry-pattern\]\.is-open \[data-industry-pattern-details\]/);
  assert.match(css, /\[data-industry-pattern-toggle\]\[hidden\]/);
  assert.match(css, /\[data-industry-pattern-toggle\]:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
