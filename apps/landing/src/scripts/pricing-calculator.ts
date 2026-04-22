/**
 * Pricing calculator — client wiring for /pricing page. Reads form state
 * via [data-calc-input="<path>"] selectors, runs pure calculatePrice(),
 * and delegates to the render module to mutate the summary panel.
 * XSS-safe: all DOM writes go through `textContent` / cloned templates.
 */
import {
  AUDIT_PROTECTION,
  CASH_PLAN,
  calculatePrice,
  type CalcInput,
  type CalcResult,
} from "@/config/pricing";
import { formatBreakdown } from "./pricing-calculator-format";
import { renderResult, resolveRefs } from "./pricing-calculator-render";

const DEFAULT_INPUT: CalcInput = {
  nec1099Count: 0,
  payrollEmployees: 0,
  payrollMode: "owner-manual",
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  rates: {
    cashPlan: {
      setup: CASH_PLAN.setup,
      perEmployeeMonthly: CASH_PLAN.perEmployeeMonthly,
      perOwnerMonthly: CASH_PLAN.perOwnerMonthly,
    },
    auditProtection: {
      monthly: AUDIT_PROTECTION.monthly,
      setup: AUDIT_PROTECTION.setup,
    },
  },
};

function clampInt(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (typeof next !== "object" || next === null) return;
    cur = next as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function readElementValue(el: HTMLElement): unknown {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "radio") return el.checked ? el.value : undefined;
    if (el.type === "number" || el.inputMode === "numeric") return clampInt(el.value);
    return el.value;
  }
  if (el instanceof HTMLSelectElement) return el.value;
  return undefined;
}

function readInputs(form: HTMLFormElement): CalcInput {
  const draft = structuredClone(DEFAULT_INPUT);
  const store = draft as unknown as Record<string, unknown>;
  form.querySelectorAll<HTMLElement>("[data-calc-input]").forEach((el) => {
    const path = el.dataset.calcInput;
    if (!path) return;
    const value = readElementValue(el);
    if (value === undefined) return; // unchecked radio etc.
    setByPath(store, path, value);
  });
  return draft;
}

// Sanity caps: real businesses using this calculator are salons/small shops.
// A value >200 is almost certainly a typo or abuse — skip recalc silently.
function isInputSane(input: CalcInput): boolean {
  return input.nec1099Count <= 200 && input.payrollEmployees <= 200;
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let handle: number | undefined;
  return (...args: A) => {
    if (handle !== undefined) window.clearTimeout(handle);
    handle = window.setTimeout(() => fn(...args), ms);
  };
}

function init(): void {
  const form = document.getElementById("pricing-calculator-form");
  const panel = document.getElementById("pricing-summary-panel");
  if (!(form instanceof HTMLFormElement) || !panel) return;

  const refs = resolveRefs(panel);
  if (!refs) return;

  let lastResult: CalcResult | null = null;

  const recalc = (): void => {
    const input = readInputs(form);
    if (!isInputSane(input)) return; // silent skip; UI constraints prevent most bad states
    const result = calculatePrice(input);
    lastResult = result;
    renderResult(refs, result);
  };

  const debounced = debounce(recalc, 150);
  form.addEventListener("input", debounced);
  form.addEventListener("change", debounced);

  const onCtaClick = (): void => {
    if (!lastResult) return;
    document.dispatchEvent(
      new CustomEvent("calc:open-consultation", {
        detail: {
          breakdownText: formatBreakdown(lastResult),
          // Explicit flag instead of sniffing the text — keeps the modal
          // decoupled from breakdown string content (W2 from review).
          showBreakdown: !lastResult.isEnterprise && lastResult.hasAnySelection,
        },
      }),
    );
  };
  // Desktop + mobile drawer each have their own CTA button.
  for (const btn of refs.cta) btn.addEventListener("click", onCtaClick);

  recalc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
