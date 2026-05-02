/**
 * Wizard Step 2 — Template picker for the selected agreement type.
 * Lists org templates filtered by type, plus a "Start Blank" card.
 * NDA + CUSTOM bypass this step in the orchestrator (NDA uses built-in
 * template-v1, CUSTOM rejects templateId server-side).
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FilePlus, Loader2 } from 'lucide-react'
import { api } from '../../../lib/api-client'
import type {
  AgreementTemplate,
  AgreementTemplateType,
  AgreementType,
} from '../../../lib/api-client'

interface Props {
  type: AgreementType
  /** null → caller chose "Start Blank". */
  onSelect: (templateId: string | null) => void
}

export function Step2TemplatePicker({ type, onSelect }: Props) {
  const { t } = useTranslation()

  // CUSTOM is excluded at the orchestrator; cast safely for the templates query
  // since the server only allows template types from `AgreementTemplateType`.
  const templateType = type as AgreementTemplateType

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agreement-templates', 'list', templateType],
    queryFn: () => api.agreementTemplates.list({ type: templateType }),
    staleTime: 60_000,
  })

  const templates: AgreementTemplate[] = data?.data ?? []

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('agreements.wizard.step2Description')}
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
          {t('agreements.wizard.templatesLoadError')}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-left p-4 rounded-xl border border-dashed border-border bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <span className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-muted-foreground">
              <FilePlus className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {t('agreements.wizard.startBlank')}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {t('agreements.wizard.startBlankDescription')}
              </span>
            </span>
          </button>

          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <span className="block text-sm font-semibold text-foreground">
                {tpl.name}
              </span>
              {tpl.defaultDepositAmount && (
                <span className="block text-xs text-muted-foreground mt-1">
                  {t('agreements.wizard.defaultDeposit', {
                    amount: tpl.defaultDepositAmount,
                  })}
                </span>
              )}
            </button>
          ))}

          {templates.length === 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2 px-1">
              {t('agreements.wizard.noTemplatesForType')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
