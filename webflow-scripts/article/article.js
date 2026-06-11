document.addEventListener('DOMContentLoaded', function () {
  var WORDS_PER_MINUTE = 200;

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
});
