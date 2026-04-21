/**
 * RenameSectionInline - Inline title edit for shared doc section
 * Display text + pencil. On click, swaps to input with Save (Enter) / Cancel (Esc).
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button, Input, cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'

const TITLE_MAX = 100

interface RenameSectionInlineProps {
  title: string
  onSave: (newTitle: string) => Promise<unknown>
  isSaving?: boolean
  className?: string
}

export function RenameSectionInline({
  title,
  onSave,
  isSaving = false,
  className,
}: RenameSectionInlineProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const startEditing = useCallback(() => {
    setValue(title)
    setIsEditing(true)
  }, [title])

  const handleSave = useCallback(async () => {
    if (isSaving) return
    const trimmed = value.trim()
    if (!trimmed) {
      toast.error(t('sharedDocs.errorTitleRequired'))
      return
    }
    if (trimmed.length > TITLE_MAX) {
      toast.error(t('sharedDocs.errorTitleTooLong'))
      return
    }
    if (trimmed === title) {
      setIsEditing(false)
      return
    }
    try {
      await onSave(trimmed)
      toast.success(t('sharedDocs.renameSuccess'))
      setIsEditing(false)
    } catch {
      toast.error(t('sharedDocs.renameError'))
    }
  }, [value, title, onSave, t, isSaving])

  const handleCancel = useCallback(() => {
    setValue(title)
    setIsEditing(false)
  }, [title])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2 flex-1', className)}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={TITLE_MAX}
          disabled={isSaving}
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          aria-label={t('sharedDocs.saveRename')}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-emerald-500" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
          aria-label={t('sharedDocs.cancelRename')}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <h3 className="font-semibold text-lg text-foreground truncate">{title}</h3>
      <Button
        variant="ghost"
        size="sm"
        onClick={startEditing}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={t('sharedDocs.renameSection')}
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}
