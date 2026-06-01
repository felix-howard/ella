import type { CalcInput, CalcResult } from "@/config/pricing";

const API_BASE_URL = (
  import.meta.env.PUBLIC_API_URL || (import.meta.env.DEV ? "http://localhost:3002" : "")
).replace(/\/$/, "");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PaymentRefs {
  email: HTMLInputElement;
  name: HTMLInputElement;
  business: HTMLInputElement;
  token: HTMLInputElement;
  create: HTMLButtonElement;
  status: HTMLElement;
  success: HTMLElement;
  url: HTMLInputElement;
  copy: HTMLButtonElement;
  open: HTMLAnchorElement;
}

interface CheckoutSessionResponse {
  checkoutUrl: string;
}

interface PaymentLinkController {
  sync(input: CalcInput, result: CalcResult): void;
  disable(message?: string): void;
}

function q<T extends HTMLElement>(root: HTMLElement, key: string): T | null {
  return root.querySelector<T>(`[data-payment-link="${key}"]`);
}

function resolvePaymentRefs(root: HTMLElement): PaymentRefs | null {
  const refs = {
    email: q<HTMLInputElement>(root, "customerEmail"),
    name: q<HTMLInputElement>(root, "customerName"),
    business: q<HTMLInputElement>(root, "businessName"),
    token: q<HTMLInputElement>(root, "staffToken"),
    create: q<HTMLButtonElement>(root, "create"),
    status: q<HTMLElement>(root, "status"),
    success: q<HTMLElement>(root, "success"),
    url: q<HTMLInputElement>(root, "checkoutUrl"),
    copy: q<HTMLButtonElement>(root, "copy"),
    open: q<HTMLAnchorElement>(root, "open"),
  };

  return Object.values(refs).every(Boolean) ? (refs as PaymentRefs) : null;
}

function optionalValue(input: HTMLInputElement): string | undefined {
  const value = input.value.trim();
  return value ? value : undefined;
}

function buildPayload(refs: PaymentRefs, pricingInput: CalcInput): Record<string, unknown> {
  return {
    pricingInput,
    customerEmail: optionalValue(refs.email),
    customerName: optionalValue(refs.name),
    businessName: optionalValue(refs.business),
  };
}

function validate(refs: PaymentRefs): string | null {
  const email = refs.email.value.trim();
  if (email && !EMAIL_PATTERN.test(email)) return "Enter a valid customer email.";
  if (!refs.token.value.trim()) return "Staff admin token is required.";
  return null;
}

function setStatus(refs: PaymentRefs, message: string, tone: "muted" | "error" | "success" = "muted"): void {
  refs.status.textContent = message;
  refs.status.classList.toggle("text-error-500", tone === "error");
  refs.status.classList.toggle("text-primary-700", tone === "success");
  refs.status.classList.toggle("text-gray-600", tone === "muted");
}

function setSuccess(refs: PaymentRefs, checkoutUrl: string): void {
  refs.url.value = checkoutUrl;
  refs.open.href = checkoutUrl;
  refs.success.hidden = false;
  setStatus(refs, "Payment link created.", "success");
}

function resetSuccess(refs: PaymentRefs): void {
  refs.url.value = "";
  refs.open.href = "#";
  refs.success.hidden = true;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    if (body.message) return body.message;
    if (body.error) return body.error;
  } catch {
    // ignore parse failure
  }
  if (response.status === 401) return "Staff admin token is missing or expired.";
  if (response.status === 403) return "Admin access required.";
  return `Payment link request failed (${response.status}).`;
}

async function createCheckoutSession(
  pricingInput: CalcInput,
  refs: PaymentRefs,
): Promise<CheckoutSessionResponse> {
  if (!API_BASE_URL) {
    throw new Error("PUBLIC_API_URL is required to create payment links.");
  }

  const response = await fetch(`${API_BASE_URL}/billing/checkout-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${refs.token.value.trim().replace(/^Bearer\s+/i, "")}`,
    },
    body: JSON.stringify(buildPayload(refs, pricingInput)),
  });

  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as CheckoutSessionResponse;
}

export function initPaymentLink(panel: HTMLElement): PaymentLinkController | null {
  const refs = resolvePaymentRefs(panel);
  if (!refs) return null;

  let latestInput: CalcInput | null = null;
  let quoteKey = "";

  refs.create.addEventListener("click", async () => {
    if (!latestInput) return;
    const requestInput = latestInput;
    const validationError = validate(refs);
    if (validationError) {
      setStatus(refs, validationError, "error");
      return;
    }

    refs.create.disabled = true;
    resetSuccess(refs);
    setStatus(refs, "Creating payment link...");
    try {
      const result = await createCheckoutSession(requestInput, refs);
      setSuccess(refs, result.checkoutUrl);
    } catch (error) {
      setStatus(refs, error instanceof Error ? error.message : "Could not create payment link.", "error");
    } finally {
      refs.token.value = "";
      if (latestInput === requestInput) refs.create.disabled = false;
    }
  });

  refs.copy.addEventListener("click", async () => {
    if (!refs.url.value) return;
    try {
      await navigator.clipboard.writeText(refs.url.value);
      setStatus(refs, "Payment link copied.", "success");
    } catch {
      setStatus(refs, "Copy failed. Select the URL manually.", "error");
    }
  });

  return {
    disable(message?: string): void {
      latestInput = null;
      refs.create.disabled = true;
      resetSuccess(refs);
      setStatus(refs, message || "");
    },

    sync(input: CalcInput, result: CalcResult): void {
      latestInput = input;
      const payableTotal = result.monthlyTotal + result.setupTotal;
      refs.create.disabled = !result.hasAnySelection || result.isEnterprise || payableTotal <= 0;
      const nextQuoteKey = JSON.stringify(input);
      if (nextQuoteKey !== quoteKey) {
        quoteKey = nextQuoteKey;
        resetSuccess(refs);
        setStatus(refs, "");
      }
    },
  };
}
