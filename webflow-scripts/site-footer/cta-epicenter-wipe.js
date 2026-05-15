// CTA Epicenter Field
(() => {
  const SECTION_SELECTOR = '[data-epicenter-wipe]';
  const STAGE_SELECTOR = '[data-epicenter-wipe-stage]';
  const ORIGIN_SELECTOR = '[data-epicenter-wipe-origin]';
  const BG_CLASS = 'epicenter-wipe__bg';
  const CANVAS_CLASS = 'epicenter-wipe__canvas';

  const DEFAULT_COLOR = '#ecf071';
  const DEFAULT_STAGE_EXTRA = '136vh';
  const MOBILE_QUERY = '(max-width: 767px)';

  const CONFIG = {
    gridSpacing: 120,
    maxRadius: 100,
    minRadius: 8,
    falloffExponent: 1.8,
    ignitionEnd: 0.24,
    introScrollEnd: 0.155,
    introVisualEnd: 0.24,
    fillScrollStart: 0.8,
    waveSpeed: 0.88,
    waveSpread: 1.32,
    fillStart: 0.84,
    fillEaseExponent: 2.35,
    strokeEnd: 0.12,
    strokeColor: '#ecf071',
    scrollStart: 0,
    scrollEnd: 0.12,
    titleScaleStart: 1.18,
    descRange: [0.34, 0.72],
    descY: 12,
    btnRange: [0.48, 0.86],
    btnY: 14,
    titleRange: [0.76, 0.98]
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileViewport = window.matchMedia(MOBILE_QUERY);
  const instances = new Map();
  let ticking = false;

  injectStyles();
  onMotionReady(initAll);

  window.addEventListener('scroll', queueFallbackRender, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('load', handleResize, { once: true });
  prefersReducedMotion.addEventListener?.('change', handleResize);
  mobileViewport.addEventListener?.('change', handleResize);

  window.CTAEpicenterWipe = {
    refresh(options = {}) {
      instances.forEach(instance => {
        instance.buildKey = '';
        render(instance);
        setupScrollTrigger(instance);
      });
      if (!options.skipGlobalRefresh) {
        requestGlobalRefresh();
      }
    },
  };

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
    document.querySelectorAll(SECTION_SELECTOR).forEach(section => {
      if (instances.has(section)) return;

      const stage = section.closest(STAGE_SELECTOR);
      if (!stage) return;

      syncStageExtraOverride(stage, section);

      const bg = getOrCreateBackground(section);
      const canvas = getOrCreateCanvas(bg);

      const context = canvas.getContext('2d', { alpha: false });

      const instance = {
        section,
        stage,
        bg,
        canvas,
        context,
        description: section.querySelector('[data-epicenter-wipe-description]'),
        button: section.querySelector('[data-epicenter-wipe-button]'),
        points: [],
        cx: 0,
        cy: 0,
        centerIndex1: -1,
        centerIndex2: -1,
        buildKey: '',
        scrollProgress: 0,
        scrollTrigger: null,
      };

      instances.set(section, instance);
      render(instance);
      setupScrollTrigger(instance);
      queueFallbackRender();
    });
  }

  function getOrCreateBackground(section) {
    const existing = Array.from(section.children).find(child => child.classList?.contains(BG_CLASS));
    if (existing) return existing;

    const bg = document.createElement('div');
    bg.className = BG_CLASS;
    bg.setAttribute('aria-hidden', 'true');
    section.insertBefore(bg, section.firstChild);
    return bg;
  }

  function getOrCreateCanvas(bg) {
    const existing = bg.querySelector(`.${CANVAS_CLASS}`);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.className = CANVAS_CLASS;
    bg.appendChild(canvas);
    return canvas;
  }

  function handleResize() {
    instances.forEach(instance => {
      instance.buildKey = '';
      render(instance);
      setupScrollTrigger(instance);
    });
    requestGlobalRefresh();
  }

  function queueFallbackRender() {
    if (!hasScrollFallbackInstances()) return;
    if (ticking) return;

    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      instances.forEach(instance => {
        if (shouldUseScrollFallbackRender(instance)) {
          render(instance);
        }
      });
    });
  }

  function hasScrollFallbackInstances() {
    for (const instance of instances.values()) {
      if (shouldUseScrollFallbackRender(instance)) return true;
    }

    return false;
  }

  function shouldUseScrollFallbackRender(instance) {
    return !instance.scrollTrigger && !shouldUseStaticMode(instance.section);
  }

  function render(instance, progressOverride) {
    const { section, stage, canvas, context, description, button } = instance;
    const color = getColor(section);

    stage.style.setProperty('--epicenter-wipe-yellow', color);

    if (shouldUseStaticMode(section)) {
      destroyScrollTrigger(instance);
      stage.setAttribute('data-epicenter-wipe-static', 'true');
      section.style.setProperty('--epicenter-wipe-yellow', color);
      section.style.setProperty('--epicenter-wipe-title-scale', '1');
      section.style.setProperty('--epicenter-wipe-description-progress', '1');
      section.style.setProperty('--epicenter-wipe-description-y', '0px');
      section.style.setProperty('--epicenter-wipe-button-progress', '1');
      section.style.setProperty('--epicenter-wipe-button-y', '0px');

      const rect = section.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    stage.removeAttribute('data-epicenter-wipe-static');

    const config = getConfig(section);
    buildGrid(instance, config);

    const progress = getRenderProgress(instance, config, progressOverride);

    const titleScale = lerp(config.titleScaleStart, 1, smooth(config.titleRange[0], config.titleRange[1], progress));
    const descriptionProgress = smooth(config.descRange[0], config.descRange[1], progress);
    const buttonProgress = smooth(config.btnRange[0], config.btnRange[1], progress);

    section.style.setProperty('--epicenter-wipe-yellow', color);
    section.style.setProperty('--epicenter-wipe-title-scale', titleScale.toFixed(4));
    section.style.setProperty('--epicenter-wipe-description-progress', descriptionProgress.toFixed(4));
    section.style.setProperty('--epicenter-wipe-description-y', `${((1 - descriptionProgress) * config.descY).toFixed(2)}px`);
    section.style.setProperty('--epicenter-wipe-button-progress', buttonProgress.toFixed(4));
    section.style.setProperty('--epicenter-wipe-button-y', `${((1 - buttonProgress) * config.btnY).toFixed(2)}px`);

    description?.style.setProperty('pointer-events', progress > config.descRange[0] ? '' : 'none');
    button?.style.setProperty('pointer-events', progress > config.btnRange[0] ? '' : 'none');

    drawCanvas(instance, config, progress, color);
  }

  function drawCanvas(instance, config, progress, color) {
    const { canvas, context, points, cx, cy, centerIndex1, centerIndex2 } = instance;
    const dpr = getDevicePixelRatio();
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    if (progress >= 1) {
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return;
    }

    const maxDist = Math.max(width, height);
    const strokeOpacity = smooth(0, config.strokeEnd, progress);
    const ignitionProgress = smooth(0, config.ignitionEnd, progress);
    const wipeAngle = Math.PI * 2 * ignitionProgress;

    points.forEach((point, i) => {
      const dist = Math.hypot(point.x - cx, point.y - cy);
      const normDist = clamp(dist / maxDist, 0, 1);
      const isCenterShape = (i === centerIndex1 || i === centerIndex2);

      const pointWaveStart = config.ignitionEnd + (normDist * config.waveSpread);
      const localProgress = smooth(0, 1, clamp((progress - pointWaveStart) / config.waveSpeed, 0, 1));

      const falloff = 1 - Math.pow(normDist, config.falloffExponent);
      const targetR = config.minRadius + falloff * (config.maxRadius - config.minRadius);
      let currentR = targetR * localProgress;

      let startAngle = 0;
      let endAngle = Math.PI * 2;

      context.beginPath();
      context.strokeStyle = config.strokeColor;
      context.globalAlpha = 0.5 * strokeOpacity;
      context.lineWidth = 1;
      context.arc(point.x, point.y, config.gridSpacing / 2, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;

      if (isCenterShape) {
        if (i === centerIndex1) {
          startAngle = 0;
          endAngle = wipeAngle;
        } else {
          startAngle = Math.PI / 2;
          endAngle = (Math.PI / 2) + wipeAngle;
        }

        if (progress < config.ignitionEnd) {
          currentR = config.gridSpacing / 2;
        } else {
          const startR = config.gridSpacing / 2;
          currentR = startR + (targetR - startR) * localProgress;
        }
      }

      if (progress > config.fillStart) {
        const fillProgress = clamp((progress - config.fillStart) / (1 - config.fillStart), 0, 1);
        const extraR = Math.max(0, (maxDist - currentR) * Math.pow(fillProgress, config.fillEaseExponent));
        currentR += extraR;
      }

      if (currentR > 0.5) {
        context.beginPath();
        context.fillStyle = color;
        context.arc(point.x, point.y, currentR, startAngle, endAngle);
        context.lineTo(point.x, point.y);
        context.fill();
      }
    });
  }

  function buildGrid(instance, config) {
    const { section, stage, canvas, context } = instance;
    const rect = section.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = getDevicePixelRatio();

    stage.style.setProperty('--epicenter-stage-panel-height', `${height}px`);

    const key = [width, height, dpr, config.gridSpacing].join(':');
    if (key === instance.buildKey) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const spacing = Math.max(1, config.gridSpacing);
    const cx = width / 2;

    let cy = 240;
    const target = section.querySelector(ORIGIN_SELECTOR);
    if (target) {
      const targetRect = target.getBoundingClientRect();
      const stageRect = section.getBoundingClientRect();
      cy = targetRect.top - stageRect.top;
    }

    const startX = (cx % spacing) - (spacing / 2) - spacing;
    const startY = (cy % spacing) - (spacing / 2) - spacing;

    const points = [];
    for (let x = startX; x <= width + spacing; x += spacing) {
      for (let y = startY; y <= height + spacing; y += spacing) {
        points.push({ x, y });
      }
    }

    const leftCenterX = cx - spacing / 2;
    const rightCenterX = cx + spacing / 2;
    const topCenterY = cy - spacing / 2;
    const bottomCenterY = cy + spacing / 2;

    instance.points = points;
    instance.cx = cx;
    instance.cy = cy;
    instance.centerIndex1 = points.findIndex(p => Math.abs(p.x - leftCenterX) < 1 && Math.abs(p.y - topCenterY) < 1);
    instance.centerIndex2 = points.findIndex(p => Math.abs(p.x - rightCenterX) < 1 && Math.abs(p.y - bottomCenterY) < 1);

    instance.buildKey = key;
  }

  function getScrollProgress(instance, config) {
    const stageRect = instance.stage.getBoundingClientRect();
    const sectionRect = instance.section.getBoundingClientRect();
    const pinDistance = Math.max(1, stageRect.height - sectionRect.height);
    const startOffset = pinDistance * clamp(config.scrollStart, 0, 1);
    const activeDistance = Math.max(1, pinDistance * (1 - clamp(config.scrollStart, 0, 1) - clamp(config.scrollEnd, 0, 1)));

    return clamp((-stageRect.top - startOffset) / activeDistance, 0, 1);
  }

  function getRenderProgress(instance, config, progressOverride) {
    let rawProgress;

    if (Number.isFinite(progressOverride)) {
      rawProgress = progressOverride;
    } else if (instance.scrollTrigger) {
      rawProgress = instance.scrollProgress || 0;
    } else {
      rawProgress = getScrollProgress(instance, config);
    }

    return remapProgress(clamp(rawProgress, 0, 1), config);
  }

  function setupScrollTrigger(instance) {
    const ScrollTrigger = getScrollTrigger();
    if (!ScrollTrigger || shouldUseStaticMode(instance.section)) {
      destroyScrollTrigger(instance);
      return;
    }

    instance.stage.classList.add('is-epicenter-wipe-scrolltrigger');
    instance.section.classList.add('is-epicenter-wipe-scrolltrigger');

    if (instance.scrollTrigger) {
      instance.scrollTrigger.refresh();
      return;
    }

    instance.scrollTrigger = ScrollTrigger.create({
      trigger: instance.stage,
      start: 'top top',
      end: () => `+=${getPinDistance(instance)}`,
      scrub: true,
      pin: instance.stage,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: self => {
        instance.scrollProgress = self.progress;
        render(instance, self.progress);
      },
      onRefresh: self => {
        instance.buildKey = '';
        instance.scrollProgress = self.progress;
        render(instance, self.progress);
      },
    });
  }

  function destroyScrollTrigger(instance) {
    if (instance.scrollTrigger) {
      instance.scrollTrigger.kill();
      instance.scrollTrigger = null;
    }

    instance.scrollProgress = 0;
    instance.stage.classList.remove('is-epicenter-wipe-scrolltrigger');
    instance.section.classList.remove('is-epicenter-wipe-scrolltrigger');
  }

  function getPinDistance(instance) {
    return Math.max(1, Math.round(getStageExtraPixels(instance.stage, instance.section)));
  }

  function syncStageExtraOverride(stage, section) {
    if (!stage?.matches?.(STAGE_SELECTOR)) return;
    if (stage.style.getPropertyValue('--epicenter-stage-extra').trim()) return;

    const dataValue = getStageExtraDataValue(stage, section);
    if (dataValue) {
      stage.style.setProperty('--epicenter-stage-extra', dataValue);
    }
  }

  function getStageExtraPixels(stage, section) {
    return parseStageExtraValue(getStageExtraValue(stage, section));
  }

  function getStageExtraValue(stage, section) {
    const inlineValue = stage.style.getPropertyValue('--epicenter-stage-extra').trim();
    if (inlineValue) return inlineValue;

    const dataValue = getStageExtraDataValue(stage, section);
    if (dataValue) return dataValue;

    const computedValue = window.getComputedStyle(stage).getPropertyValue('--epicenter-stage-extra').trim();
    return computedValue || DEFAULT_STAGE_EXTRA;
  }

  function getStageExtraDataValue(stage, section) {
    return stage.dataset.wipeStageExtra || section.dataset.wipeStageExtra || '';
  }

  function parseStageExtraValue(value) {
    const trimmed = String(value || '').trim();
    const defaultPixels = window.innerHeight * 1.32;

    if (trimmed.endsWith('vh')) {
      const numeric = parseFloat(trimmed);
      return Number.isFinite(numeric) ? (numeric / 100) * window.innerHeight : defaultPixels;
    }

    if (trimmed.endsWith('vw')) {
      const numeric = parseFloat(trimmed);
      return Number.isFinite(numeric) ? (numeric / 100) * window.innerWidth : defaultPixels;
    }

    if (trimmed.endsWith('px')) {
      const numeric = parseFloat(trimmed);
      return Number.isFinite(numeric) ? numeric : defaultPixels;
    }

    const numeric = parseFloat(trimmed);
    return Number.isFinite(numeric) ? numeric : defaultPixels;
  }

  function getScrollTrigger() {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return null;

    gsap.registerPlugin(ScrollTrigger);
    return ScrollTrigger;
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

  function getConfig(section) {
    return {
      gridSpacing: getNumber(section, 'wipeGridSpacing', CONFIG.gridSpacing),
      maxRadius: getNumber(section, 'wipeMaxRadius', CONFIG.maxRadius),
      minRadius: getNumber(section, 'wipeMinRadius', CONFIG.minRadius),
      falloffExponent: getNumber(section, 'wipeFalloffExponent', CONFIG.falloffExponent),
      ignitionEnd: getNumber(section, 'wipeIgnitionEnd', CONFIG.ignitionEnd),
      introScrollEnd: getNumber(section, 'wipeIntroScrollEnd', CONFIG.introScrollEnd),
      introVisualEnd: getNumber(section, 'wipeIntroVisualEnd', CONFIG.introVisualEnd),
      fillScrollStart: getNumber(section, 'wipeFillScrollStart', CONFIG.fillScrollStart),
      waveSpeed: getNumber(section, 'wipeWaveSpeed', CONFIG.waveSpeed),
      waveSpread: getNumber(section, 'wipeWaveSpread', CONFIG.waveSpread),
      fillStart: getNumber(section, 'wipeFillStart', CONFIG.fillStart),
      fillEaseExponent: getNumber(section, 'wipeFillEaseExponent', CONFIG.fillEaseExponent),
      strokeEnd: getNumber(section, 'wipeStrokeEnd', CONFIG.strokeEnd),
      strokeColor: section.dataset.wipeStrokeColor || CONFIG.strokeColor,
      scrollStart: getNumber(section, 'wipeStart', CONFIG.scrollStart),
      scrollEnd: getNumber(section, 'wipeEnd', CONFIG.scrollEnd),
      titleScaleStart: getNumber(section, 'wipeTitleScaleStart', CONFIG.titleScaleStart),
      descRange: getArray(section, 'wipeDescRange', CONFIG.descRange),
      descY: getNumber(section, 'wipeDescY', CONFIG.descY),
      btnRange: getArray(section, 'wipeBtnRange', CONFIG.btnRange),
      btnY: getNumber(section, 'wipeBtnY', CONFIG.btnY),
      titleRange: getArray(section, 'wipeTitleRange', CONFIG.titleRange),
    };
  }

  function getArray(element, key, fallback) {
    const val = element.dataset[key];
    if (!val) return fallback;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getNumber(element, key, fallback) {
    const value = Number(element.dataset[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function getColor(section) {
    return section.dataset.wipeColor || DEFAULT_COLOR;
  }

  function getDevicePixelRatio() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function shouldUseStaticMode(section) {
    return prefersReducedMotion.matches || (mobileViewport.matches && section.dataset.wipeMobile !== 'scrub');
  }

  function remapProgress(progress, config) {
    const introScrollEnd = clamp(config.introScrollEnd, 0.001, 0.999);
    const introVisualEnd = clamp(config.introVisualEnd, 0.001, 0.999);
    const fillVisualStart = clamp(config.fillStart, introVisualEnd + 0.001, 0.999);
    const fillScrollStart = clamp(config.fillScrollStart, introScrollEnd + 0.001, 0.999);

    if (progress <= introScrollEnd) {
      return lerp(0, introVisualEnd, progress / introScrollEnd);
    }

    if (progress <= fillScrollStart) {
      return lerp(
        introVisualEnd,
        fillVisualStart,
        (progress - introScrollEnd) / (fillScrollStart - introScrollEnd)
      );
    }

    return lerp(fillVisualStart, 1, (progress - fillScrollStart) / (1 - fillScrollStart));
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function smooth(start, end, value) {
    if (start === end) return value >= end ? 1 : 0;
    const amount = clamp((value - start) / (end - start), 0, 1);
    return amount * amount * (3 - 2 * amount);
  }

  function injectStyles() {
    if (document.getElementById('cta-epicenter-wipe-styles')) return;

    const style = document.createElement('style');
    style.id = 'cta-epicenter-wipe-styles';
    style.textContent = `
${STAGE_SELECTOR} {
  --epicenter-stage-panel-height: 100vh;
  --epicenter-wipe-yellow: ${DEFAULT_COLOR};
  position: relative;
  min-height: calc(var(--epicenter-stage-panel-height, 100vh) + var(--epicenter-stage-extra, ${DEFAULT_STAGE_EXTRA}));
  background: #fff;
}

${SECTION_SELECTOR} {
  --epicenter-wipe-yellow: ${DEFAULT_COLOR};
  --epicenter-wipe-title-scale: 1;
  --epicenter-wipe-description-progress: 1;
  --epicenter-wipe-description-y: 0px;
  --epicenter-wipe-button-progress: 1;
  --epicenter-wipe-button-y: 0px;
  --epicenter-wipe-min-height: 840px;
  position: sticky;
  top: 0;
  min-height: max(100vh, var(--epicenter-wipe-min-height));
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  background: #fff;
}

${SECTION_SELECTOR} > :not(.${BG_CLASS}) {
  position: relative;
  z-index: 2;
}

.${BG_CLASS} {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  contain: paint;
}

.${CANVAS_CLASS} {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

${SECTION_SELECTOR} [data-epicenter-wipe-title] {
  opacity: 1;
  transform: scale(var(--epicenter-wipe-title-scale));
  transform-origin: center;
  will-change: transform;
}

${SECTION_SELECTOR} [data-epicenter-wipe-description] {
  opacity: var(--epicenter-wipe-description-progress);
  transform: translate3d(0, var(--epicenter-wipe-description-y), 0);
  will-change: opacity, transform;
}

${SECTION_SELECTOR} [data-epicenter-wipe-button] {
  opacity: var(--epicenter-wipe-button-progress);
  transform: translate3d(0, var(--epicenter-wipe-button-y), 0);
  will-change: opacity, transform;
}

${STAGE_SELECTOR}[data-epicenter-wipe-static="true"] {
  min-height: auto;
}

${STAGE_SELECTOR}.is-epicenter-wipe-scrolltrigger {
  min-height: var(--epicenter-stage-panel-height, 100vh);
}

${STAGE_SELECTOR}.is-epicenter-wipe-scrolltrigger ${SECTION_SELECTOR} {
  position: relative;
  top: auto;
}

@media (prefers-reduced-motion: reduce) {
  ${SECTION_SELECTOR} {
    position: relative;
    min-height: auto;
    background: var(--epicenter-wipe-yellow);
  }

  ${SECTION_SELECTOR} .${BG_CLASS} {
    display: none;
  }
}

@media ${MOBILE_QUERY} {
  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) {
    position: relative;
    min-height: auto;
    background: var(--epicenter-wipe-yellow);
  }

  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) .${BG_CLASS} {
    display: none;
  }
}
`;
    document.head.appendChild(style);
  }
})();
