/**
 * Pricing types + pure calculator for Ella Tax services.
 *
 * Single source of truth consumed by:
 *  - `pages/pricing.astro` (marketing tier cards)
 *  - `scripts/pricing-calculator.ts` (interactive calculator)
 *
 * Design: zero DOM, zero dependencies, fully testable pure function.
 * Re-exports constants from `pricing-constants.ts` so callers only import
 * from one module (`@/config/pricing`).
 */

import {
  PAYROLL,
  TIER_BASIC,
  TIER_ENTERPRISE,
  TIER_PRO,
} from "./pricing-constants";

export * from "./pricing-constants";

/* ---------- Types ---------- */

export type Tier = "basic" | "pro" | "enterprise";

export type PayrollMode = "owner-manual" | "ella-staff";

export interface CalcInput {
  /** Number of 1099 workers. Drives tier auto-detect. */
  nec1099Count: number;
  /** W-2 payroll employee count. */
  payrollEmployees: number;
  /** Who operates payroll (affects per-employee rate). */
  payrollMode: PayrollMode;
  cashPlan: {
    enabled: boolean;
    employees: number;
    owners: number;
  };
  auditProtection: boolean;
  oneTime: {
    startLlc: number;
    holdingLlcNew: number;
    holdingLlcModify: number;
    personalTaxReturn: number;
    businessTaxReturn: number;
  };
  /** Shops to monitor for sales tax ($25/mo each). */
  salesTaxShops: number;
  /**
   * Editable rate overrides — internal pricing page only.
   * Defaults to the constants in `pricing-constants.ts` unless operator edits inputs.
   */
  rates: {
    cashPlan: {
      setup: number;
      perEmployeeMonthly: number;
      perOwnerMonthly: number;
    };
    auditProtection: {
      monthly: number;
      setup: number;
    };
    oneTime: {
      startLlc: number;
      holdingLlcNew: number;
      holdingLlcModify: number;
      personalTaxReturn: number;
      // Business tax return priced as Federal + State (user-editable components).
      businessTaxReturnFederal: number;
      businessTaxReturnState: number;
    };
    /** Per-shop monthly rate for sales tax monitoring. */
    salesTaxMonitoringMonthly: number;
  };
}

export interface LineItem {
  label: string;
  amount: number;
  kind: "monthly" | "setup";
  note?: string;
}

export interface CalcResult {
  tier: Tier;
  tierLabel: string;
  /** True when >20 1099 workers → calc disabled, contact sales. */
  isEnterprise: boolean;
  monthlyItems: LineItem[];
  setupItems: LineItem[];
  monthlyTotal: number;
  setupTotal: number;
  /** False when only the base tier line exists → CTA stays disabled. */
  hasAnySelection: boolean;
}

/* ---------- Tier detection ---------- */

/** Tier rule: ≤10 Basic, 11-20 Pro, >20 Enterprise (inclusive bounds). */
export function detectTier(nec1099Count: number): Tier {
  if (nec1099Count <= TIER_BASIC.maxNec1099) return "basic";
  if (nec1099Count <= TIER_PRO.maxNec1099) return "pro";
  return "enterprise";
}

/* ---------- Pure calculator ---------- */

const ONE_TIME_LABELS: Record<keyof CalcInput["oneTime"], string> = {
  startLlc: "Start LLC",
  holdingLlcNew: "Holding LLC (new)",
  holdingLlcModify: "Re-structure LLC basic",
  personalTaxReturn: "Personal tax return",
  businessTaxReturn: "Business tax return",
};

/**
 * Compute monthly/setup line items + totals for a given input.
 * Pure, deterministic — same input always yields same result.
 */
