import { cn } from '@ella/ui'
import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type {
  ClientPaidServiceGroup,
  ClientPaidServiceStatus,
} from '../../../lib/api-client'
import { CardSection } from '../../shared/card-section'
import { PaidServiceGroup } from './paid-service-group'
import {
  PaidServicesEmpty,
  PaidServicesError,
  PaidServicesLoading,
  PaidServicesTruncated,
} from './paid-services-query-states'
import { useClientPaidServices } from './use-client-paid-services'

interface ClientServicesTabProps {
  clientId: string
  canManagePayments?: boolean
  canManageAgreements?: boolean
}

interface PaidServiceSectionProps {
  id: string
  title: string
  description?: string
  icon: LucideIcon
  groups: ClientPaidServiceGroup[]
  clientId: string
  canManagePayments: boolean
  canManageAgreements: boolean
  attention?: boolean
}

type PaidServiceSectionId = 'pastDue' | 'active' | 'paid' | 'history'

function sectionForGroup(group: ClientPaidServiceGroup): PaidServiceSectionId {
  const statuses = new Set<ClientPaidServiceStatus>(group.items.map((item) => item.status))
  if (statuses.has('PAST_DUE')) return 'pastDue'
  if (statuses.has('ACTIVE')) return 'active'
  if (statuses.has('ENDED') || statuses.has('REFUNDED')) return 'history'
  return 'paid'
}

function groupsInSection(
  groups: ClientPaidServiceGroup[],
  sectionId: PaidServiceSectionId,
): ClientPaidServiceGroup[] {
  return groups.filter((group) => sectionForGroup(group) === sectionId)
}

function PaidServiceSection({
  id,
  title,
  description,
  icon: Icon,
  groups,
  clientId,
  canManagePayments,
  canManageAgreements,
  attention = false,
}: PaidServiceSectionProps) {
  if (groups.length === 0) return null

  return (
    <section aria-labelledby={id}>
      <div
        className={cn(
          'mb-3 rounded-xl border px-4 py-3',
          attention
            ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
            : 'border-border/60 bg-muted/40',
        )}
      >
        <h3
          id={id}
          className={cn(
            'flex items-center gap-2 text-sm font-semibold',
            attention ? 'text-red-800 dark:text-red-300' : 'text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              'mt-1 text-xs leading-5',
              attention
                ? 'text-red-700/90 dark:text-red-400/90'
                : 'text-muted-foreground',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <PaidServiceGroup
            key={`${id}-${group.id}`}
            clientId={clientId}
            group={group}
            canManagePayments={canManagePayments}
            canManageAgreements={canManageAgreements}
          />
        ))}
      </div>
    </section>
  )
}

export function ClientServicesTab({
  clientId,
  canManagePayments = false,
  canManageAgreements = false,
}: ClientServicesTabProps) {
  const { t } = useTranslation()
  const query = useClientPaidServices(clientId)
  const groups = query.data?.data ?? []
  const sections = [
    {
      id: 'paid-services-past-due',
      title: t('clientServices.section.pastDue'),
      description: t('clientServices.section.pastDueDescription'),
      icon: AlertTriangle,
      groups: groupsInSection(groups, 'pastDue'),
      attention: true,
    },
    {
      id: 'paid-services-active',
      title: t('clientServices.section.active'),
      icon: ShieldCheck,
      groups: groupsInSection(groups, 'active'),
    },
    {
      id: 'paid-services-paid',
      title: t('clientServices.section.paid'),
      icon: CheckCircle2,
      groups: groupsInSection(groups, 'paid'),
    },
    {
      id: 'paid-services-history',
      title: t('clientServices.section.history'),
      icon: Archive,
      groups: groupsInSection(groups, 'history'),
    },
  ]

  return (
    <CardSection
      title={t('clientServices.tabTitle')}
      icon={BriefcaseBusiness}
      bodyClassName="p-4 sm:p-6"
    >
      {query.isLoading ? (
        <PaidServicesLoading />
      ) : query.isError ? (
        <PaidServicesError onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-7">
          {query.data?.meta.isTruncated ? (
            <PaidServicesTruncated limit={query.data.meta.limit} />
          ) : null}
          {groups.length === 0 ? <PaidServicesEmpty /> : sections.map((section) => (
              <PaidServiceSection
                key={section.id}
                {...section}
                clientId={clientId}
                canManagePayments={canManagePayments}
                canManageAgreements={canManageAgreements}
              />
            ))}
        </div>
      )}
    </CardSection>
  )
}
