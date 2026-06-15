(function contextual404PhysicsInit() {
  'use strict';

  var ROOT_SELECTOR = '[data-ctx-404-physics]';
  var STAGE_SELECTOR = '[data-ctx-404-physics-stage]';
  var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  var TILE_BASE = 1440;
  var FIGMA_HEIGHT = 900;
  var DROP_HEIGHT_BASE = 140;
  var STAGGER_MS = 50;
  var RESIZE_DELAY = 180;

  var staticMode = new URLSearchParams(window.location.search).has('static');
  var prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  var resizeTimer = null;
  var state = null;

  var Matter = window.Matter;

  var SHAPES = [
    {
      id: 'left-navy-crescent',
      src: './assets/shape-left-navy-crescent.svg',
      x: -36, y: 696, width: 236, height: 118, angle: -90,
      body: { type: 'rect', width: 184, height: 110, radius: 24 },
      mass: 4.8,
    },
    {
      id: 'blue-ring',
      src: './assets/shape-blue-ring.svg',
      x: 162, y: 792, width: 108, height: 108, angle: 0,
      body: { type: 'circle', radius: 54 },
      mass: 2,
    },
    {
      id: 'navy-wedge',
      src: './assets/shape-navy-wedge.svg',
      x: 300, y: 742, width: 170, height: 85, angle: 62,
      body: { type: 'rect', width: 150, height: 74, radius: 18 },
      mass: 3,
    },
    {
      id: 'lavender-dome',
      src: './assets/shape-lavender-dome.svg',
      x: 452, y: 797, width: 207, height: 103, angle: 0,
      body: { type: 'rect', width: 198, height: 92, radius: 28 },
      mass: 3.4,
    },
    {
      id: 'blue-arch',
      src: './assets/shape-blue-arch.svg',
      x: 573, y: 684, width: 280, height: 140, angle: 180,
      body: { type: 'rect', width: 260, height: 112, radius: 28 },
      mass: 4,
    },
    {
      id: 'navy-circle',
      src: './assets/shape-navy-circle.svg',
      x: 832, y: 750, width: 149, height: 149, angle: 0,
      body: { type: 'circle', radius: 74.5 },
      mass: 2.8,
    },
    {
      id: 'small-navy-bowl',
      src: './assets/shape-small-navy-bowl.svg',
      x: 1128, y: 738, width: 156, height: 78, angle: 18,
      body: { type: 'rect', width: 146, height: 66, radius: 18 },
      mass: 2.4,
    },
    {
      id: 'large-blue-crescent',
      src: './assets/shape-large-blue-crescent.svg',
      x: 1032, y: 646, width: 428, height: 214, angle: 150,
      body: { type: 'rect', width: 404, height: 174, radius: 36 },
      mass: 6,
    },
  ];

  onReady(init);

  function init() {
    var root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    var stage = root.querySelector(STAGE_SELECTOR);
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'ctx404__stage';
      stage.setAttribute('data-ctx-404-physics-stage', '');
      stage.setAttribute('aria-hidden', 'true');
      root.insertBefore(stage, root.firstChild);
    }

    prepareSectionStage(root, stage);

    if (staticMode || !Matter || prefersReducedMotion.matches) {
      root.setAttribute('data-static', 'true');
      renderStatic(stage, computeLayout());
      bindResize(root, stage);
      bindReducedMotion(root, stage);
      return;
    }

    state = createWorld(stage, true);
    bindResize(root, stage);
    bindReducedMotion(root, stage);

    window.Contextual404Physics = {
      refresh: function refresh() {
        destroyWorld();
        state = createWorld(stage, true);
      },
      destroy: destroyWorld,
    };
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  // --- Layout ---

  function computeLayout() {
    var vw = Math.max(320, window.innerWidth || TILE_BASE);
    var vh = Math.max(560, window.innerHeight || FIGMA_HEIGHT);
    var isMobile = vw < 768;
    var scale = isMobile ? 0.5 : 1;
    var deviceClass = isMobile ? 'mobile' : 'desktop';
    var tile = TILE_BASE * scale;
    // Anchor tiles to the left; extra tiles extend off the right edge and only
    // fill the gap. Keeps density constant (~1 motif per tile) at any width,
    // and `ceil` guarantees the right edge is always covered.
    var tileCount = Math.max(1, Math.ceil(vw / tile));
    var startX = 0;
    return { vw: vw, vh: vh, scale: scale, deviceClass: deviceClass, tile: tile, tileCount: tileCount, startX: startX };
  }

  function computeRestPositions(layout) {
    var positions = [];
    for (var t = 0; t < layout.tileCount; t++) {
      var tileOriginX = layout.startX + t * layout.tile;
      SHAPES.forEach(function(shape) {
        var sw = shape.width * layout.scale;
        var sh = shape.height * layout.scale;
        var gapFromFloor = (FIGMA_HEIGHT - (shape.y + shape.height)) * layout.scale;
        var restTopX = tileOriginX + shape.x * layout.scale;
        var restTopY = layout.vh - gapFromFloor - sh;
        positions.push({
          shape: shape,
          sw: sw,
          sh: sh,
          cx: restTopX + sw / 2,
          cy: restTopY + sh / 2,
        });
      });
    }
    return positions;
  }

  // --- Static (reduced-motion / no-JS) rendering ---

  function renderStatic(stage, layout) {
    stage.replaceChildren();
    computeRestPositions(layout).forEach(function(pos) {
      var el = createShapeElement(pos.shape, pos.sw, pos.sh);
      el.style.pointerEvents = 'none';
      el.style.transform = 'translate3d(' + (pos.cx - pos.sw / 2) + 'px, ' + (pos.cy - pos.sh / 2) + 'px, 0) rotate(' + pos.shape.angle + 'deg)';
      stage.appendChild(el);
    });
  }

  // --- Physics world ---

  function createWorld(stage, withDrop) {
    var Engine = Matter.Engine;
    var Runner = Matter.Runner;
    var Bodies = Matter.Bodies;
    var Body = Matter.Body;
    var Composite = Matter.Composite;
    var Events = Matter.Events;

    var layout = computeLayout();
    var positions = computeRestPositions(layout);

    stage.replaceChildren();

    var elements = [];
    var bodies = [];

    positions.forEach(function(pos) {
      var el = createShapeElement(pos.shape, pos.sw, pos.sh);
      stage.appendChild(el);

      // Drop: start above rest, hidden; no-drop: start at rest, visible
      var startY = withDrop
        ? pos.cy - (DROP_HEIGHT_BASE + Math.random() * 40) * layout.scale
        : pos.cy;
      var startAngle = withDrop
        ? toRadians(pos.shape.angle) + (Math.random() - 0.5) * toRadians(10)
        : toRadians(pos.shape.angle);

      if (withDrop) el.style.opacity = '0';

      var opts = {
        isStatic: false,
        restitution: 0.3,
        friction: 0.6,
        frictionAir: 0.02,
        collisionFilter: { category: 0x0001 },
      };
      if (pos.shape.body.radius) {
        opts.chamfer = { radius: pos.shape.body.radius * layout.scale };
      }

      var body;
      if (pos.shape.body.type === 'circle') {
        body = Bodies.circle(pos.cx, startY, pos.shape.body.radius * layout.scale, opts);
      } else {
        body = Bodies.rectangle(
          pos.cx, startY,
          pos.shape.body.width * layout.scale, pos.shape.body.height * layout.scale,
          opts
        );
      }
      Body.setMass(body, pos.shape.mass);
      Body.setAngle(body, startAngle);

      bodies.push(body);
      elements.push({ element: el, body: body, sw: pos.sw, sh: pos.sh });
    });

    var engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: true,
    });

    var walls = createWalls(Bodies, layout);
    Composite.add(engine.world, walls);
    // Bodies added below: immediately for no-drop, staggered for drop
    if (!withDrop) {
      Composite.add(engine.world, bodies);
    }

    Events.on(engine, 'afterUpdate', function() {
      elements.forEach(function(item) {
        rescueOutOfBoundsBody(item, layout, Body);
        syncElement(item);
      });
    });

    elements.forEach(syncElement);

    var runner = Runner.create();
    Runner.run(runner, engine);

    // Stagger: add each body to the world (and reveal its element) left→right.
    // Bodies are OFF-WORLD until their turn, so no frozen obstacles block falling shapes.
    if (withDrop) {
      var sorted = elements.slice().sort(function(a, b) {
        return a.body.position.x - b.body.position.x;
      });
      sorted.forEach(function(item, i) {
        window.setTimeout(function() {
          item.element.style.opacity = '1';
          Composite.add(engine.world, item.body);
        }, i * STAGGER_MS);
      });
    }

    var cleanupDrag = bindPointerDrag(stage, elements, Body);

    return {
      stage: stage,
      engine: engine,
      runner: runner,
      elements: elements,
      walls: walls,
      layout: layout,
      cleanupDrag: cleanupDrag,
      deviceClass: layout.deviceClass,
      tileCount: layout.tileCount,
    };
  }

  function destroyWorld() {
    if (!state) return;
    Matter.Runner.stop(state.runner);
    if (typeof state.cleanupDrag === 'function') state.cleanupDrag();
    Matter.Composite.clear(state.engine.world, false, true);
    Matter.Engine.clear(state.engine);
    state.stage.replaceChildren();
    state = null;
  }

  // --- Walls ---

  function createWalls(Bodies, layout) {
    var t = 320;
    var opts = { isStatic: true, restitution: 0.18, friction: 0.82, render: { visible: false } };
    var vw = layout.vw;
    var vh = layout.vh;
    return [
      Bodies.rectangle(vw / 2, vh + t / 2 - 2, vw + t * 2, t, opts),  // floor
      Bodies.rectangle(-t / 2, vh / 2, t, vh * 2, opts),               // left wall
      Bodies.rectangle(vw + t / 2, vh / 2, t, vh * 2, opts),           // right wall
    ];
  }

  // --- DOM sync ---

  function createShapeElement(shape, sw, sh) {
    var el = document.createElement('div');
    var img = document.createElement('img');
    el.className = 'ctx404__shape';
    el.dataset.ctxShape = shape.id;
    el.style.width = sw + 'px';
    el.style.height = sh + 'px';
    img.src = shape.src;
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
    return el;
  }

  function syncElement(item) {
    var x = item.body.position.x - item.sw / 2;
    var y = item.body.position.y - item.sh / 2;
    item.element.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + item.body.angle + 'rad)';
  }

  function rescueOutOfBoundsBody(item, layout, Body) {
    var body = item.body;
    var margin = Math.max(item.sw, item.sh, 160);
    var isLost = (
      body.position.x < -margin ||
      body.position.x > layout.vw + margin ||
      body.position.y < -margin ||
      body.position.y > layout.vh + margin
    );
    if (!isLost) return;
    Body.setPosition(body, {
      x: clamp(body.position.x, item.sw / 2, layout.vw - item.sw / 2),
      y: clamp(body.position.y, item.sh / 2, layout.vh - item.sh / 2),
    });
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }

  // --- Drag ---

  function bindPointerDrag(stage, elements, Body) {
    var active = null;

    function getWorldPoint(event) {
      var rect = stage.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function handlePointerDown(event) {
      var shapeEl = event.target.closest && event.target.closest('.ctx404__shape');
      if (!shapeEl) return;

      var item = null;
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].element === shapeEl) { item = elements[i]; break; }
      }
      if (!item) return;

      var pt = getWorldPoint(event);
      active = {
        pointerId: event.pointerId,
        item: item,
        offsetX: pt.x - item.body.position.x,
        offsetY: pt.y - item.body.position.y,
      };

      stage.setPointerCapture(event.pointerId);
      document.body.style.cursor = 'grabbing';
      // Wake sleeping body
      if (Matter.Sleeping) Matter.Sleeping.set(item.body, false);
      Body.setVelocity(item.body, { x: 0, y: 0 });
      Body.setAngularVelocity(item.body, 0);
      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      var pt = getWorldPoint(event);
      var body = active.item.body;
      var hw = active.item.sw / 2;
      var hh = active.item.sh / 2;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var nextX = clamp(pt.x - active.offsetX, hw, vw - hw);
      var nextY = clamp(pt.y - active.offsetY, hh, vh - hh);

      Body.setVelocity(body, {
        x: (nextX - body.position.x) * 0.3,
        y: (nextY - body.position.y) * 0.3,
      });
      Body.setPosition(body, { x: nextX, y: nextY });
      event.preventDefault();
    }

    function handlePointerUp(event) {
      if (!active || event.pointerId !== active.pointerId) return;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      document.body.style.cursor = '';
      active = null;
    }

    stage.addEventListener('pointerdown', handlePointerDown);
    stage.addEventListener('pointermove', handlePointerMove);
    stage.addEventListener('pointerup', handlePointerUp);
    stage.addEventListener('pointercancel', handlePointerUp);

    return function cleanupPointerDrag() {
      stage.removeEventListener('pointerdown', handlePointerDown);
      stage.removeEventListener('pointermove', handlePointerMove);
      stage.removeEventListener('pointerup', handlePointerUp);
      stage.removeEventListener('pointercancel', handlePointerUp);
    };
  }

  // --- Resize ---

  function bindResize(root, stage) {
    window.addEventListener('resize', function() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function() {
        handleResize(root, stage);
      }, RESIZE_DELAY);
    }, { passive: true });
  }

  function handleResize(root, stage) {
    var layout = computeLayout();

    if (!state) {
      renderStatic(stage, layout);
      return;
    }

    // Same device class and tile count → just reposition walls, let physics ride
    if (layout.tileCount === state.tileCount && layout.deviceClass === state.deviceClass) {
      var Composite = Matter.Composite;
      var Bodies = Matter.Bodies;
      state.walls.forEach(function(w) { Composite.remove(state.engine.world, w); });
      state.walls = createWalls(Bodies, layout);
      Composite.add(state.engine.world, state.walls);
      state.layout = layout;
      return;
    }

    // Layout class changed → full rebuild without drop animation
    destroyWorld();
    state = createWorld(stage, false);
  }

  // --- Reduced-motion ---

  function bindReducedMotion(root, stage) {
    if (!prefersReducedMotion.addEventListener) return;
    prefersReducedMotion.addEventListener('change', function(event) {
      if (event.matches) {
        root.setAttribute('data-static', 'true');
        destroyWorld();
        renderStatic(stage, computeLayout());
      } else {
        window.location.reload();
      }
    });
  }

  // --- Utilities ---

  function prepareSectionStage(root, stage) {
    if (stage.parentElement !== root) {
      root.insertBefore(stage, root.firstChild);
    }
    if (window.getComputedStyle(root).position === 'static') {
      root.style.position = 'relative';
    }
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }
}());
