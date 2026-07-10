import type {
  ClientServiceLog,
  ClientServiceStatus,
  ClientServiceType,
  CreateClientServiceLogInput,
} from '../../../lib/api-client'
import { toDateInputValue } from './service-log-labels'

type Translate = (key: string, options?: Record<string, unknown>) => string

export type ServiceLogFormValues = {
  serviceType: ClientServiceType
  customServiceName: string
  status: ClientServiceStatus
  taxYear: string
  serviceDate: string
  note: string
}

export type ServiceLogFormFieldChange = <K extends keyof ServiceLogFormValues>(
  key: K,
  value: ServiceLogFormValues[K]
) => void

export function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDefaultFormValues(defaultTaxYear?: number | null): ServiceLogFormValues {
  return {
    serviceType: 'INDIVIDUAL_TAX_RETURN',
    customServiceName: '',
    status: 'ACTIVE',
    taxYear: defaultTaxYear ? String(defaultTaxYear) : '',
    serviceDate: getLocalDateInputValue(),
    note: '',
  }
}

export function getFormValuesFromLog(log: ClientServiceLog): ServiceLogFormValues {
  return {
    serviceType: log.serviceType,
    customServiceName: log.customServiceName ?? '',
    status: log.status,
    taxYear: log.taxYear ? String(log.taxYear) : '',
    serviceDate: toDateInputValue(log.serviceDate),
    note: log.note ?? '',
  }
}

export function buildServiceLogPayload(values: ServiceLogFormValues, t: Translate) {
  const customServiceName = values.customServiceName.trim()
  if (values.serviceType === 'OTHER' && !customServiceName) {
    return { error: t('clientServices.customServiceRequired') }
  }
  if (!values.serviceDate) {
    return { error: t('clientServices.serviceDateRequired') }
  }

  const taxYearText = values.taxYear.trim()
  const parsedTaxYear = Number(taxYearText)
  if (
    taxYearText &&
    (!Number.isInteger(parsedTaxYear) || parsedTaxYear < 2000 || parsedTaxYear > 2100)
  ) {
    return { error: t('clientServices.invalidTaxYear') }
  }

  const payload: CreateClientServiceLogInput = {
    serviceType: values.serviceType,
    status: values.status,
    taxYear: taxYearText ? parsedTaxYear : null,
    serviceDate: values.serviceDate,
    customServiceName: values.serviceType === 'OTHER' ? customServiceName : null,
    note: values.note.trim() || null,
  }

  return { payload }
}
