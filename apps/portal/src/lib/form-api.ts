/**
 * Form API client
 * Public endpoints for client self-registration intake form
 * No authentication required
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export interface OrgInfo {
  id: string
  name: string
  logoUrl: string | null
  slug: string
}

export interface StaffInfo {
  id: string
  name: string
}

export interface FormInfoResponse {
  org: OrgInfo
  staff?: StaffInfo
}

export interface RegistrationFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
  businessName: string
  smsConsentAccepted: boolean
}

export interface BusinessSubmitInput {
  name: string
  businessType?: string
  ein?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

export interface SubmitFormData {
  clientType: 'INDIVIDUAL' | 'INDIVIDUAL_WITH_BUSINESS' | 'BUSINESS'
  // Individual fields
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  taxYear: number
  language: 'VI' | 'EN'
  staffSlug?: string
  // Multi-business (preferred). When set, takes precedence over the legacy flat fields below.
  businesses?: BusinessSubmitInput[]
  // Legacy flat business fields (single business) — kept for backwards compat.
  businessName?: string
  businessType?: string
  businessEin?: string
  businessPhone?: string
  businessEmail?: string
  businessAddress?: string
  businessCity?: string
  businessState?: string
  businessZip?: string
}

export interface SubmitResponse {
  success: boolean
  clientId: string
  smsSent: boolean
}

async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json()
  } catch {
    return { error: `HTTP ${res.status}` }
  }
}

/**
 * Pull a human-readable error string out of an arbitrary JSON error body.
 * Handles strings, Zod-style nested error objects, and `{issues: [...]}` arrays
 * so the user never sees "[object Object]".
 */
function extractErrorMessage(json: Record<string, unknown>, fallback: string): string {
  // Prefer explicit `message` (our API's friendly string)
  if (typeof json.message === 'string' && json.message.trim()) return json.message

  const err = json.error
  if (typeof err === 'string' && err.trim()) return err

  // Hono's default zValidator response shape: { success: false, error: { issues: [...] } }
  if (err && typeof err === 'object') {
    const issues = (err as { issues?: Array<{ path?: (string | number)[]; message?: string }> }).issues
    if (Array.isArray(issues) && issues.length > 0) {
      const first = issues[0]
      const field = first.path?.join('.') || 'input'
      return `${field}: ${first.message || 'Invalid value'}`
    }
  }

  return fallback
}

export const formApi = {
  async getOrgInfo(orgSlug: string): Promise<FormInfoResponse> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}`)
    if (!res.ok) {
      const data = await safeParseJson(res)
      throw new Error(extractErrorMessage(data, 'Organization not found'))
    }
    return res.json()
  },

  async getStaffFormInfo(orgSlug: string, staffSlug: string): Promise<FormInfoResponse> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}/${staffSlug}`)
    if (!res.ok) {
      const data = await safeParseJson(res)
      throw new Error(extractErrorMessage(data, 'Form not found'))
    }
    return res.json()
  },

  async validateCampaign(
    orgSlug: string,
    campaignSlug: string,
  ): Promise<{ valid: boolean; campaignName?: string; formIntroContent?: string | null }> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}/campaign/${campaignSlug}`)
    if (!res.ok) {
      return { valid: false }
    }
    return res.json()
  },

  async createLead(data: {
    firstName: string
    lastName: string
    phone: string
    email?: string
    businessName?: string
    smsConsentAccepted: boolean
    orgSlug: string
    eventSlug?: string
  }): Promise<{ success: boolean; leadId?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await safeParseJson(res)

    if (!res.ok) {
      return { success: false, error: extractErrorMessage(json, 'Registration failed') }
    }

    return json as unknown as { success: boolean; leadId?: string; error?: string }
  },

  async submit(orgSlug: string, data: SubmitFormData): Promise<SubmitResponse> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const json = await safeParseJson(res)
      throw new Error(extractErrorMessage(json, 'Submission failed'))
    }

    return res.json()
  },

  // Contractor intake
  async getIntakeInfo(token: string): Promise<{
    business: { name: string }
    org: { name: string; logoUrl: string | null }
    taxYear: number
  }> {
    const res = await fetch(`${API_BASE}/contractor-intake/${token}`)
    if (!res.ok) throw new Error('Invalid or expired link')
    return res.json()
  },

  async submitContractor(token: string, data: {
    firstName: string
    lastName: string
    ssn: string
    tinType?: 'SSN' | 'EIN'
    address: string
    city: string
    state: string
    zip: string
    amountBox1: string
    amountBox4?: string
  }): Promise<{
    success: boolean
    contractor: { firstName: string; lastName: string; ssnLast4: string }
  }> {
    const res = await fetch(`${API_BASE}/contractor-intake/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await safeParseJson(res)
      throw new Error(extractErrorMessage(json, 'Submission failed'))
    }
    return res.json()
  },
}
