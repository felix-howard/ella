/**
 * Client Managed By - Shows and allows changing the managing staff member
 * Admin: custom dropdown with avatars to select/change manager
 * Member: read-only label
 */
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Users, Loader2, ChevronDown, Check } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useOrgRole } from '../../../hooks/use-org-role'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

interface ClientManagedByProps {
  clientId: string
  managedBy?: { id: string; name: string } | null
}

export function ClientAssignedStaff({ clientId, managedBy }: ClientManagedByProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isAdmin } = useOrgRole()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: membersData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isAdmin,
  })

  const members = membersData?.data ?? []

  const changeMutation = useMutation({
    mutationFn: (staffId: string) => api.clients.updateManagedBy(clientId, staffId),
    onSuccess: () => {
      toast.success(t('clientOverview.managedByUpdated'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => {
      toast.error(t('clientOverview.managedByUpdateFailed'))
    },
  })

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const selectedMember = members.find((m) => m.id === managedBy?.id)

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {t('clientOverview.managedBy')}
      </h3>

      {/* Admin: custom dropdown with avatars */}
      {isAdmin && members.length > 0 ? (
        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => !changeMutation.isPending && setIsOpen(!isOpen)}
            disabled={changeMutation.isPending}
            className={cn(
              'w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-left',
              'flex items-center justify-between',
              'focus:outline-none transition-colors',
              changeMutation.isPending && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="flex items-center gap-2">
              {selectedMember ? (
                <>
                  <StaffAvatar name={selectedMember.name} avatarUrl={selectedMember.avatarUrl} size="sm" />
                  <span className="text-sm">{selectedMember.name}</span>
                </>
              ) : managedBy ? (
                <>
                  <StaffAvatar name={managedBy.name} avatarUrl={null} size="sm" />
                  <span className="text-sm">{managedBy.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t('clientOverview.changeManagedBy')}</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              {changeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </span>
          </button>

          {isOpen && (
            <div className="absolute z-[9999] w-full mt-1 py-1 rounded-lg border bg-card border-border shadow-lg max-h-60 overflow-auto">
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                {t('clientOverview.changeManagedBy')}
              </div>
              {members.map((m) => {
                const isSelected = m.id === managedBy?.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!isSelected) changeMutation.mutate(m.id)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm',
                      'hover:bg-muted transition-colors',
                      'flex items-center justify-between',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <StaffAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                      <span className="text-foreground">{m.name}</span>
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // Non-admin: read-only display
        <div className="flex items-center gap-2">
          {managedBy ? (
            <>
              <StaffAvatar name={managedBy.name} avatarUrl={null} size="sm" />
              <span className="text-sm text-foreground">{managedBy.name}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">{t('clientOverview.noManagedBy')}</span>
          )}
        </div>
      )}
    </div>
  )
}

function StaffAvatar({ name, avatarUrl, size = 'sm' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  const avatarColor = getAvatarColor(name)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(sizeClass, 'rounded-full object-cover')}
      />
    )
  }

  return (
    <span className={cn(sizeClass, 'rounded-full flex items-center justify-center font-medium', avatarColor.bg, avatarColor.text)}>
      {getInitials(name)}
    </span>
  )
}
