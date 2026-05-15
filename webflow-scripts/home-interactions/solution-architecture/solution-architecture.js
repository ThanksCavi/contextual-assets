// Solution Architecture
(() => {
  const ROOT_SELECTOR = '[data-sa-root]';
  const PIN_SELECTOR = '[data-sa-pin]';
  const STAGE_SELECTOR = '[data-sa-stage]';
  const STICKY_SELECTOR = '[data-sa-sticky]';
  const SCENE_SELECTOR = '[data-sa-scene]';
  const PANEL_SELECTOR = '[data-sa-panel]';
  const CARD_SELECTOR = '[data-sa-card]';
  const LINE_SELECTOR = '[data-sa-line]';
  const INTRO_SELECTOR = '[data-sa-intro]';
  const OUTCOME_SELECTOR = '[data-sa-outcome]';
  const OUTCOME_CARD_SELECTOR = '[data-sa-outcome-card]';
  const END_ARROW_SELECTOR = '[data-sa-end-arrow]';
  const INTRO_ARROW_EMBED_SELECTOR = '.sa-intro-arrow-embed';
  const INTRO_ARROW_SELECTOR = '.sa-intro-arrow';
  const FINAL_CONTENT_SELECTOR = '[data-sa-final-content]';
  const FINAL_REVEAL_SELECTOR = '[data-sa-card-description]';
  const MEDIA_SELECTOR = '[data-sa-media]';
  const FOCUSABLE_SELECTOR = 'a, button, input, select, textarea, [tabindex]';

  const READY_CLASS = 'is-sa-ready';
  const STATIC_CLASS = 'is-sa-static';
  const INITIAL_CLASS = 'is-sa-initial';
  const TRANSITION_CLASS = 'is-sa-transition';
  const FINAL_CLASS = 'is-sa-final';
  const DISABLED_FOCUS_CLASS = 'is-sa-focus-disabled';
  const ORIGINAL_TABINDEX_ATTRIBUTE = 'data-sa-original-tabindex';
  const TARGET_OPACITY_ATTRIBUTE = 'data-sa-target-opacity';
  const INTRO_LINE_VALUE = 'intro-arrow';
  const FINAL_LINE_VALUE = 'final-arrow';

  const MOTION_BREAKPOINT_PX = 992;
  const DESKTOP_QUERY = `(min-width: ${MOTION_BREAKPOINT_PX}px) and (prefers-reduced-motion: no-preference)`;
  const RESIZE_REFRESH_DELAY_MS = 160;
  const MIN_SCENE_PIN_OFFSET = 32;
  const LOW_VIEWPORT_SAFE_OFFSET = 96;
  const BLUE_CARD_OVERLAY_OPACITY = 0.42;

  const SCROLL_DISTANCE = {
    viewportMultiplier: 2.45,
    widthMultiplier: 1.45,
    minimum: 1500,
  };

  const INTRO_FADE = {
    start: 'top 58%',
    end: 'top 0%',
    yMin: 56,
    yVh: 0.08,
    yMax: 88,
  };

  const TIMING = {
    branchDraw: { start: 0.04, duration: 0.24, arrowheadStart: 0.24, arrowheadDuration: 0.10 },
    blueCardsExit: { start: 0.36, duration: 0.46 },
    branchFade: { start: 0.72, duration: 0.16 },
    finalCard: { start: 0.24, duration: 0.62 },
    finalContent: { start: 0.34, duration: 0.56, startX: 90, startOpacity: 0.72 },
    sourceOverlay: { start: 0.48, duration: 0.25 },
    finalReveal: { start: 0.58, duration: 0.24 },
    finalMedia: { start: 0.64, duration: 0.30, startOpacity: 0.72, startScale: 0.92, startRotation: -4 },
    finalArrow: { start: 0.92, duration: 0.16, arrowheadStart: 1.05, arrowheadDuration: 0.05 },
    finalHold: { start: 0.94, duration: 0.11 },
    outcomeCard: { start: 'top 92%', end: 'bottom 18%', y: 96, opacityDuration: 0.35, moveDuration: 1.00 },
  };

  const LAYOUT = {
    width: 1280,
    height: 473,
    finalEnd: { left: 0, top: 0, width: 1280, height: 473 },
    stackedExitX: -1300,
  };

  const CARD_ROLE_ALIASES = {
    source: ['source', 'invoice'],
    top: ['top', 'cost'],
    bottom: ['bottom', 'fleet'],
    final: ['final', 'flywheel'],
  };

  const instances = [];
  let resizeTimer = null;

  window.addEventListener('resize', queueRefresh);

  window.SolutionArchitecture = {
    refresh: refreshAll,
  };

  onMotionReady(initAll);

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

  function initAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(initRoot);
  }

  function initRoot(root) {
    if (instances.some(instance => instance.root === root)) return;

    const stage = root.querySelector(STAGE_SELECTOR);
    const sticky = root.querySelector(STICKY_SELECTOR);
    const scene = root.querySelector(SCENE_SELECTOR);
    const panel = root.querySelector(PANEL_SELECTOR);
    const pinFrame = root.querySelector(PIN_SELECTOR);

    if (!stage || !sticky || !scene || !panel || !pinFrame) {
      console.warn('[solution-architecture] Missing required data-sa structure. Expected data-sa-stage, data-sa-sticky, data-sa-pin, data-sa-scene, and data-sa-panel.');
      return;
    }

    const cards = collectCards(panel);

    if (!hasRequiredCards(cards)) return;

    const state = {
      root,
      stage,
      sticky,
      scene,
      pinFrame,
      intro: root.querySelector(INTRO_SELECTOR),
      panel,
      cards,
      outcome: root.querySelector(OUTCOME_SELECTOR),
      outcomeCard: null,
      endArrow: null,
      introArrow: root.querySelector(INTRO_ARROW_EMBED_SELECTOR) || root.querySelector(INTRO_ARROW_SELECTOR),
      finalContent: null,
      media: null,
      lines: Array.from(root.querySelectorAll(LINE_SELECTOR)),
      focusables: collectFocusableCards(cards),
      matchMedia: null,
      timeline: null,
      introTween: null,
      introLineTween: null,
      outcomeCardTween: null,
      phase: '',
    };

    state.outcomeCard = state.outcome ? state.outcome.querySelector(OUTCOME_CARD_SELECTOR) : null;
    state.endArrow = pinFrame ? pinFrame.querySelector(END_ARROW_SELECTOR) : null;
    state.finalContent = state.cards.final.querySelector(FINAL_CONTENT_SELECTOR);
    state.media = state.cards.final.querySelector(MEDIA_SELECTOR);

    if (!state.endArrow && root.querySelector(END_ARROW_SELECTOR)) {
      console.warn('[solution-architecture] Expected [data-sa-end-arrow] inside [data-sa-pin]. Final arrow animation is disabled for this section.');
    }

    if (!state.finalContent) {
      console.warn('[solution-architecture] Expected [data-sa-final-content] inside the final card. Final-card inner parallax is disabled for this section.');
    }

    instances.push(state);
    setStaticState(state);
    setupResponsiveAnimation(state);
  }

  function collectCards(panel) {
    const found = Array.from(panel.children).filter(card => card.matches(CARD_SELECTOR));

    return Object.keys(CARD_ROLE_ALIASES).reduce((cards, role) => {
      cards[role] = findCardByRole(found, role);
      return cards;
    }, {});
  }

  function findCardByRole(cards, role) {
    const aliases = CARD_ROLE_ALIASES[role] || [];

    return cards.find(card => aliases.includes(card.getAttribute('data-sa-card'))) || null;
  }

  function hasRequiredCards(cards) {
    return Boolean(cards.source && cards.top && cards.bottom && cards.final);
  }

  function collectFocusableCards(cards) {
    return Object.keys(cards).flatMap(cardName => (
      Array.from(cards[cardName].querySelectorAll(FOCUSABLE_SELECTOR)).map(element => ({
        cardName,
        element,
      }))
    ));
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

    state.matchMedia = gsap.matchMedia();
    state.matchMedia.add(DESKTOP_QUERY, () => createDesktopAnimation(state, gsap));
  }

  function createDesktopAnimation(state, gsap) {
    const branchLines = getBranchLines(state);
    const branchArrowheads = getBranchArrowheads(state);
    const finalArrowLines = getFinalArrowLines(state);
    const finalArrowheads = getEndArrowheads(state);
    const finalReveal = Array.from(state.cards.final.querySelectorAll(FINAL_REVEAL_SELECTOR));

    setDesktopState(state);

    const pinTarget = getPinTarget(state);

    prepareLines(state, gsap);
    prepareBranchArrowheads(branchArrowheads, gsap);
    if (state.endArrow) {
      prepareFinalArrow(finalArrowLines, finalArrowheads, gsap);
    }
    createIntroFade(state, gsap);
    createIntroArrowReveal(state, gsap);
    createOutcomeReveal(state, gsap);

    const timeline = gsap.timeline({
      defaults: {
        ease: 'none',
      },
      scrollTrigger: {
        trigger: pinTarget,
        start: () => getPinStart(state, pinTarget),
        end: () => `+=${getScrollDistance(state)}`,
        scrub: true,
        pin: pinTarget,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: self => updatePhaseFromProgress(state, self.progress),
        onRefresh: self => {
          updatePhaseFromProgress(state, self.progress);
        },
      },
    });

    state.timeline = timeline;

    timeline.set(state.cards.final, getFinalCardStartState(state), 0);
    if (state.finalContent) {
      timeline.set(state.finalContent, {
        autoAlpha: TIMING.finalContent.startOpacity,
        x: () => getScaledX(state, TIMING.finalContent.startX),
      }, 0);
    }
    timeline.set(finalReveal, {
      autoAlpha: 0,
    }, 0);
    timeline.set([state.cards.source, state.cards.top, state.cards.bottom], {
      autoAlpha: 1,
      x: 0,
      scale: 1,
    }, 0);
    timeline.set([state.cards.top, state.cards.bottom, state.cards.source], {
      '--sa-blue-overlay-opacity': 0,
    }, 0);

    if (state.media) {
      timeline.set(state.media, {
        autoAlpha: TIMING.finalMedia.startOpacity,
        scale: TIMING.finalMedia.startScale,
        rotation: TIMING.finalMedia.startRotation,
        transformOrigin: '50% 50%',
      }, 0);
    }

    if (branchLines.length > 0) {
      timeline.to(branchLines, {
        strokeDashoffset: 0,
        duration: TIMING.branchDraw.duration,
        ease: 'power2.out',
      }, TIMING.branchDraw.start);

      if (branchArrowheads.length > 0) {
        timeline.to(branchArrowheads, {
          autoAlpha: 1,
          duration: TIMING.branchDraw.arrowheadDuration,
        }, TIMING.branchDraw.arrowheadStart);
      }
    }

    timeline.to([state.cards.top, state.cards.bottom], {
      x: () => getScaledX(state, LAYOUT.stackedExitX),
      '--sa-blue-overlay-opacity': BLUE_CARD_OVERLAY_OPACITY,
      duration: TIMING.blueCardsExit.duration,
      ease: 'power1.inOut',
    }, TIMING.blueCardsExit.start);

    if (branchLines.length > 0 || branchArrowheads.length > 0) {
      timeline.to([...branchLines, ...branchArrowheads], {
        autoAlpha: 0,
        duration: TIMING.branchFade.duration,
      }, TIMING.branchFade.start);
    }

    timeline.to(state.cards.final, {
      x: 0,
      duration: TIMING.finalCard.duration,
      ease: 'power1.inOut',
    }, TIMING.finalCard.start);

    if (state.finalContent) {
      timeline.to(state.finalContent, {
        autoAlpha: 1,
        x: 0,
        duration: TIMING.finalContent.duration,
        ease: 'power1.inOut',
      }, TIMING.finalContent.start);
    }

    timeline.to(state.cards.source, {
      '--sa-blue-overlay-opacity': BLUE_CARD_OVERLAY_OPACITY,
      duration: TIMING.sourceOverlay.duration,
      ease: 'power1.inOut',
    }, TIMING.sourceOverlay.start);

    timeline.to(finalReveal, {
      autoAlpha: 1,
      duration: TIMING.finalReveal.duration,
      ease: 'power2.out',
    }, TIMING.finalReveal.start);

    if (state.media) {
      timeline.to(state.media, {
        autoAlpha: 1,
        scale: 1,
        rotation: 0,
        duration: TIMING.finalMedia.duration,
        ease: 'power2.out',
      }, TIMING.finalMedia.start);
    }

    if (finalArrowLines.length > 0) {
      timeline.to(finalArrowLines, {
        opacity: (_, target) => getStoredTargetOpacity(target),
        strokeDashoffset: 0,
        duration: TIMING.finalArrow.duration,
        ease: 'power2.out',
      }, TIMING.finalArrow.start);

      if (finalArrowheads.length > 0) {
        timeline.to(finalArrowheads, {
          opacity: (_, target) => getStoredTargetOpacity(target),
          duration: TIMING.finalArrow.arrowheadDuration,
          ease: 'power2.out',
        }, TIMING.finalArrow.arrowheadStart);
      }
    }

    timeline.to({}, {
      duration: TIMING.finalHold.duration,
    }, TIMING.finalHold.start);

    setPhase(state, 'initial');

    return () => {
      if (timeline.scrollTrigger) {
        timeline.scrollTrigger.kill();
      }

      timeline.kill();

      if (state.introTween) {
        if (state.introTween.scrollTrigger) {
          state.introTween.scrollTrigger.kill();
        }

        state.introTween.kill();
        state.introTween = null;
      }

      if (state.introLineTween) {
        if (state.introLineTween.scrollTrigger) {
          state.introLineTween.scrollTrigger.kill();
        }

        state.introLineTween.kill();
        state.introLineTween = null;
      }

      if (state.outcomeCardTween) {
        if (state.outcomeCardTween.scrollTrigger) {
          state.outcomeCardTween.scrollTrigger.kill();
        }

        state.outcomeCardTween.kill();
        state.outcomeCardTween = null;
      }

      if (state.timeline === timeline) {
        state.timeline = null;
      }

      clearDesktopState(state, gsap);
    };
  }

  function getFinalCardStartState(state) {
    const layout = getFinalCardLayout(state);

    return {
      autoAlpha: 1,
      x: getScaledX(state, LAYOUT.width - LAYOUT.finalEnd.left + 10), // safety padding
      left: `${layout.end.left}px`,
      top: `${layout.end.top}px`,
      width: `${layout.end.width}px`,
      height: `${layout.end.height}px`,
      zIndex: 4,
    };
  }

  function getFinalCardLayout(state) {
    return {
      end: scaleBox(state, LAYOUT.finalEnd),
    };
  }

  function scaleBox(state, box) {
    const rect = state.panel.getBoundingClientRect();
    const scaleX = rect.width / LAYOUT.width;
    const scaleY = rect.height / LAYOUT.height;

    return {
      left: box.left * scaleX,
      top: box.top * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };
  }

  function getScaledX(state, value) {
    return value * (state.panel.getBoundingClientRect().width / LAYOUT.width);
  }

  function getScrollDistance(state) {
    const sceneWidth = state.panel.getBoundingClientRect().width || window.innerWidth;

    return Math.max(
      window.innerHeight * SCROLL_DISTANCE.viewportMultiplier,
      sceneWidth * SCROLL_DISTANCE.widthMultiplier,
      SCROLL_DISTANCE.minimum
    );
  }

  function getPinTarget(state) {
    return state.pinFrame;
  }

  function getPinStart(state, pinTarget) {
    return `top ${getScenePinOffset(state, pinTarget)}px`;
  }

  function getScenePinOffset(state, pinTarget) {
    const sceneHeight = getPinnedVisualHeight(state, pinTarget);
    const centeredOffset = Math.round((window.innerHeight - sceneHeight) / 2);
    const safeOffset = getCssPixelValue(state.root, '--sa-pin-safe-top', LOW_VIEWPORT_SAFE_OFFSET);

    return Math.max(MIN_SCENE_PIN_OFFSET, safeOffset, centeredOffset);
  }

  function getPinnedVisualHeight(state, pinTarget) {
    const sceneHeight = state.scene.getBoundingClientRect().height;
    const panelHeight = state.panel.getBoundingClientRect().height;
    const pinHeight = pinTarget.getBoundingClientRect().height;

    return Math.max(1, sceneHeight || panelHeight || pinHeight || window.innerHeight);
  }

  function getCssPixelValue(element, property, fallback) {
    const value = parseFloat(getComputedStyle(element).getPropertyValue(property));

    return Number.isFinite(value) ? value : fallback;
  }

  function getIntroFadeY() {
    return -clamp(
      window.innerHeight * INTRO_FADE.yVh,
      INTRO_FADE.yMin,
      INTRO_FADE.yMax
    );
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function prepareLines(state, gsap) {
    state.lines.forEach(line => {
      const length = getLineLength(line);
      const targetOpacity = storeTargetOpacity(line);
      const lineType = line.getAttribute('data-sa-line');
      const shouldStartHidden = lineType === FINAL_LINE_VALUE || lineType === INTRO_LINE_VALUE;

      line.setAttribute('aria-hidden', 'true');
      line.style.pointerEvents = 'none';

      if (length > 0) {
        gsap.set(line, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: shouldStartHidden ? 0 : targetOpacity,
          visibility: 'visible',
        });
      }
    });
  }

  function prepareBranchArrowheads(arrowheads, gsap) {
    if (arrowheads.length > 0) {
      gsap.set(arrowheads, { autoAlpha: 0 });
    }
  }

  function prepareFinalArrow(lines, arrowheads, gsap) {
    lines.forEach(line => {
      const length = getLineLength(line);
      storeTargetOpacity(line);

      line.setAttribute('aria-hidden', 'true');
      line.style.pointerEvents = 'none';

      if (length > 0) {
        gsap.set(line, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: 0,
          visibility: 'visible',
        });
      }
    });

    arrowheads.forEach(arrowhead => {
      storeTargetOpacity(arrowhead);
      gsap.set(arrowhead, {
        opacity: 0,
        visibility: 'visible',
      });
    });
  }

  function createIntroFade(state, gsap) {
    if (!state.intro) return;

    const tween = gsap.to(state.intro, {
      autoAlpha: 0,
      y: () => getIntroFadeY(),
      ease: 'power1.out',
      scrollTrigger: {
        trigger: state.pinFrame,
        start: INTRO_FADE.start,
        end: INTRO_FADE.end,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    state.introTween = tween;
  }

  function createIntroArrowReveal(state, gsap) {
    if (!state.introArrow) return;

    const lines = Array.from(state.introArrow.querySelectorAll(`[data-sa-line="${INTRO_LINE_VALUE}"]`));
    if (lines.length === 0) return;

    const arrowheads = Array.from(state.introArrow.querySelectorAll('.sa-arrowhead'));

    lines.forEach(line => {
      storeTargetOpacity(line);
      gsap.set(line, {
        opacity: 0,
        visibility: 'visible',
      });
    });

    arrowheads.forEach(arrowhead => {
      storeTargetOpacity(arrowhead);
      gsap.set(arrowhead, {
        opacity: 0,
        visibility: 'visible',
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: state.introArrow,
        start: 'top 86%',
        end: 'bottom 58%',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    tl.to(lines, {
      opacity: (_, target) => getStoredTargetOpacity(target),
      strokeDashoffset: 0,
      duration: 0.9,
      ease: 'power2.out',
    }, 0);

    if (arrowheads.length > 0) {
      tl.to(arrowheads, {
        opacity: (_, target) => getStoredTargetOpacity(target),
        duration: 0.2,
        ease: 'power2.out',
      }, 0.72);
    }

    state.introLineTween = tl;
  }

  function createOutcomeReveal(state, gsap) {
    if (!state.outcome || !state.outcomeCard) return;

    gsap.set(state.outcome, { autoAlpha: 1 });
    gsap.set(state.outcomeCard, { autoAlpha: 0, y: TIMING.outcomeCard.y });

    const cardTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: state.outcomeCard,
        start: TIMING.outcomeCard.start,
        end: TIMING.outcomeCard.end,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    state.outcomeCardTween = cardTimeline;

    cardTimeline.to(state.outcomeCard, {
      autoAlpha: 1,
      duration: TIMING.outcomeCard.opacityDuration,
      ease: 'power2.out',
    }, 0);

    cardTimeline.to(state.outcomeCard, {
      y: 0,
      duration: TIMING.outcomeCard.moveDuration,
      ease: 'power2.out',
    }, 0);
  }

  function getLineLength(line) {
    try {
      return typeof line.getTotalLength === 'function' ? line.getTotalLength() : 0;
    } catch (error) {
      return 0;
    }
  }

  function getElementOpacity(element) {
    const opacity = parseFloat(window.getComputedStyle(element).opacity);

    return Number.isFinite(opacity) ? opacity : 1;
  }

  function storeTargetOpacity(element) {
    if (element.hasAttribute(TARGET_OPACITY_ATTRIBUTE)) {
      return getStoredTargetOpacity(element);
    }

    const targetOpacity = getElementOpacity(element);

    element.setAttribute(TARGET_OPACITY_ATTRIBUTE, String(targetOpacity));
    return targetOpacity;
  }

  function getStoredTargetOpacity(element) {
    const opacity = parseFloat(element.getAttribute(TARGET_OPACITY_ATTRIBUTE));

    return Number.isFinite(opacity) ? opacity : 1;
  }

  function updatePhaseFromProgress(state, progress) {
    if (progress >= 0.76) {
      setPhase(state, 'final');
      return;
    }

    if (progress >= 0.34) {
      setPhase(state, 'transition');
      return;
    }

    setPhase(state, 'initial');
  }

  function setPhase(state, phase) {
    if (state.phase === phase) return;

    state.phase = phase;
    state.root.classList.remove(INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS, STATIC_CLASS);

    if (phase === 'initial') {
      state.root.classList.add(INITIAL_CLASS);
      setVisibleCards(state, new Set(['source', 'top', 'bottom']));
      return;
    }

    if (phase === 'transition') {
      state.root.classList.add(TRANSITION_CLASS);
      setVisibleCards(state, new Set(['source', 'top', 'bottom', 'final']));
      return;
    }

    if (phase === 'final') {
      state.root.classList.add(FINAL_CLASS);
      setVisibleCards(state, new Set(['final']));
      return;
    }

    state.root.classList.add(STATIC_CLASS);
    setVisibleCards(state, null);
  }

  function setVisibleCards(state, visibleCards) {
    state.focusables.forEach(({ cardName, element }) => {
      const isVisible = !visibleCards || visibleCards.has(cardName);

      setElementFocusable(element, isVisible);
    });
  }

  function setElementFocusable(element, isFocusable) {
    if (isFocusable) {
      const originalTabindex = element.getAttribute(ORIGINAL_TABINDEX_ATTRIBUTE);

      element.classList.remove(DISABLED_FOCUS_CLASS);
      element.removeAttribute('aria-hidden');

      if (originalTabindex === null) return;

      if (originalTabindex === '') {
        element.removeAttribute('tabindex');
      } else {
        element.setAttribute('tabindex', originalTabindex);
      }

      return;
    }

    if (!element.hasAttribute(ORIGINAL_TABINDEX_ATTRIBUTE)) {
      element.setAttribute(ORIGINAL_TABINDEX_ATTRIBUTE, element.getAttribute('tabindex') || '');
    }

    element.classList.add(DISABLED_FOCUS_CLASS);
    element.setAttribute('tabindex', '-1');
    element.setAttribute('aria-hidden', 'true');
  }

  function setDesktopState(state) {
    state.root.classList.add(READY_CLASS);
    state.root.classList.remove(STATIC_CLASS);
  }

  function getBranchLines(state) {
    return state.lines.filter(line => {
      const lineType = line.getAttribute('data-sa-line');

      return lineType !== FINAL_LINE_VALUE && lineType !== INTRO_LINE_VALUE;
    });
  }

  function getBranchArrowheads(state) {
    return Array.from(state.panel.querySelectorAll('.sa-arrowhead'));
  }

  function getFinalArrowLines(state) {
    if (!state.endArrow) return [];

    return Array.from(state.endArrow.querySelectorAll(`[data-sa-line="${FINAL_LINE_VALUE}"]`));
  }

  function getEndArrowheads(state) {
    return state.endArrow ? Array.from(state.endArrow.querySelectorAll('.sa-arrowhead')) : [];
  }

  function setStaticState(state) {
    state.root.classList.remove(READY_CLASS, INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS);
    state.phase = '';
    setPhase(state, 'static');
  }

  function clearDesktopState(state, gsap) {
    state.root.classList.remove(READY_CLASS, INITIAL_CLASS, TRANSITION_CLASS, FINAL_CLASS);
    state.cards.top.style.removeProperty('--sa-blue-overlay-opacity');
    state.cards.bottom.style.removeProperty('--sa-blue-overlay-opacity');
    state.cards.source.style.removeProperty('--sa-blue-overlay-opacity');
    state.lines.forEach(line => {
      line.style.pointerEvents = '';
    });

    gsap.set([
      ...(state.intro ? [state.intro] : []),
      state.cards.source,
      state.cards.top,
      state.cards.bottom,
      state.cards.final,
      state.scene,
      ...state.lines,
      ...(state.outcome ? [state.outcome] : []),
      ...(state.endArrow ? Array.from(state.endArrow.querySelectorAll('path')) : []),
      ...(state.introArrow ? [state.introArrow] : []),
      ...(state.introArrow ? Array.from(state.introArrow.querySelectorAll('path')) : []),
      ...(state.outcomeCard ? [state.outcomeCard] : []),
      ...(state.finalContent ? [state.finalContent] : []),
      ...(state.media ? [state.media] : []),
      ...state.cards.final.querySelectorAll(FINAL_REVEAL_SELECTOR),
    ], {
      clearProps: 'transform,opacity,visibility,left,top,width,height,zIndex,strokeDasharray,strokeDashoffset',
    });

    state.lines.forEach(line => {
      line.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
    });

    if (state.endArrow) {
      state.endArrow.querySelectorAll('.sa-arrowhead').forEach(arrowhead => {
        arrowhead.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
      });
    }

    if (state.introArrow) {
      state.introArrow.querySelectorAll('.sa-arrowhead').forEach(arrowhead => {
        arrowhead.removeAttribute(TARGET_OPACITY_ATTRIBUTE);
      });
    }

    setStaticState(state);
  }

  function refreshAll(options = {}) {
    initAll();

    instances.forEach(state => {
      if (state.matchMedia) {
        state.matchMedia.revert();
        state.matchMedia = null;
      }

      setupResponsiveAnimation(state);
    });

    if (!options.skipGlobalRefresh) {
      requestGlobalRefresh();
    }
  }

  function queueRefresh() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshAll, RESIZE_REFRESH_DELAY_MS);
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
