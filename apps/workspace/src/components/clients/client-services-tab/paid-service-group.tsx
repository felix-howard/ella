import { Link } from '@tanstack/react-router'
import { CalendarDays, CreditCard, FileSignature } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientPaidServiceGroup } from '../../../lib/api-client'
import { PaidServiceStatusBadge } from './paid-service-status-badge'

interface PaidServiceGroupProps {
  clientId: string
  group: ClientPaidServiceGroup
  canManagePayments: boolean
  canManageAgreements: boolean
}

function formatPaidDate(value: string, language: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const locale = language.toLowerCase().startsWith('vi') ? 'vi-VN' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function PaidServiceGroup({
  clientId,
  group,
  canManagePayments,
  canManageAgreements,
}: PaidServiceGroupProps) {
  const { t, i18n } = useTranslation()
  const sourceLabel = t(`clientServices.source.${group.source}`)
  const paidDate = formatPaidDate(group.paidAt, i18n.resolvedLanguage ?? i18n.language ?? 'en')

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
            <span>{sourceLabel}</span>
            {group.agreement ? (
              <span className="break-words text-muted-foreground [overflow-wrap:anywhere]">
                · {group.agreement.title}
              </span>
            ) : null}
          </h4>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{t('clientServices.firstPaid')}</span>
            <time dateTime={group.paidAt}>{paidDate}</time>
          </p>
        </div>

        {canManagePayments || (canManageAgreements && group.agreement) ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            {canManagePayments ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId }}
                search={{ tab: 'payments' }}
                aria-label={t('clientServices.viewPaymentsForService', { source: sourceLabel })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <CreditCard className="size-3.5" aria-hidden="true" />
                {t('clientServices.viewPayments')}
              </Link>
            ) : null}
            {canManageAgreements && group.agreement ? (
              <Link
                to="/clients/$clientId"
                params={{ clientId }}
                search={{ tab: 'agreements' }}
                aria-label={t('clientServices.viewAgreementByTitle', {
                  title: group.agreement.title,
                })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <FileSignature className="size-3.5" aria-hidden="true" />
                {t('clientServices.viewAgreement')}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="mt-3 divide-y divide-border/60" aria-label={t('clientServices.itemsLabel')}>
        {group.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-medium leading-5 text-foreground [overflow-wrap:anywhere]">
                {item.label}
              </p>
              {item.description ? (
                <p className="mt-1 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {item.description}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`clientServices.cadence.${item.cadence}`)}
              </p>
            </div>
            <PaidServiceStatusBadge status={item.status} />
          </li>
        ))}
      </ul>
    </article>
  )
}
