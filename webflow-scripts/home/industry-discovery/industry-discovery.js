/**
 * Industry Panel - Interactive background crossfade & mobile accordion
 */
(() => {
	const CFG = {
		sel: {
			panel: '[data-industry-panel]',
			card: '[data-industry-card]',
			src: '.industry-card__bg-source',
			link: '.card-link, .industry-card-link',
			toggle: '.ip-button',
		},
		variant: 'data-wf--industry-card--variant',
		cls: {
			bg: 'industry-panel__bg-active',
			act: 'is-industry-bg-active',
			open: 'is-mobile-open',
		},
		bp: 768,
	};

	const panels = new WeakMap();
	const isMobile = () => window.innerWidth <= CFG.bp;

	function initPanel(panel) {
		if (panels.has(panel)) return;

		const cards = Array.from(panel.querySelectorAll(CFG.sel.card));
		if (!cards.length) return;

		const state = {
			layers: getLayers(panel),
			activeIndex: -1,
			activeSrc: '',
		};

		panels.set(panel, state);

		cards.forEach((card) => {
			// The card type is the presence of the link itself, not its href: the
			// Expandable Card variant hides the <a> by conditional visibility, so it
			// never reaches the DOM. Placeholder hrefs ("#") stay link cards — swap the
			// variant in Webflow to bring the accordion back.
			const isLinkCard = !!card.querySelector(CFG.sel.link);
			// The Expandable Link Card carries both jobs. Desktop needs nothing extra —
			// hover reveals the description, a click follows the link — but without hover
			// mobile has to split them: the "+" opens the description, the rest of the
			// card stays the link.
			const isHybrid = isLinkCard && card.getAttribute(CFG.variant) === 'expandable-link-card';

			card.classList.add(isHybrid ? 'is-expandable-link-card' : isLinkCard ? 'is-link-card' : 'is-info-card');
			bindEvents(card, state, cards, isLinkCard, isHybrid);
		});

		preload(cards);
		setupResizeObserver(panel, cards);
	}

	function getLayers(panel) {
		let layers = Array.from(panel.children).filter((c) => c.classList?.contains(CFG.cls.bg));
		while (layers.length < 2) {
			const layer = document.createElement('div');
			layer.className = CFG.cls.bg;
			layer.setAttribute('aria-hidden', 'true');
			panel.prepend(layer);
			layers.push(layer);
		}
		return layers.slice(0, 2);
	}

	function setupResizeObserver(panel, cards) {
		const syncHeights = () => {
			const mobile = isMobile();
			cards.forEach((card) => {
				const reveal = card.querySelector('.ip-card-description-reveal');
				const h = mobile ? 0 : reveal?.offsetHeight || 0;
				card.style.setProperty('--ip-reveal-h', `${h}px`);
			});
		};

		if (window.ResizeObserver) {
			new ResizeObserver(syncHeights).observe(panel);
		}
		requestAnimationFrame(syncHeights);
	}

	function bindEvents(card, state, allCards, isLinkCard, isHybrid) {
		const handleEntry = () => {
			if (!isMobile()) updateBg(state, card);
		};

		card.addEventListener('pointerenter', handleEntry, { passive: true });
		card.addEventListener('focusin', handleEntry);

		if (isHybrid) {
			bindToggle(card, state, allCards);
			return;
		}

		card.addEventListener('click', (e) => {
			if (!isMobile() || isLinkCard) return;

			e.preventDefault();
			toggleCard(card, state, allCards);
		});
	}

	function bindToggle(card, state, allCards) {
		const toggle = card.querySelector(CFG.sel.toggle);
		if (!toggle) return;

		// Webflow ships the "+" as decoration. Here it is the only way to reach the
		// description, so it has to be an actual control.
		toggle.removeAttribute('aria-hidden');
		toggle.setAttribute('role', 'button');
		toggle.setAttribute('tabindex', '0');
		toggle.setAttribute('aria-label', 'Show description');
		toggle.setAttribute('aria-expanded', 'false');

		const handleToggle = (e) => {
			if (!isMobile()) return;

			e.preventDefault();
			toggleCard(card, state, allCards);
		};

		toggle.addEventListener('click', handleToggle);
		toggle.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') handleToggle(e);
		});
	}

	function toggleCard(card, state, allCards) {
		const wasOpen = card.classList.contains(CFG.cls.open);

		allCards.forEach((c) => c.classList.remove(CFG.cls.open));
		if (!wasOpen) {
			card.classList.add(CFG.cls.open);
			updateBg(state, card);
		}

		allCards.forEach((c) => {
			const toggle = c.querySelector(CFG.sel.toggle);
			if (toggle?.hasAttribute('aria-expanded')) {
				toggle.setAttribute('aria-expanded', String(c.classList.contains(CFG.cls.open)));
			}
		});
	}

	function updateBg(state, card) {
		const src = getSrc(card);
		if (!src || src === state.activeSrc) return;

		const nextIdx = state.activeIndex === 0 ? 1 : 0;
		const nextLayer = state.layers[nextIdx];
		const prevLayer = state.layers[state.activeIndex];

		// Force reflow for smooth transition reset if needed
		if (!nextLayer.classList.contains(CFG.cls.act)) {
			nextLayer.style.transition = 'none';
			void nextLayer.offsetHeight;
			nextLayer.style.transition = '';
		}

		nextLayer.style.backgroundImage = `url("${src}")`;
		nextLayer.classList.add(CFG.cls.act);
		if (prevLayer) prevLayer.classList.remove(CFG.cls.act);

		state.activeIndex = nextIdx;
		state.activeSrc = src;
	}

	function getSrc(card) {
		const el = card.querySelector(CFG.sel.src);
		return el?.currentSrc || el?.src || el?.getAttribute('src') || '';
	}

	function preload(cards) {
		cards.forEach((c) => {
			const s = getSrc(c);
			if (s) {
				const img = new Image();
				img.src = s;
			}
		});
	}

	// Lifecycle
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => document.querySelectorAll(CFG.sel.panel).forEach(initPanel));
	} else {
		document.querySelectorAll(CFG.sel.panel).forEach(initPanel);
	}
})();