document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.blog-faq .article').forEach(function (faq) {
    if (faq.dataset.faqReady === 'true') return;

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
          otherItem.classList.remove('is-open');

          var otherTrigger = otherItem.querySelector('.blog-faq__trigger');
          if (otherTrigger) {
            otherTrigger.setAttribute('aria-expanded', 'false');
          }
        });

        if (!isOpen) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    faq.dataset.faqReady = 'true';
  });
});
