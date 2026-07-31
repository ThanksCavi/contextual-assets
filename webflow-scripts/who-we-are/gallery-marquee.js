/* Gallery marquee — slow infinite loop for a static image row, draggable by hand.
   The track is duplicated at runtime rather than in the Designer, so editors keep
   add / delete / reorder on the original images.

   The row is not a scroll container, so the shared drag-lane.js — which drags
   scrollLeft — does not apply here: the loop lives in a transform, and the drag
   moves that same offset. Both write through render(), and the auto-scroll simply
   waits while the lane is held. Reduced motion keeps the drag and drops only the
   automatic movement.

   A throw does not get its own animation either: the release speed is added to the
   marquee speed and decays away, so the lane glides down into its own slow drift
   with nothing to see at the hand-off.
   Contract: [data-gallery-marquee] on the row; `is-draggable` / `is-dragging`
   carry the cursor and touch-action in who-we-are.css. */
(function () {
  var ROOT = '[data-gallery-marquee]';
  var SPEED = 24; // px per second
  var THRESHOLD = 4; // px of travel before a press counts as a drag
  var GLIDE = 0.42; // seconds for a throw to shed ~63% of its speed
  var MAX_THROW = 2400; // px per second: a flick coasts, it does not launch
  var STALE_RELEASE = 0.09; // s — a hand that paused before letting go throws nothing
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(row) {
    if (row.hasAttribute('data-gallery-marquee-initialized')) return;
    row.setAttribute('data-gallery-marquee-initialized', '');

    var originals = [].slice.call(row.children);
    if (!originals.length) return;

    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      if (clone.tagName === 'IMG') {
        clone.loading = 'eager';
        clone.alt = '';
      }
      row.appendChild(clone);
    });

    var firstClone = row.children[originals.length];
    var distance = 0;
    var offset = 0;
    var last = 0;
    var visible = true;
    var frame = null;
    var pointerId = null;
    var dragging = false;
    var startX = 0;
    var startOffset = 0;
    var throwSpeed = 0; // px per second still owed to the release, on top of SPEED
    var handSpeed = 0; // px per second the hand is moving the lane right now
    var moveX = 0;
    var moveTime = 0;

    function measure() {
      distance = firstClone.offsetLeft - originals[0].offsetLeft;
      offset = wrap(offset); // a resize can leave the offset past the new loop
      render();
    }

    function wrap(value) {
      if (distance <= 0) return 0;
      return ((value % distance) + distance) % distance;
    }

    function render() {
      row.style.transform = 'translate3d(' + -offset + 'px, 0, 0)';
    }

    function tick(now) {
      if (!last) last = now;
      var delta = (now - last) / 1000;
      last = now;

      if (distance > 0) {
        if (throwSpeed) {
          throwSpeed *= Math.exp(-delta / GLIDE);
          if (Math.abs(throwSpeed) < 12) throwSpeed = 0; // what is left is lost inside SPEED
        }
        offset = wrap(offset + delta * (SPEED + throwSpeed));
        render();
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame || dragging || RM) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      throwSpeed = 0; // a throw is not owed across a scroll away and back
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = null;
    }

    function onPointerDown(e) {
      if (e.button !== 0 || distance <= 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startOffset = offset;
      dragging = false;
      throwSpeed = 0; // touching a gliding lane cancels the throw it was coasting on
      handSpeed = 0;
      moveX = e.clientX;
      moveTime = e.timeStamp;
    }

    function onPointerMove(e) {
      if (e.pointerId !== pointerId) return;

      var travel = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(travel) < THRESHOLD) return;
        dragging = true;
        row.classList.add('is-dragging');
        row.setPointerCapture(pointerId);
        stop(); // the lane is in hand; the loop waits
      }

      var elapsed = (e.timeStamp - moveTime) / 1000;
      if (elapsed > 0) {
        // Smoothed, or one jittery last frame would decide the whole throw.
        handSpeed = 0.7 * (-(e.clientX - moveX) / elapsed) + 0.3 * handSpeed;
        moveX = e.clientX;
        moveTime = e.timeStamp;
      }

      offset = wrap(startOffset - travel);
      render();
    }

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      if (row.hasPointerCapture(pointerId)) row.releasePointerCapture(pointerId);
      pointerId = null;
      if (!dragging) return;

      dragging = false;
      row.classList.remove('is-dragging');

      var idle = (e.timeStamp - moveTime) / 1000;
      throwSpeed = idle > STALE_RELEASE ? 0 :
        Math.max(-MAX_THROW, Math.min(MAX_THROW, handSpeed - SPEED));
      // minus SPEED: the tick adds the marquee speed back, so a lane released at
      // walking pace keeps exactly that pace instead of a step up.

      if (visible) start();
    }

    row.classList.add('is-draggable');
    row.addEventListener('pointerdown', onPointerDown);
    row.addEventListener('pointermove', onPointerMove);
    row.addEventListener('pointerup', onPointerUp);
    row.addEventListener('pointercancel', onPointerUp);
    // Images drag as images unless the browser is told otherwise.
    row.addEventListener('dragstart', function (e) { e.preventDefault(); });

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure); // images may settle after decode

    if (window.IntersectionObserver) {
      // Watch the section, not the row: the row travels under its own transform
      // and once the offset passes the viewport width it stops intersecting —
      // which used to park the marquee for good on narrow screens.
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      }).observe(row.parentElement || row);
    } else {
      start();
    }
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualGalleryMarquee = {init: boot};
})();
