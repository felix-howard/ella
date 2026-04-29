/**
 * Entity Type Label Helper
 * Maps (entityType, businessType) → human-readable VI/EN label.
 */

type Lang = 'vi' | 'en'

interface EntityLabelInput {
  entityType: 'individual' | 'business'
  businessType?: string | null
}

const BUSINESS_TYPE_LABELS: Record<string, { vi: string; en: string }> = {
  LLC: { vi: 'LLC', en: 'LLC' },
  S_CORP: { vi: 'S-Corp', en: 'S-Corp' },
  C_CORP: { vi: 'C-Corp', en: 'C-Corp' },
  SOLE_PROPRIETOR: { vi: 'Doanh nghiệp tư nhân', en: 'Sole Proprietor' },
  PARTNERSHIP: { vi: 'Hợp danh', en: 'Partnership' },
}

const INDIVIDUAL_LABEL = {
  vi: 'Cá nhân (1040)',
  en: 'Personal (1040)',
}

const BUSINESS_FALLBACK = {
  vi: 'Doanh nghiệp',
  en: 'Business',
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function entityTypeLabel(entity: EntityLabelInput, lang: Lang): string {
  if (entity.entityType === 'individual') {
    return INDIVIDUAL_LABEL[lang]
  }

  const bt = entity.businessType?.trim()
  if (bt && BUSINESS_TYPE_LABELS[bt]) {
    return BUSINESS_TYPE_LABELS[bt][lang]
  }

  if (bt) return capitalize(bt.replace(/_/g, ' '))
  return BUSINESS_FALLBACK[lang]
}
