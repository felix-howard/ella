/**
 * Pure formatting helpers for the pricing calculator — no DOM, no side effects.
 * Split from `pricing-calculator.ts` to keep the client wiring under 200 LOC
 * (per project file-size convention).
 */
import type { CalcResult } from "@/config/pricing";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatUsd = (n: number): string => usdFormatter.format(n);
export const formatNumber = (n: number): string => numberFormatter.format(n);

/**
 * Multi-line, plain-text price breakdown. Used by the consultation modal
 * (phase 06) to prefill the contact form message textarea.
 */
export function formatBreakdown(result: CalcResult): string {
  if (result.isEnterprise) {
    return "I have more than 20 1099 workers. Please contact me for an enterprise quote.";
  }
  if (!result.hasAnySelection) {
    return "I'd like to book a free consultation.";
  }
  const monthlyLines = result.monthlyItems
    .map((item) => `  - ${item.label}: ${formatUsd(item.amount)}/mo`)
    .join("\n");
  const yearlyLines = result.yearlyItems
    .map((item) => `  - ${item.label}: ${formatUsd(item.amount)} yearly pre-pay`)
    .join("\n");
  const setupDisplayLines = result.setupDisplayItems
    .map((item) => `  - ${item.label}: ${formatUsd(item.amount)}`)
    .join("\n");
  return [
    "I'd like to book a free consultation. My estimated pricing:",
    "",
    `Worker range: ${result.tierLabel}`,
    `Monthly: ${formatUsd(result.monthlyTotal)}/mo`,
    monthlyLines,
    ...(result.yearlyTotal > 0 ? [`Yearly pre-pay: ${formatUsd(result.yearlyTotal)}`, yearlyLines] : []),
    `Setup: ${formatUsd(result.setupDisplayTotal)}`,
    setupDisplayLines,
  ].join("\n");
}
