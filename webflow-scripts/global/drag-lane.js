/* Drag lane — grab-and-drag for a natively scrollable horizontal row.
   The lane works without this file: touch swipe and trackpad scroll are native.
   This adds the desktop affordance the client asks for as "draggable".

   Contract: [data-drag-lane] on the row. On init the script adds `is-lane`,
   and global.css turns the row into a scroll container behind that class.
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

  function init(lane) {
    if (lane.hasAttribute('data-drag-lane-initialized')) return;
    lane.setAttribute('data-drag-lane-initialized', '');
    lane.classList.add('is-lane');

    var startX = 0;
    var startScroll = 0;
    var pointerId = null;
    var dragging = false;

    function paint() {
      lane.style.cursor = lane.scrollWidth - lane.clientWidth > 1 ? 'grab' : '';
    }

    function scrollable() {
      return lane.scrollWidth - lane.clientWidth > 1;
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

    lane.addEventListener('pointerdown', onPointerDown);
    lane.addEventListener('pointermove', onPointerMove);
    lane.addEventListener('pointerup', onPointerUp);
    lane.addEventListener('pointercancel', onPointerUp);
    lane.addEventListener('dragstart', function (e) { if (dragging) e.preventDefault(); });

    if (window.ResizeObserver) new ResizeObserver(paint).observe(lane);
    else window.addEventListener('resize', paint);
    paint();
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualDragLane = {init: boot};
})();
