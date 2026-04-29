/**
 * Entity Type Label Helper
 * Resolves (entityType, businessType) → human-readable label via i18n.
 * Locale text lives in `locales/{vi,en}.json` under `portal.entityPicker.*`.
 */
import type { TFunction } from 'i18next'

interface EntityLabelInput {
  entityType: 'individual' | 'business'
  businessType?: string | null
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function entityTypeLabel(entity: EntityLabelInput, t: TFunction): string {
  if (entity.entityType === 'individual') {
    return t('portal.entityPicker.individualLabel')
  }

  const bt = entity.businessType?.trim()
  if (bt) {
    const key = `portal.entityPicker.businessType.${bt}`
    const translated = t(key)
    // i18next returns the key itself when not found — fall back to humanized enum.
    if (translated !== key) return translated
    return capitalize(bt.replace(/_/g, ' '))
  }

  return t('portal.entityPicker.businessFallback')
}
