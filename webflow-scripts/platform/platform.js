/* Platform — page behaviour, one module per block.

   Contract (Designer sets only data attributes, classes stay free to change):
     [data-plt-stages]       §4 selector root; exactly one stage is open
     [data-plt-stage]        one stage; carries the `is-open` state class
     [data-plt-stage-body]   title and description, shown only while open
     [data-plt-stage-label]  closed label

   The initially open stage comes from Designer (`is-open`); without one the
   first stage opens. Layout and transitions live in platform.css. */

/* Stages (§4): click, Enter or Space opens a stage; the open one stays open. */
(() => {
	const ROOT_SELECTOR = '[data-plt-stages]';
	const STAGE_SELECTOR = '[data-plt-stage]';
	const BODY_SELECTOR = '[data-plt-stage-body]';
	const OPEN_CLASS = 'is-open';

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, {once: true});
	} else {
		init();
	}

	function init() {
		document.querySelectorAll(ROOT_SELECTOR).forEach(setupRoot);
	}

	function setupRoot(root, rootIndex) {
		const stages = Array.from(root.querySelectorAll(STAGE_SELECTOR));
		if (!stages.length) return;

		stages.forEach((stage, index) => {
			stage.setAttribute('role', 'button');
			if (!stage.hasAttribute('tabindex')) stage.setAttribute('tabindex', '0');

			const body = stage.querySelector(BODY_SELECTOR);
			if (body) {
				if (!body.id) body.id = `plt-stage-${rootIndex + 1}-${index + 1}`;
				stage.setAttribute('aria-controls', body.id);
			}
		});

		const initial = stages.find((stage) => stage.classList.contains(OPEN_CLASS)) || stages[0];
		openStage(stages, initial);

		root.addEventListener('click', (event) => {
			const stage = event.target.closest(STAGE_SELECTOR);
			if (stage && root.contains(stage)) openStage(stages, stage);
		});

		root.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			if (!event.target.matches(STAGE_SELECTOR)) return;

			event.preventDefault();
			openStage(stages, event.target);
		});
	}

	function openStage(stages, target) {
		stages.forEach((stage) => {
			const open = stage === target;
			stage.classList.toggle(OPEN_CLASS, open);
			stage.setAttribute('aria-expanded', String(open));

			const body = stage.querySelector(BODY_SELECTOR);
			if (body) body.setAttribute('aria-hidden', String(!open));
		});
	}
})();
