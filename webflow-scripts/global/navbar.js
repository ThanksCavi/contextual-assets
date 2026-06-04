/**
 * Navbar runtime
 * Syncs the header compact state with ScrollSmoother and manages mobile menu dropdowns.
 */
(() => {
	const INIT_FLAG = '__contextualNavbarInit';
	const NAVBAR_SELECTOR = '.navbar.w-nav';
	const NAVBAR_CONTAINER_SELECTOR = '.navbar-container';
	const MOBILE_TOGGLE_SELECTOR = '.mob-menu-toggle';
	const MOBILE_ITEM_SELECTOR = '.mob-menu-item';
	const MOBILE_ICON_SELECTOR = '.mob-menu-toggle-icon';
	const SMOOTH_CONTENT_SELECTOR = '#smooth-content';
	const STICKY_CLASS = 'is-sticky';
	const OPEN_CLASS = 'is-open';
	const READY_EVENT = 'contextual:smoother-ready';
	const POLICY_CHANGE_EVENT = 'contextual:motion-policy-change';
	const STICKY_ON_Y = 120;
	const STICKY_OFF_Y = 40;
	const MONITOR_MAX_MS = 1800;
	const MONITOR_STABLE_FRAME_COUNT = 4;
	const MONITOR_SETTLED_DELTA = 0.5;

	if (window[INIT_FLAG]) return;
	window[INIT_FLAG] = true;

	let navbar = null;
	let navbarContainer = null;
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
		initMobileMenuDropdowns();
	}

	function initStickyNavbar() {
		navbar = document.querySelector(NAVBAR_SELECTOR);
		navbarContainer = document.querySelector(NAVBAR_CONTAINER_SELECTOR);

		if (!navbar) return;

		isSticky = navbar.classList.contains(STICKY_CLASS);
		updateStickyState();

		window.addEventListener('scroll', startStickyMonitor, {passive: true});
		window.addEventListener('wheel', startStickyMonitor, {passive: true});
		window.addEventListener('resize', startStickyMonitor);
		window.addEventListener(READY_EVENT, startStickyMonitor);
		window.addEventListener(POLICY_CHANGE_EVENT, startStickyMonitor);
	}

	function initMobileMenuDropdowns() {
		document.querySelectorAll(MOBILE_TOGGLE_SELECTOR).forEach((toggle) => {
			if (toggle.dataset.contextualNavbarDropdownReady === 'true') return;

			toggle.dataset.contextualNavbarDropdownReady = 'true';
			toggle.addEventListener('click', handleMobileMenuToggleClick);
		});
	}

	function handleMobileMenuToggleClick(event) {
		event.preventDefault();
		event.stopPropagation();

		const currentItem = event.currentTarget.closest(MOBILE_ITEM_SELECTOR);
		if (!currentItem) return;

		const currentIcon = currentItem.querySelector(MOBILE_ICON_SELECTOR);
		const isAlreadyOpen = currentItem.classList.contains(OPEN_CLASS);

		document.querySelectorAll(`${MOBILE_ITEM_SELECTOR}.${OPEN_CLASS}`).forEach((item) => {
			item.classList.remove(OPEN_CLASS);

			const itemIcon = item.querySelector(MOBILE_ICON_SELECTOR);
			if (itemIcon) {
				itemIcon.classList.remove(OPEN_CLASS);
			}
		});

		if (!isAlreadyOpen) {
			currentItem.classList.add(OPEN_CLASS);

			if (currentIcon) {
				currentIcon.classList.add(OPEN_CLASS);
			}
		}
	}

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

		const scrollTop = getVisualScrollTop();

		if (!isSticky && scrollTop > STICKY_ON_Y) {
			setStickyState(true);
			return;
		}

		if (isSticky && scrollTop < STICKY_OFF_Y) {
			setStickyState(false);
		}
	}

	function setStickyState(nextSticky) {
		isSticky = nextSticky;
		navbar.classList.toggle(STICKY_CLASS, nextSticky);

		if (navbarContainer) {
			navbarContainer.classList.toggle(STICKY_CLASS, nextSticky);
		}
	}

	function getVisualScrollTop() {
		const smootherScrollTop = getSmootherScrollTop();

		if (Number.isFinite(smootherScrollTop)) {
			return Math.max(0, smootherScrollTop);
		}

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

		return stableMonitorFrames < MONITOR_STABLE_FRAME_COUNT;
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
