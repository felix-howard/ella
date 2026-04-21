/**
 * Summary-panel rendering for the pricing calculator.
 * DOM writes only — no business logic. Mutates elements resolved via
 * `[data-calc-state]` / `[data-calc-output]` attributes in summary-panel.astro.
 *
 * Multi-copy aware (phase 07): desktop sticky panel + mobile bottom-sheet
 * drawer + mobile summary bar each contain their own marker nodes. Every
 * ref is an array and we write to all copies each render.
 *
 * XSS-safe by construction: all text writes go through `textContent`, and
 * line items clone a static `<template>`.
 */
import type { CalcResult, LineItem } from "@/config/pricing";
import { formatNumber, formatUsd } from "./pricing-calculator-format";

export const CTA_LABEL_DEFAULT = "Book Free Consultation";
export const CTA_LABEL_ENTERPRISE = "Contact us for enterprise quote";

export interface PanelRefs {
  tierBadge: HTMLElement[];
  tierLabel: HTMLElement[];
  empty: HTMLElement[];
  result: HTMLElement[];
  enterprise: HTMLElement[];
  monthlyList: HTMLElement[];
  setupList: HTMLElement[];
  monthlyTotal: HTMLElement[];
  setupTotal: HTMLElement[];
  template: HTMLTemplateElement;
  cta: HTMLButtonElement[];
}

function qa<T extends HTMLElement>(root: HTMLElement, sel: string): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export function resolveRefs(panel: HTMLElement): PanelRefs | null {
  const template = panel.querySelector<HTMLTemplateElement>(
    "template#calc-line-item-template",
  );
  if (!template) return null;
  const refs: PanelRefs = {
    tierBadge: qa(panel, '[data-calc-state="tierBadge"]'),
    tierLabel: qa(panel, '[data-calc-output="tierLabel"]'),
    empty: qa(panel, '[data-calc-state="empty"]'),
    result: qa(panel, '[data-calc-state="result"]'),
    enterprise: qa(panel, '[data-calc-state="enterprise"]'),
    monthlyList: qa(panel, '[data-calc-output="monthlyItems"]'),
    setupList: qa(panel, '[data-calc-output="setupItems"]'),
    monthlyTotal: qa(panel, '[data-calc-output="monthlyTotal"]'),
    setupTotal: qa(panel, '[data-calc-output="setupTotal"]'),
    cta: qa<HTMLButtonElement>(panel, "[data-calc-cta]"),
    template,
  };
  // Required refs — bail out if any are missing (malformed template).
  // tierBadge is optional-per-copy (mobile bar has no badge), so not checked.
  const required: Array<HTMLElement[]> = [
    refs.empty,
    refs.result,
    refs.enterprise,
    refs.monthlyTotal,
    refs.setupTotal,
    refs.monthlyList,
    refs.setupList,
    refs.cta,
  ];
  if (required.some((arr) => arr.length === 0)) return null;
  return refs;
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

function setHidden(els: HTMLElement[], hidden: boolean): void {
  for (const el of els) el.hidden = hidden;
}

function setText(els: HTMLElement[], text: string): void {
  for (const el of els) el.textContent = text;
}

function toggleState(refs: PanelRefs, mode: "empty" | "result" | "enterprise"): void {
  setHidden(refs.empty, mode !== "empty");
  setHidden(refs.result, mode !== "result");
  setHidden(refs.enterprise, mode !== "enterprise");
  setHidden(refs.tierBadge, mode !== "result");
}

export function renderResult(refs: PanelRefs, result: CalcResult): void {
  if (result.isEnterprise) {
    toggleState(refs, "enterprise");
    for (const btn of refs.cta) {
      btn.disabled = false;
      btn.textContent = CTA_LABEL_ENTERPRISE;
    }
    return;
  }
  if (!result.hasAnySelection) {
    toggleState(refs, "empty");
    for (const btn of refs.cta) {
      btn.disabled = true;
      btn.textContent = CTA_LABEL_DEFAULT;
    }
    return;
  }
  toggleState(refs, "result");
  setText(refs.tierLabel, result.tierLabel);
  for (const list of refs.monthlyList) populateList(list, refs.template, result.monthlyItems);
  for (const list of refs.setupList) populateList(list, refs.template, result.setupItems);
  // Totals use formatNumber (no "$"): summary-panel.astro renders a literal "$" outside the span.
  setText(refs.monthlyTotal, formatNumber(result.monthlyTotal));
  setText(refs.setupTotal, formatNumber(result.setupTotal));
  for (const btn of refs.cta) {
    btn.disabled = false;
    btn.textContent = CTA_LABEL_DEFAULT;
  }
}
