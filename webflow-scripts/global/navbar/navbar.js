/**
 * Navbar runtime.
 *
 * Одна задача: держать класс .is-sticky в согласии с реальной прокруткой, в том
 * числе когда страницу листает ScrollSmoother — нативный window.scrollY при этом
 * не двигается.
 *
 * Мобильное подменю здесь НЕ обслуживается, и это осознанно. Раньше тут висел
 * обработчик, который добавлял .is-open на .mob-menu-item, — при том что сам пункт
 * является нативным Webflow Dropdown со своим открытием, а комбо-класса .is-open
 * в проекте не существовало вовсе. Два механизма на одном элементе, и работающий
 * из них — ни один. Оставлен нативный дропдаун Webflow: раскрытие, закрытие по
 * клику вне и класс .w--open он делает сам, оформление состояния — в navbar.css.
 */
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

	/* ---------- залипание ---------- */

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

	// Класс живёт в одном месте — на .navbar. Раньше он дублировался ещё на двух
	// элементах, причём один из селекторов (.navbar-container) не совпадал ни с чем
	// на странице. Всё внутреннее оформление вешается селекторами от .navbar.
	function setStickyState(nextSticky) {
		isSticky = nextSticky;
		navbar.classList.toggle(STICKY_CLASS, nextSticky);
	}

	// Под ScrollSmoother нативная прокрутка и визуальная расходятся: на iOS нативная
	// может стоять на нуле, пока контент уже уехал, а во время инерции — наоборот.
	// Берём максимум, чтобы шапка залипала по любому из двух признаков.
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

		// У смузера экспоненциальный хвост: кадровая дельта падает ниже порога,
		// когда визуальная прокрутка ещё не догнала нативную. Заснуть в этот момент —
		// значит заклинить .is-sticky в промежуточном состоянии (белая полоса на самом
		// верху после прыжка к якорю или fling'а). Пока значения расходятся — следим.
		// Обратный случай (iOS: нативная стоит, визуальная уехала) ограничен MONITOR_MAX_MS.
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
