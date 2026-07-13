import type {
  ClientServiceLog,
  ClientServiceStatus,
  ClientServiceType,
} from '../../../lib/api-client'

type Translate = (key: string, options?: Record<string, unknown>) => string

export const SERVICE_TYPE_OPTIONS: Array<{ value: ClientServiceType; labelKey: string }> = [
  { value: 'INDIVIDUAL_TAX_RETURN', labelKey: 'clientServices.serviceTypes.individualTaxReturn' },
  { value: 'BUSINESS_TAX_RETURN', labelKey: 'clientServices.serviceTypes.businessTaxReturn' },
  { value: 'BOOKKEEPING', labelKey: 'clientServices.serviceTypes.bookkeeping' },
  { value: 'PAYROLL', labelKey: 'clientServices.serviceTypes.payroll' },
  { value: 'TAX_PLANNING', labelKey: 'clientServices.serviceTypes.taxPlanning' },
  { value: 'IRS_NOTICE', labelKey: 'clientServices.serviceTypes.irsNotice' },
  { value: 'AMENDMENT', labelKey: 'clientServices.serviceTypes.amendment' },
  { value: 'FORM_1099_FILING', labelKey: 'clientServices.serviceTypes.form1099Filing' },
  { value: 'CONSULTATION', labelKey: 'clientServices.serviceTypes.consultation' },
  { value: 'OTHER', labelKey: 'clientServices.serviceTypes.other' },
]

export const STATUS_OPTIONS: Array<{ value: ClientServiceStatus; labelKey: string }> = [
  { value: 'ACTIVE', labelKey: 'clientServices.status.active' },
  { value: 'WAITING_ON_CLIENT', labelKey: 'clientServices.status.waitingOnClient' },
  { value: 'COMPLETED', labelKey: 'clientServices.status.completed' },
  { value: 'CANCELLED', labelKey: 'clientServices.status.cancelled' },
]

export const STATUS_BADGE_CLASS_NAMES: Record<ClientServiceStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  WAITING_ON_CLIENT: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  COMPLETED: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export function getServiceTypeLabel(type: ClientServiceType, t: Translate) {
  const option = SERVICE_TYPE_OPTIONS.find((item) => item.value === type)
  return t(option?.labelKey ?? 'clientServices.serviceTypes.other')
}

export function getServiceLogTitle(log: ClientServiceLog, t: Translate) {
  if (log.serviceType === 'OTHER' && log.customServiceName?.trim()) {
    return log.customServiceName.trim()
  }
  return getServiceTypeLabel(log.serviceType, t)
}

export function getStatusLabel(status: ClientServiceStatus, t: Translate) {
  const option = STATUS_OPTIONS.find((item) => item.value === status)
  return t(option?.labelKey ?? 'clientServices.status.active')
}

export function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function formatServiceDate(value: string, locale?: string) {
  const datePart = toDateInputValue(value)
  if (!datePart) return ''

  const date = new Date(`${datePart}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return datePart

  const isVi = locale?.toLowerCase().startsWith('vi')
  return new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function compareServiceLogsNewestFirst(a: ClientServiceLog, b: ClientServiceLog) {
  return (
    Date.parse(b.serviceDate) - Date.parse(a.serviceDate) ||
    Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )
}
