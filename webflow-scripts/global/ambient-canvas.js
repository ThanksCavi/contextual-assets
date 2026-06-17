// Circle Canvas
(() => {
  // Use [data-circle-zone] on a single light section or on a shared wrapper
  // around multiple light sections that should render as one seamless field.
  // Use data-circle-zone="dark" on dark backgrounds for subtler rings.
  const FIELD_SELECTOR = '[data-circle-zone]';
  const DARK_FIELD_VALUE = 'dark';
  const CANVAS_CLASS = 'circle-field-canvas';
  const INITIALIZED_CLASS = 'is-circle-field-ready';
  const STYLE_ID = 'circle-field-layering-styles';

  // Geometry.
  const MAX_DPR = 2;
  const GRID_SPACING = 24;
  const MOBILE_GRID_SPACING = 22;
  const SPOTLIGHT_RADIUS = 304;
  const MOBILE_SPOTLIGHT_RADIUS = 210;
  const MAX_FOCUS_WIDTH = 2000;

  // Motion.
  const CURSOR_ENTER_EASE = 0.085;
  const SETTLE_DISTANCE = 0.2;
  const STROKE_COLOR = '196, 194, 206';

  // Resting position.
  const DEFAULT_FIELD_X = '45%';
  const DEFAULT_FIELD_Y = '100px';

  // Visual tuning.
  const BASE_RADIUS = 0.8;
  const STATIC_RADIUS_BOOST = 9.6;
  const INTERACTIVE_RADIUS_BOOST = 0.35;
  const BASE_OPACITY = 0.045;
  const STATIC_OPACITY_BOOST = 0.6;
  const INTERACTIVE_OPACITY_BOOST = 0.03;
  const DARK_FIELD_OPACITY_MULTIPLIER = 0.5;
  const STROKE_WIDTH = 1;
  const SIZE_FALLOFF_EXPONENT = 1.52;
  const OPACITY_FALLOFF_EXPONENT = 0.9;
  const SPOTLIGHT_EDGE_FADE_START = 0.84;
  const SECTION_EDGE_FADE = 90;

  // Edge behavior.
  const LIMIT_FOCUS_TO_SAFE_AREA = true;
  const FOCUS_SAFE_ZONE = 1;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)');
  const zones = new Map();

  const manager = {
    cursorClientX: 0,
    cursorClientY: 0,
    targetClientX: 0,
    targetClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    hasPointer: false,
    hasClientPosition: false,
    activeZone: null,
    layoutDirty: true,
    rafId: null,
    eventsBound: false,
  };

  const resizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(entries => entries.forEach(handleResizeEntry))
    : null;

  function initAll() {
    injectLayeringStyles();
    document.querySelectorAll(FIELD_SELECTOR).forEach(initField);
    bindGlobalEvents();
    refreshLayouts();
    drawAll();
  }

  function initField(section) {
    if (zones.has(section)) return;

    const canvas = getOrCreateCanvas(section);
    const context = canvas.getContext('2d');
    if (!context) return;

    prepareSection(section);
    prepareCanvas(canvas);

    const state = {
      section,
      canvas,
      context,
      width: 0,
      height: 0,
      dpr: 1,
      pageLeft: 0,
      pageTop: 0,
      viewportLeft: 0,
      viewportRight: 0,
      viewportTop: 0,
      viewportBottom: 0,
      points: [],
      field: null,
      opacityMultiplier: getOpacityMultiplier(section),
    };

    zones.set(section, state);
    section.classList.add(INITIALIZED_CLASS);

    resizeField(state);

    if (resizeObserver) resizeObserver.observe(section);
  }

  function getOrCreateCanvas(section) {
    const existingCanvas = Array.from(section.children).find(child => (
      child.tagName === 'CANVAS' && child.classList.contains(CANVAS_CLASS)
    ));

    if (existingCanvas) return existingCanvas;

    const canvas = document.createElement('canvas');
    canvas.className = CANVAS_CLASS;
    section.insertBefore(canvas, section.firstChild);
    return canvas;
  }

  function prepareSection(section) {
    if (window.getComputedStyle(section).position === 'static') {
      section.style.position = 'relative';
    }
  }

  function prepareCanvas(canvas) {
    // Decorative, non-interactive layer.
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');

    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: canShowField() ? 'block' : 'none',
      pointerEvents: 'none',
      zIndex: '0',
    });
  }

  function injectLayeringStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    ${FIELD_SELECTOR} > :not(.${CANVAS_CLASS}) {
      position: relative;
      z-index: 1;
    }
    `;

    document.head.appendChild(style);
  }

  function bindGlobalEvents() {
    if (manager.eventsBound || !zones.size) return;
    manager.eventsBound = true;

    const moveEvent = 'PointerEvent' in window ? 'pointermove' : 'mousemove';
    const leaveEvent = 'PointerEvent' in window ? 'pointerleave' : 'mouseleave';

    document.addEventListener(moveEvent, handlePointerMove, { passive: true });
    document.documentElement.addEventListener(leaveEvent, handlePointerLeave, { passive: true });
    window.addEventListener('blur', handlePointerLeave, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize, { passive: true });
  }

  function handlePointerMove(event) {
    if (!canAnimate()) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;

    manager.lastClientX = event.clientX;
    manager.lastClientY = event.clientY;
    manager.hasClientPosition = true;

    updateViewportPositions();

    const activeZone = getZoneAtPoint(event.clientX, event.clientY);

    if (!manager.hasPointer || manager.activeZone !== activeZone) {
      manager.cursorClientX = event.clientX;
      manager.cursorClientY = event.clientY;
    }

    manager.activeZone = activeZone;
    manager.hasPointer = !!activeZone;
    manager.targetClientX = event.clientX;
    manager.targetClientY = event.clientY;
    requestFrame();
  }

  function handlePointerLeave() {
    if (!manager.hasPointer) return;

    manager.hasPointer = false;
    manager.activeZone = null;
    requestFrame();
  }

  function handleScroll() {
    updateViewportPositions();
    refreshActiveZone();

    if (manager.hasClientPosition && canAnimate()) {
      manager.targetClientX = manager.lastClientX;
      manager.targetClientY = manager.lastClientY;
      requestFrame();
    }
  }

  function handleWindowResize() {
    zones.forEach(resizeField);
    manager.layoutDirty = true;
    refreshActiveZone();
    requestFrame();
  }

  function handleResizeEntry(entry) {
    const state = zones.get(entry.target);
    if (state) resizeField(state);
  }

  function resizeField(state) {
    const previousPageLeft = state.pageLeft;
    const previousPageTop = state.pageTop;
    const rect = updateLayout(state);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const positionChanged = (
      Math.abs(previousPageLeft - state.pageLeft) > 0.5 ||
      Math.abs(previousPageTop - state.pageTop) > 0.5
    );

    if (state.width === width && state.height === height && state.dpr === dpr && !positionChanged) {
      draw(state);
      return;
    }

    state.width = width;
    state.height = height;
    state.dpr = dpr;

    state.canvas.width = Math.round(width * dpr);
    state.canvas.height = Math.round(height * dpr);
    state.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.field = getAccentField(state.section, width, height);
    state.points = buildGridPoints(state);
    manager.layoutDirty = true;

    draw(state);
  }

  function updateLayout(state) {
    const rect = state.section.getBoundingClientRect();
    state.pageLeft = rect.left + window.scrollX;
    state.pageTop = rect.top + window.scrollY;
    state.viewportLeft = rect.left;
    state.viewportRight = rect.right;
    state.viewportTop = rect.top;
    state.viewportBottom = rect.bottom;

    return rect;
  }

  function refreshLayouts() {
    zones.forEach(updateLayout);
    manager.layoutDirty = false;
  }

  function updateViewportPositions() {
    zones.forEach(state => {
      const rect = state.section.getBoundingClientRect();
      state.viewportLeft = rect.left;
      state.viewportRight = rect.right;
      state.viewportTop = rect.top;
      state.viewportBottom = rect.bottom;
    });
  }

  function getZoneAtPoint(clientX, clientY) {
    let activeZone = null;
    let activeArea = Infinity;

    for (const state of zones.values()) {
      if (
        clientX < state.viewportLeft ||
        clientX > state.viewportRight ||
        clientY < state.viewportTop ||
        clientY > state.viewportBottom
      ) {
        continue;
      }

      const stateArea = state.width * state.height;

      if (stateArea < activeArea) {
        activeZone = state;
        activeArea = stateArea;
      }
    }

    return activeZone;
  }

  function refreshActiveZone() {
    if (!manager.hasClientPosition) return;

    manager.activeZone = getZoneAtPoint(manager.lastClientX, manager.lastClientY);
    manager.hasPointer = !!manager.activeZone;
  }

  function getAccentField(section, width, height) {
    const isNarrow = width < 768;
    const mobileRadius = Math.max(130, Math.min(Math.min(width, height) * 0.42, MOBILE_SPOTLIGHT_RADIUS));
    const radius = isNarrow ? mobileRadius : SPOTLIGHT_RADIUS;

    return {
      x: getFieldCoordinate(section.getAttribute('data-circle-x'), width, DEFAULT_FIELD_X),
      // Y is top offset; drawing uses center.
      y: getFieldCoordinate(section.getAttribute('data-circle-y'), height, DEFAULT_FIELD_Y) + radius,
      radiusX: radius,
      radiusY: radius,
      spacing: isNarrow ? MOBILE_GRID_SPACING : GRID_SPACING,
    };
  }

  function buildGridPoints(state) {
    const { field } = state;
    const startX = positiveModulo(-state.pageLeft, field.spacing);
    const startY = positiveModulo(-state.pageTop, field.spacing);
    const points = [];

    for (let x = startX; x <= state.width; x += field.spacing) {
      for (let y = startY; y <= state.height; y += field.spacing) {
        points.push({ x, y });
      }
    }

    return points;
  }

  function requestFrame() {
    if (manager.rafId) return;

    manager.rafId = requestAnimationFrame(tick);
  }

  function tick() {
    manager.rafId = null;

    if (manager.layoutDirty) {
      refreshLayouts();
    }

    if (!canShowField()) {
      zones.forEach(state => {
        state.canvas.style.display = 'none';
        state.context.clearRect(0, 0, state.width, state.height);
      });
      return;
    }

    zones.forEach(state => {
      state.canvas.style.display = 'block';
    });

    if (!canAnimate() || !manager.hasPointer) {
      drawAll();
      return;
    }

    manager.cursorClientX += (manager.targetClientX - manager.cursorClientX) * CURSOR_ENTER_EASE;
    manager.cursorClientY += (manager.targetClientY - manager.cursorClientY) * CURSOR_ENTER_EASE;

    drawAll();

    if (getCursorDistanceToTarget() > SETTLE_DISTANCE) {
      requestFrame();
    }
  }

  function drawAll() {
    if (manager.layoutDirty) {
      refreshLayouts();
    } else {
      updateViewportPositions();
    }

    refreshActiveZone();
    zones.forEach(draw);
  }

  function draw(state) {
    const { context, width, height, points } = state;
    if (!width || !height || !state.field) return;

    if (!canShowField()) {
      state.canvas.style.display = 'none';
      context.clearRect(0, 0, width, height);
      return;
    }

    context.clearRect(0, 0, width, height);

    if (!isNearViewport(state)) return;

    context.lineWidth = STROKE_WIDTH;

    const isDynamic = canAnimate() && manager.hasPointer && state === manager.activeZone;
    const focus = isDynamic
      ? getDynamicFocus(state)
      : getSafeFocusFromPoint(state, getFieldCenter(state));

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const normalizedDistance = getNormalizedSpotlightDistance(state.field, point, focus.x, focus.y);
      if (normalizedDistance > 1) continue;

      const falloff = 1 - smoothstep(0, 1, normalizedDistance);
      const sizeLift = Math.pow(falloff, SIZE_FALLOFF_EXPONENT);
      const opacityLift = Math.pow(falloff, OPACITY_FALLOFF_EXPONENT);
      const edgeFade = 1 - smoothstep(SPOTLIGHT_EDGE_FADE_START, 1, normalizedDistance);
      const influence = isDynamic ? falloff : 0;

      const radius = (
        BASE_RADIUS +
        sizeLift * STATIC_RADIUS_BOOST +
        influence * INTERACTIVE_RADIUS_BOOST
      );
      const sectionEdgeFade = getSectionEdgeFade(state, point, radius);

      const opacity = clamp((
        BASE_OPACITY +
        opacityLift * STATIC_OPACITY_BOOST +
        influence * INTERACTIVE_OPACITY_BOOST
      ) * edgeFade * sectionEdgeFade * state.opacityMultiplier, 0, 1);

      if (radius < 0.35 || opacity < 0.002) continue;

      context.beginPath();
      context.strokeStyle = `rgba(${STROKE_COLOR}, ${opacity})`;
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function isNearViewport(state) {
    const radius = state.field ? state.field.radiusY : SPOTLIGHT_RADIUS;
    return state.viewportBottom >= -radius && state.viewportTop <= window.innerHeight + radius;
  }

  function getDynamicFocus(state) {
    const focus = {
      x: manager.cursorClientX - state.viewportLeft,
      y: manager.cursorClientY - state.viewportTop,
    };

    return LIMIT_FOCUS_TO_SAFE_AREA ? getSafeFocusFromPoint(state, focus) : focus;
  }

  function getNormalizedSpotlightDistance(field, point, focusX, focusY) {
    const dx = (point.x - focusX) / field.radiusX;
    const dy = (point.y - focusY) / field.radiusY;

    return Math.hypot(dx, dy);
  }

  function getFieldCoordinate(value, size, defaultValue) {
    // Supports %, px, and bare percentages.
    const coordinate = typeof value === 'string' && value.trim() ? value.trim() : defaultValue;
    const numericValue = parseFloat(coordinate);

    if (!Number.isFinite(numericValue)) {
      return size * 0.5;
    }

    if (coordinate.endsWith('px')) return numericValue;
    if (coordinate.endsWith('%')) return size * (numericValue / 100);

    return size * (numericValue / 100);
  }

  function getSafeFocusFromPoint(state, point) {
    return getSafeFocus(state, point.x, point.y);
  }

  function getSafeFocus(state, x, y) {
    if (!state.field || FOCUS_SAFE_ZONE <= 0) return { x, y };

    const insetX = state.field.radiusX * FOCUS_SAFE_ZONE;
    const insetY = state.field.radiusY * FOCUS_SAFE_ZONE;
    const boundsWidth = Math.min(state.width, MAX_FOCUS_WIDTH);
    const boundsLeft = (state.width - boundsWidth) / 2;
    const boundsRight = boundsLeft + boundsWidth;

    return {
      x: clamp(x, boundsLeft + insetX, boundsRight - insetX),
      y: clamp(y, insetY, state.height - insetY),
    };
  }

  function getFieldCenter(state) {
    if (!state.field) return { x: state.width / 2, y: state.height / 2 };

    return {
      x: state.field.x,
      y: state.field.y,
    };
  }

  function getSectionEdgeFade(state, point, radius) {
    // Avoid hard clipping at real zone edges. Use one shared [data-circle-zone]
    // wrapper when multiple light sections should render without an internal seam.
    if (SECTION_EDGE_FADE <= 0) return 1;

    const edgeDistance = Math.min(
      point.x,
      point.y,
      state.width - point.x,
      state.height - point.y,
    );
    const visibleDistance = edgeDistance - radius;

    return smoothstep(0, SECTION_EDGE_FADE, visibleDistance);
  }

  function getOpacityMultiplier(section) {
    return section.getAttribute('data-circle-zone') === DARK_FIELD_VALUE
      ? DARK_FIELD_OPACITY_MULTIPLIER
      : 1;
  }

  function getCursorDistanceToTarget() {
    return Math.hypot(
      manager.targetClientX - manager.cursorClientX,
      manager.targetClientY - manager.cursorClientY,
    );
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function smoothstep(edge0, edge1, value) {
    const x = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);

    return x * x * (3 - 2 * x);
  }

  function canShowField() {
    return !touchOnly.matches;
  }

  function canAnimate() {
    return canShowField() && finePointer.matches && !prefersReducedMotion.matches;
  }

  function refreshMotionMode() {
    stop();
    manager.hasPointer = false;
    manager.activeZone = null;

    zones.forEach(state => {
      state.canvas.style.display = canShowField() ? 'block' : 'none';
    });

    drawAll();
  }

  function stop() {
    if (!manager.rafId) return;

    cancelAnimationFrame(manager.rafId);
    manager.rafId = null;
  }

  function addMediaListener(query, handler) {
    if (query.addEventListener) {
      query.addEventListener('change', handler);
      return;
    }

    query.addListener(handler);
  }

  addMediaListener(prefersReducedMotion, refreshMotionMode);
  addMediaListener(finePointer, refreshMotionMode);
  addMediaListener(touchOnly, refreshMotionMode);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;

    stop();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
