/**
 * Scroll-based animation utility using IntersectionObserver.
 * Adds `.animate` class to elements with `data-animate` attribute when they enter viewport.
 * Respects prefers-reduced-motion for accessibility.
 */
export function initScrollAnimations(): void {
  // Skip animations if user prefers reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document
      .querySelectorAll<HTMLElement>("[data-animate]")
      .forEach((el) => el.classList.add("animate"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate");
          observer.unobserve(entry.target); // trigger once
        }
      });
    },
    { root: null, threshold: 0.1, rootMargin: "0px" },
  );

  document
    .querySelectorAll<HTMLElement>("[data-animate]")
    .forEach((el) => observer.observe(el));
}
