/* Drag lane — grab-and-drag for a natively scrollable horizontal row.
   The lane works without this file: touch swipe and trackpad scroll are native.
   This adds the desktop affordance the client asks for as "draggable".

   Contract: [data-drag-lane] on the row. On init the script adds `is-lane`,
   and global.css turns the row into a scroll container behind that class.
   Optional desktop pager contract, scoped to the same section:
     [data-drag-lane-controls]  pager wrapper
     [data-drag-lane-prev]      previous control
     [data-drag-lane-next]      next control
   The pager appears only when more than three cards exist and the viewport is
   at least 992px wide. It uses the lane's native scroll position, so arrows,
   mouse drag, touch swipe, and trackpad scrolling never maintain separate
   carousel state.
   Lane mode is deliberately script-owned: the Designer canvas runs no custom
   code, so there the row stays a plain wrapping grid and every card — including
   the fourth one — is visible and editable. Card widths, dividers and the grid
   itself stay in the Designer.

   Applying it to another section:
     1. build the row as a grid whose column tracks are percentages of the
        container, e.g. `grid-template-columns: 32.35% 35.3% 32.35%` with
        `grid-auto-columns` set to the width an extra card should take. Cards
        then keep their design width no matter how many are added: the ones
        beyond the container simply sit outside it;
     2. add `data-drag-lane` on the row — do NOT set overflow in the Designer;
     3. if the cards carry a divider, set it as border-left on the card class
        and zero it on the `first-child` pseudo state — so the line follows
        card order instead of a hand-placed class. */
