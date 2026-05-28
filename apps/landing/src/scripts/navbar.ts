const SCROLL_THRESHOLD = 50;

export function initNavbar() {
  const navPill = document.getElementById("nav-pill");
  const btn = document.getElementById("mobile-menu-btn");
  const closeBtn = document.getElementById("mobile-menu-close");
  const menu = document.getElementById("mobile-menu");
  const backdrop = document.getElementById("mobile-backdrop");

  let isOpen = false;
  let isScrolled = false;

  function updateNavState() {
    if (window.innerWidth < 768) {
      isScrolled = false;
      navPill?.classList.remove("nav-pill-scrolled");
      navPill?.classList.add("nav-pill-initial");
      return;
    }

    const scrolled = window.scrollY > SCROLL_THRESHOLD;
    if (scrolled === isScrolled) return;
    isScrolled = scrolled;

    navPill?.classList.toggle("nav-pill-scrolled", scrolled);
    navPill?.classList.toggle("nav-pill-initial", !scrolled);
  }

  function getFocusableElements(): HTMLElement[] {
    if (!menu) return [];
    return Array.from(
      menu.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])")
    );
  }

  function closeMenu(restoreFocus = false) {
    if (!isOpen) return;
    isOpen = false;
    document.body.style.overflow = "";
    menu?.classList.add("translate-x-full");
    menu?.classList.remove("translate-x-0");
    menu?.setAttribute("aria-hidden", "true");
    menu?.setAttribute("inert", "");
    backdrop?.classList.add("opacity-0", "pointer-events-none");
    backdrop?.classList.remove("opacity-100", "pointer-events-auto");
    btn?.setAttribute("aria-expanded", "false");
    if (restoreFocus) btn?.focus();
  }

  function openMenu() {
    if (isOpen) return;
    isOpen = true;
    document.body.style.overflow = "hidden";
    menu?.classList.remove("translate-x-full");
    menu?.classList.add("translate-x-0");
    menu?.setAttribute("aria-hidden", "false");
    menu?.removeAttribute("inert");
    backdrop?.classList.remove("opacity-0", "pointer-events-none");
    backdrop?.classList.add("opacity-100", "pointer-events-auto");
    btn?.setAttribute("aria-expanded", "true");
    menu?.querySelector<HTMLElement>("a")?.focus();
  }

  function toggleMenu() {
    if (isOpen) {
      closeMenu(true);
      return;
    }

    openMenu();
  }

  btn?.addEventListener("click", toggleMenu);
  closeBtn?.addEventListener("click", () => closeMenu(true));
  backdrop?.addEventListener("click", () => closeMenu(true));
  window.addEventListener("scroll", updateNavState, { passive: true });
  window.addEventListener("resize", () => {
    updateNavState();
    if (window.innerWidth >= 768 && isOpen) closeMenu(true);
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      closeMenu(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  });

  updateNavState();
}
