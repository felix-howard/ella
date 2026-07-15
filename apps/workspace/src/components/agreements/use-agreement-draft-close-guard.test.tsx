// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Agreement } from '../../lib/api-client'
import {
  useAgreementDraftCloseGuard,
  type AgreementDraftCloseGuard,
} from './use-agreement-draft-close-guard'
import { emptyStep3Draft, type Step3Draft } from './wizard-steps/step3-content-editor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

interface ProbeProps {
  draft: Step3Draft
  savedAgreement?: Agreement | null
  autosaveState?: 'idle' | 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict'
  isBusy?: boolean
  externalDirty?: boolean
  onClose: () => void
  onRegister?: (guard: AgreementDraftCloseGuard | null) => void
}

function CloseGuardProbe({
  draft,
  savedAgreement = null,
  autosaveState = 'idle',
  isBusy = false,
  externalDirty = false,
  onClose,
  onRegister,
}: ProbeProps) {
  const [, forceRender] = useState(0)
  const guard = useAgreementDraftCloseGuard({
    draft,
    baselineDraft: emptyStep3Draft,
    hasExternalUnsavedChanges: externalDirty,
    isBusy,
    savedAgreement,
    autosaveState,
    onClose,
    registerCloseGuard: onRegister,
  })
  return (
    <div>
      <button data-action="request" onClick={guard.requestClose}>request</button>
      <button data-action="dismiss" onClick={guard.dismissConfirmation}>dismiss</button>
      <button data-action="continue" onClick={guard.continueWithoutSaving}>continue</button>
      <button data-action="render" onClick={() => forceRender((value) => value + 1)}>render</button>
      {guard.confirmationOpen && <span data-confirmation={guard.confirmationBusy}>confirm</span>}
    </div>
  )
}

const mountedRoots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = []

afterEach(async () => {
  await act(async () => mountedRoots.splice(0).forEach(({ root }) => root.unmount()))
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function renderProbe(props: ProbeProps) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push({ root, container })
  await act(async () => root.render(<CloseGuardProbe {...props} />))
  const click = async (action: string) => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click()
    })
  }
  return { container, click }
}

describe('useAgreementDraftCloseGuard', () => {
  it('closes a clean draft immediately without browser confirm', async () => {
    const onClose = vi.fn()
    const browserConfirm = vi.fn()
    vi.stubGlobal('confirm', browserConfirm)
    const { container, click } = await renderProbe({ draft: emptyStep3Draft, onClose })

    await click('request')

    expect(onClose).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-confirmation]')).toBeNull()
    expect(browserConfirm).not.toHaveBeenCalled()
  })

  it('keeps dirty content until the user explicitly leaves without saving', async () => {
    const onClose = vi.fn()
    const dirtyDraft = { ...emptyStep3Draft, titleOverride: 'Edited title' }
    const { container, click } = await renderProbe({ draft: dirtyDraft, onClose })

    await click('request')
    expect(container.querySelector('[data-confirmation]')).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    await click('dismiss')
    expect(container.querySelector('[data-confirmation]')).toBeNull()
    await click('request')
    await click('continue')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('preserves the first pending continuation while confirmation is open', async () => {
    let registeredGuard: AgreementDraftCloseGuard | null = null
    const first = vi.fn()
    const second = vi.fn()
    const { click } = await renderProbe({
      draft: { ...emptyStep3Draft, htmlOverride: '<p>Changed</p>' },
      onClose: vi.fn(),
      onRegister: (guard) => { registeredGuard = guard },
    })

    await act(async () => {
      registeredGuard?.(first)
      registeredGuard?.(second)
    })
    await click('continue')

    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  it('guards external changes, failed autosave, and busy operations', async () => {
    const savedAgreement = { id: 'draft-1' } as Agreement
    const external = await renderProbe({
      draft: emptyStep3Draft,
      savedAgreement,
      externalDirty: true,
      onClose: vi.fn(),
    })
    await external.click('request')
    expect(external.container.querySelector('[data-confirmation]')).not.toBeNull()

    const failed = await renderProbe({
      draft: emptyStep3Draft,
      savedAgreement,
      autosaveState: 'failed',
      isBusy: true,
      onClose: vi.fn(),
    })
    await failed.click('request')
    expect(failed.container.querySelector('[data-confirmation="true"]')).not.toBeNull()
  })
})
