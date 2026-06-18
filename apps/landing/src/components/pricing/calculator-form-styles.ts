/**
 * Shared Tailwind class strings for calculator form sub-components.
 * Keeps visual styling consistent and DRY across form panels.
 */

// `text-base` on mobile keeps font-size at 16px — iOS Safari zooms in on focus
// when inputs are <16px. `md:text-sm` drops back to 14px on tablet/desktop.
export const inputCls =
  "w-full rounded-lg border border-neutral-border bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 md:text-sm";

export const labelCls = "mb-1.5 block text-sm font-medium text-gray-800";

export const sectionCls = "service-card p-5 sm:p-6";

export const headingCls = "text-base font-semibold text-gray-900";

export const hintCls = "mt-1 text-xs text-gray-500";

export const switchRowCls =
  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-border px-4 py-3";

export const switchTrackCls = "relative inline-flex h-6 w-11 shrink-0 items-center";

export const switchInputCls = "peer sr-only";

export const chevronSvgCls =
  "h-5 w-5 text-gray-400 transition-transform [details[open]_&]:rotate-180";

// Small inline number input for editable rate values (internal pricing page).
// `align-middle` keeps it baseline-aligned with surrounding hint text.
export const rateInputCls =
  "inline-block min-h-8 w-16 rounded border border-dashed border-neutral-border bg-white px-2 py-1 text-sm font-semibold text-gray-900 align-middle focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/30 md:min-h-0 md:w-14 md:px-1.5 md:py-0.5 md:text-xs";
