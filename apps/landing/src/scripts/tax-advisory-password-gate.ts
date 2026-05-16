import {
  taxAdvisoryPasswordHash,
  taxAdvisoryStorageKey,
} from "@/config/tax-advisory-presentation";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.offsetParent !== null
  );
}

function focusFirstGateElement(gate: HTMLElement): void {
  const firstElement = getFocusableElements(gate)[0];
  firstElement?.focus();
}

function unlockPage(): void {
  document.documentElement.setAttribute("data-tax-advisory-auth", "ok");
  document.getElementById("tax-advisory-gate")?.setAttribute("hidden", "");
  document.getElementById("tax-advisory-main")?.focus();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string | null> {
  if (!window.crypto?.subtle) return null;

  const data = new TextEncoder().encode(password);
  return toHex(await window.crypto.subtle.digest("SHA-256", data));
}

export function initTaxAdvisoryPasswordGate(): void {
  const gate = document.getElementById("tax-advisory-gate");
  const form = document.getElementById("tax-advisory-gate-form") as HTMLFormElement | null;
  const input = document.getElementById("tax-advisory-password") as HTMLInputElement | null;
  const error = document.getElementById("tax-advisory-gate-error");

  try {
    if (localStorage.getItem(taxAdvisoryStorageKey) === "1") {
      unlockPage();
      return;
    }
  } catch {
    // Storage may be blocked. The form still works for this page view.
  }

  if (gate) focusFirstGateElement(gate);

  gate?.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;

    const focusableElements = getFocusableElements(gate);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  });

  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (
        document.documentElement.dataset.taxAdvisoryAuth === "ok" ||
        !gate ||
        !(target instanceof Node) ||
        gate.contains(target)
      ) {
        return;
      }

      focusFirstGateElement(gate);
    },
    true
  );

  input?.addEventListener("input", () => {
    if (error) error.hidden = true;
    input.removeAttribute("aria-invalid");
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = input?.value.trim() ?? "";
    const passwordHash = await hashPassword(password);

    if (passwordHash !== taxAdvisoryPasswordHash) {
      if (error) error.hidden = false;
      input?.setAttribute("aria-invalid", "true");
      input?.focus();
      return;
    }

    try {
      localStorage.setItem(taxAdvisoryStorageKey, "1");
    } catch {
      // Ignore storage failures. Unlock for the current page view.
    }

    unlockPage();
  });
}
