/**
 * TaxBandits API Client
 * Singleton client with OAuth 2.0 JWT auth, token caching, and retry logic
 * Handles: 1099-NEC create, status, PDF, transmit
 */
import { createHmac } from 'crypto'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../lib/config'

// ============================================
// Types
// ============================================

export interface PayerData {
  businessName: string
  ein: string
  address1: string
  city: string
  state: string
  zip: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
}

export interface RecipientFormData {
  firstName: string
  lastName: string
  tinType: 'SSN' | 'EIN'
  tin: string
  address1: string
  city: string
  state: string
  zip: string
  email?: string
  amountBox1: number
  amountBox4?: number
}

export interface CreateFormRequest {
  taxYear: number
  payer: PayerData
  recipients: RecipientFormData[]
}

export interface SuccessRecord {
  RecordId: string
  RecipientId: string
  FederalFilingStatus: string
  SequenceId: string
}

export interface ErrorRecord {
  SequenceId: string
  Errors: Array<{ Code: string; Message: string; FieldName?: string }>
}

export interface CreateFormResponse {
  StatusCode: number
  SubmissionId: string
  Form1099Records: {
    SuccessRecords: SuccessRecord[]
    ErrorRecords: ErrorRecord[]
  }
}

export interface StatusRecord {
  RecordId: string
  Status: string
  FederalFilingStatus: string
}

export interface StatusResponse {
  StatusCode: number
  SubmissionId: string
  Form1099Records: StatusRecord[]
}

export interface DraftPdfResponse {
  StatusCode: number
  DraftPdfUrl: string
}

export interface TransmitResponse {
  StatusCode: number
  SubmissionId: string
  Form1099Records: {
    SuccessRecords: Array<{ RecordId: string; Status: string }>
    ErrorRecords: ErrorRecord[]
  }
}

// ============================================
// Client
// ============================================

const TOKEN_BUFFER_MS = 5 * 60 * 1000
const LOGIN_COOLDOWN_MS = 60 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000

class TaxBanditsClient {
  private token: string | null = null
  private tokenExpiry: Date | null = null
  private authPromise: Promise<void> | null = null
  private authFailedAt: Date | null = null
  private authFailError: string | null = null

