import type { CustomLineItemInput, PaymentTemplatePayload } from '../../../lib/api-client'
import {
  createEmptyItem,
  draftsToCoreBillingPayload,
  type CustomBillingInterval,
  type CustomDiscountMode,
  type CustomItemDraft,
} from './custom-link-types'

export function draftsToTemplatePayload(items: CustomItemDraft[]): PaymentTemplatePayload | null {
  return draftsToCoreBillingPayload(items)
}

export function templatePayloadToDrafts(template: PaymentTemplatePayload): CustomItemDraft[] {
  if (template.billingInterval === 'one_time') {
    return template.items.map((item) => apiItemToDraft(item, 'one_time'))
  }

  return [
    ...(template.oneTimeItems ?? []).map((item) => apiItemToDraft(item, 'one_time')),
    ...template.items.map((item) => apiItemToDraft(item, template.billingInterval)),
  ]
}

export function loadedTemplateToCustomLinkState(template: PaymentTemplatePayload): {
  items: CustomItemDraft[]
  discountMode: CustomDiscountMode
  couponId: string
} {
  return {
    items: templatePayloadToDrafts(template),
    discountMode: 'none',
    couponId: '',
  }
}

function apiItemToDraft(
  item: CustomLineItemInput,
  billingInterval: CustomBillingInterval
): CustomItemDraft {
  return {
    ...createEmptyItem(),
    label: item.label,
    description: item.description ?? '',
    amount: centsToDollarInput(item.unitAmountCents),
    quantity: String(item.quantity),
    billingInterval,
  }
}

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
