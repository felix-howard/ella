/**
 * Power of Attorney OCR Extraction Prompt
 * General, Limited, or Durable Power of Attorney
 */

export interface PowerOfAttorneyExtractedData {
  principalName: string | null
  agentName: string | null
  dateExecuted: string | null
  effectiveDate: string | null
  expirationDate: string | null
  taxMattersAuthorized: boolean | null
  scope: 'LIMITED' | 'GENERAL' | 'DURABLE' | null
  notarizationDate: string | null
}

export function getPowerOfAttorneyExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Power of Attorney (POA) documents.

IMPORTANT: This legal document grants authority to an agent to act on behalf of the principal. Tax-related POA (IRS Form 2848) is especially relevant.

Extract the following fields:

PARTIES:
- principalName: Full legal name of the principal (the person granting authority)
- agentName: Full legal name of the agent / attorney-in-fact

DATES:
- dateExecuted: Date the document was signed / executed (YYYY-MM-DD)
- effectiveDate: Date the POA becomes effective (YYYY-MM-DD); may equal dateExecuted
- expirationDate: Date the POA expires (YYYY-MM-DD); null if no expiration stated

SCOPE & TYPE:
- taxMattersAuthorized: true if the POA explicitly authorizes handling tax matters or IRS matters; false if not; null if unclear
- scope: "LIMITED" for specific purpose only, "GENERAL" for broad authority, "DURABLE" for authority surviving incapacity

NOTARIZATION:
- notarizationDate: Date the document was notarized (YYYY-MM-DD); null if not notarized

Respond in JSON format:
{
  "principalName": "NGUYEN VAN A",
  "agentName": "TRAN THI B",
  "dateExecuted": "2024-03-01",
  "effectiveDate": "2024-03-01",
  "expirationDate": null,
  "taxMattersAuthorized": true,
  "scope": "DURABLE",
  "notarizationDate": "2024-03-01"
}

Rules:
1. Use null for empty or missing fields, NEVER guess
2. Format all dates as YYYY-MM-DD
3. taxMattersAuthorized: set true only if document explicitly mentions tax, IRS, or financial matters
4. scope: use document's own language; "durable" = survives incapacity, "limited" = specific acts only
5. IRS Form 2848 is a specific tax POA — always set taxMattersAuthorized to true for Form 2848`
}

export function validatePowerOfAttorneyData(data: unknown): data is PowerOfAttorneyExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('principalName' in d)) return false
  if (d.scope !== null && d.scope !== undefined &&
      d.scope !== 'LIMITED' && d.scope !== 'GENERAL' && d.scope !== 'DURABLE') return false
  if (d.taxMattersAuthorized !== null && d.taxMattersAuthorized !== undefined &&
      typeof d.taxMattersAuthorized !== 'boolean') return false
  return true
}

export const POWER_OF_ATTORNEY_FIELD_LABELS_VI: Record<string, string> = {
  principalName: 'Tên ủy quyền (Principal)',
  agentName: 'Tên người được ủy quyền (Agent)',
  dateExecuted: 'Ngày ký',
  effectiveDate: 'Ngày có hiệu lực',
  expirationDate: 'Ngày hết hạn',
  taxMattersAuthorized: 'Ủy quyền về thuế',
  scope: 'Phạm vi ủy quyền',
  notarizationDate: 'Ngày công chứng',
}
