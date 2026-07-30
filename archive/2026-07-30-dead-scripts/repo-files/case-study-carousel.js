(() => {
  const SLIDER_SELECTOR = '[data-cs-slider]';
  const VIEWPORT_SELECTOR = '[data-cs-viewport]';
  const TRACK_SELECTOR = '[data-cs-track]';
  const SLIDE_SELECTOR = '[data-cs-slide]';
  const PREV_SELECTOR = '[data-cs-prev], [data-cs-prev-ui]';
  const NEXT_SELECTOR = '[data-cs-next], [data-cs-next-ui]';
  const CURRENT_COUNT_SELECTOR = '[data-cs-count-current]';
  const TOTAL_COUNT_SELECTOR = '[data-cs-count-total]';
  const VISUAL_CONTROLS_SELECTOR = '.cs-controls-ui';
  const VISUAL_COUNT_SELECTOR = '.cs-nav-count';

  const MODE_ATTRIBUTE = 'data-cs-mode';
  const ACTIVE_CLASS = 'is-active';
  const INITIALIZED_CLASS = 'is-initialized';
  const DISABLED_CLASS = 'is-disabled';
  const VALID_MODES = new Set(['fade', 'slide']);
  const SLIDE_DURATION = 520;
  const FADE_DURATION = 520;
  const FADE_OUT_DURATION = 360;
  const FADE_IN_DELAY = 90;

  const sliders = new WeakSet();

  function initAll() {
    document.querySelectorAll(SLIDER_SELECTOR).forEach(initSlider);
  }

  function initSlider(slider) {
    if (sliders.has(slider)) return;

    const viewport = slider.querySelector(VIEWPORT_SELECTOR);
    const track = slider.querySelector(TRACK_SELECTOR);
    const slides = Array.from(slider.querySelectorAll(SLIDE_SELECTOR));

    if (!viewport || !track || slides.length === 0) return;

    sliders.add(slider);

    const mode = getMode(slider);
    const state = {
      slider,
      viewport,
      track,
      slides,
      mode,
      currentIndex: 0,
      isAnimating: false,
      total: slides.length,
      prevControls: Array.from(slider.querySelectorAll(PREV_SELECTOR)),
      nextControls: Array.from(slider.querySelectorAll(NEXT_SELECTOR)),
    };

    prepareLayout(state);
    updateCounters(state);

    if (state.total === 1) {
      showSingleSlide(state);
      return;
    }

    bindControls(state);
    goToSlide(state, 0, true);
  }

  function getMode(slider) {
    const mode = slider.getAttribute(MODE_ATTRIBUTE);
    return VALID_MODES.has(mode) ? mode : 'fade';
  }

  function prepareLayout(state) {
    state.slider.classList.add(INITIALIZED_CLASS, `is-${state.mode}`);
    state.viewport.style.overflow = 'hidden';

    if (state.mode === 'slide') {
      state.track.style.display = 'flex';
      state.track.style.flexWrap = 'nowrap';
      state.track.style.transition = `transform ${SLIDE_DURATION}ms ease`;
      state.track.style.willChange = 'transform';

      state.slides.forEach(slide => {
        slide.style.flex = '0 0 100%';
      });

      return;
    }

    state.track.style.display = 'grid';
    state.track.style.transform = 'none';

    state.slides.forEach(slide => {
      slide.style.gridArea = '1 / 1';
      slide.style.opacity = '0';
      slide.style.transitionProperty = 'opacity';
      slide.style.transitionTimingFunction = 'ease';
    });
  }

  function bindControls(state) {
    state.prevControls.forEach(control => {
      prepareControl(control, () => goToSlide(state, state.currentIndex - 1));
    });

    state.nextControls.forEach(control => {
      prepareControl(control, () => goToSlide(state, state.currentIndex + 1));
    });
  }

  function prepareControl(control, onClick) {
    control.setAttribute('role', control.getAttribute('role') || 'button');
    control.setAttribute('tabindex', control.getAttribute('tabindex') || '0');

    control.addEventListener('click', event => {
      event.preventDefault();
      onClick();
    });

    control.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onClick();
    });
  }

  function goToSlide(state, nextIndex, immediate = false) {
    if (state.isAnimating && !immediate) return;

    const targetIndex = wrapIndex(nextIndex, state.total);

    if (state.mode === 'fade') {
      fadeToSlide(state, targetIndex, immediate);
      return;
    }

    state.currentIndex = targetIndex;

    if (state.mode === 'slide') {
      state.track.style.transform = `translate3d(${-state.currentIndex * 100}%, 0, 0)`;
    }

    updateSlideStates(state);
    updateCounters(state);
  }

  function fadeToSlide(state, targetIndex, immediate) {
    const previousIndex = state.currentIndex;

    if (immediate || targetIndex === previousIndex) {
      state.currentIndex = targetIndex;
      updateSlideStates(state);
      updateCounters(state);
      return;
    }

    state.isAnimating = true;

    state.slides.forEach((slide, index) => {
      if (index === previousIndex) {
        slide.style.transitionDuration = `${FADE_OUT_DURATION}ms`;
        slide.style.transitionDelay = '0ms';
        slide.style.opacity = '0';
        return;
      }

      if (index === targetIndex) {
        slide.style.transitionDuration = `${FADE_DURATION}ms`;
        slide.style.transitionDelay = `${FADE_IN_DELAY}ms`;
        slide.style.opacity = '1';
        return;
      }

      slide.style.transitionDelay = '0ms';
      slide.style.opacity = '0';
    });

    window.setTimeout(() => {
      state.currentIndex = targetIndex;
      updateSlideStates(state);
      updateCounters(state);
      state.isAnimating = false;
    }, FADE_DURATION + FADE_IN_DELAY);
  }

  function updateSlideStates(state) {
    state.slides.forEach((slide, index) => {
      const isActive = index === state.currentIndex;

      if (state.mode === 'fade') {
        slide.style.transitionDuration = isActive ? `${FADE_DURATION}ms` : `${FADE_OUT_DURATION}ms`;
        slide.style.transitionDelay = '0ms';
        slide.style.opacity = isActive ? '1' : '0';
      }

      slide.classList.toggle(ACTIVE_CLASS, isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.style.pointerEvents = isActive ? '' : 'none';
      updateFocusableElements(slide, isActive);
    });
  }

  function showSingleSlide(state) {
    const slide = state.slides[0];

    slide.classList.add(ACTIVE_CLASS);
    slide.setAttribute('aria-hidden', 'false');

    state.prevControls.concat(state.nextControls).forEach(control => {
      control.classList.add(DISABLED_CLASS);
      control.setAttribute('aria-disabled', 'true');
      control.setAttribute('tabindex', '-1');
    });

    state.slider.querySelectorAll(VISUAL_CONTROLS_SELECTOR).forEach(element => {
      element.hidden = true;
      element.style.display = 'none';
    });

    state.slider.querySelectorAll(VISUAL_COUNT_SELECTOR).forEach(element => {
      element.hidden = true;
      element.style.display = 'none';
    });
  }

  function updateCounters(state) {
    const current = formatCount(state.currentIndex + 1);
    const total = formatCount(state.total);

    state.slider.querySelectorAll(CURRENT_COUNT_SELECTOR).forEach(element => {
      element.textContent = current;
    });

    state.slider.querySelectorAll(TOTAL_COUNT_SELECTOR).forEach(element => {
      element.textContent = total;
    });
  }

  function updateFocusableElements(slide, isActive) {
    slide.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach(element => {
      if (isActive) {
        const originalTabindex = element.getAttribute('data-cs-original-tabindex');

        if (originalTabindex === null || originalTabindex === '') {
          element.removeAttribute('tabindex');
        } else {
          element.setAttribute('tabindex', originalTabindex);
        }

        return;
      }

      if (!element.hasAttribute('data-cs-original-tabindex')) {
        element.setAttribute('data-cs-original-tabindex', element.getAttribute('tabindex') || '');
      }

      element.setAttribute('tabindex', '-1');
    });
  }

  function wrapIndex(index, total) {
    return (index + total) % total;
  }

  function formatCount(number) {
    return String(number).padStart(2, '0');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
