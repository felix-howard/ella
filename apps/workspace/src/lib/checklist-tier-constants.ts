/**
 * Checklist tier constants for 3-tier priority grouping
 * Used in TieredChecklist component for visual hierarchy
 */

export const CHECKLIST_TIERS = {
  REQUIRED: {
    key: 'required',
    labelVi: 'BẮT BUỘC',
    labelEn: 'Required',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🔴',
  },
  APPLICABLE: {
    key: 'applicable',
    labelVi: 'THEO TÌNH HUỐNG',
    labelEn: 'Based on your answers',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '🟡',
  },
  OPTIONAL: {
    key: 'optional',
    labelVi: 'CÓ THỂ CẦN',
    labelEn: 'Optional',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '🟢',
  },
} as const

export type ChecklistTierKey = keyof typeof CHECKLIST_TIERS

export const CHECKLIST_STATUS_DISPLAY = {
  VERIFIED: { icon: '✓', labelVi: 'Đã xác minh', color: 'text-green-600', bgColor: 'bg-green-50' },
  HAS_DIGITAL: { icon: '◉', labelVi: 'Đã trích xuất', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  HAS_RAW: { icon: '○', labelVi: 'Đã nhận ảnh', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  MISSING: { icon: '✗', labelVi: 'Chưa có', color: 'text-red-600', bgColor: 'bg-red-50' },
  NOT_REQUIRED: { icon: '—', labelVi: 'Không cần', color: 'text-gray-400', bgColor: 'bg-gray-50' },
} as const
