(() => {
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

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
})();
