// Fades sections in as they scroll into view (class "reveal"); shared by every page.
const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }, { threshold: 0.15 });
for (const el of document.querySelectorAll('.reveal')) io.observe(el);
