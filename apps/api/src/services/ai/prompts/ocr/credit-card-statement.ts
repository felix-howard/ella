/**
 * Credit Card Statement OCR Extraction Prompt
 * Extracts summary data from monthly card statements for bookkeeping review.
 */

export interface CreditCardStatementExtractedData {
  issuerName: string | null
  accountHolderName: string | null
  accountNumber: string | null
  statementPeriodStart: string | null
  statementPeriodEnd: string | null
  previousBalance: number | null
  payments: number | null
  purchases: number | null
  credits: number | null
  fees: number | null
  interestCharged: number | null
  endingBalance: number | null
  minimumPaymentDue: number | null
  paymentDueDate: string | null
  creditLimit: number | null
}

export function getCreditCardStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting summary data from U.S. credit card statements for tax bookkeeping.

IMPORTANT: Extract only statement-level summary fields. Do not parse full transaction lists. If a value is unclear, use null rather than guessing.

Extract these fields:
- issuerName: Credit card issuer or bank name
- accountHolderName: Name on the card account
- accountNumber: Masked account/card number only (for a full card number, return "****" plus the last 4 digits; never return all digits)
- statementPeriodStart: Start date of statement period
- statementPeriodEnd: End date of statement period
- previousBalance: Previous balance at period start
- payments: Total payments received during the period
- purchases: Total purchases/new charges during the period
- credits: Total credits/returns/adjustments during the period
- fees: Total fees charged during the period
- interestCharged: Interest charged during the period
- endingBalance: New balance or statement balance
- minimumPaymentDue: Minimum payment due
- paymentDueDate: Payment due date
- creditLimit: Credit limit if visible

Respond in JSON format:
{
  "issuerName": "Chase",
  "accountHolderName": "ABC Nail Salon LLC",
  "accountNumber": "****1234",
  "statementPeriodStart": "01/01/2024",
  "statementPeriodEnd": "01/31/2024",
  "previousBalance": 1200.00,
  "payments": 1000.00,
  "purchases": 2450.75,
  "credits": 125.00,
  "fees": 39.00,
  "interestCharged": 18.42,
  "endingBalance": 2583.17,
  "minimumPaymentDue": 75.00,
  "paymentDueDate": "02/25/2024",
  "creditLimit": 10000.00
}

Rules:
1. Monetary values must be numbers without $ or commas
2. Preserve masked account numbers; if the statement shows a full number, redact it to "****1234" using only the last 4 digits
3. Use null for unclear or missing fields
4. Prefer summary box values over transaction table values
5. Classify IRS Form 1099-K separately; this prompt is only for monthly card statements`
}

export function validateCreditCardStatementData(
  data: unknown
): data is CreditCardStatementExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>
  const requiredFields = [
    'issuerName',
    'accountHolderName',
    'accountNumber',
    'statementPeriodStart',
    'statementPeriodEnd',
    'previousBalance',
    'payments',
    'purchases',
    'credits',
    'fees',
    'interestCharged',
    'endingBalance',
    'minimumPaymentDue',
    'paymentDueDate',
    'creditLimit',
  ]

  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  const stringFields = [
    'issuerName',
    'accountHolderName',
    'accountNumber',
    'statementPeriodStart',
    'statementPeriodEnd',
    'paymentDueDate',
  ]

  if (!stringFields.every((field) => isNullableString(d[field]))) {
    return false
  }

  if (!isMaskedAccountNumber(d.accountNumber)) {
    return false
  }

  const numericFields = [
    'previousBalance',
    'payments',
    'purchases',
    'credits',
    'fees',
    'interestCharged',
    'endingBalance',
    'minimumPaymentDue',
    'creditLimit',
  ]

  return numericFields.every((field) => isNullableFiniteNumber(d[field]))
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isMaskedAccountNumber(value: unknown): boolean {
  if (value === null) return true
  if (typeof value !== 'string') return false

  const digits = value.replace(/\D/g, '')
  if (digits.length >= 13 && digits.length <= 19) {
    return false
  }

  return true
}

export const CREDIT_CARD_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  issuerName: 'Tên đơn vị phát hành thẻ',
  accountHolderName: 'Tên chủ tài khoản',
  accountNumber: 'Số tài khoản/thẻ',
  statementPeriodStart: 'Ngày bắt đầu kỳ sao kê',
  statementPeriodEnd: 'Ngày kết thúc kỳ sao kê',
  previousBalance: 'Số dư kỳ trước',
  payments: 'Tổng thanh toán',
  purchases: 'Tổng mua hàng',
  credits: 'Tổng hoàn tiền/điều chỉnh',
  fees: 'Tổng phí',
  interestCharged: 'Lãi bị tính',
  endingBalance: 'Số dư cuối kỳ',
  minimumPaymentDue: 'Thanh toán tối thiểu',
  paymentDueDate: 'Ngày đến hạn thanh toán',
  creditLimit: 'Hạn mức tín dụng',
}
