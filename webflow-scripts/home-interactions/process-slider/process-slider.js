// Process Slider
(() => {
  const ROOT_SELECTOR = '[data-steps-slider]';
  const INTRO_SELECTOR = '[data-steps-intro]';
  const STAGE_SELECTOR = '[data-steps-stage]';
  const PIN_SELECTOR = '[data-steps-pin]';
  const VIEWPORT_SELECTOR = '[data-steps-viewport]';
  const TRACK_SELECTOR = '[data-steps-track]';
  const ITEM_SELECTOR = '[data-steps-item]';
  const CARD_SELECTOR = '[data-steps-card]';
  const SUMMARY_SELECTOR = '[data-steps-summary]';
  const TOGGLE_SELECTOR = '[data-steps-toggle]';
  const REVEAL_SELECTOR = '[data-steps-reveal]';
  const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

  const READY_CLASS = 'is-steps-ready';
  const OPEN_CLASS = 'is-open';
  const MOTION_BREAKPOINT_PX = 992;
  const DESKTOP_QUERY = `(min-width: ${MOTION_BREAKPOINT_PX}px) and (prefers-reduced-motion: no-preference)`;
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const RESIZE_REFRESH_DELAY_MS = 160;
  const REVEAL_SCROLL_DELAY_MS = 380;
  const REVEAL_SCROLL_PADDING = 48;
  const MIN_PIN_OFFSET = 32;
  const LOW_VIEWPORT_SAFE_TOP = 96;
  const LOW_VIEWPORT_SAFE_BOTTOM = 32;

  const HOLD_DISTANCE = {
    introMin: 240,
    introVh: 0.32,
    introMax: 420,
    finalMin: 180,
    finalVh: 0.22,
    finalMax: 320,
  };

  let resizeTimer = null;
  let warnedMissingStructure = false;
  let state = null;

  window.ProcessSlider = {
    refresh: refreshProcessSlider,
  };

  onMotionReady(initProcessSlider);
  window.addEventListener('resize', queueRefresh);

  function onMotionReady(callback) {
    if (window.ContextualHomeMotion?.ready) {
      window.ContextualHomeMotion.ready.then(callback);
      return;
    }

    const runWhenMotionStateIsKnown = () => {
      if (window.ContextualHomeMotion?.ready) {
        window.ContextualHomeMotion.ready.then(callback);
      } else {
        callback();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runWhenMotionStateIsKnown, { once: true });
    } else {
      requestAnimationFrame(runWhenMotionStateIsKnown);
    }
  }

  function initProcessSlider() {
    if (state) return;

    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    const nextState = collectState(root);
    if (!nextState) return;

    state = nextState;
    prepareAccordion(state);
    setupResponsiveAnimation(state);
  }

  function collectState(root) {
    const intro = root.querySelector(INTRO_SELECTOR);
    const stage = root.querySelector(STAGE_SELECTOR);
    const pin = stage ? stage.querySelector(PIN_SELECTOR) : null;
    const viewport = pin ? pin.querySelector(VIEWPORT_SELECTOR) : null;
    const track = viewport ? viewport.querySelector(TRACK_SELECTOR) : null;
    const items = track ? Array.from(track.children).filter(item => item.matches(ITEM_SELECTOR)) : [];
    const steps = collectSteps(items);

    if (!intro || !stage || !pin || !viewport || !track || items.length === 0 || steps.length === 0) {
      warnMissingStructure();
      return null;
    }

    return {
      root,
      intro,
      stage,
      pin,
      viewport,
      track,
      items,
      steps,
      matchMedia: null,
      timeline: null,
      scrollTrigger: null,
    };
  }

  function collectSteps(items) {
    return items
      .map((item, index) => {
        const card = item.querySelector(CARD_SELECTOR);
        const summary = card ? card.querySelector(SUMMARY_SELECTOR) : null;
        const toggle = card ? card.querySelector(TOGGLE_SELECTOR) : null;
        const reveal = card ? card.querySelector(REVEAL_SELECTOR) : null;

        if (!card || !summary || !toggle || !reveal) return null;

        return { item, card, summary, toggle, reveal, index };
      })
      .filter(Boolean);
  }

  function warnMissingStructure() {
    if (warnedMissingStructure) return;

    warnedMissingStructure = true;
    console.warn('[process-slider] Missing required data-steps structure. Expected data-steps-intro, data-steps-stage, data-steps-pin, data-steps-viewport, data-steps-track, data-steps-item, data-steps-card, data-steps-summary, data-steps-reveal, and data-steps-toggle.');
  }

  function prepareAccordion(state) {
    state.steps.forEach((step) => {
      prepareReveal(step);
      prepareToggle(step, state);
      closeStep(step);
    });
  }

  function prepareReveal(step) {
    if (!step.reveal.id) {
      step.reveal.id = `process-step-reveal-${step.index + 1}`;
    }

    if (!step.reveal.hasAttribute('role')) {
      step.reveal.setAttribute('role', 'button');
    }

    if (!step.reveal.hasAttribute('aria-label')) {
      step.reveal.setAttribute('aria-label', 'Close process step details');
    }

    step.reveal.addEventListener('click', (event) => handleRevealClick(event, step));
    step.reveal.addEventListener('keydown', (event) => handleRevealKeydown(event, step));
  }

  function prepareToggle(step, state) {
    step.toggle.type = 'button';
    step.toggle.setAttribute('aria-controls', step.reveal.id);
    step.toggle.addEventListener('click', (event) => handleToggleClick(event, step, state));
  }

  function handleToggleClick(event, step, state) {
    const shouldOpen = !step.card.classList.contains(OPEN_CLASS);

    closeOtherSteps(step, state);

    if (shouldOpen) {
      openStep(step);
      preserveKeyboardFocus(event, step);
      requestRevealVisibilityCheck(step, state);
    } else {
      closeStep(step);
    }
  }

  function handleRevealClick(event, step) {
    if (!step.card.classList.contains(OPEN_CLASS) || isInteractiveElement(event.target, step.reveal)) return;

    closeStep(step);
  }

  function handleRevealKeydown(event, step) {
    if (!step.card.classList.contains(OPEN_CLASS) || !isActivationKey(event)) return;

    event.preventDefault();
    closeStep(step);
    step.toggle.focus({ preventScroll: true });
  }

  function openStep(step) {
    setStepOpen(step, true);
  }

  function closeStep(step) {
    setStepOpen(step, false);
  }

  function closeOtherSteps(activeStep, state) {
    state.steps.forEach((step) => {
      if (step !== activeStep) {
        closeStep(step);
      }
    });
  }

  function setStepOpen(step, isOpen) {
    step.card.classList.toggle(OPEN_CLASS, isOpen);
    step.toggle.classList.toggle(OPEN_CLASS, isOpen);
    step.toggle.setAttribute('aria-expanded', String(isOpen));
    step.toggle.toggleAttribute('hidden', isOpen);
    step.reveal.tabIndex = isOpen ? 0 : -1;
    step.reveal.setAttribute('aria-hidden', String(!isOpen));
  }

  function preserveKeyboardFocus(event, step) {
    if (event.detail !== 0) return;

    step.reveal.focus({ preventScroll: true });
  }

  function isInteractiveElement(target, container) {
    if (!(target instanceof Element)) return false;

    const interactiveElement = target.closest(INTERACTIVE_SELECTOR);

    return Boolean(interactiveElement && interactiveElement !== container && container.contains(interactiveElement));
  }

  function isActivationKey(event) {
    return event.key === 'Enter' || event.key === ' ';
  }

  function requestRevealVisibilityCheck(step, state) {
    window.setTimeout(() => ensureRevealVisible(step, state), REVEAL_SCROLL_DELAY_MS);
  }

  function ensureRevealVisible(step, state) {
    if (!step.card.classList.contains(OPEN_CLASS) || isHorizontalPinActive(state)) return;

    const revealRect = step.reveal.getBoundingClientRect();
    const bottomOverflow = revealRect.bottom + REVEAL_SCROLL_PADDING - window.innerHeight;
    const topOverflow = REVEAL_SCROLL_PADDING - revealRect.top;
    const scrollDelta = bottomOverflow > 0 ? bottomOverflow : -Math.max(topOverflow, 0);

    if (scrollDelta === 0) return;

    scrollBy({
      top: scrollDelta,
      left: 0,
      behavior: getScrollBehavior(),
    });
  }

  function scrollBy(options) {
    if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.scrollBy === 'function') {
      window.ContextualHomeMotion.scrollBy(options);
      return;
    }

    window.scrollBy(options);
  }

  function getScrollBehavior() {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches ? 'auto' : 'smooth';
  }

  function isHorizontalPinActive(state) {
    return Boolean(state.scrollTrigger && state.scrollTrigger.isActive);
  }

  function setupResponsiveAnimation(state) {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    if (!gsap || !ScrollTrigger || !gsap.matchMedia) {
      setStaticState(state);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (state.matchMedia) {
      state.matchMedia.revert();
    }

    setStaticState(state);

    state.matchMedia = gsap.matchMedia();
    state.matchMedia.add(DESKTOP_QUERY, () => createDesktopAnimation(state, gsap));
  }

  function createDesktopAnimation(state, gsap) {
    setDesktopState(state);

    const horizontalDistance = getHorizontalDistance(state);
    if (horizontalDistance <= 0) {
      gsap.set(state.track, { clearProps: 'transform' });
      return () => clearDesktopState(state, gsap);
    }

    const introHold = getIntroHoldDistance();
    const finalHold = getFinalHoldDistance();
    const scrollDistance = introHold + horizontalDistance + finalHold;
    const timeline = gsap.timeline({
      defaults: {
        ease: 'none',
      },
      scrollTrigger: {
        trigger: state.pin,
        start: () => `top ${getPinStartOffset(state)}px`,
        end: () => `+=${scrollDistance}`,
        scrub: true,
        pin: state.pin,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline.to({}, {
      duration: introHold,
    });

    timeline.to(state.track, {
      x: -horizontalDistance,
      duration: horizontalDistance,
    });

    timeline.to({}, {
      duration: finalHold,
    });

    state.timeline = timeline;
    state.scrollTrigger = timeline.scrollTrigger;
    const scrollTrigger = timeline.scrollTrigger;

    return () => {
      if (scrollTrigger) {
        scrollTrigger.kill();
      }

      timeline.kill();

      if (state.timeline === timeline) {
        state.timeline = null;
      }

      if (state.scrollTrigger === scrollTrigger) {
        state.scrollTrigger = null;
      }

      clearDesktopState(state, gsap);
    };
  }

  function setDesktopState(state) {
    state.root.classList.add(READY_CLASS);
  }

  function setStaticState(state) {
    state.root.classList.remove(READY_CLASS);
    state.track.style.transform = '';
  }

  function clearDesktopState(state, gsap) {
    state.root.classList.remove(READY_CLASS);
    gsap.set(state.track, { clearProps: 'transform' });
  }

  function getHorizontalDistance(state) {
    const lastItem = state.items[state.items.length - 1];
    const lastItemRight = lastItem.offsetLeft + lastItem.offsetWidth;
    const visibleWidth = state.viewport.clientWidth;

    return Math.max(0, Math.ceil(lastItemRight - visibleWidth));
  }

  function getPinStartOffset(state) {
    const pinHeight = getPinnedVisualHeight(state);
    const centeredOffset = Math.round((window.innerHeight - pinHeight) / 2);
    const safeTop = Math.max(
      MIN_PIN_OFFSET,
      getCssPixelValue(state.root, '--steps-pin-safe-top', LOW_VIEWPORT_SAFE_TOP)
    );
    const safeBottom = getCssPixelValue(state.root, '--steps-pin-safe-bottom', LOW_VIEWPORT_SAFE_BOTTOM);
    const maxSafeOffset = Math.max(safeTop, window.innerHeight - pinHeight - safeBottom);

    return Math.min(Math.max(centeredOffset, safeTop), maxSafeOffset);
  }

  function getPinnedVisualHeight(state) {
    const pinHeight = state.pin.getBoundingClientRect().height;
    const viewportHeight = state.viewport.getBoundingClientRect().height;
    const firstCardHeight = state.steps[0]?.card.getBoundingClientRect().height || 0;

    return Math.max(1, pinHeight || viewportHeight || firstCardHeight || window.innerHeight);
  }

  function getIntroHoldDistance() {
    return clamp(
      window.innerHeight * HOLD_DISTANCE.introVh,
      HOLD_DISTANCE.introMin,
      HOLD_DISTANCE.introMax
    );
  }

  function getFinalHoldDistance() {
    return clamp(
      window.innerHeight * HOLD_DISTANCE.finalVh,
      HOLD_DISTANCE.finalMin,
      HOLD_DISTANCE.finalMax
    );
  }

  function getCssPixelValue(element, property, fallback) {
    const value = parseFloat(getComputedStyle(element).getPropertyValue(property));

    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function refreshProcessSlider(options = {}) {
    initProcessSlider();

    if (state) {
      setupResponsiveAnimation(state);
    }

    if (!options.skipGlobalRefresh) {
      requestGlobalRefresh();
    }
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshProcessSlider, RESIZE_REFRESH_DELAY_MS);
  }

  function requestGlobalRefresh() {
    if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.requestRefresh === 'function') {
      window.ContextualHomeMotion.requestRefresh();
      return;
    }

    if (window.ScrollTrigger) {
      window.ScrollTrigger.sort?.();
      window.ScrollTrigger.refresh(true);
    }
  }
})();
