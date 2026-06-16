(() => {
	const ROOT_SELECTOR = '[data-fss-slider]';
	const TAB_SELECTOR = '[data-fss-tab]';
	const PANEL_SELECTOR = '[data-fss-panel]';
	const MEDIA_SELECTOR = '[data-fss-media]';
	const ACTIVE_CLASS = 'is-active';
	const INIT_CLASS = 'is-initialized';
	const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

	const initialized = new WeakSet();

	function initAll() {
		document.querySelectorAll(ROOT_SELECTOR).forEach(initSlider);
	}

	function initSlider(root) {
		if (initialized.has(root)) return;

		const tabs = Array.from(root.querySelectorAll(TAB_SELECTOR));
		const panels = Array.from(root.querySelectorAll(PANEL_SELECTOR));

		if (tabs.length === 0 || panels.length === 0) return;

		initialized.add(root);
		root.classList.add(INIT_CLASS);

		const state = {
			root,
			tabs,
			panels,
			activeIndex: getInitialIndex(tabs, panels),
		};

		prepareAccessibility(state);
		bindTabs(state);
		bindMedia(state);
		activate(state, state.activeIndex, {immediate: true, focus: false});
		requestGlobalRefresh();
	}

	function getInitialIndex(tabs, panels) {
		const activeTabIndex = tabs.findIndex((tab) => tab.classList.contains(ACTIVE_CLASS));
		if (activeTabIndex >= 0) return activeTabIndex;

		const activePanelIndex = panels.findIndex((panel) => panel.classList.contains(ACTIVE_CLASS));
		return activePanelIndex >= 0 ? activePanelIndex : 0;
	}

	function prepareAccessibility(state) {
		const sliderId = ensureId(state.root, 'fss-slider');

		state.tabs.forEach((tab, index) => {
			const tabId = ensureId(tab, `${sliderId}-tab-${index + 1}`);
			const panel = state.panels[index];

			tab.setAttribute('role', tab.getAttribute('role') || 'tab');
			tab.setAttribute('type', tab.getAttribute('type') || 'button');

			if (panel) {
				const panelId = ensureId(panel, `${sliderId}-panel-${index + 1}`);
				tab.setAttribute('aria-controls', panelId);
				panel.setAttribute('role', panel.getAttribute('role') || 'tabpanel');
				panel.setAttribute('aria-labelledby', tabId);
			}
		});
	}

	function bindTabs(state) {
		state.tabs.forEach((tab, index) => {
			tab.addEventListener('click', (event) => {
				event.preventDefault();
				activate(state, index, {focus: false});
			});

			tab.addEventListener('keydown', (event) => handleTabKeydown(event, state, index));
		});
	}

	function bindMedia(state) {
		state.panels.forEach((panel) => {
			const media = panel.querySelector(MEDIA_SELECTOR);
			if (!media) return;

			const videoUrl = getVideoUrl(media, panel);
			media.classList.toggle('has-video', Boolean(videoUrl));

			if (!videoUrl) return;

			media.setAttribute('role', media.getAttribute('role') || 'button');
			media.setAttribute('tabindex', media.getAttribute('tabindex') || '0');
			media.setAttribute('aria-label', media.getAttribute('aria-label') || 'Play client success video');

			media.addEventListener('click', () => openVideo(videoUrl));
			media.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				openVideo(videoUrl);
			});
		});
	}

	function handleTabKeydown(event, state, index) {
		const keyMap = {
			ArrowRight: 1,
			ArrowDown: 1,
			ArrowLeft: -1,
			ArrowUp: -1,
		};

		if (event.key === 'Home') {
			event.preventDefault();
			activate(state, 0, {focus: true});
			return;
		}

		if (event.key === 'End') {
			event.preventDefault();
			activate(state, state.tabs.length - 1, {focus: true});
			return;
		}

		const direction = keyMap[event.key];
		if (!direction) return;

		event.preventDefault();
		activate(state, wrap(index + direction, state.tabs.length), {focus: true});
	}

	function activate(state, nextIndex, options = {}) {
		if (!state.tabs[nextIndex] || !state.panels[nextIndex]) return;

		state.activeIndex = nextIndex;

		state.tabs.forEach((tab, index) => {
			const isActive = index === nextIndex;
			tab.classList.toggle(ACTIVE_CLASS, isActive);
			tab.setAttribute('aria-selected', String(isActive));
			tab.setAttribute('tabindex', isActive ? '0' : '-1');
		});

		state.panels.forEach((panel, index) => {
			const isActive = index === nextIndex;
			panel.classList.toggle(ACTIVE_CLASS, isActive);
			panel.hidden = !isActive;
			panel.setAttribute('aria-hidden', String(!isActive));
			updateFocusableElements(panel, isActive);
		});

		if (options.focus) {
			state.tabs[nextIndex].focus({preventScroll: true});
		}

		if (!options.immediate && shouldUseMotion()) {
			state.root.classList.add('is-switching');
			window.setTimeout(() => state.root.classList.remove('is-switching'), 260);
		}

		requestGlobalRefresh();
	}

	function updateFocusableElements(panel, isActive) {
		panel.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
			if (isActive) {
				const original = element.getAttribute('data-fss-original-tabindex');
				if (original === null || original === '') {
					element.removeAttribute('tabindex');
				} else {
					element.setAttribute('tabindex', original);
				}
				return;
			}

			if (!element.hasAttribute('data-fss-original-tabindex')) {
				element.setAttribute('data-fss-original-tabindex', element.getAttribute('tabindex') || '');
			}

			element.setAttribute('tabindex', '-1');
		});
	}

	function getVideoUrl(media, panel) {
		return (
			media.getAttribute('data-fss-video-url') ||
			panel.getAttribute('data-fss-video-url') ||
			''
		).trim();
	}

	function openVideo(url) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function ensureId(element, prefix) {
		if (element.id) return element.id;

		const id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
		element.id = id;
		return id;
	}

	function wrap(index, total) {
		return (index + total) % total;
	}

	function shouldUseMotion() {
		return !window.matchMedia || !window.matchMedia(REDUCED_MOTION_QUERY).matches;
	}

	function requestGlobalRefresh() {
		if (window.ContextualHomeMotion?.requestRefresh) {
			window.ContextualHomeMotion.requestRefresh();
			return;
		}

		if (window.ScrollTrigger) {
			window.ScrollTrigger.sort?.();
			window.ScrollTrigger.refresh(true);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAll);
	} else {
		initAll();
	}
})();
