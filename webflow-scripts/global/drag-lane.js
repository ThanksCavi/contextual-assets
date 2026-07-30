/* Drag lane — grab-and-drag for a natively scrollable horizontal row.
   The lane works without this file: touch swipe and trackpad scroll are native.
   This adds the desktop affordance the client asks for as "draggable".

   Contract: [data-drag-lane] on the scroll container. Nothing else — layout,
   dividers and card widths stay in the Designer, this file only reacts to a
   pointer and to whether the row currently overflows.

   Applying it to another section:
     1. give the row `overflow: auto hidden` and column tracks with a real
        minimum, e.g. `grid-auto-flow: column`,
        `grid-template-columns: minmax(340px, 1fr) …`,
        `grid-auto-columns: minmax(340px, 1fr)`.
        Cards keep their design width while they fit, and the row becomes a
        lane by itself as soon as an editor adds one more card;
     2. add `data-drag-lane` on the row;
     3. if the cards carry a divider, set it as border-left on the card class
        and zero it on the `first-child` pseudo state — so the line follows
        card order instead of a hand-placed class. */
(function () {
  var ROOT = '[data-drag-lane]';
  var THRESHOLD = 4; // px of travel before a press counts as a drag, not a click

  function init(lane) {
    if (lane.hasAttribute('data-drag-lane-initialized')) return;
    lane.setAttribute('data-drag-lane-initialized', '');

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