export function calculatePrice(input: CalcInput): CalcResult {
  const tier = detectTier(input.nec1099Count);

  // VIP (21+) has no bare monthly/setup rates defined — reuse Pro's numeric
  // rates but surface the "VIP" marketing label so the estimate still computes.
  const tierDef =
    tier === "basic"
      ? TIER_BASIC
      : tier === "pro"
        ? TIER_PRO
        : { ...TIER_PRO, label: TIER_ENTERPRISE.marketingLabel };
  const monthly: LineItem[] = [];
  const setup: LineItem[] = [];

  monthly.push({ label: `${tierDef.label} tier`, amount: tierDef.monthly, kind: "monthly" });
  setup.push({ label: `${tierDef.label} bookkeeping setup`, amount: tierDef.setup, kind: "setup" });

  // Payroll — only applies when employees > 0 (matches worked example #1)
  if (input.payrollEmployees > 0) {
    monthly.push({ label: "Payroll base", amount: PAYROLL.baseMonthly, kind: "monthly" });
    setup.push({ label: "Payroll setup", amount: PAYROLL.baseSetup, kind: "setup" });
    const perEmp =
      input.payrollMode === "ella-staff" ? PAYROLL.ellaStaffPerEmp : PAYROLL.ownerManualPerEmp;
    monthly.push({
      label: `Payroll employees (${input.payrollEmployees} × $${perEmp}, ${input.payrollMode})`,
      amount: perEmp * input.payrollEmployees,
      kind: "monthly",
    });
  }

  const cashRates = input.rates.cashPlan;
  const auditRates = input.rates.auditProtection;

  if (input.cashPlan.enabled) {
    const cashMonthly =
      cashRates.perEmployeeMonthly * input.cashPlan.employees +
      cashRates.perOwnerMonthly * input.cashPlan.owners;
    monthly.push({
      label: `Cash Plan (${input.cashPlan.employees} emp × $${cashRates.perEmployeeMonthly} + ${input.cashPlan.owners} owner × $${cashRates.perOwnerMonthly})`,
      amount: cashMonthly,
      kind: "monthly",
    });
    setup.push({ label: "Cash Plan setup", amount: cashRates.setup, kind: "setup" });
  }

  if (input.auditProtection) {
    monthly.push({ label: "Audit Protection", amount: auditRates.monthly, kind: "monthly" });
    setup.push({ label: "Audit Protection setup", amount: auditRates.setup, kind: "setup" });
  }

  (Object.keys(ONE_TIME_LABELS) as Array<keyof CalcInput["oneTime"]>).forEach((key) => {
    const qty = input.oneTime[key];
    if (qty > 0) {
      const unit =
        key === "businessTaxReturn"
          ? input.rates.oneTime.businessTaxReturnFederal +
            input.rates.oneTime.businessTaxReturnState
          : input.rates.oneTime[key];
      setup.push({
        label: qty > 1 ? `${ONE_TIME_LABELS[key]} × ${qty}` : ONE_TIME_LABELS[key],
        amount: unit * qty,
        kind: "setup",
        note: key === "startLlc" ? "Excludes state filing fee" : undefined,
      });
    }
  });

  if (input.salesTaxShops > 0) {
    monthly.push({
      label: `Sales tax monitoring (${input.salesTaxShops} shop${input.salesTaxShops > 1 ? "s" : ""})`,
      amount: input.rates.salesTaxMonitoringMonthly * input.salesTaxShops,
      kind: "monthly",
    });
  }

  const monthlyTotal = monthly.reduce((sum, item) => sum + item.amount, 0);
  const setupTotal = setup.reduce((sum, item) => sum + item.amount, 0);

  // hasAnySelection: >1 because index 0 is always the base tier line (pushed above).
  // A real user selection only exists once another line item joins it.
  return {
    tier,
    tierLabel: tierDef.label,
    isEnterprise: false,
    monthlyItems: monthly,
    setupItems: setup,
    monthlyTotal,
    setupTotal,
    hasAnySelection: monthly.length > 1 || setup.length > 1,
  };
}

// VERIFY: Pro tier (11 1099) + 5 payroll (owner-manual) + Cash Plan (11 emp, 1 owner)
// → monthlyTotal === 275, setupTotal === 1400. Matches anh chủ's example #1.
// Example #2 (50-shop → $575/mo) doesn't cleanly reconcile; rules match #1 only.
