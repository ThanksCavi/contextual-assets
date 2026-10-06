/* Careers "Our values" card stack: cards stack under the fixed navbar and scroll
   away with the section.

   #wrapper        section trigger and endTrigger
   .card-wrapper   pinned box of each card
   .card-tab       the card, scaled

   Runs on touch devices too, limited by viewport height (MIN_VIEWPORT_QUERY). */
(() => {
	// Careers markup keeps its classes; other pages opt in with data attributes.
	const SECTION_SELECTOR = '#wrapper, [data-values-stack]';
	const WRAPPER_SELECTOR = '.card-wrapper, [data-values-stack-item]';
	const CARD_SELECTOR = '.card-tab, [data-values-stack-card]';
	const NAVBAR_SELECTOR = '.navbar.w-nav';

	// Offset of each next card in the stack.
	const STACK_STEP_PX = 10;
	// Gap between the navbar and the top of the stack.
	const STACK_MARGIN_PX = 20;
	const NAVBAR_FALLBACK_PX = 70;

	// The tallest card must fit under the navbar, so the limit is viewport height,
	// per layout (cards get shorter at 992px).
	const MIN_VIEWPORT_QUERY =
		'(max-width: 991px) and (min-height: 700px),' +
		'(min-width: 992px) and (min-height: 600px)';

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, {once: true});
	} else {
		init();
	}

	function init() {
		const gsap = window.gsap;
		const ScrollTrigger = window.ScrollTrigger;

		if (!gsap || !ScrollTrigger) {
			console.warn('[careers-values-stack] GSAP/ScrollTrigger is not available.');
			return;
		}

		const section = document.querySelector(SECTION_SELECTOR);
		if (!section) return;

		gsap.registerPlugin(ScrollTrigger);

		const wrappers = gsap.utils.toArray(WRAPPER_SELECTOR, section);
		const cards = gsap.utils.toArray(CARD_SELECTOR, section);

		if (!wrappers.length || wrappers.length !== cards.length) {
			console.warn('[careers-values-stack] Stack markup does not match the expected structure.');
			return;
		}

		const lastIndex = cards.length - 1;
		const lastCard = cards[lastIndex];

		// Unpin when the last card's bottom meets the bottom of #wrapper.
		const stackEnd = () =>
			'bottom ' + (stackTop() + STACK_STEP_PX * lastIndex + lastCard.offsetHeight);

		// pinType is left to ScrollTrigger: 'fixed' breaks under ScrollSmoother, 'transform' lags on iOS.

		gsap.matchMedia().add(MIN_VIEWPORT_QUERY, () => {
			wrappers.forEach((wrapper, i) => {
				const isLast = i === lastIndex;

				gsap.to(cards[i], {
					scale: isLast ? 1 : 0.9 + 0.025 * i,
					transformOrigin: 'top center',
					ease: 'none',
					scrollTrigger: {
						trigger: wrapper,
						start: () => 'top ' + (stackTop() + STACK_STEP_PX * i),
						endTrigger: section,
						end: stackEnd,
						scrub: true,
						pin: wrapper,
						pinSpacing: false,
						invalidateOnRefresh: true,
					},
				});
			});

			// An anchor to a card lands it in its slot of the stack, not flush
			// under the navbar (scroll-smoother.js honours scroll-margin-top).
			const alignAnchors = () => wrappers.forEach((wrapper, i) => {
				const slot = stackTop() + STACK_STEP_PX * i - anchorOffset();
				wrapper.style.scrollMarginTop = Math.max(0, slot) + 'px';
			});
			alignAnchors();
			ScrollTrigger.addEventListener('refreshInit', alignAnchors);

			return () => {
				ScrollTrigger.removeEventListener('refreshInit', alignAnchors);
				wrappers.forEach((wrapper) => { wrapper.style.scrollMarginTop = ''; });
			};
		});
	}

	function anchorOffset() {
		const motion = window.ContextualHomeMotion;
		return motion && typeof motion.getAnchorOffset === 'function' ? motion.getAnchorOffset() : 0;
	}

	// Navbar bottom edge: --navbar-inset + --navbar-bar-height-sticky.
	function stackTop() {
		const navbar = document.querySelector(NAVBAR_SELECTOR);
		const style = navbar && getComputedStyle(navbar);
		const navbarBottom = style
			? (parseFloat(style.getPropertyValue('--navbar-inset')) || 0) +
				(parseFloat(style.getPropertyValue('--navbar-bar-height-sticky')) || 0)
			: 0;

		return (navbarBottom || NAVBAR_FALLBACK_PX) + STACK_MARGIN_PX;
	}
})();
