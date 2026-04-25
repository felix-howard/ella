/**
 * Lead notes card — textarea with 500ms debounced auto-save.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useLeadNotesAutosave } from '../../../hooks/use-lead-notes-autosave'
import { CardSection } from '../../shared/card-section'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadNotesSection({ lead }: Props) {
  const { t } = useTranslation()
  const { notes, setNotes, isPending, isError } = useLeadNotesAutosave({
    leadId: lead.id,
    initialNotes: lead.notes ?? '',
  })

  const action = isPending ? (
    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  ) : isError ? (
    <span className="text-xs text-destructive">{t('leads.updateError')}</span>
  ) : null

  return (
    <CardSection title={t('leads.editNotes')} action={action}>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder={t('leads.notesPlaceholder')}
        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
    </CardSection>
  )
}
