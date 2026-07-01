import { useMemo, useState, type ChangeEvent } from 'react'
import { Button, Select } from '@ella/ui'
import { FileText, Loader2, Save } from 'lucide-react'
import type { PaymentTemplatePayload, PaymentTemplateSummary } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'
import { draftsToTemplatePayload } from '../custom-link-template-conversion'
import { formatCents, type CustomItemDraft } from '../custom-link-types'
import { PaymentTemplateSaveModal } from './payment-template-save-modal'
import { useCreatePaymentTemplate, usePaymentTemplates } from './use-payment-templates'

interface PaymentTemplatePanelProps {
  items: CustomItemDraft[]
  disabledReason: string | null
  onLoadTemplate: (template: PaymentTemplatePayload) => void
}

export function PaymentTemplatePanel({
  items,
  disabledReason,
  onLoadTemplate,
}: PaymentTemplatePanelProps) {
  const [selectedId, setSelectedId] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const { templates, loading, error } = usePaymentTemplates()
  const createTemplate = useCreatePaymentTemplate()
  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? null
  const templatePayload = useMemo(() => draftsToTemplatePayload(items), [items])
  const saveDisabled = Boolean(disabledReason) || !templatePayload || createTemplate.isPending

  const handleTemplateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextSelectedId = event.target.value
    setSelectedId(nextSelectedId)
    const template = templates.find((template) => template.id === nextSelectedId)
    if (!template) return
    onLoadTemplate(template.template)
    toast.success(`${template.name} loaded. You can edit before sending.`)
  }

  const handleSave = async (input: { name: string; description?: string }) => {
    const template = draftsToTemplatePayload(items)
    if (!template) throw new Error(disabledReason ?? 'Fix line items before saving.')
    await createTemplate.mutateAsync({ ...input, template })
    toast.success('Payment template saved')
    setSaveOpen(false)
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby="payment-templates-title"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="payment-templates-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <FileText className="h-4 w-4 text-primary" />
            Payment templates
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a saved setup to replace the rows below, or save the current rows for reuse.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setSaveOpen(true)}
          disabled={saveDisabled}
        >
          {createTemplate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save as template
        </Button>
      </header>

      <div className="mt-3">
        <Select
          value={selectedId}
          onChange={handleTemplateChange}
          disabled={loading || templates.length === 0}
          placeholder={loading ? 'Loading templates...' : 'Choose template to load...'}
          options={templates.map(templateOption)}
          aria-label="Choose a payment template to load"
        />
      </div>

      <p className="mt-2 min-h-4 text-xs text-muted-foreground" role="status">
        {error ? (
          <span className="text-error">Could not load templates. {error.message}</span>
        ) : selectedTemplate ? (
          <TemplateSummary template={selectedTemplate} />
        ) : templates.length === 0 && !loading ? (
          'No templates saved yet.'
        ) : (
          disabledReason ?? 'Selecting a template replaces the current line items.'
        )}
      </p>

      <PaymentTemplateSaveModal
        open={saveOpen}
        isPending={createTemplate.isPending}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
      />
    </section>
  )
}

function templateOption(template: PaymentTemplateSummary) {
  return {
    value: template.id,
    label: `${template.name} (${template.itemCount} item${template.itemCount === 1 ? '' : 's'})`,
  }
}

function TemplateSummary({ template }: { template: PaymentTemplateSummary }) {
  return (
    <>
      Loaded {template.name}: {template.itemCount} item{template.itemCount === 1 ? '' : 's'} -{' '}
      {formatCents(template.totalCents)}
    </>
  )
}
