// @ts-nocheck — DEPRECATED: This file is replaced by taxbandits-client.ts and will be deleted in Phase 6
/**
 * Tax1099 API Client (DEPRECATED - use taxbandits-client.ts)
 * Singleton client for Tax1099 API with token caching, login mutex, and retry logic
 * Handles: login, payer, recipient, form validation, import, PDF retrieval
 */
import { config } from '../lib/config'

// ============================================
// Types
// ============================================

export interface PayerData {
  clientPayerId: string
  payerName: string
  payerTIN: string
  tinType: 'Business'
  address1: string
  city: string
  state: string
  zip: string
  phone?: string
  email?: string
}

export interface SavePayerResponse {
  success: boolean
  payerId?: number
  message?: string
}

export interface RecipientData {
  clientRecipientId: string
  clientPayerId: string
  recipientName: string
  recipientTIN: string
  tinType: 'Individual'
  address1: string
  city: string
  state: string
  zip: string
  email?: string
}

export interface SaveRecipientResponse {
  success: boolean
  recipientId?: number
  message?: string
}

export interface ValidateFormData {
  clientPayerId: string
  clientRecipientId: string
  taxYear: number
  payerTIN: string
  recipientTIN: string
  amtBox1: number
  amtBox4?: number
}

export interface ValidateResponse {
  isValid: boolean
  errors?: string[]
}

export interface ImportFormData {
  clientPayerId: string
  clientRecipientId: string
  taxYear: number
  amtBox1: number
  amtBox4?: number
}

export interface ImportResponse {
  success: boolean
  forms: Array<{
    formId: number
    clientRecipientId: string
    status: string
  }>
}

export interface PdfResponse {
  forms: Array<{
    formId: number
    recipientPdf: string // Base64 encoded PDF
  }>
}

export interface SubmitRequest {
  formIds: number[]
  tinCheckAllForms: boolean
  uspsAllForms: boolean
  eDeliveryRecipientAllForms: boolean
  isSeparateStateFiling: boolean
}

export interface SubmitResponse {
  success: boolean
  submissionId: string
  status: string
  forms: Array<{
    formId: number
    status: 'SUBMITTED' | 'REJECTED'
    errors?: string[]
  }>
}

export interface SubmissionStatusResponse {
  status: string
  acceptedCount: number
  rejectedCount: number
  forms?: Array<{
    formId: number
    status: string
  }>
}

// ============================================
// Client
// ============================================

const TOKEN_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry
const LOGIN_COOLDOWN_MS = 60 * 1000 // Wait 60s before retrying after login failure

class Tax1099Client {
  private token: string | null = null
  private tokenExpiry: Date | null = null
  private loginPromise: Promise<void> | null = null
  private loginFailedAt: Date | null = null
  private loginFailError: string | null = null

