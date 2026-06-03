document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.blog-faq .article').forEach(function (faq) {
    if (faq.dataset.faqReady === 'true') return;

    function setPanelHeight(item) {
      var panel = item.querySelector('.blog-faq__panel');
      if (!panel) return;

      if (item.classList.contains('is-open')) {
        var styles = window.getComputedStyle(panel);
        var currentPaddingTop = parseFloat(styles.paddingTop) || 0;
        var currentPaddingBottom = parseFloat(styles.paddingBottom) || 0;
        var openPaddingBottom = parseFloat(styles.getPropertyValue('--blog-faq-panel-open-padding-bottom')) || 0;
        var contentHeight = panel.scrollHeight - currentPaddingTop - currentPaddingBottom;

        panel.style.maxHeight = contentHeight + currentPaddingTop + openPaddingBottom + 'px';
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
      var trigger = document.createElement('button');
      var icon = document.createElement('span');
      var label = document.createElement('span');

      item.className = 'blog-faq__item';
      panel.className = 'blog-faq__panel';
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
        panel.appendChild(current);
      }

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
});
