/* Drag cursor — the badge that replaces the pointer over a draggable row.

   A layer on top of the two drag modules, not a third drag implementation: it
   never touches scrollLeft or the marquee offset, and it asks neither module for
   its state. It binds to the site's two drag contracts —

     [data-drag-lane]        a natively scrollable row      (drag-lane.js)
     [data-gallery-marquee]  a looping row on a transform   (gallery-marquee.js)

   — so a new page that uses either contract gets the same cursor with no markup
   of its own. Nothing here is page-specific.

   Two things are worth knowing about the geometry:

   1. Hover is watched on the row's nearest clipping ancestor-or-self, not on the
      row. A marquee row rides a transform, so its own box slides out from under
      the visible strip and the images beyond it are only children — the 20px
      gaps between them would fall outside the row's box and blink the badge off
      and on. The element that clips the strip is the strip. For a scroll lane
      that element is the lane itself, so one rule covers both.
   2. The badge is appended to <body>, outside #smooth-wrapper. ScrollSmoother
      transforms that wrapper, and a transformed ancestor would make `fixed`
      resolve against it — the cursor would then lag the page as it scrolls.

   Deliberate boundary: none of the three rows currently holds a link or button,
   so there is no code here to hand the native cursor back over an interactive
   child. Add a CTA inside a lane card and this is the one place to revisit. */
(function () {
  var ZONES = '[data-drag-lane], [data-gallery-marquee]';
  var FINE = '(hover: hover) and (pointer: fine)';
  var REDUCED = '(prefers-reduced-motion: reduce)';
  var EASE = 0.22; // share of the remaining distance the badge covers each frame
  var EDGE = 2; // px tolerance for fractional widths

  // A finger has no cursor to replace, and a coarse pointer has no hover state to
  // enter. Both rows stay natively swipeable there.
  if (!window.matchMedia || !matchMedia(FINE).matches) return;

  var reduced = matchMedia(REDUCED).matches;

  var badge;
  var zone = null; // the drag contract element the pointer is over
  var host = null; // the element that clips it — where hover is watched
  var pressed = false;
  var x = 0;
  var y = 0;
  var toX = 0;
  var toY = 0;
  var frame = null;

  function build() {
    badge = document.createElement('div');
    badge.className = 'ctx-drag-cursor';
    badge.setAttribute('aria-hidden', 'true');

    var face = document.createElement('span');
    face.className = 'ctx-drag-cursor-face'; // the arrows are its two pseudo-elements
    badge.appendChild(face);
    document.body.appendChild(badge);
  }

  function clipHost(row) {
    var node = row;
    while (node && node !== document.body) {
      var style = getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return node;
      node = node.parentElement;
    }
    return row;
  }

  // True for both mechanics: the lane's content overflows its scroll port, and the
  // marquee's images overflow the row box they are laid out in. A row that fits
  // has nothing to drag and should not advertise one.
  function movable(row) {
    return row.scrollWidth > row.clientWidth + EDGE;
  }

  function tick() {
    if (reduced) {
      x = toX;
      y = toY;
    } else {
      x += (toX - x) * EASE;
      y += (toY - y) * EASE;
    }
    badge.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
    frame = zone ? requestAnimationFrame(tick) : null;
  }

  function show(row, clip, e) {
    if (zone) hide();

    zone = row;
    host = clip;
    // Both, so the rule wins over the row's own grab cursor as well as the host's.
    row.classList.add('is-drag-cursor-host');
    clip.classList.add('is-drag-cursor-host');

    toX = x = e.clientX; // enter where the pointer is, do not fly in from the last exit
    toY = y = e.clientY;
    badge.classList.add('is-visible');
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function hide() {
    if (!zone) return;

    zone.classList.remove('is-drag-cursor-host');
    host.classList.remove('is-drag-cursor-host');
    zone = null;
    host = null;
    badge.classList.remove('is-visible', 'is-pressed');
  }

  function bind(row) {
    var clip = clipHost(row);

    function follow(e) {
      if (e.pointerType !== 'mouse') return;
      // The width test reads layout, so it runs once on the way in rather than on
      // every move of the mouse.
      if (zone !== row) {
        if (!movable(row)) return;
        show(row, clip, e);
      }
      toX = e.clientX;
      toY = e.clientY;
    }

    clip.addEventListener('pointerenter', follow);
    clip.addEventListener('pointermove', follow);
    clip.addEventListener('pointerleave', function () {
      // A drag that has left the strip is still a drag: the row holds the pointer
      // capture and keeps sending moves, so the badge stays with the hand.
      if (!pressed) hide();
    });
    clip.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || zone !== row) return;
      pressed = true;
      badge.classList.add('is-pressed');
    });
  }

  function release(e) {
    if (!pressed) return;

    pressed = false;
    badge.classList.remove('is-pressed');
    if (!host) return;

    var rect = host.getBoundingClientRect();
    var inside = e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) hide(); // let go past the edge: no pointerleave will follow
  }

  function boot() {
    var rows = [].slice.call(document.querySelectorAll(ZONES));
    if (!rows.length) return;

    build();
    rows.forEach(bind);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
