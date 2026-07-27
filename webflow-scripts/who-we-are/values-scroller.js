/* Values scroller — arrow buttons over a native horizontal scroll container.
   The section works without this file: swipe and scroll are native. The arrows
   are the desktop affordance on top.
   Contract:
     [data-values-scroller]        scroll container
     [data-values-scroller-prev]   previous control
     [data-values-scroller-next]   next control
   State: `is-disabled` on a control that has reached its edge. */
(function () {
  var ROOT = '[data-values-scroller]';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDGE = 2; // px tolerance for fractional scroll positions

  function init(root) {
    if (root.hasAttribute('data-values-scroller-initialized')) return;
    root.setAttribute('data-values-scroller-initialized', '');

    var scope = root.closest('section') || document;
    var prev = scope.querySelector('[data-values-scroller-prev]');
    var next = scope.querySelector('[data-values-scroller-next]');
    if (!prev && !next) return;

    function step() {
      var kids = root.children;
      if (kids.length > 1) return kids[1].offsetLeft - kids[0].offsetLeft;
      return root.clientWidth;
    }

    function scrollBy(direction) {
      root.scrollBy({left: direction * step(), behavior: RM ? 'auto' : 'smooth'});
    }

    function paint() {
      var max = root.scrollWidth - root.clientWidth;
      setDisabled(prev, root.scrollLeft <= EDGE);
      setDisabled(next, root.scrollLeft >= max - EDGE);
    }

    function setDisabled(button, disabled) {
      if (!button) return;
      button.classList.toggle('is-disabled', disabled);
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function bind(button, direction) {
      if (!button) return;
      button.addEventListener('click', function (e) {
        e.preventDefault();
        scrollBy(direction);
      });
      // The controls are anchors carrying role="button"; Enter fires click
      // natively, Space does not.
      button.addEventListener('keydown', function (e) {
        if (e.key !== ' ') return;
        e.preventDefault();
        scrollBy(direction);
      });
    }

    bind(prev, -1);
    bind(next, 1);
    root.addEventListener('scroll', paint, {passive: true});
    window.addEventListener('resize', paint);
    paint();
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualValuesScroller = {init: boot};
})();
