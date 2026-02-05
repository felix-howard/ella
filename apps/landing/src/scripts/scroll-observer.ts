/**
 * Scroll-based animation utility using IntersectionObserver.
 * Adds `.animate` class to elements with `data-animate` attribute when they enter viewport.
 * Handles counter animations for `data-count` elements.
 * Respects prefers-reduced-motion for accessibility.
 */

/** Animate counter from 0 to target value with easeOutCubic easing */
function animateCounter(element: HTMLElement): void {
  const target = parseInt(element.dataset.count || "0", 10);
  if (Number.isNaN(target) || target <= 0) {
    return; // Skip invalid or zero targets
  }
  const suffix = element.dataset.suffix || "";
  const duration = 1500; // ms
  const start = performance.now();

  function update(currentTime: number): void {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutCubic: 1 - (1 - x)^3
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    element.textContent = current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

export function initScrollAnimations(): void {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // For reduced motion: show final state immediately
  if (prefersReducedMotion) {
    document
      .querySelectorAll<HTMLElement>("[data-animate]")
      .forEach((el) => el.classList.add("animate"));
    // Show final counter values instantly
    document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const target = parseInt(el.dataset.count || "0", 10);
      const suffix = el.dataset.suffix || "";
      el.textContent = target.toLocaleString() + suffix;
    });
    return;
  }

  // Observer for data-animate elements
  const animateObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate");
          animateObserver.unobserve(entry.target);
        }
      });
    },
    { root: null, threshold: 0.1, rootMargin: "0px" }
  );

  document
    .querySelectorAll<HTMLElement>("[data-animate]")
    .forEach((el) => animateObserver.observe(el));

  // Observer for counter animations
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          animateCounter(el);
          counterObserver.unobserve(el);
        }
      });
    },
    { root: null, threshold: 0.2, rootMargin: "0px" }
  );

  document
    .querySelectorAll<HTMLElement>("[data-count]")
    .forEach((el) => counterObserver.observe(el));
}
