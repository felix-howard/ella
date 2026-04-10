/**
 * Portal API client
 * Simplified HTTP client for magic link portal access
 * Public endpoints only - no auth required
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Error messages for different status codes
const ERROR_MESSAGES: Record<number, { code: string; vi: string; en: string }> = {
  429: { code: 'RATE_LIMITED', vi: 'Quá nhiều yêu cầu. Vui lòng đợi một chút.', en: 'Too many requests. Please wait.' },
  500: { code: 'SERVER_ERROR', vi: 'Lỗi máy chủ. Vui lòng thử lại.', en: 'Server error. Please try again.' },
  503: { code: 'UNAVAILABLE', vi: 'Dịch vụ tạm thời không khả dụng.', en: 'Service temporarily unavailable.' },
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // Handle rate limiting specifically
    if (response.status === 429) {
      const errInfo = ERROR_MESSAGES[429]
      throw new ApiError(429, errInfo.code, errInfo.vi)
    }

    const data = await response.json()

    if (!response.ok) {
      // Check for known error status codes
      const errInfo = ERROR_MESSAGES[response.status]
      if (errInfo) {
        throw new ApiError(response.status, errInfo.code, errInfo.vi)
      }
      throw new ApiError(
        response.status,
        data.error || 'UNKNOWN_ERROR',
        data.message || 'Đã có lỗi xảy ra'
      )
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.')
  }
}

// Draft return data type
export interface DraftReturnData {
  clientName: string
  clientLanguage: 'EN' | 'VI'
  taxYear: number
  version: number
  filename: string
  uploadedAt: string
  pdfUrl: string
}

// Portal data types
export interface PortalClient {
  name: string
  language: 'VI' | 'EN'
}

export interface PortalTaxCase {
  id: string
  taxYear: number
  status: string
  engagementId?: string  // Added for multi-year support (Phase 5)
}

export interface ChecklistDoc {
  id: string
  docType: string
  labelVi: string
  status?: string
  reason?: string
}

export interface PortalStats {
  uploaded: number
  verified: number
  missing: number
}

export interface PortalData {
  client: PortalClient
  taxCase: PortalTaxCase
  checklist: {
    received: ChecklistDoc[]
    blurry: ChecklistDoc[]
    missing: ChecklistDoc[]
  }
  stats: PortalStats
}

export interface UploadedImage {
  id: string
  filename: string
  status: string
  createdAt: string
}

export interface UploadResponse {
  uploaded: number
  images: UploadedImage[]
  message: string
}

// Portal API methods
export const portalApi = {
  // Get portal data via magic link token
  getData: (token: string) => request<PortalData>(`/portal/${token}`),

  // Upload files with progress tracking using XMLHttpRequest
  uploadWithProgress: async (
    token: string,
    files: File[],
    onProgress: (progress: number) => void
  ): Promise<UploadResponse> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new ApiError(xhr.status, 'PARSE_ERROR', 'Invalid response'))
          }
        } else if (xhr.status === 429) {
          const errInfo = ERROR_MESSAGES[429]
          reject(new ApiError(429, errInfo.code, errInfo.vi))
        } else {
          const errInfo = ERROR_MESSAGES[xhr.status]
          if (errInfo) {
            reject(new ApiError(xhr.status, errInfo.code, errInfo.vi))
          } else {
            try {
              const data = JSON.parse(xhr.responseText)
              reject(
                new ApiError(
                  xhr.status,
                  data.error || 'UPLOAD_ERROR',
                  data.message || 'Không thể tải lên. Vui lòng thử lại.'
                )
              )
            } catch {
              reject(
                new ApiError(
                  xhr.status,
                  'UPLOAD_ERROR',
                  'Không thể tải lên. Vui lòng thử lại.'
                )
              )
            }
          }
        }
      }

      xhr.onerror = () => {
        reject(
          new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối. Vui lòng thử lại.')
        )
      }

      xhr.open('POST', `${API_BASE_URL}/portal/${token}/upload`)
      xhr.send(formData)
    })
  },

  // Upload files via magic link (legacy - no progress)
  upload: async (token: string, files: File[]): Promise<UploadResponse> => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const response = await fetch(`${API_BASE_URL}/portal/${token}/upload`, {
      method: 'POST',
      body: formData,
    })

    // Handle rate limiting for uploads
    if (response.status === 429) {
      const errInfo = ERROR_MESSAGES[429]
      throw new ApiError(429, errInfo.code, errInfo.vi)
    }

    const data = await response.json()

    if (!response.ok) {
      // Check for known error status codes
      const errInfo = ERROR_MESSAGES[response.status]
      if (errInfo) {
        throw new ApiError(response.status, errInfo.code, errInfo.vi)
      }
      throw new ApiError(
        response.status,
        data.error || 'UPLOAD_ERROR',
        data.message || 'Không thể tải lên. Vui lòng thử lại.'
      )
    }

    return data as UploadResponse
  },

  // Get draft return data for portal viewing
  getDraft: (token: string) => request<DraftReturnData>(`/portal/draft/${token}`),

  // Track when client views the draft
  trackDraftView: async (token: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/portal/draft/${token}/viewed`, {
      method: 'POST',
    })
  },
}
