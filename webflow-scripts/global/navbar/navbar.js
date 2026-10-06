/* Navbar runtime: keeps .is-sticky in sync with the scroll position, including
   ScrollSmoother scrolling. The mobile submenu is Webflow's native dropdown. */
(() => {
	const INIT_FLAG = '__contextualNavbarInit';
	const NAVBAR_SELECTOR = '.navbar.w-nav';
	const SMOOTH_CONTENT_SELECTOR = '#smooth-content';
	const STICKY_CLASS = 'is-sticky';
	const READY_EVENT = 'contextual:smoother-ready';
	const POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
	const STICKY_ON_Y = 8;
	const STICKY_OFF_Y = 1;
	const MONITOR_MAX_MS = 4000;
	const MONITOR_STABLE_FRAME_COUNT = 4;
	const MONITOR_SETTLED_DELTA = 0.5;

	if (window[INIT_FLAG]) return;
	window[INIT_FLAG] = true;

	let navbar = null;
	let isSticky = false;
	let ticking = false;
	let monitorFrame = null;
	let monitorStartedAt = 0;
	let lastMonitorScrollTop = null;
	let stableMonitorFrames = 0;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initNavbar, {once: true});
	} else {
		initNavbar();
	}

	function initNavbar() {
		initStickyNavbar();
	}

	function initStickyNavbar() {
		navbar = document.querySelector(NAVBAR_SELECTOR);

		if (!navbar) return;

		isSticky = navbar.classList.contains(STICKY_CLASS);
		updateStickyState();

		window.addEventListener('scroll', startStickyMonitor, {passive: true});
		window.addEventListener('wheel', startStickyMonitor, {passive: true});
		window.addEventListener('resize', startStickyMonitor);
		window.addEventListener(READY_EVENT, startStickyMonitor);
		window.addEventListener(POLICY_CHANGE_EVENT, startStickyMonitor);
	}

	/* Sticky state */

	function requestStickyUpdate() {
		if (ticking) return;

		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			updateStickyState();
		});
	}

	function startStickyMonitor() {
		requestStickyUpdate();

		monitorStartedAt = getCurrentTime();
		lastMonitorScrollTop = null;
		stableMonitorFrames = 0;

		if (monitorFrame !== null) return;

		monitorFrame = requestAnimationFrame(runStickyMonitor);
	}

	function runStickyMonitor() {
		monitorFrame = null;
		updateStickyState();

		if (!shouldContinueStickyMonitor()) return;

		monitorFrame = requestAnimationFrame(runStickyMonitor);
	}

	function updateStickyState() {
		if (!navbar) return;

		if (!isSticky && getScrollTop() > STICKY_ON_Y) {
			setStickyState(true);
			return;
		}

		if (isSticky && getScrollTop() <= STICKY_OFF_Y) {
			setStickyState(false);
		}
	}

	// The class lives on .navbar only; inner styles key off it.
	function setStickyState(nextSticky) {
		isSticky = nextSticky;
		navbar.classList.toggle(STICKY_CLASS, nextSticky);
	}

	// Native and visual scroll diverge under ScrollSmoother; use the larger.
	function getScrollTop() {
		return Math.max(getNativeScrollTop(), getVisualScrollTop());
	}

	function getVisualScrollTop() {
		const smootherScrollTop = getSmootherScrollTop();

		if (Number.isFinite(smootherScrollTop)) {
			return Math.max(0, smootherScrollTop);
		}

		return getNativeScrollTop();
	}

	function getNativeScrollTop() {
		return Math.max(0, window.scrollY || window.pageYOffset || 0);
	}

	function shouldContinueStickyMonitor() {
		const elapsed = getCurrentTime() - monitorStartedAt;
		if (elapsed >= MONITOR_MAX_MS) return false;

		const currentScrollTop = getVisualScrollTop();

		if (Number.isFinite(lastMonitorScrollTop) && Math.abs(currentScrollTop - lastMonitorScrollTop) <= MONITOR_SETTLED_DELTA) {
			stableMonitorFrames += 1;
		} else {
			stableMonitorFrames = 0;
		}

		lastMonitorScrollTop = currentScrollTop;

		if (stableMonitorFrames < MONITOR_STABLE_FRAME_COUNT) return true;

		// Keep watching while native and visual scroll differ, or .is-sticky can get stuck
		// after an anchor jump or a fling. The reverse case is capped by MONITOR_MAX_MS.
		return Math.abs(currentScrollTop - getNativeScrollTop()) > MONITOR_SETTLED_DELTA;
	}

	function getSmootherScrollTop() {
		const motion = window.ContextualHomeMotion;
		const shouldUseSmoother = motion && typeof motion.shouldUseSmoother === 'function'
			? motion.shouldUseSmoother()
			: Boolean(motion && motion.smoother);

		if (!shouldUseSmoother) return null;

		const smoothContent = document.querySelector(SMOOTH_CONTENT_SELECTOR);
		if (smoothContent) {
			const value = -smoothContent.getBoundingClientRect().top;
			if (Number.isFinite(value)) return value;
		}

		const smoother = getSmoother();
		if (!smoother) return null;

		try {
			if (typeof smoother.scrollTop === 'function') {
				const value = Number(smoother.scrollTop());
				if (Number.isFinite(value)) return value;
			}
		} catch (error) {
			return null;
		}

		return null;
	}

	function getSmoother() {
		if (window.ContextualHomeMotion && typeof window.ContextualHomeMotion.getSmoother === 'function') {
			return window.ContextualHomeMotion.getSmoother();
		}

		if (window.ContextualHomeMotion && window.ContextualHomeMotion.smoother) {
			return window.ContextualHomeMotion.smoother;
		}

		if (window.ScrollSmoother && typeof window.ScrollSmoother.get === 'function') {
			return window.ScrollSmoother.get();
		}

		return null;
	}

	function getCurrentTime() {
		if (window.performance && typeof window.performance.now === 'function') {
			return window.performance.now();
		}

		return Date.now();
	}
})();