  /**
   * Base request with auth, retry, and error handling
   */
  private async request<T>(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const token = await this.ensureAuth()
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        })

        if (response.status === 401 && attempt < retries - 1) {
          console.warn('[Tax1099] Token expired, refreshing...')
          this.token = null
          this.tokenExpiry = null
          continue
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Tax1099 API error ${response.status}: ${errorText}`)
        }

        return response.json() as Promise<T>
      } catch (error) {
        if (attempt === retries - 1) throw error
        const delay = 1000 * Math.pow(2, attempt)
        console.warn(`[Tax1099] Request failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    throw new Error('Tax1099: Max retries exceeded')
  }

  /**
   * Login to Tax1099 API and cache bearer token
   */
  private async doLogin(): Promise<void> {
    if (!config.tax1099.isConfigured) {
      throw new Error('Tax1099 API is not configured. Set TAX1099_LOGIN, TAX1099_PASSWORD, TAX1099_APP_KEY.')
    }

    console.log(`[Tax1099] Logging in (sandbox: ${config.tax1099.isSandbox})...`)
    const response = await fetch(config.tax1099.urls.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: config.tax1099.login,
        password: config.tax1099.password,
        appKey: config.tax1099.appKey,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Tax1099 login failed (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    this.token = data.token
    // Use API-provided expiry if available, otherwise assume 24h
    const expiryMs = data.expiresIn
      ? data.expiresIn * 1000
      : 24 * 60 * 60 * 1000
    this.tokenExpiry = new Date(Date.now() + expiryMs)
    console.log('[Tax1099] Login successful, token cached')
  }

  /**
   * Ensure valid auth token exists, login if needed
   * Uses mutex to prevent concurrent login calls
   */
  private async ensureAuth(): Promise<string> {
    if (
      this.token &&
      this.tokenExpiry &&
      Date.now() < this.tokenExpiry.getTime() - TOKEN_BUFFER_MS
    ) {
      return this.token
    }

    // If login recently failed, reject immediately to avoid hammering the API
    if (this.loginFailedAt && Date.now() - this.loginFailedAt.getTime() < LOGIN_COOLDOWN_MS) {
      throw new Error(`Tax1099 login failed (cooldown ${LOGIN_COOLDOWN_MS / 1000}s): ${this.loginFailError}`)
    }

    // Mutex: reuse in-flight login promise
    if (!this.loginPromise) {
      this.loginPromise = this.doLogin()
        .then(() => {
          this.loginFailedAt = null
          this.loginFailError = null
        })
        .catch((err) => {
          this.loginFailedAt = new Date()
          this.loginFailError = err.message
          throw err
        })
        .finally(() => {
          this.loginPromise = null
        })
    }
    await this.loginPromise
    return this.token!
  }

  /**
   * Pre-flight auth check — call before batch operations to fail fast
   */
  async checkAuth(): Promise<void> {
    await this.ensureAuth()
  }

  /**
   * Create/update payer (business client) in Tax1099
   */
  async savePayer(data: PayerData): Promise<SavePayerResponse> {
    console.log(`[Tax1099] Saving payer: ${data.clientPayerId}`)
    return this.request<SavePayerResponse>(
      `${config.tax1099.urls.payer}/save`,
      { method: 'POST', body: JSON.stringify(data) }
    )
  }

  /**
   * Create/update recipient (contractor) in Tax1099
   */
  async saveRecipient(data: RecipientData): Promise<SaveRecipientResponse> {
    console.log(`[Tax1099] Saving recipient: ${data.clientRecipientId}`)
    return this.request<SaveRecipientResponse>(
      `${config.tax1099.urls.recipient}/save`,
      { method: 'POST', body: JSON.stringify(data) }
    )
  }

  /**
   * Validate 1099-NEC form data before import
   */
  async validateForm(data: ValidateFormData): Promise<ValidateResponse> {
    console.log(`[Tax1099] Validating form for recipient: ${data.clientRecipientId}`)
    return this.request<ValidateResponse>(
      `${config.tax1099.urls.form}/1099nec/validate`,
      { method: 'POST', body: JSON.stringify(data) }
    )
  }

  /**
   * Import forms to Tax1099 (returns formIds for PDF retrieval + submit)
   */
  async importOnly(data: ImportFormData[]): Promise<ImportResponse> {
    console.log(`[Tax1099] Importing ${data.length} forms`)
    return this.request<ImportResponse>(
      `${config.tax1099.urls.form}/importonly/1099nec`,
      { method: 'POST', body: JSON.stringify({ forms: data }) }
    )
  }

  /**
   * Fetch generated PDFs from Tax1099 (returns base64-encoded PDF data)
   */
  async getPdfs(formIds: number[]): Promise<PdfResponse> {
    console.log(`[Tax1099] Fetching PDFs for ${formIds.length} forms`)
    return this.request<PdfResponse>(
      `${config.tax1099.urls.pdf}/forms/getpdfs`,
      { method: 'POST', body: JSON.stringify({ formIds }) }
    )
  }

  /**
   * Submit forms to IRS via Tax1099 with TIN Check, USPS, and eDelivery options
   */
  async submitForms(data: SubmitRequest): Promise<SubmitResponse> {
    console.log(`[Tax1099] Submitting ${data.formIds.length} forms to IRS`)
    return this.request<SubmitResponse>(
      `${config.tax1099.urls.payment}/forms/submit`,
      { method: 'POST', body: JSON.stringify(data) }
    )
  }

  /**
   * Get submission status from Tax1099
   */
  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatusResponse> {
    console.log(`[Tax1099] Checking submission status: ${submissionId}`)
    return this.request<SubmissionStatusResponse>(
      `${config.tax1099.urls.payment}/submission/${submissionId}/status`,
      { method: 'GET' }
    )
  }
}

// Singleton export
export const tax1099Client = new Tax1099Client()
