
	document.addEventListener('DOMContentLoaded', () => {
	const sections = document.querySelectorAll('.story-content-block[data-anchor-section]');
	const navItems = document.querySelectorAll('.story-nav-item[data-anchor-link]');

	/*
	 * ACTIVE NAV
	 */
	const observer = new IntersectionObserver(
	(entries) => {
	entries.forEach((entry) => {
	if (!entry.isIntersecting) return;

	const activeId = entry.target.dataset.anchorSection;

	navItems.forEach((item) => {
	item.classList.toggle('is-active', item.dataset.anchorLink === activeId);
});
});
},
{
	rootMargin: '-45% 0px -45% 0px',
	threshold: 0,
},
	);

	sections.forEach((section) => {
	observer.observe(section);
});

	/*
	 * SMOOTH SCROLL
	 */
	navItems.forEach((item) => {
	item.addEventListener('click', (e) => {
	e.preventDefault();

	const targetId = item.dataset.anchorLink;

	const target = document.querySelector(`[data-anchor-section="${targetId}"]`);

	if (!target) return;

	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	target.scrollIntoView({
	behavior: prefersReducedMotion ? 'auto' : 'smooth',
	block: 'start',
});
});
});
});

	(() => {
	const url = encodeURIComponent(window.location.href);
	const title = encodeURIComponent(document.title);

	const links = {
	x: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
	linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
	email: `mailto:?subject=${title}&body=${url}`,
};

	document.querySelectorAll('[data-share]').forEach((link) => {
	const type = link.dataset.share;
	if (!links[type]) return;

	link.href = links[type];

	if (type !== 'email') {
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
}
});
})();
