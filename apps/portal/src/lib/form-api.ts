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
}

export interface SubmitFormData {
  firstName: string
  lastName?: string
  phone: string
  taxYear: number
  language: 'VI' | 'EN'
  staffSlug?: string
}

export interface SubmitResponse {
  success: boolean
  clientId: string
  smsSent: boolean
}

async function safeParseJson(res: Response): Promise<Record<string, string>> {
  try {
    return await res.json()
  } catch {
    return { error: `HTTP ${res.status}` }
  }
}

export const formApi = {
  async getOrgInfo(orgSlug: string): Promise<FormInfoResponse> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}`)
    if (!res.ok) {
      const data = await safeParseJson(res)
      throw new Error(data.error || 'Organization not found')
    }
    return res.json()
  },

  async getStaffFormInfo(orgSlug: string, staffSlug: string): Promise<FormInfoResponse> {
    const res = await fetch(`${API_BASE}/form/${orgSlug}/${staffSlug}`)
    if (!res.ok) {
      const data = await safeParseJson(res)
      throw new Error(data.error || 'Form not found')
    }
    return res.json()
  },

  async createLead(data: {
    firstName: string
    lastName: string
    phone: string
    email?: string
    businessName?: string
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
      return { success: false, error: json.message || json.error || 'Registration failed' }
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
      throw new Error(json.message || json.error || 'Submission failed')
    }

    return res.json()
  },
}
