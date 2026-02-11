(() => {
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const header = document.querySelector("[data-header]");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 6);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Smooth scroll for in-page anchors (with reduced-motion support)
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[href^='#']");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || href === "#") return;
    const el = document.querySelector(href);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
    history.pushState(null, "", href);
  });

  // Reveal on scroll
  const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
  if (prefersReduced || revealEls.length === 0) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { root: null, threshold: 0.12, rootMargin: "40px 0px -10px 0px" }
  );

  revealEls.forEach((el) => io.observe(el));
})();

