/* Gallery marquee — slow infinite loop for a static image row, draggable by hand.
   The track is duplicated at runtime rather than in the Designer, so editors keep
   add / delete / reorder on the original images.

   The row is not a scroll container, so the shared drag-lane.js — which drags
   scrollLeft — does not apply here: the loop lives in a transform, and the drag
   moves that same offset. One frame loop owns the offset in every state — drifting,
   held, dragged, gliding — so nothing else ever writes the transform and the drag
   cannot outrun the display. Reduced motion keeps the drag and drops only the
   automatic movement.

   A throw does not get its own animation either: the release speed is added to the
   marquee speed and decays away, so the lane glides down into its own slow drift
   with nothing to see at the hand-off.
   The hand grabs the strip, not the row. The row rides the transform, so its own
   box slides out from under the visible strip: the images past its edge are only
   children of it, and the 20px gaps between them belong to nothing — a press
   landing in one of those did nothing at all. Pointer events and the pointer
   capture therefore live on the element that clips the row, which is exactly the
   strip. The transform stays on the row.

   Contract: [data-gallery-marquee] on the row; the script adds `is-marquee-strip`
   / `is-dragging` to the clipping element, and global.css hangs the cursor,
   touch-action and user-select off them. */
(function () {
  var ROOT = '[data-gallery-marquee]';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = RM ? 0 : 24; // px per second the lane drifts on its own
  var THRESHOLD = 4; // px of travel before a press counts as a drag
  var GLIDE = 0.42; // seconds for a throw to shed ~63% of its speed
  var MAX_THROW = 2400; // px per second: a flick coasts, it does not launch
  var STALE_RELEASE = 0.09; // s — a hand that paused before letting go throws nothing

  // The nearest ancestor-or-self that clips overflow: the strip the row shows through.
  function clipHost(row) {
    var node = row;
    while (node && node !== document.body) {
      var style = getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return node;
      node = node.parentElement;
    }
    return row;
  }

  function init(row) {
    if (row.hasAttribute('data-gallery-marquee-initialized')) return;
    row.setAttribute('data-gallery-marquee-initialized', '');

    var strip = clipHost(row);
    var originals = [].slice.call(row.children);
    if (!originals.length) return;

    originals.forEach(function (node) {
      if (node.tagName !== 'IMG') return;
      // A lane carries images in from the side, and lazy loading only watches the
      // page scroll — a lazy photo reaches the edge still empty. The copies load
      // eagerly regardless, so the original may as well fetch the same bytes.
      node.loading = 'eager';
      node.addEventListener('load', measure); // its width decides the loop length
    });

    function loaded() {
      return originals.every(function (node) {
        return node.tagName !== 'IMG' || node.complete;
      });
    }

    function appendSet() {
      originals.forEach(function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        if (clone.tagName === 'IMG') {
          clone.loading = 'eager';
          clone.alt = '';
        }
        row.appendChild(clone);
      });
    }

    appendSet();
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
    var travel = 0; // px the hand has moved since it took hold
    var throwSpeed = 0; // px per second still owed to the release, on top of SPEED
    var handSpeed = 0; // px per second the hand is moving the lane right now
    var moveX = 0;
    var moveTime = 0;

    function measure() {
      distance = firstClone.offsetLeft - originals[0].offsetLeft;
      // The wrap jumps the lane back by one loop, so the lane has to be one loop
      // longer than the row — otherwise the far end runs out and bare background
      // shows at the right edge for part of every cycle. Half-loaded photos are
      // narrower than they will be, so wait for their real widths or the lane
      // ends up with copies it does not need.
      if (loaded()) {
        while (distance > 0 && row.scrollWidth < row.clientWidth + distance) appendSet();
      }
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

      var next = offset;
      if (pointerId !== null) {
        // Under the hand the lane follows travel and nothing else: held without
        // moving, it stands still; dragged, it lands once per frame rather than
        // once per pointer event, which is what made the drag feel choppy.
        if (dragging) next = wrap(startOffset - travel);
      } else if (distance > 0) {
        if (throwSpeed) {
          throwSpeed *= Math.exp(-delta / GLIDE);
          if (Math.abs(throwSpeed) < 12) throwSpeed = 0; // what is left is lost inside SPEED
        }
        next = wrap(offset + delta * (SPEED + throwSpeed));
      }

      if (next !== offset) {
        offset = next;
        render();
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame) return;
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
      travel = 0; // a lane taken hold of stands still until the hand moves
      dragging = false;
      throwSpeed = 0; // touching a gliding lane cancels the throw it was coasting on
      handSpeed = 0;
      moveX = e.clientX;
      moveTime = e.timeStamp;
    }

    function onPointerMove(e) {
      if (e.pointerId !== pointerId) return;

      travel = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(travel) < THRESHOLD) return;
        dragging = true;
        strip.classList.add('is-dragging');
        strip.setPointerCapture(pointerId);
      }

      var elapsed = (e.timeStamp - moveTime) / 1000;
      if (elapsed > 0) {
        // Smoothed, or one jittery last frame would decide the whole throw.
        handSpeed = 0.7 * (-(e.clientX - moveX) / elapsed) + 0.3 * handSpeed;
        moveX = e.clientX;
        moveTime = e.timeStamp;
      }
    }

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      if (strip.hasPointerCapture(pointerId)) strip.releasePointerCapture(pointerId);
      pointerId = null;
      if (!dragging) return;

      dragging = false;
      strip.classList.remove('is-dragging');

      var idle = (e.timeStamp - moveTime) / 1000;
      throwSpeed = (RM || idle > STALE_RELEASE) ? 0 :
        Math.max(-MAX_THROW, Math.min(MAX_THROW, handSpeed - SPEED));
      // minus SPEED: the tick adds the marquee speed back, so a lane released at
      // walking pace keeps exactly that pace instead of a step up.

      if (visible) start();
    }

    strip.classList.add('is-marquee-strip');
    strip.addEventListener('pointerdown', onPointerDown);
    strip.addEventListener('pointermove', onPointerMove);
    strip.addEventListener('pointerup', onPointerUp);
    strip.addEventListener('pointercancel', onPointerUp);
    // Images drag as images unless the browser is told otherwise.
    strip.addEventListener('dragstart', function (e) { e.preventDefault(); });

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
