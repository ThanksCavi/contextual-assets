/* Reveal accordion — one-open-at-a-time card accordion.
   Contract (neutral data-attrs, safe alongside FAQ's data-accordion):
     [data-reveal-accordion]          root (one item open at a time)
     [data-reveal-accordion-item]     each card
     [data-reveal-accordion-toggle]   clickable region(s) inside a card
     [data-reveal-accordion-detail]   collapsible region (grid-rows 0fr<->1fr)
     [data-reveal-accordion-icon]     +/- glyph
   State: `is-open` on the item. JS owns state; CSS owns presentation. */
(function () {
  var ROOT = '[data-reveal-accordion]';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    if (root.hasAttribute('data-reveal-accordion-initialized')) return;
    root.setAttribute('data-reveal-accordion-initialized', '');
    var items = [].slice.call(root.querySelectorAll('[data-reveal-accordion-item]'));

    items.forEach(function (item) {
      var detail = item.querySelector('[data-reveal-accordion-detail]');
      var icon = item.querySelector('[data-reveal-accordion-icon]');
      var toggles = [].slice.call(item.querySelectorAll('[data-reveal-accordion-toggle]'));
      // The whole card may be the trigger, in which case the item carries the
      // attribute itself and querySelectorAll (descendants only) misses it.
      if (item.matches('[data-reveal-accordion-toggle]')) toggles.unshift(item);
      if (RM && detail) detail.style.transition = 'none';

      function paint(open) {
        item.classList.toggle('is-open', open);
        if (detail) detail.style.gridTemplateRows = open ? '1fr' : '0fr';
        if (icon) icon.textContent = open ? '−' : '+';
        toggles.forEach(function (t) { t.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      }
      paint(false);

      function onToggle(e) {
        e.preventDefault();
        var willOpen = !item.classList.contains('is-open');
        items.forEach(function (other) {
          if (other === item) return;
          other.classList.remove('is-open');
          var d = other.querySelector('[data-reveal-accordion-detail]');
          if (d) d.style.gridTemplateRows = '0fr';
          var ic = other.querySelector('[data-reveal-accordion-icon]');
          if (ic) ic.textContent = '+';
          var otherToggles = [].slice.call(other.querySelectorAll('[data-reveal-accordion-toggle]'));
          if (other.matches('[data-reveal-accordion-toggle]')) otherToggles.unshift(other);
          otherToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
        });
        paint(willOpen);
      }

      toggles.forEach(function (t) {
        t.setAttribute('role', 'button');
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '0');
        t.addEventListener('click', onToggle);
        t.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') onToggle(e);
        });
      });
    });
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualRevealAccordion = { init: boot };
})();
