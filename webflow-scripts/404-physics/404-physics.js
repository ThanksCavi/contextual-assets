(function contextual404PhysicsInit() {
  'use strict';

  var ROOT_SELECTOR = '[data-ctx-404-physics]';
  var STAGE_SELECTOR = '[data-ctx-404-physics-stage]';
  var OBSTACLE_SELECTOR = '[data-ctx-404-obstacle]';
  var FOOTER_SELECTOR = '[data-ctx-404-footer]';
  var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  var TILE_BASE = 1440;
  var FIGMA_HEIGHT = 900;
  var RESIZE_DELAY = 180;

  // Entrance (scripted drop-in) tuning. Shapes fall from random heights, in
  // random order, accelerating like gravity, with a soft landing bounce.
  var ENTRANCE_TOP_FRACTION = 0.32;   // highest a shape may start (≈1/3 from top)
  var ENTRANCE_LOW_FRACTION = 0.60;   // lowest start
  var ENTRANCE_MAX_DELAY = 300;       // spread of random start times
  var ENTRANCE_BOUNCE_MS = 240;

  var staticMode = new URLSearchParams(window.location.search).has('static');
  var prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  var resizeTimer = null;
  var state = null;
  var flashTimer = null;

  var Matter = window.Matter;

  // Hero motif — the 8 Figma shapes, in the 1440x900 design frame (x,y = top-left).
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

  // Accent shapes — a few MEDIUM shapes (not tiny) that echo the hero vocabulary
  // and fill the gaps in scale with the rest. Desktop only; skipped on mobile.
  var ACCENTS = [
    {
      id: 'accent-circle-1', src: './assets/shape-navy-circle.svg', desktopOnly: true,
      x: 332, y: 808, width: 92, height: 92, angle: 0,
      body: { type: 'circle', radius: 46 }, mass: 2.4,
    },
    {
      id: 'accent-dome-1', src: './assets/shape-lavender-dome.svg', desktopOnly: true,
      x: 660, y: 840, width: 122, height: 60, angle: 0,
      body: { type: 'rect', width: 114, height: 54, radius: 18 }, mass: 1.8,
    },
    {
      id: 'accent-ring-1', src: './assets/shape-blue-ring.svg', desktopOnly: true,
      x: 1000, y: 812, width: 88, height: 88, angle: 0,
      body: { type: 'circle', radius: 44 }, mass: 1.7,
    },
    {
      id: 'accent-wedge-1', src: './assets/shape-navy-wedge.svg', desktopOnly: true,
      x: 180, y: 780, width: 110, height: 55, angle: -30,
      body: { type: 'rect', width: 100, height: 48, radius: 12 }, mass: 1.6,
    },
    {
      id: 'accent-crescent-1', src: './assets/shape-left-navy-crescent-blue.svg', desktopOnly: true,
      x: 850, y: 830, width: 140, height: 70, angle: 45,
      body: { type: 'rect', width: 120, height: 60, radius: 16 }, mass: 2.0,
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

    // Programmatic z-index fallback: put stage (z-index 1) above description (z-index 0) but below everything else (z-index 10)
    var header = root.querySelector('.ctx404__header');
    if (header) {
      header.style.zIndex = 'auto';
    }
    ['.ctx404__logo', '.ctx404__tag', '.ctx404__title', 'h1', '.ctx404__button', '[data-ctx-404-obstacle]'].forEach(function(sel) {
      var el = root.querySelector(sel);
      if (el) {
        el.style.position = 'relative';
        el.style.zIndex = '10';
      }
    });
    var copyEl = root.querySelector('.ctx404__copy');
    if (copyEl) {
      copyEl.style.position = 'relative';
      copyEl.style.zIndex = '0';
    }

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
    var tileCount = Math.max(1, Math.ceil(vw / tile));
    var startX = 0;
    var bleed = 60 * scale;
    var footerEl = document.querySelector(FOOTER_SELECTOR);
    var footerHeight = footerEl ? footerEl.getBoundingClientRect().height : 0;
    var groundY = vh - footerHeight;
    var sink = (footerHeight > 0 ? 16 : 38) * scale;
    return { vw: vw, vh: vh, scale: scale, deviceClass: deviceClass, tile: tile, tileCount: tileCount, startX: startX, bleed: bleed, groundY: groundY, sink: sink };
  }

  // Choose shapes based on layout class (desktop gets decorative accents)
  function getMotif(layout) {
    return layout.deviceClass === 'mobile' ? SHAPES : SHAPES.concat(ACCENTS);
  }

  function cloneShapeWithSrc(shape, src) {
    return {
      id: shape.id,
      src: src,
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      angle: shape.angle,
      body: shape.body,
      mass: shape.mass
    };
  }

  function computeRestPositions(layout) {
    var motif = getMotif(layout);
    var positions = [];
    for (var t = 0; t < layout.tileCount; t++) {
      var tileOriginX = layout.startX + t * layout.tile;
      motif.forEach(function(shape) {
        var sw = shape.width * layout.scale;
        var sh = shape.height * layout.scale;
        var hw = rotatedHalfWidth(shape, layout.scale);
        var gapFromFloor = (FIGMA_HEIGHT - (shape.y + shape.height)) * layout.scale;
        var restTopX = tileOriginX + shape.x * layout.scale;
        var restTopY = layout.groundY + layout.sink - gapFromFloor - sh;
        var cx = restTopX + sw / 2;

        if (cx + hw < -layout.bleed || cx - hw > layout.vw + layout.bleed) return;

        // Custom color variants for tiled copies to prevent color repetition
        var src = shape.src;
        if (t > 0) {
          if (shape.id === 'blue-ring')          src = './assets/shape-blue-ring-dark.svg';
          else if (shape.id === 'small-navy-bowl')    src = './assets/shape-small-navy-bowl-lavender.svg';
          else if (shape.id === 'lavender-dome')      src = './assets/shape-lavender-dome-dark.svg';
          else if (shape.id === 'blue-arch')          src = './assets/shape-blue-arch-dark.svg';
          else if (shape.id === 'left-navy-crescent') src = './assets/shape-left-navy-crescent-blue.svg';
        }

        var resolvedShape = cloneShapeWithSrc(shape, src);

        positions.push({
          shape: resolvedShape,
          sw: sw,
          sh: sh,
          hw: hw,
          cx: cx,
          cy: restTopY + sh / 2,
        });
      });
    }
    nudgeEdgesToBleed(positions, layout);
    return positions;
  }

  function nudgeEdgesToBleed(positions, layout) {
    if (!positions.length) return;
    var edgeBleed = 44 * layout.scale;
    var leftMost = positions[0];
    var rightMost = positions[0];
    positions.forEach(function(p) {
      if (p.cx - p.hw < leftMost.cx - leftMost.hw) leftMost = p;
      if (p.cx + p.hw > rightMost.cx + rightMost.hw) rightMost = p;
    });
    var lVisLeft = leftMost.cx - leftMost.hw;
    if (lVisLeft > -edgeBleed) leftMost.cx -= (lVisLeft + edgeBleed);
    var rVisRight = rightMost.cx + rightMost.hw;
    if (rVisRight < layout.vw + edgeBleed) rightMost.cx += (layout.vw + edgeBleed - rVisRight);
  }

  function rotatedHalfWidth(shape, scale) {
    var w = shape.width * scale;
    var h = shape.height * scale;
    var a = toRadians(shape.angle);
    return (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  }

  // --- Static Render ---

  function renderStatic(stage, layout) {
    stage.replaceChildren();
    computeRestPositions(layout).forEach(function(pos) {
      var el = createShapeElement(pos.shape, pos.sw, pos.sh);
      el.style.pointerEvents = 'none';
      el.style.transform = slotTransform(pos);
      stage.appendChild(el);
    });
  }

  // --- World ---

  function createWorld(stage, animateIn) {
    var layout = computeLayout();
    var positions = computeRestPositions(layout);

    stage.replaceChildren();

    var elements = positions.map(function(pos) {
      var el = createShapeElement(pos.shape, pos.sw, pos.sh);
      stage.appendChild(el);
      return { element: el, pos: pos, sw: pos.sw, sh: pos.sh, body: null };
    });

    var world = {
      stage: stage,
      layout: layout,
      elements: elements,
      deviceClass: layout.deviceClass,
      tileCount: layout.tileCount,
      engine: null,
      runner: null,
      walls: null,
      obstacles: null,
      cleanupDrag: null,
      entranceRaf: 0,
      destroyed: false,
    };

    if (animateIn) {
      runEntrance(world, function() {
        if (!world.destroyed) startPhysics(world);
      });
    } else {
      elements.forEach(function(item) {
        item.element.style.transform = slotTransform(item.pos);
      });
      startPhysics(world);
    }

    return world;
  }

  function runEntrance(world, onComplete) {
    var layout = world.layout;
    var topLimit = layout.vh * ENTRANCE_TOP_FRACTION;
    var lowLimit = layout.vh * ENTRANCE_LOW_FRACTION;
    var btn = getObstacleRect(world.stage);

    var items = world.elements.map(function(item) {
      var pos = item.pos;
      var slotY = pos.cy - pos.sh / 2;
      var startY = topLimit + Math.random() * (lowLimit - topLimit);
      if (btn && pos.cx > btn.left - 90 && pos.cx < btn.right + 90) {
        startY = Math.max(startY, btn.bottom + 30);
      }
      startY = Math.min(startY, slotY - 70);
      var rise = slotY - startY;
      return {
        el: item.element,
        slotX: pos.cx - pos.sw / 2,
        slotY: slotY,
        startY: startY,
        rise: rise,
        angle: pos.shape.angle,
        startAngle: pos.shape.angle + (Math.random() - 0.5) * 26,
        delay: Math.random() * ENTRANCE_MAX_DELAY,
        fallDur: 360 + Math.sqrt(rise) * 26,
        bounceH: Math.min(26, rise * 0.06),
      };
    });

    items.forEach(function(it) {
      it.el.style.transform = entranceTransform(it.slotX, it.startY, it.startAngle, 0.96);
    });

    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var elapsed = now - start;
      var done = true;
      items.forEach(function(it) {
        var t = elapsed - it.delay;
        if (t < it.fallDur + ENTRANCE_BOUNCE_MS) done = false;
        var y, ang, scale;
        if (t <= 0) {
          y = it.startY; ang = it.startAngle; scale = 0.96;
        } else if (t < it.fallDur) {
          var f = t / it.fallDur;
          var e = f * f;
          y = it.startY + it.rise * e;
          ang = it.startAngle + (it.angle - it.startAngle) * e;
          scale = 0.96 + 0.04 * e;
        } else {
          var tb = clamp((t - it.fallDur) / ENTRANCE_BOUNCE_MS, 0, 1);
          y = it.slotY - it.bounceH * Math.sin(Math.PI * tb) * (1 - tb);
          ang = it.angle;
          scale = 1;
        }
        it.el.style.transform = entranceTransform(it.slotX, y, ang, scale);
      });
      if (done) { world.entranceRaf = 0; onComplete(); return; }
      world.entranceRaf = requestAnimationFrame(frame);
    }
    world.entranceRaf = requestAnimationFrame(frame);
  }

  function getObstacleRect(stage) {
    var el = document.querySelector(OBSTACLE_SELECTOR);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var sr = stage.getBoundingClientRect();
    return { left: r.left - sr.left, right: r.right - sr.left, top: r.top - sr.top, bottom: r.bottom - sr.top };
  }

  function startPhysics(world) {
    var Engine = Matter.Engine;
    var Runner = Matter.Runner;
    var Bodies = Matter.Bodies;
    var Body = Matter.Body;
    var Composite = Matter.Composite;
    var Events = Matter.Events;
    var Sleeping = Matter.Sleeping;
    var layout = world.layout;

    var engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: true,
    });

    var bodies = [];
    world.elements.forEach(function(item) {
      var shape = item.pos.shape;
      var opts = {
        restitution: 0.52,
        friction: 0.55,
        frictionAir: 0.010,
        collisionFilter: { category: 0x0001, mask: 0xFFFF },
      };
      if (shape.body.radius) opts.chamfer = { radius: shape.body.radius * layout.scale };

      var body = shape.body.type === 'circle'
        ? Bodies.circle(item.pos.cx, item.pos.cy, shape.body.radius * layout.scale, opts)
        : Bodies.rectangle(item.pos.cx, item.pos.cy, shape.body.width * layout.scale, shape.body.height * layout.scale, opts);

      Body.setMass(body, shape.mass);
      Body.setAngle(body, toRadians(shape.angle));
      item.body = body;
      bodies.push(body);
    });

    var walls = createWalls(Bodies, layout);
    var obstacles = createObstacles(Bodies, world.stage);
    Composite.add(engine.world, bodies.concat(walls, obstacles));

    bodies.forEach(function(b) { Sleeping.set(b, true); });

    Events.on(engine, 'afterUpdate', function() {
      world.elements.forEach(function(item) {
        rescueOutOfBoundsBody(item, world.layout, Body);
        syncElement(item);
      });
    });

    Events.on(engine, 'collisionStart', function(event) {
      event.pairs.forEach(function(pair) {
        if (pair.bodyA.label === 'obstacle' || pair.bodyB.label === 'obstacle') {
          triggerButtonFlash();
        }
      });
    });

    world.elements.forEach(syncElement);

    var runner = Runner.create();
    Runner.run(runner, engine);

    world.engine = engine;
    world.runner = runner;
    world.walls = walls;
    world.obstacles = obstacles;
    world.cleanupDrag = bindPointerDrag(world.stage, world.elements, Body);

    // Tab visibility handling to pause runner
    function handleVisibilityChange() {
      if (document.hidden) {
        if (runner) Runner.stop(runner);
      } else {
        if (runner && engine) Runner.run(runner, engine);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    world.cleanupVisibility = function() {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }

  function destroyWorld() {
    if (!state) return;
    state.destroyed = true;
    if (state.entranceRaf) cancelAnimationFrame(state.entranceRaf);
    if (state.runner) Matter.Runner.stop(state.runner);
    if (typeof state.cleanupDrag === 'function') state.cleanupDrag();
    if (typeof state.cleanupVisibility === 'function') state.cleanupVisibility();
    if (state.engine) {
      Matter.Composite.clear(state.engine.world, false, true);
      Matter.Engine.clear(state.engine);
    }
    state.stage.replaceChildren();
    state = null;
  }

  // --- Walls & obstacles ---

  function createWalls(Bodies, layout) {
    var t = 320;
    var opts = { isStatic: true, restitution: 0.18, friction: 0.82, render: { visible: false } };
    var vw = layout.vw;
    var vh = layout.vh;
    var b = layout.bleed;
    var floor = layout.groundY + layout.sink;
    return [
      Bodies.rectangle(vw / 2, floor + t / 2 - 2, vw + t * 2, t, opts),  // floor
      Bodies.rectangle(-b - t / 2, vh / 2, t, vh * 2, opts),             // left wall
      Bodies.rectangle(vw + b + t / 2, vh / 2, t, vh * 2, opts),         // right wall
      Bodies.rectangle(vw / 2, -60 - t / 2, vw + t * 2, t, opts),        // ceiling
    ];
  }

  function createObstacles(Bodies, stage) {
    var stageRect = stage.getBoundingClientRect();
    var els = document.querySelectorAll(OBSTACLE_SELECTOR);
    var obstacles = [];
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (!r.width || !r.height) continue;
      obstacles.push(Bodies.rectangle(
        r.left - stageRect.left + r.width / 2,
        r.top - stageRect.top + r.height / 2,
        r.width, r.height,
        {
          label: 'obstacle',
          isStatic: true,
          restitution: 0.4,
          friction: 0.6,
          chamfer: { radius: Math.min(12, r.height / 2) },
          render: { visible: false },
        }
      ));
    }
    return obstacles;
  }

  // --- DOM ---

  function createShapeElement(shape, sw, sh) {
    var el = document.createElement('div');
    var img = document.createElement('img');
    el.className = 'ctx404__shape';
    el.dataset.ctxShape = shape.id;
    el.style.width = sw + 'px';
    el.style.height = sh + 'px';

    var src = shape.src;
    if (src.indexOf('./') === 0) {
      var baseUrl = window.CTX_404_ASSETS_BASE_URL || 'https://thankscavi.github.io/contextual-assets/webflow-scripts/404-physics/';
      src = baseUrl + src.substring(2);
    }

    img.src = src;
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
    return el;
  }

  function slotTransform(pos) {
    return 'translate3d(' + (pos.cx - pos.sw / 2) + 'px, ' + (pos.cy - pos.sh / 2) + 'px, 0) rotate(' + pos.shape.angle + 'deg)';
  }

  function entranceTransform(x, y, angleDeg, scale) {
    return 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + angleDeg + 'deg) scale(' + scale + ')';
  }

  function syncElement(item) {
    if (!item.body) return;
    var x = item.body.position.x - item.sw / 2;
    var y = item.body.position.y - item.sh / 2;
    item.element.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + item.body.angle + 'rad)';
  }

  // Keep shapes in bounds
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

    function getWorldPoint(event, rect) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function handlePointerDown(event) {
      var shapeEl = event.target.closest && event.target.closest('.ctx404__shape');
      if (!shapeEl) return;

      var item = null;
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].element === shapeEl) { item = elements[i]; break; }
      }
      if (!item || !item.body) return;

      var stageRect = stage.getBoundingClientRect();
      var pt = getWorldPoint(event, stageRect);
      active = {
        pointerId: event.pointerId,
        item: item,
        offsetX: pt.x - item.body.position.x,
        offsetY: pt.y - item.body.position.y,
        stageRect: stageRect,
        trail: [{ x: item.body.position.x, y: item.body.position.y, t: performance.now() }],
        origCollisionFilter: item.body.collisionFilter
      };

      stage.setPointerCapture(event.pointerId);
      item.element.classList.add('is-dragging');
      document.body.style.cursor = 'grabbing';
      
      if (Matter.Sleeping) Matter.Sleeping.set(item.body, false);
      Body.setVelocity(item.body, { x: 0, y: 0 });
      Body.setAngularVelocity(item.body, 0);

      // Disable ALL collisions during drag
      item.body.collisionFilter = {
        category: item.body.collisionFilter.category,
        mask: 0x0000
      };

      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      var pt = getWorldPoint(event, active.stageRect);
      var body = active.item.body;
      var hw = active.item.sw / 2;
      var hh = active.item.sh / 2;
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var nextX = clamp(pt.x - active.offsetX, hw, vw - hw);
      var nextY = clamp(pt.y - active.offsetY, hh, vh - hh);

      // Add to position trail
      var now = performance.now();
      active.trail.push({ x: nextX, y: nextY, t: now });
      if (active.trail.length > 5) active.trail.shift();

      // Instantly position and override gravity velocity buildup
      Body.setPosition(body, { x: nextX, y: nextY });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      
      event.preventDefault();
    }

    function handlePointerUp(event) {
      if (!active || event.pointerId !== active.pointerId) return;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      
      active.item.element.classList.remove('is-dragging');
      document.body.style.cursor = '';

      // Restore collisions
      if (active.origCollisionFilter) {
        active.item.body.collisionFilter = active.origCollisionFilter;
      }

      // Calculate throw velocity from trail
      var trail = active.trail;
      var vel = { x: 0, y: 0 };
      if (trail.length >= 2) {
        var last = trail[trail.length - 1];
        var prev = trail[Math.max(0, trail.length - 3)];
        var dt = (last.t - prev.t) || 16.67;
        vel.x = ((last.x - prev.x) / dt) * 6; // scale factor
        vel.y = ((last.y - prev.y) / dt) * 6;

        // Cap maximum velocity
        var maxSpeed = 15;
        var speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > maxSpeed) {
          vel.x = (vel.x / speed) * maxSpeed;
          vel.y = (vel.y / speed) * maxSpeed;
        }
      }

      Body.setVelocity(active.item.body, vel);

      // Add slight premium spin rotation on throw
      var angularVel = vel.x * 0.005;
      Body.setAngularVelocity(active.item.body, clamp(angularVel, -0.15, 0.15));

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

    if (layout.tileCount === state.tileCount && layout.deviceClass === state.deviceClass && state.engine) {
      var Composite = Matter.Composite;
      var Bodies = Matter.Bodies;
      var Body = Matter.Body;

      state.walls.concat(state.obstacles).forEach(function(b) {
        Composite.remove(state.engine.world, b);
      });
      state.walls = createWalls(Bodies, layout);
      state.obstacles = createObstacles(Bodies, stage);
      Composite.add(state.engine.world, state.walls.concat(state.obstacles));

      var positions = computeRestPositions(layout);
      state.elements.forEach(function(item, i) {
        item.pos = positions[i];
        if (item.body && item.body.isSleeping) {
          Body.setPosition(item.body, { x: positions[i].cx, y: positions[i].cy });
          Body.setAngle(item.body, toRadians(positions[i].shape.angle));
        }
      });
      state.layout = layout;
      return;
    }

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

  // Polyfill Object.assign if needed for older environments
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null to object');
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          for (var nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }

  function triggerButtonFlash() {
    var btn = document.querySelector(OBSTACLE_SELECTOR);
    if (!btn) return;
    btn.classList.remove('is-hit');
    void btn.offsetWidth;
    btn.classList.add('is-hit');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function() {
      btn.classList.remove('is-hit');
    }, 400);
  }
}());
