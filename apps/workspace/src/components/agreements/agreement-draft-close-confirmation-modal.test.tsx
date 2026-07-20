// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '@ella/ui'
import { AgreementDraftCloseConfirmationModal } from './agreement-draft-close-confirmation-modal'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'agreements.draft.closeConfirmation.title': 'Save draft before closing?',
      'agreements.draft.closeConfirmation.description': 'Save changes before leaving.',
      'agreements.draft.closeConfirmation.busyDescription': 'Saving is still running.',
      'agreements.draft.closeConfirmation.invalidHint': 'Resolve required fields first.',
      'agreements.draft.closeConfirmation.dontSave': "Don't save draft",
      'agreements.draft.closeConfirmation.save': 'Save draft',
      'common.close': 'Close',
    })[key] ?? key,
  }),
}))

let root: ReturnType<typeof createRoot> | null = null

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  document.body.replaceChildren()
  document.body.style.overflow = ''
})

async function renderConfirmation(overrides: {
  savePending?: boolean
  canSave?: boolean
  onCancel?: () => void
  onSave?: () => void
  onDiscard?: () => void
} = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const props = {
    open: true,
    savePending: false,
    canSave: true,
    onCancel: vi.fn(),
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  }
  await act(async () => {
    root?.render(<AgreementDraftCloseConfirmationModal {...props} />)
  })
  return props
}

describe('AgreementDraftCloseConfirmationModal', () => {
  it('shows explicit save and do-not-save actions above the editor layer', async () => {
    const props = await renderConfirmation()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const buttons = Array.from(document.querySelectorAll('button'))

    expect(dialog?.textContent).toContain('Save draft before closing?')
    expect(dialog?.className).toContain('z-[10020]')
    expect(document.querySelector('[aria-label="Close"]')).not.toBeNull()
    expect(buttons.some((button) => button.textContent?.includes('Save draft'))).toBe(true)
    expect(buttons.some((button) => button.textContent?.includes("Don't save draft"))).toBe(true)

    await act(async () => buttons.find((button) => button.textContent?.includes('Save draft'))?.click())
    await act(async () => buttons.find((button) => button.textContent?.includes("Don't save draft"))?.click())
    expect(props.onSave).toHaveBeenCalledOnce()
    expect(props.onDiscard).toHaveBeenCalledOnce()
  })

  it('treats confirmation backdrop and Escape as keep editing', async () => {
    const props = await renderConfirmation()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')

    await act(async () => dialog?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))

    expect(props.onCancel).toHaveBeenCalledTimes(2)
    expect(props.onSave).not.toHaveBeenCalled()
    expect(props.onDiscard).not.toHaveBeenCalled()
  })

  it('blocks all leave choices while a save is pending', async () => {
    const props = await renderConfirmation({ savePending: true })
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const actionButtons = Array.from(document.querySelectorAll('button'))

    expect(dialog?.textContent).toContain('Saving is still running.')
    expect(actionButtons.every((button) => button.disabled)).toBe(true)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('preserves an underlying modal body-scroll lock when it unmounts', async () => {
    document.body.style.overflow = 'hidden'
    await renderConfirmation()

    await act(async () => root?.unmount())
    root = null

    expect(document.body.style.overflow).toBe('hidden')
  })

  it('releases body scroll when a nested modal tree unmounts together', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <Modal open onClose={vi.fn()}>
        <AgreementDraftCloseConfirmationModal
          open
          savePending={false}
          canSave
          onCancel={vi.fn()}
          onSave={vi.fn()}
          onDiscard={vi.fn()}
        />
      </Modal>,
    ))
    expect(document.body.style.overflow).toBe('hidden')

    await act(async () => root?.unmount())
    root = null

    expect(document.body.style.overflow).toBe('')
  })
})
