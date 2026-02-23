/**
 * Staff Upload Notification Template
 * Sent to staff when clients upload documents via portal
 *
 * Constraints:
 * - Must be under 160 chars (GSM-7 to avoid multi-segment billing)
 * - No emojis or special chars (avoid UCS-2 encoding)
 * - Short, actionable message
 */

export interface StaffUploadTemplateParams {
  clientName: string
  uploadCount: number
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: StaffUploadTemplateParams) => {
    const { clientName, uploadCount } = params
    // Max ~145 chars: "[Ella] {name} vua gui {n} tai lieu. Dang nhap de xem."
    return `[Ella] ${clientName} vua gui ${uploadCount} tai lieu. Dang nhap de xem.`
  },

  EN: (params: StaffUploadTemplateParams) => {
    const { clientName, uploadCount } = params
    // Max ~110 chars: "[Ella] {name} uploaded {n} documents. Log in to view."
    const docWord = uploadCount === 1 ? 'document' : 'documents'
    return `[Ella] ${clientName} uploaded ${uploadCount} ${docWord}. Log in to view.`
  },
}

export function generateStaffUploadMessage(
  params: StaffUploadTemplateParams
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.VI
  return template(params)
}

export const STAFF_UPLOAD_TEMPLATE_NAME = 'staff_upload' as const
