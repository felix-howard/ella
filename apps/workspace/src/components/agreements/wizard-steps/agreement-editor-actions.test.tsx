import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AgreementEditorActions } from './agreement-editor-actions'

const labels: Record<string, string> = {
  'agreements.draft.reload': 'Reload draft',
  'agreements.draft.saveCta': 'Save draft',
  'agreements.draft.state.conflict': 'Save conflict',
  'agreements.draft.state.idle': 'Draft ready',
  'common.cancel': 'Cancel',
  'nda.editor.previewAndSend': 'Preview & Send',
}

function t(key: string): string {
  return labels[key] ?? key
}

describe('AgreementEditorActions', () => {
  it('surfaces conflict reload and disables preview send', () => {
    const markup = renderToStaticMarkup(
      <AgreementEditorActions
        canSubmit
        isSubmitting={false}
        isDraftSaved
        draftSaveState="conflict"
        draftMetadata="Last saved by Alex."
        conflictMessage="Another staff member updated this draft."
        sendBlockedReason="Reload the draft before sending."
        onOpenPreview={vi.fn()}
        onCancel={vi.fn()}
        onSaveDraft={vi.fn()}
        onReloadDraft={vi.fn()}
        t={t}
      />,
    )

    expect(markup).toContain('Another staff member updated this draft.')
    expect(markup).toContain('Reload draft')
    expect(markup).toContain('Save conflict')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('Reload the draft before sending.')
  })

  it('keeps first save available while blocking send for required draft flows', () => {
    const markup = renderToStaticMarkup(
      <AgreementEditorActions
        canSubmit
        isSubmitting={false}
        draftSaveState="idle"
        sendBlockedReason="Save the draft before previewing and sending."
        onOpenPreview={vi.fn()}
        onCancel={vi.fn()}
        onSaveDraft={vi.fn()}
        t={t}
      />,
    )

    expect(markup).toContain('Save draft')
    expect(markup).toContain('Preview &amp; Send')
    expect(markup).toContain('Save the draft before previewing and sending.')
    expect(markup).toContain('disabled=""')
  })
})
