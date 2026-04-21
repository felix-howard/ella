/**
 * Pricing calculator — client wiring for /pricing page. Reads form state
 * via [data-calc-input="<path>"] selectors, runs pure calculatePrice(),
 * and mutates summary panel via textContent + cloneNode (XSS-safe).
 */
import {
  calculatePrice,
  type CalcInput,
  type CalcResult,
  type LineItem,
} from "@/config/pricing";

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
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatUsd = (n: number): string => usdFormatter.format(n);
const formatNumber = (n: number): string => numberFormatter.format(n);

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
    if (el.type === "number") return clampInt(el.value);
    return el.value;
  }
  if (el instanceof HTMLSelectElement) return el.value;
  return undefined;
}

function readInputs(form: HTMLFormElement): CalcInput {
  const draft = JSON.parse(JSON.stringify(DEFAULT_INPUT)) as CalcInput;
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

function validate(input: CalcInput): string[] {
  const errs: string[] = [];
  if (input.nec1099Count > 200) errs.push("Unrealistic 1099 count (>200).");
  if (input.payrollEmployees > 200) errs.push("Unrealistic payroll employees (>200).");
  return errs;
}

interface PanelRefs {
  tierBadge: HTMLElement;
  tierLabel: HTMLElement;
  empty: HTMLElement;
  result: HTMLElement;
  enterprise: HTMLElement;
  monthlyList: HTMLElement;
  setupList: HTMLElement;
  monthlyTotal: HTMLElement;
  setupTotal: HTMLElement;
  template: HTMLTemplateElement;
  cta: HTMLButtonElement;
}

function resolveRefs(panel: HTMLElement): PanelRefs | null {
  const template = document.getElementById("calc-line-item-template");
  if (!(template instanceof HTMLTemplateElement)) return null;
  const q = <T extends HTMLElement>(sel: string): T | null => panel.querySelector<T>(sel);
  const refs = {
    tierBadge: q('[data-calc-state="tierBadge"]'),
    tierLabel: q('[data-calc-output="tierLabel"]'),
    empty: q('[data-calc-state="empty"]'),
    result: q('[data-calc-state="result"]'),
    enterprise: q('[data-calc-state="enterprise"]'),
    monthlyList: q('[data-calc-output="monthlyItems"]'),
    setupList: q('[data-calc-output="setupItems"]'),
    monthlyTotal: q('[data-calc-output="monthlyTotal"]'),
    setupTotal: q('[data-calc-output="setupTotal"]'),
    cta: q<HTMLButtonElement>("[data-calc-cta]"),
    template,
  };
  return Object.values(refs).every((v) => v !== null) ? (refs as PanelRefs) : null;
}

function populateList(list: HTMLElement, template: HTMLTemplateElement, items: LineItem[]): void {
  list.replaceChildren();
  items.forEach((item) => {
    const frag = template.content.cloneNode(true) as DocumentFragment;
    const label = frag.querySelector<HTMLElement>('[data-slot="label"]');
    const amount = frag.querySelector<HTMLElement>('[data-slot="amount"]');
    if (label) label.textContent = item.label;
    if (amount) amount.textContent = formatUsd(item.amount);
    list.appendChild(frag);
  });
}

function toggleState(refs: PanelRefs, mode: "empty" | "result" | "enterprise"): void {
  refs.empty.hidden = mode !== "empty";
  refs.result.hidden = mode !== "result";
  refs.enterprise.hidden = mode !== "enterprise";
  refs.tierBadge.hidden = mode !== "result";
}

function renderResult(refs: PanelRefs, result: CalcResult): void {
  if (result.isEnterprise) {
    toggleState(refs, "enterprise");
    refs.cta.disabled = true;
    return;
  }
  if (!result.hasAnySelection) {
    toggleState(refs, "empty");
    refs.cta.disabled = true;
    return;
  }
  toggleState(refs, "result");
  refs.tierLabel.textContent = result.tierLabel;
  populateList(refs.monthlyList, refs.template, result.monthlyItems);
  populateList(refs.setupList, refs.template, result.setupItems);
  // Totals use formatNumber (no "$"): summary-panel.astro renders a literal "$" outside the span.
  refs.monthlyTotal.textContent = formatNumber(result.monthlyTotal);
  refs.setupTotal.textContent = formatNumber(result.setupTotal);
  refs.cta.disabled = false;
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

  const recalc = (): void => {
    const input = readInputs(form);
    if (validate(input).length > 0) return; // silent skip; UI constraints prevent most bad states
    renderResult(refs, calculatePrice(input));
  };

  const debounced = debounce(recalc, 150);
  form.addEventListener("input", debounced);
  form.addEventListener("change", debounced);

  recalc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