(function () {
  var ROOT = '[data-drag-lane]';
  var THRESHOLD = 4; // px of travel before a press counts as a drag, not a click
  var EDGE = 2; // px tolerance for fractional scroll positions
  var DESKTOP_QUERY = '(min-width: 992px)';
  var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  function init(lane) {
    if (lane.hasAttribute('data-drag-lane-initialized')) return;
    lane.setAttribute('data-drag-lane-initialized', '');
    lane.classList.add('is-lane');

    var scope = lane.closest('section') || lane.parentElement || document;
    var controls = scope.querySelector('[data-drag-lane-controls]');
    var prev = scope.querySelector('[data-drag-lane-prev]');
    var next = scope.querySelector('[data-drag-lane-next]');
    var desktop = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;
    var startX = 0;
    var startScroll = 0;
    var pointerId = null;
    var dragging = false;

    function paint() {
      var canScroll = scrollable();
      var controlsActive = updateControlsVisibility();

      lane.style.cursor = canScroll ? 'grab' : '';
      paintViewportEdgeDivider(canScroll);

      if (!controlsActive) return;

      var max = maxScroll();
      setDisabled(prev, !canScroll || lane.scrollLeft <= EDGE);
      setDisabled(next, !canScroll || lane.scrollLeft >= max - EDGE);
    }

    function scrollable() {
      return maxScroll() > EDGE;
    }

    function maxScroll() {
      return Math.max(0, lane.scrollWidth - lane.clientWidth);
    }

    function updateControlsVisibility() {
      if (!controls) return false;

      var isDesktop = !desktop || desktop.matches;
      var active = lane.children.length > 3 && isDesktop;

      // A focused control can disappear on a responsive resize. Move focus out
      // before hiding its parent so assistive technology never retains a hidden
      // focus target.
      if (!active && controls.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      controls.hidden = !active;
      controls.setAttribute('aria-hidden', active ? 'false' : 'true');
      lane.classList.toggle('has-controls', active);

      return active;
    }

    function setDisabled(button, disabled) {
      if (!button) return;

      button.classList.toggle('is-disabled', disabled);
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function cardAnchors() {
      var laneRect = lane.getBoundingClientRect();
      var max = maxScroll();

      return [].slice.call(lane.children).map(function (card) {
        var left = card.getBoundingClientRect().left - laneRect.left + lane.scrollLeft;
        return Math.max(0, Math.min(max, left));
      }).filter(function (anchor, index, anchors) {
        return index === 0 || Math.abs(anchor - anchors[index - 1]) > EDGE;
      });
    }

    function closestAnchorIndex(anchors) {
      var closest = 0;
      var distance = Infinity;

      anchors.forEach(function (anchor, index) {
        var nextDistance = Math.abs(anchor - lane.scrollLeft);
        if (nextDistance < distance) {
          distance = nextDistance;
          closest = index;
        }
      });

      return closest;
    }

    function moveByCard(direction) {
      var anchors = cardAnchors();
      if (anchors.length < 2) return;

      var current = closestAnchorIndex(anchors);
      var target = Math.max(0, Math.min(anchors.length - 1, current + direction));
      if (target === current) return;

      lane.scrollTo({
        left: anchors[target],
        behavior: window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth',
      });
    }

    function paintViewportEdgeDivider(canScroll) {
      var cards = [].slice.call(lane.children);
      var edge = lane.scrollLeft + lane.clientWidth;
      var laneRect = lane.getBoundingClientRect();

      cards.forEach(function (card) {
        var left = card.getBoundingClientRect().left - laneRect.left + lane.scrollLeft;
        var sitsOnViewportEdge = canScroll && Math.abs(left - edge) <= EDGE;
        card.classList.toggle('is-lane-edge', sitsOnViewportEdge);
      });
    }

    function onPointerDown(e) {
      // Touch already pans the lane natively; hijacking it only breaks momentum.
      if (e.pointerType === 'touch' || e.button !== 0 || !scrollable()) return;

      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = lane.scrollLeft;
      dragging = false;
    }

    function onPointerMove(e) {
      if (e.pointerId !== pointerId) return;

      var travel = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(travel) < THRESHOLD) return;
        dragging = true;
        lane.style.cursor = 'grabbing';
        lane.style.userSelect = 'none';
        lane.setPointerCapture(pointerId);
      }
      lane.scrollLeft = startScroll - travel;
      e.preventDefault();
    }

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      if (lane.hasPointerCapture(pointerId)) lane.releasePointerCapture(pointerId);
      pointerId = null;
      if (!dragging) return;

      dragging = false;
      lane.style.userSelect = '';
      paint();
      // Swallow the click that ends the drag so a card link does not fire.
      lane.addEventListener('click', swallow, {capture: true, once: true});
      setTimeout(function () {
        lane.removeEventListener('click', swallow, {capture: true});
      }, 0);
    }

    function swallow(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function bindControl(button, direction) {
      if (!button) return;

      button.addEventListener('click', function (e) {
        e.preventDefault();
        if (button.getAttribute('aria-disabled') === 'true') return;
        moveByCard(direction);
      });

      // Link blocks fire click natively for Enter. Space needs explicit support.
      button.addEventListener('keydown', function (e) {
        if (e.key !== ' ') return;
        e.preventDefault();
        if (button.getAttribute('aria-disabled') === 'true') return;
        moveByCard(direction);
      });
    }

    lane.addEventListener('pointerdown', onPointerDown);
    lane.addEventListener('pointermove', onPointerMove);
    lane.addEventListener('pointerup', onPointerUp);
    lane.addEventListener('pointercancel', onPointerUp);
    lane.addEventListener('dragstart', function (e) { if (dragging) e.preventDefault(); });
    lane.addEventListener('scroll', paint, {passive: true});
    bindControl(prev, -1);
    bindControl(next, 1);

    if (window.ResizeObserver) new ResizeObserver(paint).observe(lane);
    // The breakpoint class change can settle a frame after matchMedia fires,
    // so paint again on the viewport's next frame as well.
    window.addEventListener('resize', function () {
      window.requestAnimationFrame(paint);
    });

    if (desktop) {
      if (typeof desktop.addEventListener === 'function') desktop.addEventListener('change', paint);
      else if (typeof desktop.addListener === 'function') desktop.addListener(paint);
    }

    paint();
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualDragLane = {init: boot};
})();