  private createJWS(): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      iss: config.taxbandits.clientId,
      sub: config.taxbandits.clientId,
      aud: config.taxbandits.userToken,
      iat: Math.floor(Date.now() / 1000),
    })).toString('base64url')
    const signature = createHmac('sha256', config.taxbandits.clientSecret)
      .update(`${header}.${payload}`)
      .digest('base64url')
    return `${header}.${payload}.${signature}`
  }

  private async doAuth(): Promise<void> {
    if (!config.taxbandits.isConfigured) {
      throw new Error('TaxBandits API not configured. Set TAXBANDITS_CLIENT_ID, TAXBANDITS_CLIENT_SECRET, TAXBANDITS_USER_TOKEN.')
    }
    console.log(`[TaxBandits] Authenticating (sandbox: ${config.taxbandits.isSandbox})...`)
    const jws = this.createJWS()
    const response = await fetch(config.taxbandits.urls.oauth, {
      method: 'GET',
      headers: { Authentication: jws },
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`TaxBandits OAuth failed (${response.status}): ${text}`)
    }
    const data = await response.json()
    if (!data.AccessToken) {
      throw new Error('TaxBandits OAuth response missing AccessToken')
    }
    this.token = data.AccessToken
    // Use API-provided expiry if available, otherwise assume 55 min (5-min buffer on 60-min token)
    const expiryMs = data.ExpiresIn ? data.ExpiresIn * 1000 : 55 * 60 * 1000
    this.tokenExpiry = new Date(Date.now() + expiryMs)
    console.log('[TaxBandits] Auth successful, token cached')
  }

  private async ensureAuth(): Promise<string> {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry.getTime() - TOKEN_BUFFER_MS) {
      return this.token
    }
    if (this.authFailedAt && Date.now() - this.authFailedAt.getTime() < LOGIN_COOLDOWN_MS) {
      throw new Error(`TaxBandits auth failed (cooldown): ${this.authFailError}`)
    }
    if (!this.authPromise) {
      this.authPromise = this.doAuth()
        .then(() => { this.authFailedAt = null; this.authFailError = null })
        .catch((err) => { this.authFailedAt = new Date(); this.authFailError = err.message; throw err })
        .finally(() => { this.authPromise = null })
    }
    await this.authPromise
    return this.token!
  }

  private async request<T>(url: string, options: RequestInit, retries = 3): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const token = await this.ensureAuth()
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
          },
        })
        if (response.status === 401 && attempt < retries - 1) {
          console.warn('[TaxBandits] Token expired, refreshing...')
          this.token = null
          this.tokenExpiry = null
          continue
        }
        // TaxBandits returns 300 (MultiStatus) for partial success — treat as success
        if (!response.ok && response.status !== 300) {
          const errorText = await response.text()
          // Parse TaxBandits error response for user-friendly messages
          let message = `TaxBandits API error ${response.status}`
          try {
            const parsed = JSON.parse(errorText)
            const details: string[] = []
            // Top-level validation errors
            if (parsed.Errors?.length) {
              details.push(...parsed.Errors.map((e: { Name?: string; Message?: string }) =>
                `${e.Name}: ${e.Message}`
              ))
            }
            // Per-record errors in Form1099Records
            if (parsed.Form1099Records?.ErrorRecords?.length) {
              for (const rec of parsed.Form1099Records.ErrorRecords) {
                details.push(...(rec.Errors || []).map((e: { FieldName?: string; Message?: string }) =>
                  `Record ${rec.SequenceId}: ${e.FieldName || ''} ${e.Message}`.trim()
                ))
              }
            }
            message = details.length > 0 ? details.join('; ') : (parsed.StatusMessage || message)
          } catch { /* use default message */ }
          const err = new Error(message)
          // Don't retry client errors (except 429 rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw err
          }
          throw err
        }
        return response.json() as Promise<T>
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw new Error(`TaxBandits request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`)
        }
        if (attempt === retries - 1) throw error
        const delay = 1000 * Math.pow(2, attempt)
        console.warn(`[TaxBandits] Request failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      } finally {
        clearTimeout(timeout)
      }
    }
    throw new Error('TaxBandits: Max retries exceeded')
  }

  async checkAuth(): Promise<void> {
    await this.ensureAuth()
  }

  async createForm1099NEC(data: CreateFormRequest): Promise<CreateFormResponse> {
    console.log(`[TaxBandits] Creating 1099-NEC: ${data.recipients.length} recipient(s)`)
    const body = {
      SubmissionManifest: {
        TaxYear: data.taxYear.toString(),
        IRSFilingType: 'IRIS',
        IsFederalFiling: true,
        IsStateFiling: false,
        IsPostal: false,
        IsOnlineAccess: true,
      },
      ReturnHeader: {
        Business: {
          BusinessNm: data.payer.businessName,
          EINorSSN: data.payer.ein,
          IsEIN: true,
          IsForeign: false,
          USAddress: {
            Address1: data.payer.address1,
            City: data.payer.city,
            State: data.payer.state,
            ZipCd: data.payer.zip,
          },
          ...(data.payer.contactName && { ContactNm: data.payer.contactName }),
          ...(data.payer.contactPhone && { Phone: data.payer.contactPhone }),
          ...(data.payer.contactEmail && { Email: data.payer.contactEmail }),
        },
      },
      ReturnData: data.recipients.map((r, i) => ({
        SequenceId: (i + 1).toString(),
        Recipient: {
          FirstNm: r.firstName,
          LastNm: r.lastName,
          TINType: r.tinType,
          TIN: r.tin,
          IsForeign: false,
          USAddress: {
            Address1: r.address1,
            City: r.city,
            State: r.state,
            ZipCd: r.zip,
          },
          ...(r.email && { Email: r.email }),
        },
        NECFormData: {
          B1NEC: r.amountBox1,
          B4FedTaxWH: r.amountBox4 ?? 0,
        },
      })),
    }
    return this.request<CreateFormResponse>(
      `${config.taxbandits.urls.api}/Form1099NEC/Create`,
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async getStatus(submissionId: string, recordIds: string[]): Promise<StatusResponse> {
    console.log(`[TaxBandits] Checking status: ${submissionId}`)
    const params = new URLSearchParams({ RecordIds: recordIds.join(',') })
    return this.request<StatusResponse>(
      `${config.taxbandits.urls.api}/Form1099NEC/${submissionId}/Status?${params}`,
      { method: 'GET' }
    )
  }

  async requestDraftPdf(submissionId: string, recordId: string): Promise<DraftPdfResponse> {
    console.log(`[TaxBandits] Requesting draft PDF: ${recordId}`)
    return this.request<DraftPdfResponse>(
      `${config.taxbandits.urls.api}/Form1099NEC/RequestDraftPdfUrl`,
      { method: 'POST', body: JSON.stringify({ RecordId: recordId }) }
    )
  }

  async downloadPdfFromS3(draftPdfUrl: string): Promise<Buffer> {
    const s3Path = new URL(draftPdfUrl).pathname.substring(1)
    const sseKey = Buffer.from(config.taxbandits.base64Key, 'base64')

    const s3 = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.taxbandits.awsAccessKey,
        secretAccessKey: config.taxbandits.awsSecretKey,
      },
    })

    const command = new GetObjectCommand({
      Bucket: config.taxbandits.s3Bucket,
      Key: s3Path,
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey: sseKey.toString('base64'),
    })

    const response = await s3.send(command)
    const stream = response.Body as NodeJS.ReadableStream
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async transmit(submissionId: string, recordIds: string[]): Promise<TransmitResponse> {
    console.log(`[TaxBandits] Transmitting ${recordIds.length} form(s) to IRS`)
    return this.request<TransmitResponse>(
      `${config.taxbandits.urls.api}/Form1099NEC/${submissionId}/Transmit`,
      { method: 'POST', body: JSON.stringify({ SubmissionId: submissionId, RecordIds: recordIds }) }
    )
  }
}

export const taxbanditsClient = new TaxBanditsClient()
