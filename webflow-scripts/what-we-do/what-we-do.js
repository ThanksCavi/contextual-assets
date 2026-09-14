/* What We Do — page behaviour, one module per block.

   Contract (Designer sets only data attributes, classes stay free to change):
     [data-wwd-anchors]         §1 anchor row, rebuilt from the §3 cards
     [data-wwd-anchor-label]    label in the first tile, which is the clone template
     [data-values-stack-item]   §3 card; its id is derived from the card title
     [data-wwd-solution-title]  §3 card title, source of the id and the tile label
     [data-wwd-rich-list]       §3 rich text prop; each line becomes a list item
     [data-wwd-assemble]        §4 empty slot; the assemble mark is injected into it
     [data-wwd-abilities]       §5a wrapper of the family grid; hosts the connector svg
     [data-wwd-family]          one column; [data-wwd-family-label] is its yellow label
     [data-wwd-foundation]      §5b box every connector ends at
     [data-wwd-point-word]      §6 display word, zooms in first
     [data-wwd-point-copy]      §6 paragraph, fades up after the word

   Scroll-driven motion follows the site policy (ContextualHomeMotion) and runs
   only at desktop widths without reduced motion; otherwise the end state shows. */

/* Solutions (§3 → §1): each card gets an id from its title and the hero row
   gets one tile per card, so a duplicated card needs no id or link by hand.
   Runs as the script executes: before values-stack.js starts on
   DOMContentLoaded and before scroll-smoother.js resolves an incoming hash. */
(() => {
	const ITEM_SELECTOR = '[data-values-stack-item]';
	const TITLE_SELECTOR = '[data-wwd-solution-title]';
	const ROW_SELECTOR = '[data-wwd-anchors]';
	const LABEL_SELECTOR = '[data-wwd-anchor-label]';
	const ID_PREFIX = 'wwd-solution-';
	const RICH_LIST_SELECTOR = '[data-wwd-rich-list]';
	const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote';
	// The rich text prop editor has no list button, so editors type one item per
	// line; a leading dash or bullet from pasted text is dropped.
	const BULLET = /^\s*(?:[-–—•*]|&nbsp;)+\s*/;
	// Cleared fields keep a zero-width joiner, which is not whitespace.
	const INVISIBLE = /[\u200b-\u200d\ufeff]/g;

	document.querySelectorAll(RICH_LIST_SELECTOR).forEach((box) => {
		if (box.querySelector('ul, ol')) return;
		const list = document.createElement('ul');
		box.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
			block.innerHTML.split(/<br\s*\/?>/i).forEach((line) => {
				const html = line.replace(BULLET, '').trim();
				const probe = document.createElement('div');
				probe.innerHTML = html;
				if (!probe.textContent.replace(INVISIBLE, '').trim()) return;
				const item = document.createElement('li');
				item.innerHTML = html;
				list.append(item);
			});
		});
		box.replaceChildren(...(list.children.length ? [list] : []));
	});

	const solutions = [];
	const used = new Set();

	document.querySelectorAll(ITEM_SELECTOR).forEach((item) => {
		const title = item.querySelector(TITLE_SELECTOR);
		if (!title) return;
		const label = title.textContent.trim();
		const base = slugify(label) || 'card';
		let slug = base;
		for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
		used.add(slug);
		item.id = ID_PREFIX + slug;
		solutions.push({id: item.id, label});
	});

	const row = document.querySelector(ROW_SELECTOR);
	const label = row && row.querySelector(LABEL_SELECTOR);
	const template = label && label.closest('a');
	if (!solutions.length || !template) return;

	row.replaceChildren(...solutions.map((solution) => {
		const tile = template.cloneNode(true);
		tile.setAttribute('href', `#${solution.id}`);
		tile.querySelector(LABEL_SELECTOR).textContent = solution.label;
		return tile;
	}));

	function slugify(text) {
		return text
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}
})();

