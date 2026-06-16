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
    // How far a shape may bleed past the viewport edge (and where side walls sit).
    var bleed = 60 * scale;
    // Ground = top of the footer if present, else the viewport bottom. Shapes
    // sink slightly into the ground so there's no seam (and they bleed off the
    // bottom edge when there's no footer).
    var footerEl = document.querySelector(FOOTER_SELECTOR);
    var footerHeight = footerEl ? footerEl.getBoundingClientRect().height : 0;
    var groundY = vh - footerHeight;
    var sink = (footerHeight > 0 ? 16 : 38) * scale;
    return { vw: vw, vh: vh, scale: scale, deviceClass: deviceClass, tile: tile, tileCount: tileCount, startX: startX, bleed: bleed, groundY: groundY, sink: sink };
  }

  function getMotif(layout) {
    return layout.deviceClass === 'mobile' ? SHAPES : SHAPES.concat(ACCENTS);
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
        // Cull by the ROTATED visual extent: keep a shape only if its visible
        // pixels reach the viewport (a rotated crescent is much narrower than its
        // box). Bodies are placed asleep, so kept off-screen shapes never pile.
        if (cx + hw < -layout.bleed || cx - hw > layout.vw + layout.bleed) return;
        positions.push({
          shape: shape,
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

  // The shape nearest each edge may not visually reach it (rotation/hollow form).
  // Slide the outermost shape outward so its solid part bleeds off the edge —
  // matching the designer's corner crescents. Only nudges if there's a gap.
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

  // Half-width of a shape's axis-aligned box after CSS rotation around its centre.
  function rotatedHalfWidth(shape, scale) {
    var w = shape.width * scale;
    var h = shape.height * scale;
    var a = toRadians(shape.angle);
    return (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  }

  // --- Static (reduced-motion / no-JS) rendering ---

  function renderStatic(stage, layout) {
    stage.replaceChildren();
    computeRestPositions(layout).forEach(function(pos) {
      var el = createShapeElement(pos.shape, pos.sw, pos.sh);
      el.style.pointerEvents = 'none';
      el.style.transform = slotTransform(pos);
      stage.appendChild(el);
    });
  }

  // --- World (entrance → physics) ---

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

  // Scripted drop-in: shapes fall from random heights, in random order,
  // accelerating like gravity, and settle with a soft bounce. Shapes over the
  // button start below it so they never drop onto it. No physics yet — the
  // resting layout stays deterministic and gapless.
  function runEntrance(world, onComplete) {
    var layout = world.layout;
    var topLimit = layout.vh * ENTRANCE_TOP_FRACTION;
    var lowLimit = layout.vh * ENTRANCE_LOW_FRACTION;
    var btn = getObstacleRect(world.stage);

    var items = world.elements.map(function(item) {
      var pos = item.pos;
      var slotY = pos.cy - pos.sh / 2;
      var startY = topLimit + Math.random() * (lowLimit - topLimit);
      // Keep shapes above the button from dropping onto it.
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

    // Place at the start of the fall synchronously so nothing flashes at (0,0).
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
          var e = f * f;                       // accelerate downward (gravity)
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

  // Bounding rect of the first obstacle (button), in stage-local coords.
  function getObstacleRect(stage) {
    var el = document.querySelector(OBSTACLE_SELECTOR);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var sr = stage.getBoundingClientRect();
    return { left: r.left - sr.left, right: r.right - sr.left, top: r.top - sr.top, bottom: r.bottom - sr.top };
  }

  // Build the Matter world at the settled slots and hand interaction over to it.
  // Bodies are created asleep so gravity can't drift them off their slots; the
  // first drag/throw wakes them.
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
        restitution: 0.4,
        friction: 0.6,
        frictionAir: 0.012,
        collisionFilter: { category: 0x0001 },
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

    // Freeze every shape at its slot until the user interacts with it.
    bodies.forEach(function(b) { Sleeping.set(b, true); });

    Events.on(engine, 'afterUpdate', function() {
      world.elements.forEach(function(item) {
        rescueOutOfBoundsBody(item, world.layout, Body);
        syncElement(item);
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
  }

  function destroyWorld() {
    if (!state) return;
    state.destroyed = true;
    if (state.entranceRaf) cancelAnimationFrame(state.entranceRaf);
    if (state.runner) Matter.Runner.stop(state.runner);
    if (typeof state.cleanupDrag === 'function') state.cleanupDrag();
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
    // Side walls sit `bleed` outside the viewport so edge shapes can rest
    // partly off-screen; the floor sits at the ground (footer top or viewport bottom).
    return [
      Bodies.rectangle(vw / 2, floor + t / 2 - 2, vw + t * 2, t, opts),  // floor
      Bodies.rectangle(-b - t / 2, vh / 2, t, vh * 2, opts),             // left wall
      Bodies.rectangle(vw + b + t / 2, vh / 2, t, vh * 2, opts),         // right wall
    ];
  }

  // Static bodies matching tagged page elements (e.g. the button) so thrown
  // shapes bounce off the real content.
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
    img.src = shape.src;
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
      if (!item || !item.body) return;

      var pt = getWorldPoint(event);
      active = {
        pointerId: event.pointerId,
        item: item,
        offsetX: pt.x - item.body.position.x,
        offsetY: pt.y - item.body.position.y,
      };

      stage.setPointerCapture(event.pointerId);
      document.body.style.cursor = 'grabbing';
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
        x: (nextX - body.position.x) * 0.62,
        y: (nextY - body.position.y) * 0.62,
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

    // Same shape set → re-anchor cheaply: move walls/obstacles and re-seat the
    // still-sleeping shapes onto the new viewport bottom (leave thrown ones alone).
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

    // Shape set changed → rebuild deterministically, no entrance replay.
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
