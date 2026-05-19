// CTA Clock Wipe
(() => {
  const SECTION_SELECTOR = '[data-cta-wipe]';
  const STAGE_SELECTOR = '[data-cta-wipe-stage]';
  const BG_CLASS = 'cta-wipe__bg';
  const CANVAS_CLASS = 'cta-wipe__canvas';

  const TILE_ROWS = 4;
  const TILE_COLUMNS = 6;
  const DEFAULT_COLOR = '#ecf071';
  const DEFAULT_BACKGROUND = '#faf9f5';
  const DEFAULT_STAGE_EXTRA = '224vh';
  const MOBILE_QUERY = '(max-width: 767px)';
  const MOTION_POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';

  const CONFIG = {
    columns: 6,
    cellMin: 180,
    cellMax: 240,
    heightMin: 680,
    heightMax: 840,
    heightRatio: 0.5833,
    anchorX: 0,
    anchorY: 0,
    key1: 0.24,
    key2: 0.57,
    key3: 0.81,
    revealStart: 0.055,
    revealEnd: 0.43,
    revealSpread: 0.36,
    revealBatches: 11,
    animationEnd: 0.855,
    expandStart: 0.76,
    expandEnd: 0.94,
    expandAmount: 1.36,
    expandWave: 0.22,
    solidStart: 0.81,
    solidEnd: 0.9,
    solidWave: 0.045,
    titleScaleStart: 1.18,
    titleStart: 0.42,
    titleEnd: 0.78,
    descriptionStart: 0.48,
    descriptionEnd: 0.82,
    descriptionY: 22,
    buttonStart: 0.62,
    buttonEnd: 0.92,
    buttonY: 30,
    scrollStart: 0,
    scrollEnd: 0.12,
  };

  const PRIMARY_PATTERN = [
    [
      { from: 180, a1: 180, a2: 323 },
      { from: 270, a1: 180, a2: 324, dir: -1 },
      { from: 0, a1: 180, a2: 323 },
      { from: 90, a1: 180, a2: 270 },
      { from: 180, a1: 180, a2: 180 },
      { from: 270, a1: 180, a2: 270, dir: -1 },
    ],
    [
      { from: 270, a1: 180, a2: 321, dir: -1 },
      { from: 0, a1: 180, a2: 282 },
      { from: 90, a1: 180, a2: 313 },
      { from: 180, a1: 180, a2: 299 },
      { from: 270, a1: 180, a2: 313, dir: -1 },
      { from: 0, a1: 180, a2: 316 },
    ],
    [
      { from: 0, a1: 180, a2: 302 },
      { from: 90, a1: 180, a2: 294 },
      { from: 180, a1: 180, a2: 295, dir: -1 },
      { from: 270, a1: 180, a2: 303, dir: -1 },
      { from: 0, a1: 180, a2: 318 },
      { from: 90, a1: 180, a2: 302 },
    ],
    [
      { from: 90, a1: 180, a2: 300 },
      { from: 180, a1: 180, a2: 300 },
      { from: 270, a1: 180, a2: 270 },
      { from: 0, a1: 180, a2: 300 },
      { from: 90, a1: 180, a2: 300 },
      { from: 180, a1: 180, a2: 300 },
    ],
  ];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileViewport = window.matchMedia(MOBILE_QUERY);
  const instances = new Map();
  let ticking = false;

  injectStyles();
  onMotionReady(initAll);

  window.addEventListener('scroll', queueFallbackRender, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener(MOTION_POLICY_CHANGE_EVENT, handleResize);
  window.addEventListener('load', handleResize, { once: true });
  prefersReducedMotion.addEventListener?.('change', handleResize);
  mobileViewport.addEventListener?.('change', handleResize);

  window.CTAWipe = {
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
      const instance = {
        section,
        stage,
        bg,
        canvas,
        context: canvas.getContext('2d', { alpha: false }),
        description: section.querySelector('[data-cta-wipe-description]'),
        button: section.querySelector('[data-cta-wipe-button]'),
        shapes: [],
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

    stage.style.setProperty('--cta-wipe-yellow', color);

    if (shouldUseStaticMode(section)) {
      destroyScrollTrigger(instance);
      stage.setAttribute('data-cta-wipe-static', 'true');
      section.style.setProperty('--cta-wipe-yellow', color);
      section.style.setProperty('--cta-wipe-title-scale', '1');
      section.style.setProperty('--cta-wipe-description-progress', '1');
      section.style.setProperty('--cta-wipe-description-y', '0px');
      section.style.setProperty('--cta-wipe-button-progress', '1');
      section.style.setProperty('--cta-wipe-button-y', '0px');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    stage.removeAttribute('data-cta-wipe-static');

    const config = getConfig(section);
    buildShapes(instance, config);

    const progress = getRenderProgress(instance, config, progressOverride);
    const visualProgress = getVisualProgress(config, progress);
    const solid = smooth(config.solidEnd, Math.min(1, config.solidEnd + config.solidWave), progress);
    const rect = section.getBoundingClientRect();
    const titleScale = lerp(config.titleScaleStart, 1, smooth(config.titleStart, config.titleEnd, progress));

    section.style.setProperty('--cta-wipe-yellow', color);
    section.style.setProperty('--cta-wipe-title-scale', titleScale.toFixed(4));
    const descriptionProgress = smooth(config.descriptionStart, config.descriptionEnd, progress);
    const buttonProgress = smooth(config.buttonStart, config.buttonEnd, progress);

    section.style.setProperty('--cta-wipe-description-progress', descriptionProgress.toFixed(4));
    section.style.setProperty('--cta-wipe-description-y', `${((1 - descriptionProgress) * config.descriptionY).toFixed(2)}px`);
    section.style.setProperty('--cta-wipe-button-progress', buttonProgress.toFixed(4));
    section.style.setProperty('--cta-wipe-button-y', `${((1 - buttonProgress) * config.buttonY).toFixed(2)}px`);

    description?.style.setProperty('pointer-events', progress > config.descriptionStart ? '' : 'none');
    button?.style.setProperty('pointer-events', progress > config.buttonStart ? '' : 'none');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = DEFAULT_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = color;
    context.globalAlpha = solid;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;

    if (solid >= 1) return;

    const dpr = getDevicePixelRatio();

    context.save();
    context.scale(dpr, dpr);
    context.fillStyle = color;

    instance.shapes.forEach(shape => {
      if (!isShapeVisible(shape, config, progress)) return;

      const angle = getShapeAngle(shape, config, progress, visualProgress);
      if (angle <= 0) return;

      const fromDeg = getShapeFrom(shape, angle);

      const dx = shape.x - rect.width / 2;
      const dy = shape.y - rect.height / 2;
      const distance = Math.hypot(dx, dy);
      const maxDistance = Math.hypot(rect.width / 2, rect.height / 2) || 1;
      const distanceRatio = distance / maxDistance;
      const waveDelay = distanceRatio * config.expandWave;
      const solidDelay = getShapeSolidDelay(shape, distanceRatio, config);

      const scaleProgress = smooth(config.expandStart + waveDelay, config.expandEnd + waveDelay, visualProgress);
      const scale = lerp(1, config.expandAmount, scaleProgress);

      const radius = (shape.size / 2) * scale;
      const fillAlpha = smooth(config.solidStart + solidDelay, config.solidEnd + solidDelay, progress);

      if (angle >= 359.5) {
        context.beginPath();
        context.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
        context.fill();
        return;
      }

      const startAngleRad = (fromDeg - 90) * Math.PI / 180;
      const endAngleRad = (fromDeg + angle - 90) * Math.PI / 180;

      context.beginPath();
      context.moveTo(shape.x, shape.y);
      context.arc(shape.x, shape.y, radius, startAngleRad, endAngleRad);
      context.closePath();
      context.fill();

      if (fillAlpha > 0) {
        context.globalAlpha = fillAlpha;
        context.beginPath();
        context.arc(shape.x, shape.y, radius, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
      }
    });

    context.restore();
  }

  function buildShapes(instance, config) {
    const { section, stage, canvas, context } = instance;
    const rect = section.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const cell = Math.round(Math.max(config.cellMin, Math.min(config.cellMax, width / config.columns)));
    const targetHeight = Math.round(cell * 3.5);
    const designHeight = Math.round(Math.max(config.heightMin, Math.min(config.heightMax, width * config.heightRatio)));
    const contentMinHeight = getContentMinHeight(section);
    const sectionMinHeight = Math.max(targetHeight, designHeight, contentMinHeight);
    const tile = PRIMARY_PATTERN;

    section.style.setProperty('--cta-wipe-min-height', `${sectionMinHeight}px`);

    const height = Math.max(1, Math.round(section.getBoundingClientRect().height));
    stage.style.setProperty('--cta-stage-panel-height', `${height}px`);

    const dpr = getDevicePixelRatio();
    const key = [width, height, cell, config.columns, config.cellMin, config.cellMax, config.heightMin, config.heightMax, config.heightRatio, config.anchorX, config.anchorY, dpr].join(':');

    if (key === instance.buildKey) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const tileWidth = TILE_COLUMNS * cell;
    const anchorX = width / 2 - tileWidth / 2 + config.anchorX;
    const anchorY = config.anchorY;
    const startCol = Math.floor((-cell - anchorX) / cell);
    const endCol = Math.ceil((width + cell - anchorX) / cell);
    const startRow = Math.floor((-cell - anchorY) / cell);
    const endRow = Math.ceil((height + cell - anchorY) / cell);
    const shapes = [];

    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startCol; column <= endCol; column += 1) {
        const source = tile[modulo(row, TILE_ROWS)][modulo(column, TILE_COLUMNS)];
        const x = anchorX + column * cell;
        const y = anchorY + row * cell;

        shapes.push({
          from: source.from,
          a1: source.a1,
          a2: source.a2,
          dir: source.dir || 1,
          revealOrder: getRevealOrder(row, column),
          x: x + cell / 2,
          y: y + cell / 2,
          size: cell
        });
      }
    }

    instance.shapes = shapes;
    instance.buildKey = key;
  }

  function getContentMinHeight(section) {
    const sectionRect = section.getBoundingClientRect();
    const styles = window.getComputedStyle(section);
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    let contentBottom = paddingTop;

    Array.from(section.children).forEach(child => {
      if (child.classList?.contains(BG_CLASS)) return;

      const childStyles = window.getComputedStyle(child);
      if (childStyles.display === 'none' || childStyles.position === 'absolute' || childStyles.position === 'fixed') return;

      const childRect = child.getBoundingClientRect();
      const marginBottom = parseFloat(childStyles.marginBottom) || 0;
      contentBottom = Math.max(contentBottom, childRect.bottom - sectionRect.top + marginBottom);
    });

    return Math.max(100, Math.round(contentBottom + paddingBottom));
  }

  function getVisualProgress(config, progress) {
    const animationEnd = Math.max(config.revealEnd + 0.01, config.animationEnd);

    if (progress <= config.revealEnd) return 0;

    return lerp(config.key1, 1, smooth(config.revealEnd, animationEnd, progress));
  }

  function getShapeAngle(shape, config, progress, visualProgress) {
    if (progress <= config.revealEnd) {
      return shape.a1;
    }

    if (visualProgress <= config.key1) {
      return lerp(0, shape.a1, smooth(0, config.key1, visualProgress));
    }

    if (visualProgress <= config.key2) {
      return lerp(shape.a1, shape.a2, smooth(config.key1, config.key2, visualProgress));
    }

    if (visualProgress <= config.key3) {
      return lerp(shape.a2, 360, smooth(config.key2, config.key3, visualProgress));
    }

    return 360;
  }

  function isShapeVisible(shape, config, progress) {
    if (progress > config.revealEnd) return true;

    return progress >= getShapeRevealPoint(shape, config);
  }

  function getShapeRevealPoint(shape, config) {
    const batchCount = Math.max(1, Math.round(config.revealBatches));
    const batch = Math.min(batchCount - 1, Math.floor(shape.revealOrder * batchCount));
    const batchProgress = batchCount <= 1 ? 0 : batch / (batchCount - 1);

    return Math.min(config.revealEnd, config.revealStart + batchProgress * config.revealSpread);
  }

  function getShapeSolidDelay(shape, distanceRatio, config) {
    if (!config.solidWave) return 0;

    const orderOffset = (shape.revealOrder - 0.5) * config.solidWave * 0.45;
    const distanceOffset = distanceRatio * config.solidWave;

    return Math.max(0, orderOffset + distanceOffset);
  }

  function getRevealOrder(row, column) {
    let hash = ((row + 4096) * 73856093) ^ ((column + 4096) * 19349663);
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;

    return (hash >>> 0) / 4294967295;
  }

  function getShapeFrom(shape, angle) {
    if (shape.dir !== -1) return shape.from;

    return shape.from + shape.a1 - angle;
  }

  function getScrollProgress(instance, config) {
    const stageRect = instance.stage.getBoundingClientRect();
    const sectionRect = instance.section.getBoundingClientRect();
    const pinDistance = Math.max(1, stageRect.height - sectionRect.height);
    const startOffset = pinDistance * clamp(config.scrollStart);
    const activeDistance = Math.max(1, pinDistance * (1 - clamp(config.scrollStart) - clamp(config.scrollEnd)));

    return clamp((-stageRect.top - startOffset) / activeDistance);
  }

  function getRenderProgress(instance, config, progressOverride) {
    if (Number.isFinite(progressOverride)) return clamp(progressOverride);
    if (instance.scrollTrigger) return clamp(instance.scrollProgress || 0);

    return getScrollProgress(instance, config);
  }

  function setupScrollTrigger(instance) {
    const ScrollTrigger = getScrollTrigger();
    if (!ScrollTrigger || shouldUseStaticMode(instance.section)) {
      destroyScrollTrigger(instance);
      return;
    }

    instance.stage.classList.add('is-cta-wipe-scrolltrigger');
    instance.section.classList.add('is-cta-wipe-scrolltrigger');

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
    instance.stage.classList.remove('is-cta-wipe-scrolltrigger');
    instance.section.classList.remove('is-cta-wipe-scrolltrigger');
  }

  function getPinDistance(instance) {
    return Math.max(1, Math.round(getStageExtraPixels(instance.stage, instance.section)));
  }

  function syncStageExtraOverride(stage, section) {
    if (!stage?.matches?.(STAGE_SELECTOR)) return;
    if (stage.style.getPropertyValue('--cta-stage-extra').trim()) return;

    const dataValue = getStageExtraDataValue(stage, section);
    if (dataValue) {
      stage.style.setProperty('--cta-stage-extra', dataValue);
    }
  }

  function getStageExtraPixels(stage, section) {
    return parseStageExtraValue(getStageExtraValue(stage, section));
  }

  function getStageExtraValue(stage, section) {
    const inlineValue = stage.style.getPropertyValue('--cta-stage-extra').trim();
    if (inlineValue) return inlineValue;

    const dataValue = getStageExtraDataValue(stage, section);
    if (dataValue) return dataValue;

    const computedValue = window.getComputedStyle(stage).getPropertyValue('--cta-stage-extra').trim();
    return computedValue || DEFAULT_STAGE_EXTRA;
  }

  function getStageExtraDataValue(stage, section) {
    return stage.dataset.wipeStageExtra || section.dataset.wipeStageExtra || '';
  }

  function parseStageExtraValue(value) {
    const trimmed = String(value || '').trim();
    const defaultPixels = window.innerHeight * 2.24;

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
      columns: getNumber(section, 'wipeColumns', CONFIG.columns),
      cellMin: getNumber(section, 'wipeCellMin', CONFIG.cellMin),
      cellMax: getNumber(section, 'wipeCellMax', CONFIG.cellMax),
      heightMin: getNumber(section, 'wipeHeightMin', CONFIG.heightMin),
      heightMax: getNumber(section, 'wipeHeightMax', CONFIG.heightMax),
      heightRatio: getNumber(section, 'wipeHeightRatio', CONFIG.heightRatio),
      anchorX: getNumber(section, 'wipeAnchorX', CONFIG.anchorX),
      anchorY: getNumber(section, 'wipeAnchorY', CONFIG.anchorY),
      key1: getNumber(section, 'wipeKey1', CONFIG.key1),
      key2: getNumber(section, 'wipeKey2', CONFIG.key2),
      key3: getNumber(section, 'wipeKey3', CONFIG.key3),
      revealStart: getNumber(section, 'wipeRevealStart', CONFIG.revealStart),
      revealEnd: getNumber(section, 'wipeRevealEnd', CONFIG.revealEnd),
      revealSpread: getNumber(section, 'wipeRevealSpread', CONFIG.revealSpread),
      revealBatches: getNumber(section, 'wipeRevealBatches', CONFIG.revealBatches),
      animationEnd: getNumber(section, 'wipeAnimationEnd', CONFIG.animationEnd),
      expandStart: getNumber(section, 'wipeExpandStart', CONFIG.expandStart),
      expandEnd: getNumber(section, 'wipeExpandEnd', CONFIG.expandEnd),
      expandAmount: getNumber(section, 'wipeExpandAmount', CONFIG.expandAmount),
      expandWave: getNumber(section, 'wipeExpandWave', CONFIG.expandWave),
      solidStart: getNumber(section, 'wipeSolidStart', CONFIG.solidStart),
      solidEnd: getNumber(section, 'wipeSolidEnd', CONFIG.solidEnd),
      solidWave: getNumber(section, 'wipeSolidWave', CONFIG.solidWave),
      titleScaleStart: getNumber(section, 'wipeTitleScaleStart', CONFIG.titleScaleStart),
      titleStart: getNumber(section, 'wipeTitleStart', CONFIG.titleStart),
      titleEnd: getNumber(section, 'wipeTitleEnd', CONFIG.titleEnd),
      descriptionStart: getNumber(section, 'wipeDescriptionStart', CONFIG.descriptionStart),
      descriptionEnd: getNumber(section, 'wipeDescriptionEnd', CONFIG.descriptionEnd),
      descriptionY: getNumber(section, 'wipeDescriptionY', CONFIG.descriptionY),
      buttonStart: getNumber(section, 'wipeButtonStart', CONFIG.buttonStart),
      buttonEnd: getNumber(section, 'wipeButtonEnd', CONFIG.buttonEnd),
      buttonY: getNumber(section, 'wipeButtonY', CONFIG.buttonY),
      scrollStart: getNumber(section, 'wipeStart', CONFIG.scrollStart),
      scrollEnd: getNumber(section, 'wipeEnd', CONFIG.scrollEnd),
    };
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
    if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.shouldUseHeavyScrollEffects === 'function') {
      return !window.ContextualHomeMotion.shouldUseHeavyScrollEffects();
    }

    return prefersReducedMotion.matches || (mobileViewport.matches && section.dataset.wipeMobile !== 'scrub');
  }

  function injectStyles() {
    if (document.getElementById('cta-clock-wipe-canvas-styles')) return;

    const style = document.createElement('style');
    style.id = 'cta-clock-wipe-canvas-styles';
    style.textContent = `
${STAGE_SELECTOR} {
  --cta-stage-panel-height: 100vh;
  --cta-wipe-yellow: ${DEFAULT_COLOR};
  position: relative;
  min-height: calc(var(--cta-stage-panel-height, 100vh) + var(--cta-stage-extra, ${DEFAULT_STAGE_EXTRA}));
  background: var(--_system-colors---light, ${DEFAULT_BACKGROUND});
}

${SECTION_SELECTOR} {
  --cta-wipe-yellow: ${DEFAULT_COLOR};
  --cta-wipe-title-scale: 1;
  --cta-wipe-description-progress: 1;
  --cta-wipe-description-y: 0px;
  --cta-wipe-button-progress: 1;
  --cta-wipe-button-y: 0px;
  --cta-wipe-min-height: 840px;
  position: sticky;
  top: 0;
  min-height: max(100vh, var(--cta-wipe-min-height));
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  background: var(--_system-colors---light, ${DEFAULT_BACKGROUND});
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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

${SECTION_SELECTOR} [data-cta-wipe-title] {
  opacity: 1;
  transform: scale(var(--cta-wipe-title-scale));
  transform-origin: center;
  will-change: transform;
}

${SECTION_SELECTOR} [data-cta-wipe-description] {
  opacity: var(--cta-wipe-description-progress);
  transform: translate3d(0, var(--cta-wipe-description-y), 0);
  will-change: opacity, transform;
}

${SECTION_SELECTOR} [data-cta-wipe-button] {
  opacity: var(--cta-wipe-button-progress);
  transform: translate3d(0, var(--cta-wipe-button-y), 0);
  will-change: opacity, transform;
}

${STAGE_SELECTOR}[data-cta-wipe-static="true"] {
  min-height: auto;
}

${STAGE_SELECTOR}[data-cta-wipe-static="true"] ${SECTION_SELECTOR} {
  position: relative;
  top: auto;
  min-height: auto;
  background: var(--cta-wipe-yellow);
}

${STAGE_SELECTOR}[data-cta-wipe-static="true"] ${SECTION_SELECTOR} .${BG_CLASS} {
  display: none;
}

${STAGE_SELECTOR}.is-cta-wipe-scrolltrigger {
  min-height: var(--cta-stage-panel-height, 100vh);
}

${STAGE_SELECTOR}.is-cta-wipe-scrolltrigger ${SECTION_SELECTOR} {
  position: relative;
  top: auto;
}

@media (prefers-reduced-motion: reduce) {
  ${SECTION_SELECTOR} {
    position: relative;
    min-height: auto;
    background: var(--cta-wipe-yellow);
  }

  ${SECTION_SELECTOR} .${BG_CLASS} {
    display: none;
  }
}

@media ${MOBILE_QUERY} {
  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) {
    position: relative;
    min-height: auto;
    background: var(--cta-wipe-yellow);
  }

  ${SECTION_SELECTOR}:not([data-wipe-mobile="scrub"]) .${BG_CLASS} {
    display: none;
  }
}
`;
    document.head.appendChild(style);
  }

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function smooth(start, end, value) {
    if (start === end) return value >= end ? 1 : 0;
    const amount = clamp((value - start) / (end - start));
    return amount * amount * (3 - 2 * amount);
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }
})();
