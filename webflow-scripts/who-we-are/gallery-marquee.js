/* Gallery marquee — slow infinite loop for a static image row.
   The track is duplicated at runtime rather than in the Designer, so editors keep
   add / delete / reorder on the original images.
   Contract: [data-gallery-marquee] on the row. */
(function () {
  var ROOT = '[data-gallery-marquee]';
  var SPEED = 24; // px per second
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(row) {
    if (row.hasAttribute('data-gallery-marquee-initialized')) return;
    row.setAttribute('data-gallery-marquee-initialized', '');

    var originals = [].slice.call(row.children);
    if (!originals.length || RM) return; // reduced motion: leave the static row

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

    function measure() {
      distance = firstClone.offsetLeft - originals[0].offsetLeft;
    }

    function tick(now) {
      if (!last) last = now;
      var delta = (now - last) / 1000;
      last = now;

      if (distance > 0) {
        offset = (offset + delta * SPEED) % distance;
        row.style.transform = 'translate3d(' + -offset + 'px, 0, 0)';
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = null;
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure); // images may settle after decode

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      }).observe(row);
    } else {
      start();
    }
  }

  function boot() { [].slice.call(document.querySelectorAll(ROOT)).forEach(init); }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.ContextualGalleryMarquee = {init: boot};
})();
