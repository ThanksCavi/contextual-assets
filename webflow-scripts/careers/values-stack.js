/* Careers — «Our values» card stack.
   Карточки собираются в стопку под фиксированным navbar и уезжают вместе с
   секцией. Раньше этот код жил в page-embed страницы careers-new.

   Контракт разметки (Designer — менять осторожно):
     #wrapper        `.wraper-anim-tab`, секция-триггер и endTrigger
     .card-wrapper   пиновый бокс каждой карточки
     .card-tab       сама карточка, на неё вешается scale / rotationX

   Политика движения. Остальные эффекты сайта спрашивают
   ContextualHomeMotion.shouldUseHeavyScrollEffects(), который выключает всё
   тяжёлое на тач-устройствах. Здесь — сознательное исключение: клиент просил
   стопку и на телефоне, а сам эффект — transform на пяти элементах, без
   ScrollSmoother и без normalizeScroll. Ограничение поэтому не по типу ввода,
   а по высоте экрана, см. MIN_VIEWPORT_QUERY. */
(() => {
	const SECTION_SELECTOR = '#wrapper';
	const WRAPPER_SELECTOR = '.card-wrapper';
	const CARD_SELECTOR = '.card-tab';
	const NAVBAR_SELECTOR = '.navbar.w-nav';

	// Сдвиг каждой следующей карточки в собранной стопке.
	const STACK_STEP_PX = 10;
	// Зазор между нижним краем navbar и верхом стопки.
	const STACK_MARGIN_PX = 20;
	const NAVBAR_FALLBACK_PX = 70;

	// Эффект физически требует, чтобы самая высокая карточка целиком помещалась
	// под navbar'ом: stackTop + высота карточки <= высота экрана. Замеры на
	// staging 06.08.2026: 320px -> нужно 735, 375 -> 711, 390 и 412 -> 687,
	// 768 -> 571.
	//
	// Критерий — высота, а не ширина: телефон в ландшафте (844x390) шире
	// планшета, но не вмещает ни одной карточки, и любой `min-width` его
	// пропустит. Порог 700 отсекает iPhone SE, 320px, ландшафт и короткое окно
	// браузера на десктопе, оставляя остальные телефоны и планшеты.
	//
	// В мобильных браузерах высота в media query — это большой вьюпорт (со
	// спрятанной адресной строкой), и она не скачет при её показе/скрытии, так
	// что matchMedia не будет включать и выключать эффект посреди скролла.
	const MIN_VIEWPORT_QUERY = '(min-height: 700px)';

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, {once: true});
	} else {
		init();
	}

	function init() {
		const gsap = window.gsap;
		const ScrollTrigger = window.ScrollTrigger;

		if (!gsap || !ScrollTrigger) {
			console.warn('[careers-values-stack] GSAP/ScrollTrigger недоступны.');
			return;
		}

		const section = document.querySelector(SECTION_SELECTOR);
		if (!section) return;

		gsap.registerPlugin(ScrollTrigger);

		const wrappers = gsap.utils.toArray(WRAPPER_SELECTOR, section);
		const cards = gsap.utils.toArray(CARD_SELECTOR, section);

		if (!wrappers.length || wrappers.length !== cards.length) {
			console.warn('[careers-values-stack] Разметка стопки не совпадает с ожидаемой.');
			return;
		}

		const lastIndex = cards.length - 1;
		const lastCard = cards[lastIndex];

		// Пины снимаются ровно тогда, когда низ последней карточки в её слоте
		// совпадает с низом #wrapper — только так стопка не наезжает на следующую
		// секцию. Здесь стояла константа 550, подогнанная под десктопную карточку
		// (435px); на мобильной (597px) стопке не хватало ~120px, и она въезжала
		// в тёмную секцию.
		const stackEnd = () =>
			'bottom ' + (stackTop() + STACK_STEP_PX * lastIndex + lastCard.offsetHeight);

		// pinType не задаём НИГДЕ — ScrollTrigger определяет его сам, и оба
		// значения, выставленные руками, делают хуже:
		//
		//   'fixed'     под ScrollSmoother прибивает карточку к
		//               трансформированному `#smooth-content`, а не к экрану:
		//               она улетает вместе с контентом (06.08.2026, десктоп);
		//   'transform' на iOS двигает пин из JS на каждое событие скролла, а
		//               iOS откладывает JS во время инерции — стопка отстаёт от
		//               пальца (06.08.2026, отчёт с устройства).

		gsap.matchMedia().add(MIN_VIEWPORT_QUERY, () => {
			wrappers.forEach((wrapper, i) => {
				const isLast = i === lastIndex;

				// Здесь был ещё rotationX: -10. Perspective не задан ни на карточке,
				// ни на родителе, поэтому поворот проецировался ортографически — весь
				// его вклад сводился к вертикальному сжатию на ~1% (замер 06.08.2026:
				// 0.9129 против 0.9215 у первой карточки, ~5px на 545px). За эту
				// невидимую разницу каждая карточка получала matrix3d и отдельный
				// 3D-слой, который iOS растрирует заново на каждом шаге scale.
				// Если наклон всё-таки нужен — возвращать вместе с
				// transformPerspective, иначе он ничего не рисует.
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
		});
	}

	// Стопка не должна уезжать под фиксированный navbar: его нижний край =
	// top + --navbar-sticky-min-height (контракт navbar.css).
	function stackTop() {
		const navbar = document.querySelector(NAVBAR_SELECTOR);
		const style = navbar && getComputedStyle(navbar);
		const navbarBottom = style
			? (parseFloat(style.top) || 0) +
				(parseFloat(style.getPropertyValue('--navbar-sticky-min-height')) || 0)
			: 0;

		return (navbarBottom || NAVBAR_FALLBACK_PX) + STACK_MARGIN_PX;
	}
})();