/* Assemble (§4): pieces fly into the mark once the slot is fully in view. */
(() => {
	const SLOT_SELECTOR = '[data-wwd-assemble]';
	const STAGE_CLASS = 'wwd-assemble';
	const IN_CLASS = 'is-in';
	// Fully in view; 0.98 because transformed layouts rarely report exactly 1.
	const FULL_VIEW_THRESHOLD = 0.98;
	const TALL_SLOT_THRESHOLD = 0.35;

	const piece = (dx, d, dy, rot, sc, shape) =>
		`<g class="wwd-assemble-px" style="--dx:${dx};--d:${d}"><g class="wwd-assemble-py" style="--dy:${dy};--rot:${rot};--sc:${sc}">${shape}</g></g>`;

	const MARKUP =
		`<div class="${STAGE_CLASS}" aria-hidden="true">` +
		'<svg class="wwd-assemble-mark" width="190" height="192" viewBox="0 0 190 192" fill="none" xmlns="http://www.w3.org/2000/svg">' +
		piece('-24.4px', '.28s', '15.5px', '-90deg', '.68', '<path d="M46.2208 191.996C71.3214 191.916 91.7642 171.41 91.9962 145.918C92.2283 120.232 71.8534 99.2156 46.4868 98.9807C21.5672 98.74 1.09616 118.656 0.167969 143.723L46.6565 144.159L46.2208 191.996Z" fill="#FAF9F5"/>') +
		piece('-62.8px', '.35s', '33.6px', '0deg', '.57', '<path d="M45.6442 191.996C45.8367 191.996 46.0291 191.996 46.2215 191.996L46.6573 144.159L0.168733 143.723C0.151754 144.164 0.140435 144.611 0.134775 145.058C-0.0972717 170.745 20.2776 191.761 45.6442 191.996Z" fill="#6881FF"/>') +
		piece('43.1px', '.42s', '74.5px', '0deg', '.47', '<path d="M144.156 191.699C139.849 191.699 135.525 191.074 131.275 189.819C119.582 186.352 109.921 178.483 104.069 167.657C98.2224 156.831 96.8867 144.348 100.305 132.508C103.729 120.668 111.5 110.885 122.191 104.959C132.882 99.0384 145.209 97.6859 156.902 101.147C168.595 104.615 178.256 112.484 184.108 123.31C189.954 134.136 191.29 146.618 187.872 158.458C184.448 170.299 176.677 180.082 165.986 186.008C159.177 189.779 151.706 191.699 144.151 191.699H144.156ZM144.054 121.017C140.059 121.017 136.103 122.032 132.497 124.032C126.838 127.167 122.723 132.348 120.912 138.617C119.101 144.887 119.808 151.495 122.904 157.226C126 162.957 131.116 167.124 137.308 168.958C143.5 170.792 150.025 170.075 155.685 166.94C161.345 163.806 165.459 158.625 167.27 152.355C169.082 146.085 168.374 139.477 165.278 133.746C162.182 128.015 157.066 123.848 150.874 122.014C148.627 121.35 146.335 121.017 144.054 121.017Z" fill="#6881FF"/>') +
		piece('21px', '.21s', '18.8px', '-20.47deg', '.72', '<path d="M98.1816 46.644C98.1816 72.3194 118.738 93.129 144.087 93.129C169.437 93.129 189.993 72.3136 189.993 46.644" fill="#6881FF"/>') +
		piece('76.2px', '.14s', '-58.5px', '32.78deg', '.57', '<path d="M189.999 46.6441C189.999 20.9688 169.443 0.15918 144.093 0.15918C118.738 0.15918 98.1875 20.9745 98.1875 46.6441" fill="#FAF9F5"/>') +
		piece('6.1px', '.07s', '15.4px', '0deg', '.82', '<path d="M46.0401 93.2838C41.7671 93.2838 37.4261 92.6763 33.1248 91.3983C8.74854 84.1771 -5.27614 58.2209 1.86071 33.5428C8.99191 8.85894 34.6246 -5.34272 59.0008 1.8842C70.8069 5.3859 80.5642 13.3292 86.4672 24.2584C92.3703 35.1876 93.7229 47.7903 90.2649 59.7454C84.3901 80.0679 65.9735 93.2838 46.0401 93.2838ZM46.0684 21.9488C35.5188 21.9488 25.7672 28.9465 22.6544 39.7095C18.8794 52.7764 26.3049 66.5196 39.2089 70.3422C52.113 74.1648 65.6849 66.6456 69.4599 53.5787C71.288 47.2459 70.5748 40.5749 67.4507 34.7922C64.3266 29.0038 59.1593 24.7971 52.911 22.946C50.6358 22.2697 48.3323 21.9488 46.0741 21.9488H46.0684Z" fill="#6881FF"/>') +
		piece('-89.9px', '0s', '-23.4px', '0deg', '.87', '<circle cx="46" cy="46.9004" r="25" fill="#FAF9F5"/>') +
		'</svg></div>';

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, {once: true});
	} else {
		init();
	}

	function init() {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		document.querySelectorAll(SLOT_SELECTOR).forEach((slot) => {
			if (slot.querySelector(`.${STAGE_CLASS}`)) return;
			slot.insertAdjacentHTML('beforeend', MARKUP);
			const stage = slot.querySelector(`.${STAGE_CLASS}`);

			if (reducedMotion || !('IntersectionObserver' in window)) {
				stage.classList.add(IN_CLASS);
				return;
			}

			const tall = slot.offsetHeight > window.innerHeight * 0.8;
			const observer = new IntersectionObserver((entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				stage.classList.add(IN_CLASS);
				observer.disconnect();
			}, {threshold: tall ? TALL_SLOT_THRESHOLD : FULL_VIEW_THRESHOLD});

			observer.observe(slot);
		});
	}
})();

