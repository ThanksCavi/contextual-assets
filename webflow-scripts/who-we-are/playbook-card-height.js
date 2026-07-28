/* Who We Are playbook cards — keep revealed copy clear of the close control.
   The detail panel is an absolute overlay so its copy does not contribute to
   card height. Grow only an open card, and only by the measured overlap. */
(function () {
  var CARD = '.wwa-playbook-card';
  var DETAIL = '.wwa-playbook-card-detail';
  var BLOCK = '.wwa-playbook-detail-block';
  var ACTION = '.wwa-playbook-card-action .button';
  var scheduled = false;
  var resizeTimer;

  function requestGlobalRefresh() {
    if (
      window.ContextualHomeMotion &&
      typeof window.ContextualHomeMotion.requestRefresh === 'function'
    ) {
      window.ContextualHomeMotion.requestRefresh();
      return;
    }
    if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === 'function') {
      window.ScrollTrigger.refresh();
    }
  }

  function sync() {
    scheduled = false;
    var cards = [].slice.call(document.querySelectorAll(CARD));
    var previousHeights = cards.map(function (card) {
      return card.style.minHeight;
    });

    // Measure every open card from the same unmodified grid state.
    cards.forEach(function (card) {
      card.style.removeProperty('min-height');
    });

    cards.forEach(function (card) {
      if (!card.classList.contains('is-open')) return;

      var detail = card.querySelector(DETAIL);
      var blocks = detail ? detail.querySelectorAll(BLOCK) : [];
      var lastBlock = blocks.length ? blocks[blocks.length - 1] : null;
      var action = card.querySelector(ACTION);
      if (!lastBlock || !action) return;

      var cardHeight = card.getBoundingClientRect().height;
      var overlap = Math.ceil(
        lastBlock.getBoundingClientRect().bottom -
          action.getBoundingClientRect().top
      );

      if (overlap >= 0) {
        card.style.minHeight = Math.ceil(cardHeight + overlap + 1) + 'px';
      }
    });

    var changed = cards.some(function (card, index) {
      return card.style.minHeight !== previousHeights[index];
    });
    if (changed) requestGlobalRefresh();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  function init() {
    var cards = [].slice.call(document.querySelectorAll(CARD));
    if (!cards.length) return;

    cards.forEach(function (card) {
      if (card.hasAttribute('data-playbook-height-initialized')) return;
      card.setAttribute('data-playbook-height-initialized', '');
      new MutationObserver(schedule).observe(card, {
        attributes: true,
        attributeFilter: ['class']
      });
    });

    if (!document.documentElement.hasAttribute('data-playbook-height-resize')) {
      document.documentElement.setAttribute('data-playbook-height-resize', '');
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(schedule, 100);
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule);
    }
    schedule();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.ContextualPlaybookCardHeight = {
    init: init,
    refresh: schedule
  };
})();
