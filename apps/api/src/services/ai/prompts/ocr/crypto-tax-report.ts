export interface CryptoTaxReportExtractedData {
  reportProvider: string | null
  taxpayerName: string | null
  taxYear: number | null
  totalTransactions: number | null
  shortTermGains: number | null
  shortTermLosses: number | null
  longTermGains: number | null
  longTermLosses: number | null
  netCapitalGain: number | null
  costBasisMethod: string | null
}

export function getCryptoTaxReportExtractionPrompt(): string {
  return `You are an expert OCR system specializing in cryptocurrency tax reports from providers such as Coinbase, Kraken, TurboTax Crypto, CoinTracker, Koinly, TokenTax, and similar platforms.

Extract all available data from this cryptocurrency tax report and return a JSON object with these fields:

- reportProvider: Name of the crypto tax report provider or platform (string)
- taxpayerName: Full legal name of the taxpayer (string)
- taxYear: Tax year this report covers (number, e.g. 2023)
- totalTransactions: Total number of cryptocurrency transactions reported (number)
- shortTermGains: Total short-term capital gains (held <= 1 year) in USD (number)
- shortTermLosses: Total short-term capital losses in USD as positive number (number)
- longTermGains: Total long-term capital gains (held > 1 year) in USD (number)
- longTermLosses: Total long-term capital losses in USD as positive number (number)
- netCapitalGain: Net capital gain or loss for the year in USD (number, negative if net loss)
- costBasisMethod: Cost basis accounting method used, e.g. FIFO, LIFO, HIFO, Specific ID (string)

Rules:
- All dollar amounts must be numbers without currency symbols or commas
- If a field is not present in the document, use null
- Short-term = assets held 12 months or less; long-term = assets held more than 12 months
- Net capital gain = (shortTermGains - shortTermLosses) + (longTermGains - longTermLosses)
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "reportProvider": "string or null",
  "taxpayerName": "string or null",
  "taxYear": number or null,
  "totalTransactions": number or null,
  "shortTermGains": number or null,
  "shortTermLosses": number or null,
  "longTermGains": number or null,
  "longTermLosses": number or null,
  "netCapitalGain": number or null,
  "costBasisMethod": "string or null"
}`
}

export function validateCryptoTaxReportData(data: unknown): data is CryptoTaxReportExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'taxpayerName' in d
}

export const CRYPTO_TAX_REPORT_FIELD_LABELS_VI: Record<string, string> = {
  reportProvider: 'Nhà cung cấp báo cáo',
  taxpayerName: 'Tên người nộp thuế',
  taxYear: 'Năm thuế',
  totalTransactions: 'Tổng số giao dịch',
  shortTermGains: 'Lãi vốn ngắn hạn',
  shortTermLosses: 'Lỗ vốn ngắn hạn',
  longTermGains: 'Lãi vốn dài hạn',
  longTermLosses: 'Lỗ vốn dài hạn',
  netCapitalGain: 'Lãi vốn ròng',
  costBasisMethod: 'Phương pháp tính giá vốn',
}
