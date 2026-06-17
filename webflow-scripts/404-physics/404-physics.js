(function contextual404PhysicsInit() {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  var CONFIG = {
    shapes: [
      { id: 'left-navy-crescent',  src: './assets/shape-left-navy-crescent.svg',  width: 236, height: 118, angle:  -90, body: { type: 'rect',   width: 236, height: 118, radius: 24  }, mass: 4.8 },
      { id: 'blue-ring',           src: './assets/shape-blue-ring.svg',           width: 108, height: 108, angle:    0, body: { type: 'circle', radius: 54                            }, mass: 2   },
      { id: 'navy-wedge',          src: './assets/shape-navy-wedge.svg',          width: 170, height:  85, angle:   62, body: { type: 'rect',   width: 170, height:  85, radius: 18  }, mass: 3   },
      { id: 'lavender-dome',       src: './assets/shape-lavender-dome.svg',       width: 207, height: 103, angle:  180, body: { type: 'rect',   width: 207, height: 103, radius: 28  }, mass: 3.4 },
      { id: 'blue-arch',           src: './assets/shape-blue-arch.svg',           width: 280, height: 140, angle:  180, body: { type: 'rect',   width: 280, height: 140, radius: 28  }, mass: 4   },
      { id: 'navy-circle',         src: './assets/shape-navy-circle.svg',         width: 149, height: 149, angle:    0, body: { type: 'circle', radius: 74.5                         }, mass: 2.8 },
      { id: 'small-navy-bowl',     src: './assets/shape-small-navy-bowl.svg',     width: 156, height:  78, angle:   18, body: { type: 'rect',   width: 156, height:  78, radius: 18  }, mass: 2.4 },
      { id: 'large-blue-crescent', src: './assets/shape-large-blue-crescent.svg', width: 428, height: 214, angle:  150, body: { type: 'rect',   width: 428, height: 214, radius: 36  }, mass: 6   },
    ],

    layout: {
      frameWidth:       1440,
      mobileBreakpoint:  768,
      mobileScale:       0.6,
    },

    physics: {
      gravityScale:  0.001,
      restitution:   0.48,
      friction:      0.6,
      frictionAir:   0.012,
      throwVelocity: 0.6,
    },

    bounds: {
      wallBleed:          12,
      wallThickness:     320,
      floorSink:           1,
      minVisibleFraction:  0.5,
    },

    spawn: {
      stagger:     80,  // ms between shapes
      angleJitter: 20,  // ±deg random rotation at spawn
      zoneJitter:  0.4, // ±fraction of zone width for x scatter
    },

    button: {
      obstacleSelector: '[data-ctx-404-obstacle]',
      obstacleCategory: 0x0004,
      chamfer:           12,
    },
  };

  // ─── MODULE STATE ──────────────────────────────────────────────────────────
  var ROOT_SELECTOR  = '[data-ctx-404-physics]';
  var STAGE_SELECTOR = '[data-ctx-404-physics-stage]';
  var REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

  var staticMode           = new URLSearchParams(window.location.search).has('static');
  var prefersReducedMotion = window.matchMedia(REDUCED_MOTION);
  var resizeTimer          = null;
  var state                = null;
  var Matter               = window.Matter;

  onReady(init);

  // ─── INIT ──────────────────────────────────────────────────────────────────
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
    if (!stage.classList.contains('ctx404__stage')) {
      stage.classList.add('ctx404__stage');
    }

    prepareSectionStage(root, stage);

    if (staticMode || !Matter || prefersReducedMotion.matches) {
      root.setAttribute('data-static', 'true');
      renderStatic(stage, computeLayout());
      bindResize(root, stage);
      bindReducedMotion(root, stage);
      return;
    }

    state = createWorld(stage);
    bindResize(root, stage);
    bindReducedMotion(root, stage);

    window.Contextual404Physics = {
      refresh: function () { destroyWorld(); state = createWorld(stage); },
      destroy: destroyWorld,
    };
  }

  function onReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  }

  // ─── LAYOUT ────────────────────────────────────────────────────────────────
  function getGroundY(vh) {
    var footer = document.querySelector('[data-ctx-404-footer]');
    if (footer) return footer.getBoundingClientRect().top;
    return vh;
  }

  function computeLayout() {
    var vw       = Math.max(320, window.innerWidth  || CONFIG.layout.frameWidth);
    var vh       = Math.max(560, window.innerHeight || 900);
    var isMobile = vw < CONFIG.layout.mobileBreakpoint;
    var scale    = isMobile ? CONFIG.layout.mobileScale : 1;
    var groundY  = getGroundY(vh);
    return { vw: vw, vh: vh, scale: scale, isMobile: isMobile, groundY: groundY };
  }

  // ─── STATIC RENDER (reduced-motion / ?static) ──────────────────────────────
  function renderStatic(stage, layout) {
    stage.replaceChildren();
    var vw      = layout.vw;
    var groundY = layout.groundY;
    var scale   = layout.scale;
    var sink    = CONFIG.bounds.floorSink;
    var n       = CONFIG.shapes.length;
    var zoneW   = vw / n;

    CONFIG.shapes.forEach(function (shape, i) {
      var sw = shape.width  * scale;
      var sh = shape.height * scale;
      var el = createShapeElement(shape, sw, sh);
      el.style.pointerEvents = 'none';
      var cx = (i + 0.5) * zoneW;
      var cy = groundY - sink - sh / 2;
      applyTransform(el, cx, cy, shape.angle, 'deg', 1, 1, sw, sh);
      stage.appendChild(el);
    });
  }

  // ─── PHYSICS WORLD ─────────────────────────────────────────────────────────
  function createWorld(stage) {
    var Engine    = Matter.Engine;
    var Runner    = Matter.Runner;
    var Bodies    = Matter.Bodies;
    var Body      = Matter.Body;
    var Composite = Matter.Composite;
    var Events    = Matter.Events;

    var layout = computeLayout();
    stage.replaceChildren();

    var engine = Engine.create({
      gravity: { x: 0, y: 1, scale: CONFIG.physics.gravityScale },
      enableSleeping: true,
    });

    var walls = createWalls(Bodies, layout);
    Composite.add(engine.world, walls);

    var obstacles = createObstacles(Bodies, layout);
    if (obstacles.length) Composite.add(engine.world, obstacles);

    var runner = Runner.create();
    Runner.run(runner, engine);

    var physicsItems = spawnShapes(stage, Bodies, Body, Composite, engine, layout);

    Events.on(engine, 'afterUpdate', function () {
      physicsItems.forEach(function (item) {
        rescueOutOfBoundsBody(item, layout, Body);
        syncElement(item);
      });
    });

    return {
      stage:        stage,
      engine:       engine,
      runner:       runner,
      walls:        walls,
      obstacles:    obstacles,
      layout:       layout,
      physicsItems: physicsItems,
      cleanupDrag:  bindPointerDrag(stage, physicsItems, Body),
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

  // ─── SPAWN ─────────────────────────────────────────────────────────────────
  function shapeById(id) {
    for (var i = 0; i < CONFIG.shapes.length; i++) {
      if (CONFIG.shapes[i].id === id) return CONFIG.shapes[i];
    }
  }

  function variantOf(id, newSrc) {
    var s = shapeById(id);
    return { id: s.id, src: newSrc, width: s.width, height: s.height,
             angle: s.angle, body: s.body, mass: s.mass };
  }

  function getSpawnList(vw) {
    var base = CONFIG.shapes;

    var extraRing = variantOf('blue-ring',          './assets/shape-blue-ring-dark.svg');
    var extraBowl = variantOf('small-navy-bowl',    './assets/shape-small-navy-bowl-lavender.svg');
    var extraDome = variantOf('lavender-dome',      './assets/shape-lavender-dome-dark.svg');
    var extraArch = variantOf('blue-arch',          './assets/shape-blue-arch-dark.svg');
    var extraCres = variantOf('left-navy-crescent', './assets/shape-left-navy-crescent-blue.svg');

    if (vw >= 1920) {
      var extra1920 = base
        .filter(function(s) { return s.id !== 'large-blue-crescent'; })
        .map(function(s) {
          if (s.id === 'blue-ring')          return extraRing;
          if (s.id === 'small-navy-bowl')    return extraBowl;
          if (s.id === 'lavender-dome')      return extraDome;
          if (s.id === 'blue-arch')          return extraArch;
          if (s.id === 'left-navy-crescent') return extraCres;
          return s;
        });
      return base.concat(extra1920); // 15
    }
    if (vw >= 1760) return base.concat([
      shapeById('navy-circle'),
      extraDome,
      extraRing,
      extraBowl,
    ]); // 12
    if (vw >= 1440) return base.concat([extraRing, extraBowl]); // 10
    return base; // 8
  }

  // Shapes drop from above the viewport in staggered left-to-right zones.
  // Physics handles all settling — no pre-placed sleeping bodies.
  function spawnShapes(stage, Bodies, Body, Composite, engine, layout) {
    var vw      = layout.vw;
    var scale   = layout.scale;
    var shapes  = getSpawnList(vw);
    var n       = shapes.length;
    var zoneW   = vw / n;
    var stagger = CONFIG.spawn.stagger;
    var jitter  = CONFIG.spawn.zoneJitter;
    var aJitter = CONFIG.spawn.angleJitter;
    var items   = [];

    shapes.forEach(function (shape, i) {
      var sc = scale;
      var sb = shape.body;
      var sw = shape.width  * sc;
      var sh = shape.height * sc;

      var zoneCenter = (i + 0.5) * zoneW;
      var spawnX = zoneCenter + (Math.random() * 2 - 1) * jitter * zoneW;
      if (shape.id === 'large-blue-crescent') {
        spawnX = vw * (0.75 + Math.random() * 0.15);
      }
      spawnX = clamp(spawnX, sw / 2, vw - sw / 2);
      var spawnY = -sh - 20;

      var opts = {
        isStatic:    false,
        restitution: CONFIG.physics.restitution,
        friction:    CONFIG.physics.friction,
        frictionAir: CONFIG.physics.frictionAir,
        collisionFilter: { category: 0x0001, mask: 0xFFFF },
        label: shape.id,
      };
      if (sb.radius && sb.type !== 'circle') {
        opts.chamfer = { radius: sb.radius * sc };
      }

      var body;
      if (sb.type === 'circle') {
        body = Bodies.circle(spawnX, spawnY, sb.radius * sc, opts);
      } else {
        body = Bodies.rectangle(spawnX, spawnY, sb.width * sc, sb.height * sc, opts);
      }
      Body.setMass(body, shape.mass);
      Body.setAngle(body, toRadians(shape.angle + (Math.random() * 2 - 1) * aJitter));

      var el = createShapeElement(shape, sw, sh);
      stage.appendChild(el);

      var item = { element: el, body: body, sw: sw, sh: sh, shape: shape };
      items.push(item);
      syncElement(item); // position element above viewport before body enters world

      window.setTimeout(function () {
        Composite.add(engine.world, body);
      }, i * stagger);
    });

    return items;
  }

  // ─── WALLS & OBSTACLES ─────────────────────────────────────────────────────
  function createWalls(Bodies, layout) {
    var t    = CONFIG.bounds.wallThickness;
    var wb   = CONFIG.bounds.wallBleed;
    var gy   = layout.groundY;
    var sk   = CONFIG.bounds.floorSink;
    var vw   = layout.vw;
    var vh   = layout.vh;
    var opts = { isStatic: true, restitution: 0.18, friction: 0.82, render: { visible: false } };
    return [
      Bodies.rectangle(vw / 2,          gy + sk + t / 2, vw + t * 2, t,      opts), // floor
      Bodies.rectangle(-wb - t / 2,     vh / 2,           t,          vh * 2, opts), // left wall
      Bodies.rectangle(vw + wb + t / 2, vh / 2,           t,          vh * 2, opts), // right wall
    ];
  }

  function createObstacles(Bodies, layout) {
    var selector = CONFIG.button.obstacleSelector;
    var category = CONFIG.button.obstacleCategory;
    var chamfer  = CONFIG.button.chamfer;
    var result   = [];
    document.querySelectorAll(selector).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      result.push(Bodies.rectangle(
        r.left + r.width  / 2,
        r.top  + r.height / 2,
        r.width, r.height,
        {
          isStatic:        true,
          restitution:     0.2,
          friction:        0.8,
          collisionFilter: { category: category, mask: 0xFFFF },
          chamfer:         { radius: chamfer },
          label:           'obstacle',
          render:          { visible: false },
        }
      ));
    });
    return result;
  }

  // ─── DOM SYNC ──────────────────────────────────────────────────────────────
  function createShapeElement(shape, sw, sh) {
    var el  = document.createElement('div');
    var img = document.createElement('img');
    el.className = 'ctx404__shape';
    el.dataset.ctxShape = shape.id;
    el.style.width  = sw + 'px';
    el.style.height = sh + 'px';

    var src = shape.src;
    if (src.indexOf('./') === 0) {
      var baseUrl = window.CTX_404_ASSETS_BASE_URL || 'https://thankscavi.github.io/contextual-assets/webflow-scripts/404-physics/';
      src = baseUrl + src.substring(2);
    }
    img.src       = src;
    img.alt       = '';
    img.draggable = false;
    el.appendChild(img);
    return el;
  }

  function applyTransform(el, cx, cy, angle, angleUnit, scaleX, scaleY, sw, sh) {
    var x   = cx - sw / 2;
    var y   = cy - sh / 2;
    var rot = angle + (angleUnit === 'deg' ? 'deg' : 'rad');
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + rot + ') scaleX(' + scaleX + ') scaleY(' + scaleY + ')';
  }

  function syncElement(item) {
    var x = item.body.position.x - item.sw / 2;
    var y = item.body.position.y - item.sh / 2;
    item.element.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + item.body.angle + 'rad)';
  }

  function rescueOutOfBoundsBody(item, layout, Body) {
    var body = item.body;
    if (body.isStatic) return;

    var vw     = layout.vw;
    var vh     = layout.vh;
    var margin = Math.max(item.sw, item.sh, 200);
    var lost   = (
      body.position.x < -margin ||
      body.position.x > vw + margin ||
      body.position.y > vh + margin
    );
    if (lost) {
      Body.setPosition(body, {
        x: clamp(body.position.x, item.sw / 2, vw - item.sw / 2),
        y: clamp(body.position.y, -item.sh,    layout.groundY - item.sh / 2),
      });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      return;
    }

    // Visibility guard for sleeping bodies only
    if (!body.isSleeping) return;
    var minFrac = CONFIG.bounds.minVisibleFraction;
    var hw = item.sw / 2;
    var hh = item.sh / 2;
    var bx = body.position.x;
    var by = body.position.y;
    var visW = Math.min(bx + hw, vw) - Math.max(bx - hw, 0);
    var visH = Math.min(by + hh, layout.groundY) - Math.max(by - hh, 0);
    if (visW < 0) visW = 0;
    if (visH < 0) visH = 0;
    var frac = (visW * visH) / (item.sw * item.sh);
    if (frac < minFrac) {
      Body.setPosition(body, {
        x: clamp(bx, hw, vw - hw),
        y: clamp(by, hh, layout.groundY - hh),
      });
    }
  }

  // ─── DRAG ──────────────────────────────────────────────────────────────────
  function bindPointerDrag(stage, elements, Body) {
    var active   = null;
    var origMask = 0xFFFF;
    var obstCat  = CONFIG.button.obstacleCategory;
    var throwVel = CONFIG.physics.throwVelocity;

    function getWorldPt(event) {
      var r = stage.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    }

    function onDown(event) {
      var shapeEl = event.target.closest && event.target.closest('.ctx404__shape');
      if (!shapeEl) return;

      var item = null;
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].element === shapeEl) { item = elements[i]; break; }
      }
      if (!item) return;

      var pt = getWorldPt(event);
      active = {
        pointerId: event.pointerId,
        item:      item,
        offsetX:   pt.x - item.body.position.x,
        offsetY:   pt.y - item.body.position.y,
      };

      stage.setPointerCapture(event.pointerId);
      document.body.style.cursor = 'grabbing';
      if (Matter.Sleeping) Matter.Sleeping.set(item.body, false);
      Body.setVelocity(item.body, { x: 0, y: 0 });
      Body.setAngularVelocity(item.body, 0);

      origMask = item.body.collisionFilter.mask;
      item.body.collisionFilter = {
        category: item.body.collisionFilter.category,
        mask:     origMask & ~obstCat,
      };

      event.preventDefault();
    }

    function onMove(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      var pt   = getWorldPt(event);
      var body = active.item.body;
      var hw   = (body.bounds.max.x - body.bounds.min.x) / 2;
      var hh   = (body.bounds.max.y - body.bounds.min.y) / 2;
      var vw   = window.innerWidth;
      var vh   = window.innerHeight;
      var nextX = clamp(pt.x - active.offsetX, hw, vw - hw);
      var nextY = clamp(pt.y - active.offsetY, hh, vh - hh);

      Body.setVelocity(body, {
        x: (nextX - body.position.x) * throwVel,
        y: (nextY - body.position.y) * throwVel,
      });
      Body.setPosition(body, { x: nextX, y: nextY });
      event.preventDefault();
    }

    function onUp(event) {
      if (!active || event.pointerId !== active.pointerId) return;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      document.body.style.cursor = '';

      active.item.body.collisionFilter = {
        category: active.item.body.collisionFilter.category,
        mask:     origMask,
      };
      active = null;
    }

    stage.addEventListener('pointerdown',   onDown);
    stage.addEventListener('pointermove',   onMove);
    stage.addEventListener('pointerup',     onUp);
    stage.addEventListener('pointercancel', onUp);

    return function cleanup() {
      stage.removeEventListener('pointerdown',   onDown);
      stage.removeEventListener('pointermove',   onMove);
      stage.removeEventListener('pointerup',     onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
  }

  // ─── RESIZE ────────────────────────────────────────────────────────────────
  function bindResize(root, stage) {
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () { handleResize(root, stage); }, 180);
    }, { passive: true });
  }

  function handleResize(root, stage) {
    if (!state) {
      renderStatic(stage, computeLayout());
      return;
    }
    destroyWorld();
    state = createWorld(stage);
  }

  // ─── REDUCED-MOTION ────────────────────────────────────────────────────────
  function bindReducedMotion(root, stage) {
    if (!prefersReducedMotion.addEventListener) return;
    prefersReducedMotion.addEventListener('change', function (event) {
      if (event.matches) {
        root.setAttribute('data-static', 'true');
        destroyWorld();
        renderStatic(stage, computeLayout());
      } else {
        window.location.reload();
      }
    });
  }

  // ─── UTILITIES ─────────────────────────────────────────────────────────────
  function prepareSectionStage(root, stage) {
    if (stage.parentElement !== root) root.insertBefore(stage, root.firstChild);
    if (window.getComputedStyle(root).position === 'static') root.style.position = 'relative';
  }

  function toRadians(deg) { return deg * Math.PI / 180; }

  function clamp(v, lo, hi) {
    if (hi < lo) return (lo + hi) / 2;
    return Math.min(Math.max(v, lo), hi);
  }

}());
