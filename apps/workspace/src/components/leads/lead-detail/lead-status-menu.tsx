/**
 * Compact lead status menu for the detail header.
 * Keeps the current status visible where users scan the lead identity.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { LeadStatusBadge } from '../lead-status-badge'
import type { Lead, LeadStatus } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'SENT', 'CONTACTED', 'LOST']

export function LeadStatusMenu({ lead }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isConverted = lead.status === 'CONVERTED'

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const statusMutation = useMutation({
    mutationFn: (status: LeadStatus) => api.leads.update(lead.id, { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: ['lead', lead.id] })
      const previous = queryClient.getQueryData<{ data: Lead }>(['lead', lead.id])

      queryClient.setQueryData(['lead', lead.id], (old: { data: Lead } | undefined) =>
        old ? { ...old, data: { ...old.data, status } } : old,
      )
      queryClient.setQueriesData(
        { queryKey: ['leads'] },
        (old: { data: Lead[] } | undefined) =>
          old?.data
            ? { ...old, data: old.data.map((item) => (item.id === lead.id ? { ...item, status } : item)) }
            : old,
      )

      return { previous }
    },
    onError: (_err, _status, context) => {
      if (context?.previous) queryClient.setQueryData(['lead', lead.id], context.previous)
      toast.error(t('leads.updateError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const handleSelect = (status: LeadStatus) => {
    setIsOpen(false)
    if (status === lead.status || statusMutation.isPending) return
    statusMutation.mutate(status)
  }

  if (isConverted) {
    return <LeadStatusBadge status={lead.status} />
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        disabled={statusMutation.isPending}
        className={cn(
          'inline-flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/30',
          'disabled:cursor-wait disabled:opacity-70',
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t('leads.changeStatus')}
      >
        <LeadStatusBadge status={lead.status} />
        {statusMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 z-[9999] mt-1 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {STATUS_OPTIONS.map((status) => {
            const active = lead.status === status

            return (
              <button
                key={status}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => handleSelect(status)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  active && 'bg-muted/70 font-medium',
                )}
              >
                <LeadStatusBadge status={status} variant="dot" />
                {active && <Check className="h-4 w-4 text-muted-foreground" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
