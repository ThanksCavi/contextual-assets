/**
 * Hero Lottie Intro
 * -----------------
 * Runs only for the marked Home hero: .hero-spotlight[data-hero-intro="home"].
 * Existing lottie-mask.js remains responsible for Lottie setup, image slots,
 * and viewport-triggered playback for every [data-lottie-mask] instance.
 */
(function heroLottieIntroInit() {
	'use strict';

	var HERO_SELECTOR = '.hero-spotlight[data-hero-intro="home"]';
	var LOTTIE_SELECTOR = '[data-lottie-mask]';
	var MOBILE_QUERY = '(max-width: 767px)';
	var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
	var HERO_READY_EVENT = 'contextual:hero-ready';
	var READY_TIMEOUT = 5500;
	var MOTION_READY_TIMEOUT = 1200;
	var PAGE_SETTLE_TIMEOUT = 700;
	var INTRO_HOLD_DURATION = 2200;
	var LOTTIE_MOVE_DURATION = 1350;
	var FIELD_REVEAL_DELAY = 2460;
	var PRIMARY_REVEAL_DELAY = 2820;
	var SECONDARY_REVEAL_DELAY = 3260;
	var NAV_REVEAL_DELAY = 3220;
	var AFTER_REVEAL_DELAY = 3660;
	var PRIMARY_REVEAL_DURATION = 1650;
	var SECONDARY_REVEAL_DURATION = 1500;
	var NAV_REVEAL_DURATION = 1350;
	var AFTER_REVEAL_DURATION = 1450;
	var PRIMARY_STAGGER = 115;
	var SECONDARY_STAGGER = 105;
	var MOVE_EASE = 'cubic-bezier(0.19, 1, 0.22, 1)';
	var REVEAL_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
	var NAV_REVEAL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
	var SCROLL_LOCK_CLASS = 'is-hero-intro-scroll-locked';
	var stableLayoutPromise = null;

	function onReady(fn) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', fn, { once: true });
		} else {
			fn();
		}
	}

	function prefersReducedMotion() {
		return window.matchMedia && window.matchMedia(REDUCED_MOTION_QUERY).matches;
	}

	function isMobileViewport() {
		return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
	}

	function shouldUseIntroScrollLock() {
		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.getMotionPolicy === 'function') {
			return !!window.ContextualHomeMotion.getMotionPolicy().allowIntroScrollLock;
		}

		var touchPoints = Number(window.navigator && window.navigator.maxTouchPoints);
		if (Number.isFinite(touchPoints) && touchPoints > 0) return false;

		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.shouldUseHeavyScrollEffects === 'function') {
			return window.ContextualHomeMotion.shouldUseHeavyScrollEffects();
		}

		return true;
	}

	function nextFrame() {
		return new Promise(function(resolve) {
			requestAnimationFrame(function() {
				requestAnimationFrame(resolve);
			});
		});
	}

	function wait(ms) {
		return new Promise(function(resolve) {
			window.setTimeout(resolve, ms);
		});
	}

	function timeoutPromise(ms) {
		return new Promise(function(resolve) {
			window.setTimeout(resolve, ms);
		});
	}

	function waitForFonts() {
		if (!document.fonts || !document.fonts.ready) return Promise.resolve();
		return Promise.race([
			document.fonts.ready.catch(function() {
				return null;
			}),
			timeoutPromise(PAGE_SETTLE_TIMEOUT)
		]);
	}

	function waitForPageSettle() {
		if (document.readyState === 'complete') {
			return nextFrame();
		}

		return new Promise(function(resolve) {
			var done = false;

			function finish() {
				if (done) return;
				done = true;
				window.removeEventListener('load', finish);
				window.removeEventListener('pageshow', finish);
				resolve();
			}

			window.addEventListener('load', finish, { once: true });
			window.addEventListener('pageshow', finish, { once: true });
			window.setTimeout(finish, PAGE_SETTLE_TIMEOUT);
		}).then(nextFrame);
	}

	function waitForMotionReady() {
		var motion = window.ContextualHomeMotion;

		if (motion && motion.ready && typeof motion.ready.then === 'function') {
			return Promise.race([
				motion.ready.catch(function() {
					return null;
				}),
				timeoutPromise(MOTION_READY_TIMEOUT)
			]);
		}

		return new Promise(function(resolve) {
			var done = false;

			function finish() {
				if (done) return;
				done = true;
				window.removeEventListener('contextual:smoother-ready', finish);
				resolve();
			}

			window.addEventListener('contextual:smoother-ready', finish, { once: true });
			window.setTimeout(finish, MOTION_READY_TIMEOUT);
		});
	}

	function waitForStableLayout() {
		if (!stableLayoutPromise) {
			stableLayoutPromise = Promise.all([
				waitForMotionReady(),
				waitForFonts(),
				waitForPageSettle()
			]).then(nextFrame);
		}

		return stableLayoutPromise.then(nextFrame);
	}

	function isLottieReady(lottieEl) {
		var state = lottieEl.getAttribute('data-lottie-mask-ready');
		return state === 'playing' || state === 'static' || state === 'error' ||
			(!!lottieEl.querySelector('.lm-stage') && !!lottieEl.querySelector('.lm-visible'));
	}

	function waitForLottie(lottieEl) {
		if (isLottieReady(lottieEl)) return Promise.resolve(true);

		return new Promise(function(resolve) {
			var done = false;
			var observer = null;

			function finish(value) {
				if (done) return;
				done = true;
				if (observer) observer.disconnect();
				resolve(value);
			}

			observer = new MutationObserver(function() {
				if (isLottieReady(lottieEl)) finish(true);
			});

			observer.observe(lottieEl, {
				attributes: true,
				attributeFilter: ['data-lottie-mask-ready'],
				childList: true,
				subtree: true
			});

			window.setTimeout(function() {
				finish(isLottieReady(lottieEl));
			}, READY_TIMEOUT);
		});
	}

	function getRevealGroups(hero) {
		var nav = document.querySelector('.navbar.w-nav');
		var markedItems = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-intro-reveal]'));
		var after = Array.prototype.slice.call(document.querySelectorAll('[data-hero-intro-after]'));
		var primary = [];
		var secondary = [];

		markedItems.forEach(function(item, index) {
			var role = (item.getAttribute('data-hero-intro-reveal') || '').trim().toLowerCase();

			if (role === 'secondary' || role === 'supporting' || role === 'brands' || role === 'logos') {
				secondary.push(item);
				return;
			}

			if (role === 'primary' || role === 'content') {
				primary.push(item);
				return;
			}

			if (index < 3) {
				primary.push(item);
			} else {
				secondary.push(item);
			}
		});

		return {
			nav: nav,
			primary: primary,
			secondary: secondary,
			after: after,
			all: uniqueElements((nav ? [nav] : []).concat(primary, secondary, after))
		};
	}

	function uniqueElements(elements) {
		return elements.filter(function(el, index, list) {
			return el && list.indexOf(el) === index;
		});
	}

	function setInitialStyles(lottieShell, revealGroups) {
		lottieShell.style.opacity = '1';
		lottieShell.style.transformOrigin = '50% 50%';
		lottieShell.style.willChange = 'transform';

		revealGroups.all.forEach(function(el) {
			el.style.opacity = '0';
			el.style.transform = el === revealGroups.nav ? 'translate3d(0, -22px, 0)' : 'translate3d(0, 34px, 0)';
			el.style.willChange = 'opacity, transform';
		});
	}

	function clearInlineStyles(lottieShell, revealElements) {
		lottieShell.style.opacity = '';
		lottieShell.style.transform = '';
		lottieShell.style.transformOrigin = '';
		lottieShell.style.willChange = '';

		revealElements.forEach(function(el) {
			el.style.opacity = '';
			el.style.transform = '';
			el.style.filter = '';
			el.style.willChange = '';
		});
	}

	function revealStatic(hero, lottieShell, revealElements, options) {
		hero.classList.remove('is-hero-intro-running');
		hero.classList.add('is-hero-intro-static');
		hero.classList.add('is-hero-intro-field-visible');
		hero.setAttribute('data-hero-intro-ready', 'static');
		if (!options || !options.keepLottieActive) {
			showHeroLottieStaticFallback(hero);
		}
		if (lottieShell) clearInlineStyles(lottieShell, revealElements || []);
		dispatchHeroReady(hero, 'static');
	}

	function showHeroLottieStaticFallback(hero) {
		var heroLottie = hero.querySelector('[data-hero-intro-lottie]');
		var lottieEl = null;
		var placeholder = null;
		var placeholderImage = null;
		var fallbackUrl = '';
		var animatedLayers = null;

		if (!heroLottie) return;

		lottieEl = heroLottie.matches('[data-lottie-mask]') ? heroLottie : heroLottie.querySelector('[data-lottie-mask]');
		if (!lottieEl) return;

		fallbackUrl = (lottieEl.getAttribute('data-lottie-img-4') || '').trim() || lottieEl.getAttribute('data-lottie-img-3') || '';
		placeholder = lottieEl.querySelector('.lottie-builder-placeholder');

		if (!placeholder && fallbackUrl) {
			placeholder = document.createElement('img');
			placeholder.className = 'lottie-builder-placeholder';
			placeholder.alt = '';
			placeholder.loading = 'lazy';
			lottieEl.insertBefore(placeholder, lottieEl.firstChild);
		}

		if (placeholder) {
			placeholderImage = placeholder.tagName === 'IMG' ? placeholder : placeholder.querySelector('img');

			if (placeholderImage && fallbackUrl && !placeholderImage.getAttribute('src')) {
				placeholderImage.setAttribute('src', fallbackUrl);
			}

			placeholder.style.display = 'block';
			placeholder.style.visibility = 'visible';
		}

		animatedLayers = lottieEl.querySelectorAll('.lm-stage, .lm-visible');
		animatedLayers.forEach(function(layer) {
			layer.style.display = 'none';
		});

		lottieEl.setAttribute('data-lottie-mask-ready', 'static');
	}

	function dispatchHeroReady(hero, mode) {
		window.dispatchEvent(new CustomEvent(HERO_READY_EVENT, {
			detail: {
				hero: hero,
				mode: mode
			}
		}));
		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.requestRefresh === 'function') {
			window.ContextualHomeMotion.requestRefresh({ delay: 0 });
		} else if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.refreshAll === 'function') {
			window.ContextualHomeMotion.refreshAll();
		}
	}

	function shouldSkipIntroForPagePosition(hero) {
		var currentScroll = getCurrentScrollTop();
		if (currentScroll > 2) return true;

		var rect = hero.getBoundingClientRect();
		var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

		return rect.bottom <= 0 || rect.top >= viewportHeight;
	}

	function getSmoother() {
		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.getSmoother === 'function') {
			return window.ContextualHomeMotion.getSmoother();
		}

		if (!shouldUseIntroScrollLock()) {
			return null;
		}

		if (window.ContextualHomeMotion && window.ContextualHomeMotion.smoother) {
			return window.ContextualHomeMotion.smoother;
		}

		if (window.ScrollSmoother && typeof window.ScrollSmoother.get === 'function') {
			return window.ScrollSmoother.get();
		}

		return null;
	}

	function getSmootherScrollTop(smoother) {
		if (!smoother) return 0;

		try {
			if (typeof smoother.scrollTop === 'function') {
				return Number(smoother.scrollTop()) || 0;
			}

			if (typeof smoother.scrollTop === 'number') {
				return smoother.scrollTop;
			}
		} catch (err) {
			return 0;
		}

		return 0;
	}

	function getCurrentScrollTop() {
		return Math.max(
			window.scrollY || window.pageYOffset || 0,
			getSmootherScrollTop(getSmoother()),
			0
		);
	}

	function lockIntroScroll() {
		if (!shouldUseIntroScrollLock()) {
			return function releaseIntroScroll() {};
		}

		var smoother = getSmoother();
		var hadPausedState = false;
		var previousPaused = false;
		var released = false;
		var scrollKeys = {
			32: true,
			33: true,
			34: true,
			35: true,
			36: true,
			37: true,
			38: true,
			39: true,
			40: true
		};

		function preventScroll(event) {
			event.preventDefault();
		}

		function preventScrollKeys(event) {
			if (scrollKeys[event.keyCode]) {
				event.preventDefault();
			}
		}

		document.documentElement.classList.add(SCROLL_LOCK_CLASS);
		window.addEventListener('wheel', preventScroll, { passive: false });
		window.addEventListener('touchmove', preventScroll, { passive: false });
		window.addEventListener('keydown', preventScrollKeys);

		if (smoother && typeof smoother.paused === 'function') {
			try {
				previousPaused = !!smoother.paused();
				hadPausedState = true;
				smoother.paused(true);
			} catch (err) {
				hadPausedState = false;
			}
		}

		return function releaseIntroScroll() {
			if (released) return;
			released = true;

			document.documentElement.classList.remove(SCROLL_LOCK_CLASS);
			window.removeEventListener('wheel', preventScroll);
			window.removeEventListener('touchmove', preventScroll);
			window.removeEventListener('keydown', preventScrollKeys);

			if (hadPausedState && smoother && typeof smoother.paused === 'function') {
				try {
					smoother.paused(previousPaused);
				} catch (err) {
					// Ignore cleanup failures from third-party smoother state.
				}
			}
		};
	}

	function getIntroTransform(rect) {
		var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
		var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
		var rectCenterX = rect.left + rect.width / 2;
		var rectCenterY = rect.top + rect.height / 2;
		var introMaxSize = Math.min(viewportWidth * 0.34, viewportHeight * 0.46);
		var largestSide = Math.max(rect.width, rect.height);
		var scale = largestSide > 0 ? introMaxSize / largestSide : 1;

		scale = Math.max(0.56, Math.min(0.88, scale));

		return {
			x: viewportWidth / 2 - rectCenterX,
			y: viewportHeight / 2 - rectCenterY,
			scale: scale
		};
	}

	function animateElement(el, keyframes, options) {
		if (typeof el.animate === 'function') {
			var animation = el.animate(keyframes, options);
			el._heroIntroAnimation = animation;
			var fallback = wait((options.delay || 0) + (options.duration || 0));
			if (animation.finished && typeof animation.finished.then === 'function') {
				return Promise.race([
					animation.finished.catch(function() { return null; }),
					fallback
				]);
			}
			return fallback;
		}

		var lastFrame = keyframes[keyframes.length - 1];
		Object.keys(lastFrame).forEach(function(prop) {
			el.style[prop] = lastFrame[prop];
		});
		return wait((options.delay || 0) + (options.duration || 0));
	}

	function addRevealAnimation(animations, el, options) {
		animations.push(animateElement(el, [
			{
				opacity: 0,
				transform: options.fromTransform
			},
			{
				opacity: 0.86,
				transform: options.settleTransform,
				offset: 0.72
			},
			{
				opacity: 1,
				transform: 'translate3d(0, 0, 0)'
			}
		], {
			duration: options.duration,
			delay: options.delay,
			easing: options.easing,
			fill: 'forwards'
		}));
	}

	function runIntro(hero, lottieShell, revealGroups, releaseIntroScroll) {
		var rect = lottieShell.getBoundingClientRect();
		var lockReleased = false;

		function releaseLockOnce() {
			if (lockReleased) return;
			lockReleased = true;
			if (typeof releaseIntroScroll === 'function') releaseIntroScroll();
		}

		if (!rect.width || !rect.height) {
			releaseLockOnce();
			revealStatic(hero, lottieShell, revealGroups.all);
			return Promise.resolve();
		}

		var start = getIntroTransform(rect);
		var startTransform = 'translate3d(' + start.x.toFixed(2) + 'px, ' + start.y.toFixed(2) + 'px, 0) scale(' + start.scale.toFixed(3) + ')';

		hero.classList.add('is-hero-intro-running');
		setInitialStyles(lottieShell, revealGroups);
		lottieShell.style.transform = startTransform;

		return nextFrame().then(function() {
			window.setTimeout(function() {
				hero.classList.add('is-hero-intro-field-visible');
			}, FIELD_REVEAL_DELAY);

			var lottieMove = animateElement(lottieShell, [
				{ transform: startTransform, opacity: 1 },
				{ transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
			], {
				duration: LOTTIE_MOVE_DURATION,
				delay: INTRO_HOLD_DURATION,
				easing: MOVE_EASE,
				fill: 'forwards'
			});
			var animations = [lottieMove];

			lottieMove.then(releaseLockOnce);
			window.setTimeout(releaseLockOnce, INTRO_HOLD_DURATION + LOTTIE_MOVE_DURATION + 400);

			revealGroups.primary.forEach(function(el, index) {
				addRevealAnimation(animations, el, {
					fromTransform: 'translate3d(0, 34px, 0)',
					settleTransform: 'translate3d(0, -3px, 0)',
					duration: PRIMARY_REVEAL_DURATION,
					delay: PRIMARY_REVEAL_DELAY + index * PRIMARY_STAGGER,
					easing: REVEAL_EASE
				});
			});

			revealGroups.secondary.forEach(function(el, index) {
				addRevealAnimation(animations, el, {
					fromTransform: 'translate3d(0, 30px, 0)',
					settleTransform: 'translate3d(0, -2px, 0)',
					duration: SECONDARY_REVEAL_DURATION,
					delay: SECONDARY_REVEAL_DELAY + index * SECONDARY_STAGGER,
					easing: REVEAL_EASE
				});
			});

			if (revealGroups.nav) {
				addRevealAnimation(animations, revealGroups.nav, {
					fromTransform: 'translate3d(0, -22px, 0)',
					settleTransform: 'translate3d(0, 2px, 0)',
					duration: NAV_REVEAL_DURATION,
					delay: NAV_REVEAL_DELAY,
					easing: NAV_REVEAL_EASE
				});
			}

			revealGroups.after.forEach(function(el, index) {
				addRevealAnimation(animations, el, {
					fromTransform: 'translate3d(0, 36px, 0)',
					settleTransform: 'translate3d(0, -2px, 0)',
					duration: AFTER_REVEAL_DURATION,
					delay: AFTER_REVEAL_DELAY + index * SECONDARY_STAGGER,
					easing: REVEAL_EASE
				});
			});

			return Promise.all(animations);
		}).then(function() {
			releaseLockOnce();
			hero.classList.remove('is-hero-intro-running');
			hero.classList.add('is-hero-intro-complete');
			hero.setAttribute('data-hero-intro-ready', 'complete');
			clearInlineStyles(lottieShell, revealGroups.all);
			dispatchHeroReady(hero, 'complete');
		});
	}

	function init() {
		var hero = document.querySelector(HERO_SELECTOR);
		if (!hero || hero.hasAttribute('data-hero-intro-ready')) return;

		hero.setAttribute('data-hero-intro-ready', 'pending');

		var lottieEl = hero.querySelector(LOTTIE_SELECTOR);
		var lottieShell = lottieEl && (lottieEl.closest('.lottie-component') || lottieEl);
		var revealGroups = getRevealGroups(hero);

		if (getCurrentScrollTop() > 2) {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		if (!lottieEl || !lottieShell || prefersReducedMotion()) {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		if (isMobileViewport()) {
			revealStatic(hero, lottieShell, revealGroups.all, { keepLottieActive: true });
			return;
		}

		if (typeof window.lottie === 'undefined') {
			revealStatic(hero, lottieShell, revealGroups.all);
			return;
		}

		waitForStableLayout().then(function() {
			if (shouldSkipIntroForPagePosition(hero)) {
				revealStatic(hero, lottieShell, revealGroups.all);
				return null;
			}

			return waitForLottie(lottieEl);
		}).then(function(isReady) {
			var releaseIntroScroll = null;

			if (isReady === null) return;

			if (!isReady) {
				revealStatic(hero, lottieShell, revealGroups.all);
				return;
			}

			return waitForStableLayout().then(function() {
				if (shouldSkipIntroForPagePosition(hero)) {
					revealStatic(hero, lottieShell, revealGroups.all);
					return;
				}

				releaseIntroScroll = lockIntroScroll();

				return nextFrame().then(function() {
					return runIntro(hero, lottieShell, revealGroups, releaseIntroScroll);
				}).catch(function(err) {
					if (releaseIntroScroll) releaseIntroScroll();
					throw err;
				});
			});
		}).catch(function(err) {
			revealStatic(hero, lottieShell, revealGroups.all);
			if (window.console && typeof window.console.warn === 'function') {
				window.console.warn('[hero-intro] Intro skipped:', err);
			}
		});
	}

	onReady(init);
})();
