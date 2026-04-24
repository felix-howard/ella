/**
 * Lead notes card — textarea with 500ms debounced auto-save.
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useLeadNotesAutosave } from '../../../hooks/use-lead-notes-autosave'
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

  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{t('leads.editNotes')}</h3>
          {isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {isError && (
          <span className="text-xs text-destructive">{t('leads.updateError')}</span>
        )}
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={t('leads.notesPlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </section>
  )
}
