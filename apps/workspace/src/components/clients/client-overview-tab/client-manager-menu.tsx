import { Check } from 'lucide-react'
import { cn } from '@ella/ui'
import type { StaffManagerSummary } from '../../../lib/api-client'
import { StaffAvatar } from './client-manager-display'

interface ClientManagerMenuProps {
  members: StaffManagerSummary[]
  unavailableAssignedStaff: StaffManagerSummary[]
  selectedStaffIds: string[]
  archivedLabel: string
  changeManagedByLabel: string
  isPending: boolean
  onToggle: (staffId: string) => void
}

export function ClientManagerMenu({
  members,
  unavailableAssignedStaff,
  selectedStaffIds,
  archivedLabel,
  changeManagedByLabel,
  isPending,
  onToggle,
}: ClientManagerMenuProps) {
  return (
    <div
      id="client-manager-menu"
      role="menu"
      className="absolute z-[9999] w-full mt-1 py-1 rounded-lg border bg-card border-border shadow-lg max-h-60 overflow-auto"
    >
      <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
        {changeManagedByLabel}
      </div>
      {unavailableAssignedStaff.map((member) => {
        const isSelected = selectedStaffIds.includes(member.id)
        if (!isSelected) return null

        return (
          <ManagerMenuButton
            key={member.id}
            member={member}
            isSelected
            isPending={isPending}
            archivedLabel={archivedLabel}
            onToggle={onToggle}
            variant="archived"
          />
        )
      })}
      {unavailableAssignedStaff.length > 0 && <div className="my-1 border-t border-border" />}
      {members.map((member) => (
        <ManagerMenuButton
          key={member.id}
          member={member}
          isSelected={selectedStaffIds.includes(member.id)}
          isPending={isPending}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

function ManagerMenuButton({
  member,
  isSelected,
  isPending,
  archivedLabel,
  variant = 'active',
  onToggle,
}: {
  member: StaffManagerSummary
  isSelected: boolean
  isPending: boolean
  archivedLabel?: string
  variant?: 'active' | 'archived'
  onToggle: (staffId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!isPending) onToggle(member.id)
      }}
      disabled={isPending}
      role="menuitemcheckbox"
      aria-checked={isSelected}
      className={cn(
        'w-full px-3 py-2 text-left text-sm',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary transition-colors',
        'flex items-center justify-between gap-2',
        variant === 'archived' ? 'bg-amber-50 text-amber-900' : isSelected && 'bg-primary/10',
        isPending && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <StaffAvatar name={member.name} avatarUrl={member.avatarUrl ?? null} size="sm" />
        <span className={cn('truncate', variant === 'active' && 'text-foreground')}>
          {member.name}
        </span>
        {variant === 'archived' && archivedLabel && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium">
            {archivedLabel}
          </span>
        )}
      </span>
      {isSelected && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
    </button>
  )
}