/* Abilities connectors (§5a → §5b): one line per family into the Foundation box,
   drawn on scroll. Geometry is read from the live DOM, so adding a card or a
   family needs no change here. */
(() => {
	const WRAP_SELECTOR = '[data-wwd-abilities]';
	const FAMILY_SELECTOR = '[data-wwd-family]';
	const LABEL_SELECTOR = '[data-wwd-family-label]';
	const FOUNDATION_SELECTOR = '[data-wwd-foundation]';
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const LAYOUT_QUERY = '(min-width: 992px)';
	const MOTION_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
	const POLICY_EVENT = 'contextual:motion-policy-change';

	// Figma 5719:1896: the collector runs 56px above the box, the centre arrow
	// ends 20px above it, turns have a 20px radius.
	const COLLECTOR_OFFSET = 56;
	const END_GAP = 20;
	const TURN_RADIUS = 20;
	const ARROW_LONG = 10;
	const ARROW_HALF = 6;

	let wrap = null;
	let svg = null;
	let timeline = null;
	let resizeTimer = null;

	onMotionReady(init);

	function init() {
		wrap = document.querySelector(WRAP_SELECTOR);
		if (!wrap || !document.querySelector(FOUNDATION_SELECTOR)) return;

		svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('class', 'wwd-abilities-lines');
		svg.setAttribute('aria-hidden', 'true');
		wrap.prepend(svg);

		build();

		window.addEventListener('resize', () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(build, 200);
		});
		window.addEventListener(POLICY_EVENT, build);
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(build).catch(() => {});
		}
	}

	function build() {
		if (timeline) {
			timeline.scrollTrigger && timeline.scrollTrigger.kill();
			timeline.kill();
			timeline = null;
		}
		svg.replaceChildren();
		syncAccordionSemantics();

		if (!window.matchMedia(LAYOUT_QUERY).matches) {
			drawStackedArrow();
			return;
		}

		const shapes = drawShapes();
		if (!shapes) return;

		const gsap = window.gsap;
		if (!gsap || !window.ScrollTrigger || !heavyMotionAllowed()) return;

		gsap.registerPlugin(window.ScrollTrigger);
		shapes.lines.forEach((line) => {
			const length = line.getTotalLength();
			gsap.set(line, {strokeDasharray: length, strokeDashoffset: length});
		});
		gsap.set(shapes.arrows, {autoAlpha: 0});

		timeline = gsap.timeline({
			defaults: {ease: 'none'},
			scrollTrigger: {
				trigger: wrap,
				start: 'top 75%',
				endTrigger: document.querySelector(FOUNDATION_SELECTOR),
				end: 'top 60%',
				scrub: true,
				invalidateOnRefresh: true,
			},
		});
		timeline.to(shapes.lines, {strokeDashoffset: 0, duration: 0.85}, 0);
		timeline.to(shapes.arrows, {autoAlpha: 1, duration: 0.15}, 0.85);

		refreshScroll();
	}

	function drawShapes() {
		const origin = wrap.getBoundingClientRect();
		const foundation = document.querySelector(FOUNDATION_SELECTOR).getBoundingClientRect();
		const stems = Array.from(wrap.querySelectorAll(FAMILY_SELECTOR))
			.map((family) => {
				const label = family.querySelector(LABEL_SELECTOR) || family;
				const labelRect = label.getBoundingClientRect();
				return {
					x: labelRect.left + labelRect.width / 2 - origin.left,
					bottom: family.getBoundingClientRect().bottom - origin.top,
				};
			})
			.sort((a, b) => a.x - b.x);
		if (!stems.length) return null;

		const centerX = foundation.left + foundation.width / 2 - origin.left;
		const foundationTop = foundation.top - origin.top;
		const lowest = Math.max(...stems.map((stem) => stem.bottom));
		const collectorY = Math.max(foundationTop - COLLECTOR_OFFSET, lowest + TURN_RADIUS);
		const endY = foundationTop - END_GAP;

		const center = stems.reduce((best, stem) =>
			Math.abs(stem.x - centerX) < Math.abs(best.x - centerX) ? stem : best);

		const lines = [];
		const arrows = [];

		stems.forEach((stem, index) => {
			if (stem === center) {
				lines.push(addPath(`M${stem.x} ${stem.bottom}V${endY}`));
				arrows.push(addPath(
					`M${stem.x - ARROW_HALF} ${endY - ARROW_LONG}L${stem.x} ${endY}L${stem.x + ARROW_HALF} ${endY - ARROW_LONG}`));
				return;
			}

			const dir = stem.x < center.x ? 1 : -1;
			const next = stems[index + dir];
			const endX = next === center ? center.x : next.x + dir * TURN_RADIUS;
			lines.push(addPath(
				`M${stem.x} ${stem.bottom}V${collectorY - TURN_RADIUS}` +
				`Q${stem.x} ${collectorY} ${stem.x + dir * TURN_RADIUS} ${collectorY}H${endX}`));

			const tipX = (stem.x + next.x) / 2 + dir * (ARROW_LONG / 2);
			arrows.push(addPath(
				`M${tipX - dir * ARROW_LONG} ${collectorY - ARROW_HALF}L${tipX} ${collectorY}` +
				`L${tipX - dir * ARROW_LONG} ${collectorY + ARROW_HALF}`));
		});

		return {lines, arrows};
	}

	// Stacked layout: one static centre arrow across the gap below the accordions.
	// The svg starts at the wrapper's bottom edge (see CSS), so opening a
	// family moves the arrow with it; the gap is read from layout offsets, which
	// ignore the Foundation's fade-up transform.
	function drawStackedArrow() {
		const foundation = document.querySelector(FOUNDATION_SELECTOR);
		const gap = layoutTop(foundation) - (layoutTop(wrap) + wrap.offsetHeight);
		const endY = gap - END_GAP;
		if (endY <= ARROW_LONG) return;

		const x = layoutLeft(foundation) + foundation.offsetWidth / 2 - layoutLeft(wrap);
		addPath(`M${x} 0V${endY}`);
		addPath(`M${x - ARROW_HALF} ${endY - ARROW_LONG}L${x} ${endY}L${x + ARROW_HALF} ${endY - ARROW_LONG}`);
	}

	function layoutTop(el) {
		let top = 0;
		for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
		return top;
	}

	function layoutLeft(el) {
		let left = 0;
		for (let node = el; node; node = node.offsetParent) left += node.offsetLeft;
		return left;
	}

	function addPath(d) {
		const path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', d);
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke-width', '1');
		path.setAttribute('stroke-opacity', '0.3');
		path.style.stroke = 'var(--_system-colors---light)';
		svg.appendChild(path);
		return path;
	}

	// Desktop shows every family open, so the accordion's hidden/toggle
	// semantics only apply to the stacked layout.
	function syncAccordionSemantics() {
		const desktop = window.matchMedia(LAYOUT_QUERY).matches;
		wrap.querySelectorAll('[data-reveal-accordion-item]').forEach((item) => {
			const detail = item.querySelector('[data-reveal-accordion-detail]');
			const toggle = item.querySelector('[data-reveal-accordion-toggle]');
			if (detail) {
				detail.setAttribute('aria-hidden', String(!desktop && !item.classList.contains('is-open')));
			}
			if (toggle) toggle.setAttribute('tabindex', desktop ? '-1' : '0');
		});
	}

	function heavyMotionAllowed() {
		const motion = window.ContextualHomeMotion;
		const heavy = motion && typeof motion.shouldUseHeavyScrollEffects === 'function'
			? motion.shouldUseHeavyScrollEffects()
			: true;
		return heavy && window.matchMedia(MOTION_QUERY).matches;
	}

	function refreshScroll() {
		const motion = window.ContextualHomeMotion;
		if (motion && typeof motion.requestRefresh === 'function') {
			motion.requestRefresh();
		} else {
			window.ScrollTrigger.refresh();
		}
	}

	function onMotionReady(callback) {
		const start = () => {
			const motion = window.ContextualHomeMotion;
			if (motion && motion.ready) {
				motion.ready.then(callback);
			} else {
				callback();
			}
		};
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', start, {once: true});
		} else {
			start();
		}
	}
})();

