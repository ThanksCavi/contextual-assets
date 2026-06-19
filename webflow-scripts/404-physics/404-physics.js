(function contextual404PhysicsInit() {
	'use strict';

	// ─── CONFIG ────────────────────────────────────────────────────────────────
	var CONFIG = {
		shapes: [
			{
				id: 'left-navy-crescent',
				src: './assets/shape-left-navy-crescent.svg',
				width: 236,
				height: 118,
				angle: -90,
				body: {type: 'rect', width: 236, height: 118, radius: 24},
				mass: 4.8
			},
			{
				id: 'blue-ring',
				src: './assets/shape-blue-ring.svg',
				width: 108,
				height: 108,
				angle: 0,
				body: {type: 'circle', radius: 54},
				mass: 2
			},
			{
				id: 'navy-wedge',
				src: './assets/shape-navy-wedge.svg',
				width: 170,
				height: 85,
				angle: 62,
				body: {type: 'rect', width: 170, height: 85, radius: 18},
				mass: 3
			},
			{
				id: 'lavender-dome',
				src: './assets/shape-lavender-dome.svg',
				width: 207,
				height: 103,
				angle: 180,
				body: {type: 'rect', width: 207, height: 103, radius: 28},
				mass: 3.4
			},
			{
				id: 'blue-arch',
				src: './assets/shape-blue-arch.svg',
				width: 280,
				height: 140,
				angle: 180,
				body: {type: 'rect', width: 280, height: 140, radius: 28},
				mass: 4
			},
			{
				id: 'navy-circle',
				src: './assets/shape-navy-circle.svg',
				width: 149,
				height: 149,
				angle: 0,
				body: {type: 'circle', radius: 74.5},
				mass: 2.8
			},
			{
				id: 'small-navy-bowl',
				src: './assets/shape-small-navy-bowl.svg',
				width: 156,
				height: 78,
				angle: 18,
				body: {type: 'rect', width: 156, height: 78, radius: 18},
				mass: 2.4
			},
			{
				id: 'large-blue-crescent',
				src: './assets/shape-large-blue-crescent.svg',
				width: 428,
				height: 214,
				angle: 150,
				body: {type: 'rect', width: 428, height: 214, radius: 36},
				mass: 6
			},
		],

		layout: {
			frameWidth: 1440,
			mobileBreakpoint: 768,
			mobileScale: 0.6,
		},

		physics: {
			gravityScale: 0.001,
			restitution: 0.48,
			friction: 0.6,
			frictionAir: 0.012,
			throwVelocity: 0.6,
			maxThrow: 22,   // px/frame cap on release velocity
		},

		bounds: {
			wallBleed: 12,
			wallThickness: 320,
			floorSink: 1,
			minVisibleFraction: 0.5,
			minVisibleTop: 0.35, // min fraction of shape kept visible below the top edge
		},

		spawn: {
			stagger: 80,  // ms between shapes
			angleJitter: 20,  // ±deg random rotation at spawn
			zoneJitter: 0.4, // ±fraction of zone width for x scatter
		},

		button: {
			obstacleSelector: '[data-ctx-404-obstacle]',
			obstacleCategory: 0x0004,
			chamfer: 12,
			hitMinSpeed: 6,   // px/frame threshold to trigger button reaction
			hitCooldown: 350, // ms cooldown between button reactions
		},

		drag: {
			pushEnabled: true, // master flag: false => fall back to mask=0x0000 (no push)
			maxPushSpeed: 18,   // px/frame cap on push velocity fed to neighbours (anti-explosion)
		},
	};

	// ─── MODULE STATE ──────────────────────────────────────────────────────────
	var ROOT_SELECTOR = '[data-ctx-404-physics]';
	var STAGE_SELECTOR = '[data-ctx-404-physics-stage]';
	var REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

	var staticMode = new URLSearchParams(window.location.search).has('static');
	var prefersReducedMotion = window.matchMedia(REDUCED_MOTION);
	var resizeTimer = null;
	var state = null;
	var Matter = window.Matter;
	var entranceSettled = false; // gating flag for button impact reaction

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
			refresh: function () {
				destroyWorld();
				state = createWorld(stage);
			},
			destroy: destroyWorld,
		};
	}

	function onReady(cb) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', cb, {once: true});
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
		var vw = Math.max(320, window.innerWidth || CONFIG.layout.frameWidth);
		var vh = Math.max(560, window.innerHeight || 900);
		var isMobile = vw < CONFIG.layout.mobileBreakpoint;
		var scale = isMobile ? CONFIG.layout.mobileScale : 1;
		var groundY = getGroundY(vh);
		return {vw: vw, vh: vh, scale: scale, isMobile: isMobile, groundY: groundY};
	}

	// ─── STATIC RENDER (reduced-motion / ?static) ──────────────────────────────
	function renderStatic(stage, layout) {
		stage.replaceChildren();
		var vw = layout.vw;
		var groundY = layout.groundY;
		var scale = layout.scale;
		var sink = CONFIG.bounds.floorSink;
		var n = CONFIG.shapes.length;
		var zoneW = vw / n;

		CONFIG.shapes.forEach(function (shape, i) {
			var sw = shape.width * scale;
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
		var Engine = Matter.Engine;
		var Runner = Matter.Runner;
		var Bodies = Matter.Bodies;
		var Body = Matter.Body;
		var Composite = Matter.Composite;
		var Events = Matter.Events;

		var layout = computeLayout();
		stage.replaceChildren();

		var engine = Engine.create({
			gravity: {x: 0, y: 1, scale: CONFIG.physics.gravityScale},
			enableSleeping: true,
		});

		var walls = createWalls(Bodies, layout);
		Composite.add(engine.world, walls);

		var obstacles = createObstacles(Bodies, layout);
		if (obstacles.length) Composite.add(engine.world, obstacles);

		var runner = Runner.create();
		Runner.run(runner, engine);

		var physicsItems = spawnShapes(stage, Bodies, Body, Composite, engine, layout);

		// Gate button reaction until entrance cascade has settled (~1.2 s after init)
		entranceSettled = false;
		var entranceTimer = window.setTimeout(function () {
			entranceSettled = true;
		}, 1200);

		// Button impact reaction: detect collisions with obstacle bodies
		var buttonLastHit = 0;
		var obstacleEls = document.querySelectorAll(CONFIG.button.obstacleSelector);

		Events.on(engine, 'collisionStart', function (event) {
			if (!entranceSettled) return;
			var now = performance.now();
			if (now - buttonLastHit < CONFIG.button.hitCooldown) return;
			var pairs = event.pairs;
			for (var p = 0; p < pairs.length; p++) {
				var pair = pairs[p];
				// Match obstacles by label (robust across soft re-anchors, which create
				// fresh obstacle bodies with new ids) rather than a cached id map.
				var aIsObstacle = pair.bodyA.label === 'obstacle';
				var bIsObstacle = pair.bodyB.label === 'obstacle';
				if (!aIsObstacle && !bIsObstacle) continue;
				var bShape = aIsObstacle ? pair.bodyB : pair.bodyA;
				var speed = Math.sqrt(bShape.velocity.x * bShape.velocity.x + bShape.velocity.y * bShape.velocity.y);
				if (speed < CONFIG.button.hitMinSpeed) continue;
				buttonLastHit = now;
				obstacleEls.forEach(function (el) {
					if (!window.matchMedia(REDUCED_MOTION).matches) {
						el.classList.add('is-hit');
						window.setTimeout(function () {
							el.classList.remove('is-hit');
						}, CONFIG.button.hitCooldown);
					}
				});
				break; // one event per collision batch is enough
			}
		});

		Events.on(engine, 'afterUpdate', function () {
			physicsItems.forEach(function (item) {
				// Mark entry: once the body is fully below the top edge
				if (!item.hasEntered && item.body.position.y - item.sh / 2 >= 0) {
					item.hasEntered = true;
				}
				rescueOutOfBoundsBody(item, state.layout, Body);
				enforceCeiling(item, Body);
				syncElement(item);
			});
		});

		var dragResult = bindPointerDrag(stage, physicsItems, Body, engine);

		return {
			stage: stage,
			engine: engine,
			runner: runner,
			walls: walls,
			obstacles: obstacles,
			layout: layout,
			physicsItems: physicsItems,
			cleanupDrag: dragResult.cleanup,
			entranceTimer: entranceTimer,
		};
	}

	function destroyWorld() {
		if (!state) return;
		window.clearTimeout(state.entranceTimer);
		entranceSettled = false;
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
		return {
			id: s.id, src: newSrc, width: s.width, height: s.height,
			angle: s.angle, body: s.body, mass: s.mass
		};
	}

	function getSpawnList(vw) {
		var base = CONFIG.shapes;
		var crescent = shapeById('large-blue-crescent');
		var baseSans = base.filter(function (s) {
			return s.id !== 'large-blue-crescent';
		});

		if (vw < CONFIG.layout.mobileBreakpoint) return baseSans; // crescent too large on mobile

		var extraRing = variantOf('blue-ring', './assets/shape-blue-ring-dark.svg');
		var extraBowl = variantOf('small-navy-bowl', './assets/shape-small-navy-bowl-lavender.svg');
		var extraDome = variantOf('lavender-dome', './assets/shape-lavender-dome-dark.svg');
		var extraArch = variantOf('blue-arch', './assets/shape-blue-arch-dark.svg');
		var extraCres = variantOf('left-navy-crescent', './assets/shape-left-navy-crescent-blue.svg');
		extraCres.angle = -130; // more tilted spawn → less stable on flat surfaces like the button

		// crescent is always last so it gets the rightmost spawn zone on every breakpoint
		if (vw >= 1920) {
			var extra1920 = baseSans.map(function (s) {
				if (s.id === 'blue-ring') return extraRing;
				if (s.id === 'small-navy-bowl') return extraBowl;
				if (s.id === 'lavender-dome') return extraDome;
				if (s.id === 'blue-arch') return extraArch;
				if (s.id === 'left-navy-crescent') return extraCres;
				return s;
			});
			// extraCres lands at zone 7 (center = button) due to array structure;
			// move it to zone 9 (right-of-center) by shifting it two positions right
			extra1920.splice(2, 0, extra1920.splice(0, 1)[0]);
			return baseSans.concat(extra1920).concat([crescent]); // 15, crescent last
		}
		if (vw >= 1760) return baseSans.concat([
			shapeById('navy-circle'),
			extraDome,
			extraRing,
			extraBowl,
			crescent,
		]); // 12, crescent last
		if (vw >= 1440) return baseSans.concat([extraRing, extraBowl, crescent]); // 10, crescent last
		return base; // 8, crescent already last
	}

	// Shapes drop from above the viewport in staggered left-to-right zones.
	// Physics handles all settling — no pre-placed sleeping bodies.
	function spawnShapes(stage, Bodies, Body, Composite, engine, layout) {
		var vw = layout.vw;
		var scale = layout.scale;
		var shapes = getSpawnList(vw);
		var n = shapes.length;
		var zoneW = vw / n;
		var stagger = CONFIG.spawn.stagger;
		var jitter = CONFIG.spawn.zoneJitter;
		var aJitter = CONFIG.spawn.angleJitter;
		var items = [];

		shapes.forEach(function (shape, i) {
			var sc = scale;
			var sb = shape.body;
			var sw = shape.width * sc;
			var sh = shape.height * sc;

			var zoneCenter = (i + 0.5) * zoneW;
			var spawnX = zoneCenter + (Math.random() * 2 - 1) * jitter * zoneW;
			spawnX = clamp(spawnX, sw / 2, vw - sw / 2);
			var spawnY = -sh - 20;

			var opts = {
				isStatic: false,
				restitution: CONFIG.physics.restitution,
				friction: CONFIG.physics.friction,
				frictionAir: CONFIG.physics.frictionAir,
				collisionFilter: {category: 0x0001, mask: 0xFFFF},
				label: shape.id,
			};
			if (sb.radius && sb.type !== 'circle') {
				opts.chamfer = {radius: sb.radius * sc};
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

			var item = {element: el, body: body, sw: sw, sh: sh, shape: shape, hasEntered: false};
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
		var t = CONFIG.bounds.wallThickness;
		var wb = CONFIG.bounds.wallBleed;
		var gy = layout.groundY;
		var sk = CONFIG.bounds.floorSink;
		var vw = layout.vw;
		var vh = layout.vh;
		var opts = {isStatic: true, restitution: 0.18, friction: 0.82, render: {visible: false}};
		return [
			Bodies.rectangle(vw / 2, gy + sk + t / 2, vw + t * 2, t, opts), // floor
			Bodies.rectangle(-wb - t / 2, vh / 2, t, vh * 2, opts), // left wall
			Bodies.rectangle(vw + wb + t / 2, vh / 2, t, vh * 2, opts), // right wall
		];
	}

	function createObstacles(Bodies) {
		var selector = CONFIG.button.obstacleSelector;
		var category = CONFIG.button.obstacleCategory;
		var chamfer = CONFIG.button.chamfer;
		var result = [];
		document.querySelectorAll(selector).forEach(function (el) {
			var r = el.getBoundingClientRect();
			if (!r.width || !r.height) return;
			result.push(Bodies.rectangle(
				r.left + r.width / 2,
				r.top + r.height / 2,
				r.width, r.height,
				{
					isStatic: true,
					restitution: 0.2,
					friction: 0.8,
					collisionFilter: {category: category, mask: 0xFFFF},
					chamfer: {radius: chamfer},
					label: 'obstacle',
					render: {visible: false},
				}
			));
		});
		return result;
	}

	// ─── DOM SYNC ──────────────────────────────────────────────────────────────
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

	function applyTransform(el, cx, cy, angle, angleUnit, scaleX, scaleY, sw, sh) {
		var x = cx - sw / 2;
		var y = cy - sh / 2;
		var rot = angle + (angleUnit === 'deg' ? 'deg' : 'rad');
		el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + rot + ') scaleX(' + scaleX + ') scaleY(' + scaleY + ')';
	}

	function syncElement(item) {
		var x = item.body.position.x - item.sw / 2;
		var y = item.body.position.y - item.sh / 2;
		item.element.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + item.body.angle + 'rad)';
	}

	// Soft ceiling: once a shape has entered the viewport, keep ≥35% visible below the top edge.
	// Entrance bodies (hasEntered=false) are exempt so they still fall in from above.
	function enforceCeiling(item, Body) {
		if (!item.hasEntered) return;
		var body = item.body;
		var minVisible = CONFIG.bounds.minVisibleTop; // 0.35
		// Minimum center Y that keeps minVisible fraction of the shape below y=0
		var minCenterY = -(0.5 - minVisible) * item.sh;
		if (body.position.y < minCenterY) {
			Body.setPosition(body, {x: body.position.x, y: minCenterY});
			if (body.velocity.y < 0) {
				Body.setVelocity(body, {x: body.velocity.x, y: body.velocity.y * -0.3});
			}
		}
	}

	function rescueOutOfBoundsBody(item, layout, Body) {
		var body = item.body;
		if (body.isStatic) return;

		var vw = layout.vw;
		var vh = layout.vh;
		var margin = Math.max(item.sw, item.sh, 200);
		var lost = (
			body.position.x < -margin ||
			body.position.x > vw + margin ||
			body.position.y > vh + margin ||
			(item.hasEntered && body.position.y < -margin) // far above, only after entry
		);
		if (lost) {
			Body.setPosition(body, {
				x: clamp(body.position.x, item.sw / 2, vw - item.sw / 2),
				y: clamp(body.position.y, -item.sh, layout.groundY - item.sh / 2),
			});
			Body.setVelocity(body, {x: 0, y: 0});
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
	// Kinematic pin drag: body is moved to the target in the engine's beforeUpdate
	// tick, not inside the pointer event. This decouples the pointer stream from
	// the engine tick, eliminates forced reflows (no getBoundingClientRect in
	// pointermove), and prevents gravity drift on press-and-hold.
	function bindPointerDrag(stage, elements, Body, engine) {
		var active = null; // holds drag state while a pointer is down
		var beforeUpdateFn = null; // ref kept so we can remove it on cleanup

		// Pin the dragged body every engine tick.
		beforeUpdateFn = function () {
			if (!active) return;
			var body = active.item.body;
			Body.setPosition(body, {x: active.targetX, y: active.targetY});
			if (CONFIG.drag.pushEnabled) {
				// Compute per-tick delta and clamp to maxPushSpeed to prevent explosion
				var dx = active.targetX - active.prevPinnedX;
				var dy = active.targetY - active.prevPinnedY;
				var mag = Math.sqrt(dx * dx + dy * dy);
				var cap = CONFIG.drag.maxPushSpeed;
				if (mag > cap) {
					var ratio = cap / mag;
					dx *= ratio;
					dy *= ratio;
				}
				// Feed velocity so the contact solver gives neighbours a realistic push impulse
				Body.setVelocity(body, {x: dx, y: dy});
				// Keep the static pusher awake in case the user holds still then shoves
				Matter.Sleeping.set(body, false);
				active.prevPinnedX = active.targetX;
				active.prevPinnedY = active.targetY;
			} else {
				Body.setVelocity(body, {x: 0, y: 0});
				Body.setAngularVelocity(body, 0);
			}
		};
		Matter.Events.on(engine, 'beforeUpdate', beforeUpdateFn);

		function onDown(event) {
			// Safety: a previous drag that never released cleanly (lost pointer
			// capture, released off-window, second pointer) would otherwise leave its
			// body static/non-colliding and "stuck" mid-air. Restore it first so a
			// body can never be orphaned in the pusher state.
			if (active) abortActive();

			var shapeEl = event.target.closest && event.target.closest('.ctx404__shape');
			if (!shapeEl) return;

			var item = null;
			for (var i = 0; i < elements.length; i++) {
				if (elements[i].element === shapeEl) {
					item = elements[i];
					break;
				}
			}
			if (!item) return;

			// Cache stage rect once on pointerdown — never inside pointermove
			var stageRect = stage.getBoundingClientRect();
			var ptX = event.clientX - stageRect.left;
			var ptY = event.clientY - stageRect.top;

			if (Matter.Sleeping) Matter.Sleeping.set(item.body, false);
			Body.setVelocity(item.body, {x: 0, y: 0});
			Body.setAngularVelocity(item.body, 0);

			// Save original collision filter (used by both push paths and release)
			var savedFilter = {
				category: item.body.collisionFilter.category,
				mask: item.body.collisionFilter.mask,
				group: item.body.collisionFilter.group,
			};

			var savedMass = item.body.mass;
			var isPusher = CONFIG.drag.pushEnabled;

			if (isPusher) {
				// Make this body an immovable kinematic pusher: static so the solver
				// never moves it back, but it still transmits position corrections to
				// dynamic neighbours. Set mask AFTER setStatic (setStatic does not
				// touch collisionFilter, but ordering is explicit for safety).
				Body.setStatic(item.body, true);
				item.body.collisionFilter = {
					category: savedFilter.category,
					mask: 0xFFFF & ~CONFIG.button.obstacleCategory,
					group: savedFilter.group,
				};
				// Wake the whole pile: a static body does not wake sleeping neighbours
				// on its own — Matter only wakes sleepers on contact with a moving,
				// non-static body. Without this the pusher passes through settled shapes.
				for (var w = 0; w < elements.length; w++) {
					if (!elements[w].body.isStatic) {
						Matter.Sleeping.set(elements[w].body, false);
					}
				}
			} else {
				// Legacy path: disable all collisions so the dragged body passes through
				item.body.collisionFilter = {
					category: savedFilter.category,
					mask: 0x0000,
					group: savedFilter.group,
				};
			}

			active = {
				pointerId: event.pointerId,
				item: item,
				stageRect: stageRect,
				offsetX: ptX - item.body.position.x,
				offsetY: ptY - item.body.position.y,
				targetX: item.body.position.x,
				targetY: item.body.position.y,
				savedFilter: savedFilter,
				savedMass: savedMass,
				isPusher: isPusher,
				prevPinnedX: item.body.position.x,
				prevPinnedY: item.body.position.y,
				trail: [{x: ptX, y: ptY, t: performance.now()}],
			};

			stage.setPointerCapture(event.pointerId);
			document.body.style.cursor = 'grabbing';
			item.element.classList.add('is-dragging');
			event.preventDefault();
		}

		function onMove(event) {
			if (!active || event.pointerId !== active.pointerId) return;

			// Use stable half-extents from item dimensions, not body.bounds (avoids
			// rotation-dependent AABB which causes clamping oscillation / jitter).
			var hw = active.item.sw / 2;
			var hh = active.item.sh / 2;
			var vw = active.stageRect.width;  // viewport width as seen at grab time
			var vh = active.stageRect.height;

			var ptX = event.clientX - active.stageRect.left;
			var ptY = event.clientY - active.stageRect.top;

			// Update target; clamp within stage bounds
			active.targetX = clamp(ptX - active.offsetX, hw, vw - hw);
			active.targetY = clamp(ptY - active.offsetY, hh, vh - hh);

			// Trail for throw velocity — keep last 5 entries
			var now = performance.now();
			active.trail.push({x: ptX, y: ptY, t: now});
			if (active.trail.length > 5) active.trail.shift();

			event.preventDefault();
		}

		function onUp(event) {
			if (!active || event.pointerId !== active.pointerId) return;
			releaseActive(event.pointerId);
		}

		function releaseActive(pointerId) {
			if (!active) return;

			if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
			document.body.style.cursor = '';
			active.item.element.classList.remove('is-dragging');

			// Restore dynamic state for the pusher path before applying throw
			if (active.isPusher) {
				Body.setStatic(active.item.body, false);
				// setStatic(false) restores from body._original which predates our custom
				// setMass call — re-apply the saved mass explicitly to ensure throw feels
				// correct and body isn't unexpectedly light.
				Body.setMass(active.item.body, active.savedMass);
			}

			// Restore collision filter
			active.item.body.collisionFilter = active.savedFilter;

			// Compute throw velocity from trail (last vs ~3rd-from-last entry)
			var trail = active.trail;
			var vx = 0, vy = 0;
			if (trail.length >= 2) {
				var newPt = trail[trail.length - 1];
				var oldPt = trail[Math.max(0, trail.length - 3)];
				var dt = newPt.t - oldPt.t;
				if (dt > 0) {
					// Convert px/ms → px/frame (assuming 60 Hz = ~16.67 ms/frame)
					var msPerFrame = 1000 / 60;
					vx = (newPt.x - oldPt.x) / dt * msPerFrame;
					vy = (newPt.y - oldPt.y) / dt * msPerFrame;
				}
			}

			// Cap speed so hard flicks can't escape containment
			var speed = Math.sqrt(vx * vx + vy * vy);
			var cap = CONFIG.physics.maxThrow;
			if (speed > cap) {
				var ratio = cap / speed;
				vx *= ratio;
				vy *= ratio;
			}

			Body.setVelocity(active.item.body, {x: vx, y: vy});
			// Add subtle spin proportional to horizontal throw speed
			Body.setAngularVelocity(active.item.body, clamp(vx * 0.004, -0.12, 0.12));

			active = null;
		}

		// Restore an in-flight drag's body to a safe DYNAMIC state without applying
		// a throw. Used when a drag is interrupted (stale pointer on a new press,
		// resize, world teardown) so a body is never left static/non-colliding.
		function abortActive() {
			if (!active) return;
			if (stage.hasPointerCapture(active.pointerId)) stage.releasePointerCapture(active.pointerId);
			active.item.element.classList.remove('is-dragging');
			if (active.isPusher) {
				Body.setStatic(active.item.body, false);
				Body.setMass(active.item.body, active.savedMass);
			}
			active.item.body.collisionFilter = active.savedFilter;
			document.body.style.cursor = '';
			active = null;
		}

		stage.addEventListener('pointerdown', onDown);
		stage.addEventListener('pointermove', onMove);
		stage.addEventListener('pointerup', onUp);
		stage.addEventListener('pointercancel', onUp);
		// Backstop: a release that doesn't reach the stage (pointer left the window,
		// capture silently dropped) must still end the drag, or the body stays stuck.
		document.addEventListener('pointerup', onUp);
		document.addEventListener('pointercancel', onUp);

		function cleanup() {
			// Cancel any in-flight drag (restores its body to safe dynamic state)
			abortActive();
			stage.removeEventListener('pointerdown', onDown);
			stage.removeEventListener('pointermove', onMove);
			stage.removeEventListener('pointerup', onUp);
			stage.removeEventListener('pointercancel', onUp);
			document.removeEventListener('pointerup', onUp);
			document.removeEventListener('pointercancel', onUp);
			// Remove the beforeUpdate pin handler
			Matter.Events.off(engine, 'beforeUpdate', beforeUpdateFn);
			beforeUpdateFn = null;
		}

		return {cleanup: cleanup};
	}

	// ─── RESIZE ────────────────────────────────────────────────────────────────
	function bindResize(root, stage) {
		window.addEventListener('resize', function () {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(function () {
				handleResize(root, stage);
			}, 180);
		}, {passive: true});
	}

	function handleResize(root, stage) {
		if (!state) {
			renderStatic(stage, computeLayout());
			return;
		}

		var newLayout = computeLayout();
		var oldSpawnLen = state.physicsItems.length;
		var newSpawnLen = getSpawnList(newLayout.vw).length;

		// Same shape-count bucket: soft re-anchor (no re-drop).
		// cleanupDrag cancels any active drag and tears down the old beforeUpdate pin;
		// softReanchor re-binds a fresh one.
		if (newSpawnLen === oldSpawnLen) {
			if (typeof state.cleanupDrag === 'function') state.cleanupDrag();
			state.cleanupDrag = null; // prevent destroyWorld from calling it again
			softReanchor(newLayout);
			return;
		}

		// Different bucket: full rebuild (re-drop acceptable here).
		// destroyWorld will call cleanupDrag, so let it.
		destroyWorld();
		state = createWorld(stage);
	}

	// Soft re-anchor: reposition walls/obstacles for new viewport, clamp out-of-bounds
	// dynamic bodies. Does NOT destroy the world or re-drop shapes.
	function softReanchor(newLayout) {
		var Bodies = Matter.Bodies;
		var Body = Matter.Body;
		var Composite = Matter.Composite;

		// Remove old walls and obstacles from the world
		state.walls.forEach(function (w) {
			Composite.remove(state.engine.world, w);
		});
		state.obstacles.forEach(function (ob) {
			Composite.remove(state.engine.world, ob);
		});

		// Create new walls/obstacles for the new layout
		var newWalls = createWalls(Bodies, newLayout);
		var newObstacles = createObstacles(Bodies, newLayout);
		Composite.add(state.engine.world, newWalls);
		if (newObstacles.length) Composite.add(state.engine.world, newObstacles);

		// Re-clamp any out-of-bounds dynamic bodies into the new viewport
		state.physicsItems.forEach(function (item) {
			var body = item.body;
			if (body.isStatic) return;
			var hw = item.sw / 2;
			var hh = item.sh / 2;
			var newX = clamp(body.position.x, hw, newLayout.vw - hw);
			var newY = clamp(body.position.y, hh, newLayout.groundY - hh);
			if (newX !== body.position.x || newY !== body.position.y) {
				Body.setPosition(body, {x: newX, y: newY});
				Body.setVelocity(body, {x: 0, y: 0});
			}
		});

		// Update state references
		state.walls = newWalls;
		state.obstacles = newObstacles;
		state.layout = newLayout;

		// Re-bind drag with current engine (new cleanup fn replaces old one)
		var dragResult = bindPointerDrag(state.stage, state.physicsItems, Body, state.engine);
		state.cleanupDrag = dragResult.cleanup;
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

	function toRadians(deg) {
		return deg * Math.PI / 180;
	}

	function clamp(v, lo, hi) {
		if (hi < lo) return (lo + hi) / 2;
		return Math.min(Math.max(v, lo), hi);
	}

}());
