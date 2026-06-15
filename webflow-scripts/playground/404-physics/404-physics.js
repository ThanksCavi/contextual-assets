(function contextual404PhysicsInit() {
  'use strict';

  var ROOT_SELECTOR = '[data-ctx-404-physics]';
  var STAGE_SELECTOR = '[data-ctx-404-physics-stage]';
  var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  var BASE_WIDTH = 1440;
  var BASE_HEIGHT = 900;
  var RESET_DELAY = 180;
  var staticMode = new URLSearchParams(window.location.search).has('static');
  var prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  var resizeTimer = null;
  var resizeObserver = null;
  var state = null;

  var Matter = window.Matter;

  var SHAPES = [
    {
      id: 'left-navy-crescent',
      nodeId: '2380:4223',
      src: './assets/shape-left-navy-crescent.svg',
      x: -36,
      y: 696,
      width: 236,
      height: 118,
      angle: -90,
      body: { type: 'rect', width: 184, height: 110, radius: 24 },
      mass: 4.8,
    },
    {
      id: 'blue-ring',
      nodeId: '2380:4227',
      src: './assets/shape-blue-ring.svg',
      x: 162,
      y: 792,
      width: 108,
      height: 108,
      angle: 0,
      body: { type: 'circle', radius: 54 },
      mass: 2,
    },
    {
      id: 'navy-wedge',
      nodeId: '2380:4226',
      src: './assets/shape-navy-wedge.svg',
      x: 300,
      y: 742,
      width: 170,
      height: 85,
      angle: 62,
      body: { type: 'rect', width: 150, height: 74, radius: 18 },
      mass: 3,
    },
    {
      id: 'lavender-dome',
      nodeId: '2380:4225',
      src: './assets/shape-lavender-dome.svg',
      x: 452,
      y: 797,
      width: 207,
      height: 103,
      angle: 0,
      body: { type: 'rect', width: 198, height: 92, radius: 28 },
      mass: 3.4,
    },
    {
      id: 'blue-arch',
      nodeId: '2380:4222',
      src: './assets/shape-blue-arch.svg',
      x: 573,
      y: 684,
      width: 280,
      height: 140,
      angle: 180,
      body: { type: 'rect', width: 260, height: 112, radius: 28 },
      mass: 4,
    },
    {
      id: 'navy-circle',
      nodeId: '2380:4228',
      src: './assets/shape-navy-circle.svg',
      x: 832,
      y: 750,
      width: 149,
      height: 149,
      angle: 0,
      body: { type: 'circle', radius: 74.5 },
      mass: 2.8,
    },
    {
      id: 'small-navy-bowl',
      nodeId: '2380:4224',
      src: './assets/shape-small-navy-bowl.svg',
      x: 1128,
      y: 738,
      width: 156,
      height: 78,
      angle: 18,
      body: { type: 'rect', width: 146, height: 66, radius: 18 },
      mass: 2.4,
    },
    {
      id: 'large-blue-crescent',
      nodeId: '2380:4221',
      src: './assets/shape-large-blue-crescent.svg',
      x: 1032,
      y: 646,
      width: 428,
      height: 214,
      angle: 150,
      body: { type: 'rect', width: 404, height: 174, radius: 36 },
      mass: 6,
    },
  ];

  onReady(init);

  function init() {
    var root = document.querySelector(ROOT_SELECTOR);
    var stage = root && root.querySelector(STAGE_SELECTOR);
    if (!root || !stage) return;

    prepareSectionStage(root, stage);

    if (staticMode || !Matter || prefersReducedMotion.matches) {
      root.setAttribute('data-static', 'true');
      fitDesign(root);
      bindResize(root);
      return;
    }

    root.removeAttribute('data-static');
    fitDesign(root);
    state = createWorld(root, stage);
    bindResize(root, stage);
    bindReducedMotion(root);

    window.Contextual404Physics = {
      refresh: function refresh() {
        resetWorld(root, stage);
      },
      destroy: function destroy() {
        destroyWorld();
      },
    };
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function bindResize(root, stage) {
    function queueResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function afterResize() {
        fitDesign(root);
        if (stage && state && !prefersReducedMotion.matches) {
          resetWorld(root, stage);
        }
      }, RESET_DELAY);
    }

    window.addEventListener('resize', queueResize, { passive: true });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(queueResize);
      resizeObserver.observe(root);
    }
  }

  function bindReducedMotion(root) {
    if (!prefersReducedMotion.addEventListener) return;

    prefersReducedMotion.addEventListener('change', function handleMotionChange(event) {
      if (event.matches) {
        root.setAttribute('data-static', 'true');
        destroyWorld();
      } else {
        window.location.reload();
      }
    });
  }

  function fitDesign(root) {
    var viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || BASE_WIDTH);
    var viewportHeight = Math.max(560, window.innerHeight || document.documentElement.clientHeight || BASE_HEIGHT);
    var isMobile = viewportWidth < 768;
    var scale = isMobile
      ? Math.min(0.5, Math.max(0.39, viewportWidth / 780))
      : Math.min(viewportWidth / BASE_WIDTH, viewportHeight / BASE_HEIGHT);
    var frameWidth = BASE_WIDTH * scale;
    var frameHeight = BASE_HEIGHT * scale;
    var frameLeft = (viewportWidth - frameWidth) / 2;
    var frameTop = isMobile ? 0 : Math.max(0, (viewportHeight - frameHeight) / 2);

    root.style.setProperty('--ctx404-scale', String(scale));
    root.style.setProperty('--ctx404-frame-left', frameLeft + 'px');
    root.style.setProperty('--ctx404-frame-top', frameTop + 'px');
  }

  function createWorld(root, stage) {
    var Engine = Matter.Engine;
    var Runner = Matter.Runner;
    var Bodies = Matter.Bodies;
    var Body = Matter.Body;
    var Composite = Matter.Composite;
    var Mouse = Matter.Mouse;
    var MouseConstraint = Matter.MouseConstraint;

    var engine = Engine.create({
      gravity: { x: 0, y: 0.86, scale: 0.001 },
      timing: { timeScale: 1 },
    });
    var runner = Runner.create();
    var bodies = [];
    var elements = [];
    var layout = getWorldLayout(root, stage);

    stage.replaceChildren();

    SHAPES.forEach(function buildShape(shape, index) {
      var element = document.createElement('div');
      var image = document.createElement('img');
      var displayShape = getDisplayShape(shape, layout);
      var body = createBody(Bodies, displayShape, index);

      element.className = 'ctx404__shape';
      element.dataset.ctxShape = shape.id;
      element.dataset.nodeId = shape.nodeId;
      element.style.width = displayShape.width + 'px';
      element.style.height = displayShape.height + 'px';

      image.src = shape.src;
      image.alt = '';
      image.draggable = false;
      element.appendChild(image);
      stage.appendChild(element);

      Body.setMass(body, shape.mass);
      Body.setAngle(body, toRadians(shape.angle));

      bodies.push(body);
      elements.push({ element: element, body: body, shape: displayShape });
    });

    Composite.add(engine.world, bodies);
    Composite.add(engine.world, createWalls(Bodies, layout));

    var mouse = Mouse.create(stage);
    applyMouseScale(mouse, root);

    var mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.12,
        damping: 0.18,
        render: { visible: false },
      },
    });

    mouseConstraint.collisionFilter.mask = 0x0001;
    Composite.add(engine.world, mouseConstraint);
    var cleanupDrag = bindPointerDrag(root, stage, elements, Body);

    Matter.Events.on(engine, 'afterUpdate', function syncDom() {
      elements.forEach(function syncItem(item) {
        rescueOutOfBoundsBody(item, layout, Body);
        syncElement(item);
      });
    });

    elements.forEach(syncElement);
    Runner.run(runner, engine);

    return {
      root: root,
      stage: stage,
      engine: engine,
      layout: layout,
      runner: runner,
      mouse: mouse,
      mouseConstraint: mouseConstraint,
      elements: elements,
      cleanupDrag: cleanupDrag,
    };
  }

  function resetWorld(root, stage) {
    destroyWorld();
    state = createWorld(root, stage);
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

  function getWorldLayout(root, stage) {
    var design = root.querySelector('.ctx404__design');
    if (design) {
      return {
        designMode: true,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        scale: 1,
        xOffset: 0,
        yOffset: 0,
      };
    }

    var rect = root.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    var scale = getProductionScale(root, width, height);
    var xOffset = (width - BASE_WIDTH * scale) / 2;
    var yOffset = Math.max(0, height - BASE_HEIGHT * scale);

    return {
      designMode: false,
      width: width,
      height: height,
      scale: scale,
      xOffset: xOffset,
      yOffset: yOffset,
    };
  }

  function getProductionScale(root, width, height) {
    var override = Number(window.getComputedStyle(root).getPropertyValue('--ctx404-physics-scale'));
    if (Number.isFinite(override) && override > 0) return override;

    if (width < 768) {
      return Math.min(0.5, Math.max(0.39, width / 780));
    }

    return Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  }

  function getDisplayShape(shape, layout) {
    var scale = layout.scale;
    return {
      id: shape.id,
      nodeId: shape.nodeId,
      src: shape.src,
      x: layout.xOffset + shape.x * scale,
      y: layout.yOffset + shape.y * scale,
      width: shape.width * scale,
      height: shape.height * scale,
      angle: shape.angle,
      mass: shape.mass,
      body: {
        type: shape.body.type,
        width: shape.body.width ? shape.body.width * scale : undefined,
        height: shape.body.height ? shape.body.height * scale : undefined,
        radius: shape.body.radius ? shape.body.radius * scale : undefined,
      },
    };
  }

  function createBody(Bodies, shape) {
    var centerX = shape.x + shape.width / 2;
    var centerY = shape.y + shape.height / 2;
    var options = {
      restitution: 0.42,
      friction: 0.72,
      frictionAir: 0.012,
      density: 0.0016,
      collisionFilter: { category: 0x0001 },
      chamfer: shape.body.radius ? { radius: shape.body.radius } : undefined,
    };

    if (shape.body.type === 'circle') {
      return Bodies.circle(centerX, centerY, shape.body.radius, options);
    }

    return Bodies.rectangle(centerX, centerY, shape.body.width, shape.body.height, options);
  }

  function createWalls(Bodies, layout) {
    var thickness = 320;
    var wallOptions = {
      isStatic: true,
      restitution: 0.18,
      friction: 0.82,
      render: { visible: false },
    };

    return [
      Bodies.rectangle(layout.width / 2, layout.height + thickness / 2 - 2, layout.width + thickness * 2, thickness, wallOptions),
      Bodies.rectangle(-thickness / 2, layout.height / 2, thickness, layout.height * 2, wallOptions),
      Bodies.rectangle(layout.width + thickness / 2, layout.height / 2, thickness, layout.height * 2, wallOptions),
      Bodies.rectangle(layout.width / 2, -thickness, layout.width + thickness * 2, thickness, wallOptions),
    ];
  }

  function syncElement(item) {
    var body = item.body;
    var shape = item.shape;
    var x = body.position.x - shape.width / 2;
    var y = body.position.y - shape.height / 2;
    var angle = body.angle;

    item.element.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + angle + 'rad)';
  }

  function rescueOutOfBoundsBody(item, layout, Body) {
    var body = item.body;
    var shape = item.shape;
    var margin = Math.max(shape.width, shape.height, 160);
    var minX = shape.width / 2;
    var maxX = layout.width - shape.width / 2;
    var minY = shape.height / 2;
    var maxY = layout.height - shape.height / 2;
    var isLost = (
      body.position.x < -margin ||
      body.position.x > layout.width + margin ||
      body.position.y < -margin ||
      body.position.y > layout.height + margin
    );

    if (!isLost) return;

    Body.setPosition(body, {
      x: clamp(body.position.x, minX, maxX),
      y: clamp(body.position.y, minY, maxY),
    });
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function applyMouseScale(mouse, root) {
    var design = root.querySelector('.ctx404__design');
    var scale = design ? (design.getBoundingClientRect().width / BASE_WIDTH || 1) : 1;
    if (Matter.Mouse && typeof Matter.Mouse.setScale === 'function') {
      Matter.Mouse.setScale(mouse, { x: 1 / scale, y: 1 / scale });
    } else {
      mouse.scale.x = 1 / scale;
      mouse.scale.y = 1 / scale;
    }
  }

  function bindPointerDrag(root, stage, elements, Body) {
    var active = null;

    function handlePointerDown(event) {
      var shapeElement = event.target.closest && event.target.closest('.ctx404__shape');
      if (!shapeElement) return;

      var item = elements.find(function findItem(candidate) {
        return candidate.element === shapeElement;
      });

      if (!item) return;

      var point = getWorldPoint(root, stage, event);
      active = {
        pointerId: event.pointerId,
        item: item,
        offsetX: point.x - item.body.position.x,
        offsetY: point.y - item.body.position.y,
      };

      stage.setPointerCapture(event.pointerId);
      stage.style.cursor = 'grabbing';
      Body.setVelocity(item.body, { x: 0, y: 0 });
      Body.setAngularVelocity(item.body, 0);
      event.preventDefault();
    }

    function handlePointerMove(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      var point = getWorldPoint(root, stage, event);
      var body = active.item.body;
      var layout = getWorldLayout(root, stage);
      var shape = active.item.shape;
      var nextX = clamp(point.x - active.offsetX, shape.width / 2, layout.width - shape.width / 2);
      var nextY = clamp(point.y - active.offsetY, shape.height / 2, layout.height - shape.height / 2);
      var velocity = {
        x: (nextX - body.position.x) * 0.38,
        y: (nextY - body.position.y) * 0.38,
      };

      Body.setPosition(body, { x: nextX, y: nextY });
      Body.setVelocity(body, velocity);
      event.preventDefault();
    }

    function handlePointerUp(event) {
      if (!active || event.pointerId !== active.pointerId) return;

      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }

      stage.style.cursor = '';
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

  function getWorldPoint(root, stage, event) {
    var design = root.querySelector('.ctx404__design');
    var rect = design ? design.getBoundingClientRect() : stage.getBoundingClientRect();
    var scale = design ? (rect.width / BASE_WIDTH || 1) : 1;

    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  }

  function prepareSectionStage(root, stage) {
    var design = root.querySelector('.ctx404__design');
    if (design) return;

    if (stage.parentElement !== root) {
      root.insertBefore(stage, root.firstChild);
    }

    if (window.getComputedStyle(root).position === 'static') {
      root.style.position = 'relative';
    }

    Object.assign(stage.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });
  }

  function clamp(value, min, max) {
    if (max < min) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }
}());