/* The Point (§6): the display word zooms in from above (animate.css zoomInDown,
   toned down to the site's motion policy), then the paragraph fades up. */
(() => {
	const WORD_SELECTOR = '[data-wwd-point-word]';
	const COPY_SELECTOR = '[data-wwd-point-copy]';
	const MOTION_QUERY = '(min-width: 992px) and (prefers-reduced-motion: no-preference)';
	const POLICY_EVENT = 'contextual:motion-policy-change';

	let context = null;

	onMotionReady(() => {
		build();
		window.addEventListener(POLICY_EVENT, build);
	});

	function build() {
		const gsap = window.gsap;
		const word = document.querySelector(WORD_SELECTOR);
		if (!gsap || !window.ScrollTrigger || !word) return;

		if (context) {
			context.revert();
			context = null;
		}
		if (!heavyMotionAllowed()) return;

		gsap.registerPlugin(window.ScrollTrigger);
		const copy = document.querySelector(COPY_SELECTOR);

		context = gsap.context(() => {
			const timeline = gsap.timeline({
				scrollTrigger: {trigger: word, start: 'top 80%', once: true},
			});
			timeline.from(word, {opacity: 0, scale: 0.6, y: -60, duration: 0.9, ease: 'back.out(1.4)'}, 0);
			if (copy) {
				timeline.from(copy, {opacity: 0, y: 24, duration: 0.6, ease: 'power2.out'}, 0.6);
			}
		});
	}

	function heavyMotionAllowed() {
		const motion = window.ContextualHomeMotion;
		const heavy = motion && typeof motion.shouldUseHeavyScrollEffects === 'function'
			? motion.shouldUseHeavyScrollEffects()
			: true;
		return heavy && window.matchMedia(MOTION_QUERY).matches;
	}

	function onMotionReady(callback) {
		const start = () => {
			const motion = window.ContextualHomeMotion;
			if (motion && motion.ready) {
				motion.ready.then(callback);
			} else {
				callback();
			}
		};
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', start, {once: true});
		} else {
			start();
		}
	}
})();
