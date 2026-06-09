document.addEventListener('DOMContentLoaded', function () {
  var ARTICLE_LAYOUT_SELECTOR = '[data-article-layout]';
  var ARTICLE_SIDEBAR_SELECTOR = '[data-article-sidebar]';
  var ARTICLE_CONTENT_SELECTOR = '[data-article-content]';
  var ARTICLE_PIN_MANAGED_CLASS = 'is-article-pin-managed';
  var DESKTOP_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
  var MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
  var RESIZE_REFRESH_DELAY_MS = 160;
  var DEFAULT_TOP_OFFSET = 100;
  var WORDS_PER_MINUTE = 200;
  var articlePin = {
    matchMedia: null,
    trigger: null,
    sidebar: null,
    sidebarStyle: null,
    pinTopOffset: null,
    stylesApplied: false,
  };
  var articlePinResizeTimer = null;

  setupArticleReadTime();
  setupArticleStandaloneLinks();

  document.querySelectorAll('.blog-faq .article').forEach(function (faq) {
    if (faq.dataset.faqReady === 'true') return;

    function setPanelHeight(item) {
      var panel = item.querySelector('.blog-faq__panel');
      var panelInner = item.querySelector('.blog-faq__panel-inner');
      if (!panel || !panelInner) return;

      if (item.classList.contains('is-open')) {
        panel.style.maxHeight = panelInner.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = '0px';
      }
    }

    function closeItem(item) {
      var trigger = item.querySelector('.blog-faq__trigger');

      item.classList.remove('is-open');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
      }
      setPanelHeight(item);
    }

    function openItem(item) {
      var trigger = item.querySelector('.blog-faq__trigger');

      item.classList.add('is-open');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'true');
      }
      setPanelHeight(item);
    }

    var headings = Array.from(faq.children).filter(function (child) {
      return child.tagName === 'H3';
    });

    headings.forEach(function (heading, index) {
      var item = document.createElement('div');
      var panel = document.createElement('div');
      var panelInner = document.createElement('div');
      var trigger = document.createElement('button');
      var icon = document.createElement('span');
      var label = document.createElement('span');

      item.className = 'blog-faq__item';
      panel.className = 'blog-faq__panel';
      panelInner.className = 'blog-faq__panel-inner';
      heading.classList.add('blog-faq__question');

      trigger.className = 'blog-faq__trigger';
      trigger.type = 'button';
      trigger.setAttribute('aria-expanded', 'false');

      icon.className = 'blog-faq__icon';
      icon.setAttribute('aria-hidden', 'true');

      label.innerHTML = heading.innerHTML;
      trigger.appendChild(label);
      trigger.appendChild(icon);

      heading.innerHTML = '';
      heading.appendChild(trigger);

      faq.insertBefore(item, heading);
      item.appendChild(heading);

      var next = item.nextSibling;
      while (next && !(next.nodeType === 1 && next.tagName === 'H3')) {
        var current = next;
        next = next.nextSibling;
        panelInner.appendChild(current);
      }

      panel.appendChild(panelInner);
      item.appendChild(panel);

      if (index === 0) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }

      trigger.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');

        faq.querySelectorAll('.blog-faq__item').forEach(function (otherItem) {
          closeItem(otherItem);
        });

        if (!isOpen) {
          openItem(item);
        }
      });
    });

    faq.querySelectorAll('.blog-faq__item').forEach(function (item) {
      setPanelHeight(item);
    });

    window.addEventListener('resize', function () {
      faq.querySelectorAll('.blog-faq__item.is-open').forEach(function (item) {
        setPanelHeight(item);
      });
    });

    faq.dataset.faqReady = 'true';
  });

  function setupArticleStandaloneLinks() {
    document.querySelectorAll('.article').forEach(function (article) {
      if (article.closest('.blog-faq')) return;

      article.querySelectorAll('p').forEach(function (paragraph) {
        var link = getStandaloneParagraphLink(paragraph);
        if (!link || link.dataset.articleTextLinkReady === 'true') return;

        paragraph.classList.add('article-link-wrap');
        link.classList.add('article-text-link');
        link.dataset.articleTextLinkReady = 'true';
      });
    });
  }

  function getStandaloneParagraphLink(paragraph) {
    var elementChildren = Array.from(paragraph.children);
    if (elementChildren.length !== 1 || elementChildren[0].tagName !== 'A') return null;

    var link = elementChildren[0];
    if (paragraph.textContent.trim() !== link.textContent.trim()) return null;

    return link;
  }

  function setupArticleReadTime() {
    var readTimeTargets = document.querySelectorAll('[data-article-read-time]');
    var article = document.querySelector('[data-article-read-source]') || document.querySelector('.article');
    if (!readTimeTargets.length || !article) return;

    var words = getWordCount(article.textContent);
    var minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));

    readTimeTargets.forEach(function (target) {
      target.textContent = String(minutes);
    });
  }

  function getWordCount(text) {
    var matches = text.trim().match(/\S+/g);
    return matches ? matches.length : 0;
  }

  if (document.querySelector(ARTICLE_LAYOUT_SELECTOR) && document.querySelector(ARTICLE_SIDEBAR_SELECTOR) && document.querySelector(ARTICLE_CONTENT_SELECTOR)) {
    onArticleMotionReady(initArticleSidebarPin);
    window.addEventListener('resize', queueArticleSidebarPinRefresh);
    window.addEventListener(MOTION_POLICY_CHANGE_EVENT, queueArticleSidebarPinRefresh);
  }

  function onArticleMotionReady(callback) {
    if (window.ContextualHomeMotion && window.ContextualHomeMotion.ready) {
      window.ContextualHomeMotion.ready.then(callback);
      return;
    }

    requestAnimationFrame(callback);
  }

  function initArticleSidebarPin() {
    setupArticleSidebarPin();
    requestGlobalRefresh();
  }

  function setupArticleSidebarPin() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var layout = document.querySelector(ARTICLE_LAYOUT_SELECTOR);
    var sidebar = document.querySelector(ARTICLE_SIDEBAR_SELECTOR);
    var content = document.querySelector(ARTICLE_CONTENT_SELECTOR);

    clearArticleSidebarPin();

    if (!gsap || !ScrollTrigger || !gsap.matchMedia || !layout || !sidebar || !content || !shouldUseDesktopMotion()) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    articlePin.matchMedia = gsap.matchMedia();
    articlePin.matchMedia.add(DESKTOP_QUERY, function () {
      if (!shouldUseDesktopMotion() || content.offsetHeight <= sidebar.offsetHeight) return undefined;

      applyArticlePinStyles(sidebar);
      articlePin.trigger = ScrollTrigger.create({
        trigger: layout,
        endTrigger: layout,
        start: function () {
          return 'top top+=' + getArticleTopOffset() + 'px';
        },
        end: function () {
          return 'bottom top+=' + (getArticleTopOffset() + sidebar.offsetHeight) + 'px';
        },
        pin: sidebar,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      });

      return clearActiveArticlePin;
    });
  }

  function clearArticleSidebarPin() {
    if (articlePin.matchMedia) {
      var matchMedia = articlePin.matchMedia;
      articlePin.matchMedia = null;
      matchMedia.revert();
    }

    clearActiveArticlePin();
  }

  function clearActiveArticlePin() {
    if (articlePin.trigger) {
      articlePin.trigger.kill();
      articlePin.trigger = null;
    }

    restoreArticlePinStyles();
  }

  function applyArticlePinStyles(sidebar) {
    articlePin.sidebar = sidebar;
    articlePin.pinTopOffset = getComputedArticleTopOffset(sidebar);
    articlePin.sidebarStyle = sidebar.getAttribute('style');
    articlePin.stylesApplied = true;
    sidebar.classList.add(ARTICLE_PIN_MANAGED_CLASS);
    sidebar.style.position = 'relative';
    sidebar.style.top = 'auto';
  }

  function restoreArticlePinStyles() {
    var sidebar = articlePin.sidebar;
    if (!sidebar || !articlePin.stylesApplied) return;

    sidebar.classList.remove(ARTICLE_PIN_MANAGED_CLASS);
    articlePin.pinTopOffset = null;

    if (articlePin.sidebarStyle === null) {
      sidebar.removeAttribute('style');
    } else {
      sidebar.setAttribute('style', articlePin.sidebarStyle);
    }

    articlePin.sidebar = null;
    articlePin.sidebarStyle = null;
    articlePin.stylesApplied = false;
  }

  function queueArticleSidebarPinRefresh() {
    clearTimeout(articlePinResizeTimer);
    articlePinResizeTimer = window.setTimeout(function () {
      setupArticleSidebarPin();
      requestGlobalRefresh();
    }, RESIZE_REFRESH_DELAY_MS);
  }

  function shouldUseDesktopMotion() {
    var motion = window.ContextualHomeMotion;

    if (motion && motion.shouldUseSmoother && !motion.shouldUseSmoother()) return false;
    if (motion && motion.shouldUseHeavyScrollEffects) return motion.shouldUseHeavyScrollEffects();

    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  function getArticleTopOffset() {
    return Number.isFinite(articlePin.pinTopOffset) ? articlePin.pinTopOffset : getComputedArticleTopOffset(articlePin.sidebar);
  }

  function getComputedArticleTopOffset(sidebar) {
    if (!sidebar) return DEFAULT_TOP_OFFSET;

    var value = Number.parseFloat(window.getComputedStyle(sidebar).top);
    return Number.isFinite(value) ? value : DEFAULT_TOP_OFFSET;
  }

  function requestGlobalRefresh() {
    if (window.ContextualHomeMotion && window.ContextualHomeMotion.requestRefresh) {
      window.ContextualHomeMotion.requestRefresh();
      return;
    }

    if (window.ScrollTrigger) {
      if (window.ScrollTrigger.sort) {
        window.ScrollTrigger.sort();
      }
      window.ScrollTrigger.refresh(true);
    }
  }
});
