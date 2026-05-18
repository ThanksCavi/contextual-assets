/**
 * ScrollSmoother runtime
 * Uses the Webflow-provided GSAP plugins and the Designer-defined
 * #smooth-wrapper > #smooth-content structure.
 */
(() => {
	const WRAPPER_SELECTOR = '#smooth-wrapper';
	const CONTENT_SELECTOR = '#smooth-content';
	const INIT_FLAG = '__contextualHomeScrollSmootherInit';
	const READY_EVENT = 'contextual:smoother-ready';
	const REQUEST_REFRESH_DELAY_MS = 80;
	const RESIZE_REFRESH_DELAY_MS = 160;
	const MOTION_BREAKPOINT_PX = 992;
	const DESKTOP_WIDTH_QUERY = `(min-width: ${MOTION_BREAKPOINT_PX}px)`;
	const FINE_POINTER_QUERY = '(pointer: fine)';
	const HOVER_QUERY = '(hover: hover)';
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

	if (window[INIT_FLAG]) return;
	window[INIT_FLAG] = true;

	let resolveReady;
	let refreshTimer = null;
	let refreshToken = 0;
	let resizeTimer = null;
	let smootherState = null;
	let readyMarked = false;
	let policyState = null;
	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});

	window.ContextualHomeMotion = window.ContextualHomeMotion || {};
	Object.assign(window.ContextualHomeMotion, {
		ready,
		refreshAll,
		requestRefresh,
		getSmoother,
		getMotionPolicy,
		shouldUseSmoother,
		shouldUseHeavyScrollEffects,
		scrollBy,
		scrollTo,
		getScrollTop,
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initScrollSmoother, {once: true});
	} else {
		initScrollSmoother();
	}

	function initScrollSmoother() {
		const gsap = window.gsap;
		const ScrollTrigger = window.ScrollTrigger;
		const ScrollSmoother = window.ScrollSmoother;
		const wrapper = document.querySelector(WRAPPER_SELECTOR);
		const content = document.querySelector(CONTENT_SELECTOR);

		if (!gsap || !ScrollTrigger || !ScrollSmoother) {
			console.warn('[home-scroll-smoother] Webflow GSAP ScrollTrigger/ScrollSmoother is not available.');
			markReady(null);
			return;
		}

		if (!wrapper || !content || !wrapper.contains(content)) {
			console.warn('[home-scroll-smoother] Expected #smooth-wrapper > #smooth-content structure was not found.');
			markReady(null);
			return;
		}

		smootherState = {
			gsap,
			ScrollTrigger,
			ScrollSmoother,
			wrapper,
			content,
			wrapperStyle: wrapper.getAttribute('style'),
			contentStyle: content.getAttribute('style'),
		};

		gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

		syncSmootherForViewport();
		markReady(getSmoother());

		window.addEventListener('load', scheduleSettledRefresh, {once: true});
		window.addEventListener('resize', queueSettledRefresh);
		bindPolicyListeners();
	}

	function markReady(smoother) {
		if (readyMarked) return;
		readyMarked = true;

		window.ContextualHomeMotion.smoother = smoother;
		resolveReady(window.ContextualHomeMotion);
		window.dispatchEvent(new CustomEvent(READY_EVENT, {
			detail: {
				smoother,
			},
		}));
		scheduleSettledRefresh();
	}

	function queueSettledRefresh() {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			syncSmootherForViewport();
			requestRefresh();
		}, RESIZE_REFRESH_DELAY_MS);
	}

	function handleViewportChange() {
		syncSmootherForViewport();
		requestRefresh();
	}

	function syncSmootherForViewport() {
		if (!smootherState) return null;

		const {ScrollSmoother, wrapper, content} = smootherState;
		let smoother = ScrollSmoother.get && ScrollSmoother.get();

		if (!shouldUseSmoother()) {
			if (smoother && typeof smoother.kill === 'function') {
				smoother.kill();
			}

			restoreElementStyle(wrapper, smootherState.wrapperStyle);
			restoreElementStyle(content, smootherState.contentStyle);
			window.ContextualHomeMotion.smoother = null;
			return null;
		}

		if (!smoother) {
			smoother = ScrollSmoother.create({
				wrapper,
				content,
				smooth: 2,
				effects: true,
				effectsPrefix: 'smoother-',
				smoothTouch: false,
				normalizeScroll: true,
			});
		}

		window.ContextualHomeMotion.smoother = smoother;
		return smoother;
	}

	function shouldUseSmoother() {
		return getMotionPolicy().allowFullScrollMotion;
	}

	function shouldUseHeavyScrollEffects() {
		return getMotionPolicy().allowHeavyScrollEffects;
	}

	function getMotionPolicy() {
		const media = getPolicyState();
		const isDesktopWidth = media.desktopWidth ? media.desktopWidth.matches : true;
		const hasFinePointer = media.finePointer ? media.finePointer.matches : true;
		const hasHover = media.hover ? media.hover.matches : true;
		const prefersReducedMotion = media.reducedMotion ? media.reducedMotion.matches : false;
		const maxTouchPoints = getMaxTouchPoints();
		const isTouchCapable = maxTouchPoints > 0;
		const allowFullScrollMotion = Boolean(
			isDesktopWidth &&
			hasFinePointer &&
			hasHover &&
			!prefersReducedMotion &&
			!isTouchCapable
		);

		return {
			allowFullScrollMotion,
			allowHeavyScrollEffects: allowFullScrollMotion,
			shouldUseSmoother: allowFullScrollMotion,
			isDesktopWidth,
			hasFinePointer,
			hasHover,
			prefersReducedMotion,
			isTouchCapable,
			maxTouchPoints,
		};
	}

	function getPolicyState() {
		if (!policyState) {
			policyState = {
				desktopWidth: createMediaQuery(DESKTOP_WIDTH_QUERY),
				finePointer: createMediaQuery(FINE_POINTER_QUERY),
				hover: createMediaQuery(HOVER_QUERY),
				reducedMotion: createMediaQuery(REDUCED_MOTION_QUERY),
				listenersBound: false,
			};
		}

		return policyState;
	}

	function createMediaQuery(query) {
		return window.matchMedia ? window.matchMedia(query) : null;
	}

	function bindPolicyListeners() {
		const media = getPolicyState();
		if (media.listenersBound) return;

		media.listenersBound = true;
		[
			media.desktopWidth,
			media.finePointer,
			media.hover,
			media.reducedMotion,
		].forEach(mediaQuery => {
			if (!mediaQuery) return;

			if (typeof mediaQuery.addEventListener === 'function') {
				mediaQuery.addEventListener('change', handleViewportChange);
			} else if (typeof mediaQuery.addListener === 'function') {
				mediaQuery.addListener(handleViewportChange);
			}
		});
	}

	function getMaxTouchPoints() {
		const points = Number(window.navigator?.maxTouchPoints ?? 0);
		return Number.isFinite(points) ? Math.max(0, points) : 0;
	}

	function restoreElementStyle(element, styleValue) {
		if (styleValue === null) {
			element.removeAttribute('style');
			return;
		}

		element.setAttribute('style', styleValue);
	}

	function requestRefresh(options = {}) {
		const delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : REQUEST_REFRESH_DELAY_MS;

		clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(() => scheduleSettledRefresh(options), delay);
	}

	function scheduleSettledRefresh(options = {}) {
		const token = ++refreshToken;
		const shouldWaitForFonts = options.waitForFonts !== false;
		const fontReady = shouldWaitForFonts ? document.fonts?.ready || Promise.resolve() : Promise.resolve();

		Promise.resolve(fontReady)
		.catch(() => null)
		.then(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (token === refreshToken) {
						refreshAll();
					}
				});
			});
		});
	}

	function refreshAll() {
		clearTimeout(refreshTimer);

		if (window.ScrollTrigger) {
			window.ScrollTrigger.sort?.();
			window.ScrollTrigger.refresh(true);
		}
	}

	function scrollBy(options = {}) {
		const top = Number(options.top) || 0;
		const left = Number(options.left) || 0;

		if (left) {
			window.scrollBy({
				top,
				left,
				behavior: options.behavior || 'auto',
			});
			return;
		}

		scrollTo(getScrollTop() + top, options);
	}

	function scrollTo(target, options = {}) {
		const smoother = getSmoother();
		const behavior = options.behavior || 'auto';
		const shouldSmooth = behavior === 'smooth';
		const scrollTarget = typeof target === 'number' ? clampScrollTop(target) : target;

		if (smoother && typeof smoother.scrollTo === 'function') {
			smoother.scrollTo(scrollTarget, shouldSmooth, options.position);
			return;
		}

		if (typeof target === 'number') {
			window.scrollTo({
				top: scrollTarget,
				left: 0,
				behavior,
			});
			return;
		}

		if (target && typeof target.scrollIntoView === 'function') {
			target.scrollIntoView({
				behavior,
				block: options.block || 'start',
				inline: options.inline || 'nearest',
			});
		}
	}

	function getScrollTop() {
		const smoother = getSmoother();

		try {
			if (smoother && typeof smoother.scrollTop === 'function') {
				return Number(smoother.scrollTop()) || 0;
			}
		} catch (error) {
			return window.scrollY || window.pageYOffset || 0;
		}

		return window.scrollY || window.pageYOffset || 0;
	}

	function getSmoother() {
		if (!shouldUseSmoother()) {
			return null;
		}

		if (window.ContextualHomeMotion?.smoother) {
			return window.ContextualHomeMotion.smoother;
		}

		if (window.ScrollSmoother && typeof window.ScrollSmoother.get === 'function') {
			return window.ScrollSmoother.get();
		}

		return null;
	}

	function clampScrollTop(value) {
		const maxScroll = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight,
			document.body.scrollHeight - window.innerHeight,
		);

		return Math.max(0, Math.min(maxScroll, value));
	}
})();
