import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { StaffFileListItem } from '../../lib/api-client'

interface StaffFileActionMenuProps {
  file: StaffFileListItem
  canDelete: boolean
  isDeleting?: boolean
  onOpenInNewTab: (file: StaffFileListItem) => void
  onDownload: (file: StaffFileListItem) => void
  onRename: (file: StaffFileListItem) => void
  onDelete: (file: StaffFileListItem) => void
}

export function StaffFileActionMenu({
  file,
  canDelete,
  isDeleting,
  onOpenInNewTab,
  onDownload,
  onRename,
  onDelete,
}: StaffFileActionMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = 220
    const height = canDelete ? 188 : 144
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
    let top = rect.bottom + 6
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6)
    setPosition({ top, left })
  }, [canDelete, open])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const runAction = (action: (file: StaffFileListItem) => void) => {
    setOpen(false)
    action(file)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('common.actions', 'Actions')}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-[220px] overflow-hidden rounded-xl border border-border bg-card py-2 shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <MenuButton icon={ExternalLink} label={t('fileActions.openInNewTab')} onClick={() => runAction(onOpenInNewTab)} />
          <MenuButton icon={Download} label={t('profile.staffFiles.download')} onClick={() => runAction(onDownload)} />
          <MenuButton icon={Pencil} label={t('fileActions.rename')} onClick={() => runAction(onRename)} />
          {canDelete && (
            <>
              <div className="my-1 border-t border-border" />
              <MenuButton
                icon={Trash2}
                label={t('profile.staffFiles.delete')}
                destructive
                onClick={() => runAction(onDelete)}
              />
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

type MenuButtonProps = {
  icon: ComponentType<{ className?: string }>
  label: string
  destructive?: boolean
  onClick: () => void
}

function MenuButton({ icon: Icon, label, destructive, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted',
        destructive ? 'text-destructive' : 'text-foreground'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      {label}
    </button>
  )
}
