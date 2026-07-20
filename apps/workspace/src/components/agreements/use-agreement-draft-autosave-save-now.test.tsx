// @vitest-environment happy-dom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agreement, SaveAgreementDraftPayload } from '../../lib/api-client'
import {
  useAgreementDraftAutosave,
  type AgreementDraftAutosaveState,
} from './use-agreement-draft-autosave'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  updateDraft: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock('./use-agreement-mutations', () => ({
  agreementsApi: () => ({ updateDraft: mocks.updateDraft }),
  useInvalidateAgreements: () => mocks.invalidate,
}))

interface CapturedAutosave {
  state: AgreementDraftAutosaveState
  saveNow: () => Promise<void>
  pause: () => void
}

let captured: CapturedAutosave | null = null
let root: ReturnType<typeof createRoot> | null = null

function Probe({
  payload,
  onSaved,
  onConflict,
  onCapture,
}: {
  payload: SaveAgreementDraftPayload
  onSaved: (agreement: Agreement) => void
  onConflict: (error: Error) => void
  onCapture: (autosave: CapturedAutosave) => void
}) {
  const autosave = useAgreementDraftAutosave({
    entity: { type: 'client', id: 'client-1' },
    draftAgreementId: 'draft-1',
    payload,
    updatedAt: '2026-07-15T01:00:00.000Z',
    enabled: true,
    onSaved,
    onConflict,
  })
  useEffect(() => {
    onCapture({ state: autosave.state, saveNow: autosave.saveNow, pause: autosave.pause })
  }, [autosave.pause, autosave.saveNow, autosave.state, onCapture])
  return <span>{autosave.state}</span>
}

const captureAutosave = (autosave: CapturedAutosave) => { captured = autosave }

const baseline: SaveAgreementDraftPayload = {
  type: 'ENGAGEMENT_LETTER',
  title: 'Engagement Letter',
  contentHtml: '<p>Original</p>',
  source: 'CALCULATOR',
}

beforeEach(() => {
  captured = null
  mocks.updateDraft.mockReset()
  mocks.invalidate.mockReset()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  document.body.replaceChildren()
})

describe('useAgreementDraftAutosave saveNow', () => {
  it('flushes current saved-draft changes before close can continue', async () => {
    const savedAgreement = {
      id: 'draft-1',
      updatedAt: '2026-07-15T01:01:00.000Z',
    } as Agreement
    mocks.updateDraft.mockResolvedValue({ data: savedAgreement })
    const onSaved = vi.fn()
    const onConflict = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <Probe
        payload={baseline}
        onSaved={onSaved}
        onConflict={onConflict}
        onCapture={captureAutosave}
      />,
    ))
    const edited = { ...baseline, contentHtml: '<p>Edited</p>' }
    await act(async () => root?.render(
      <Probe
        payload={edited}
        onSaved={onSaved}
        onConflict={onConflict}
        onCapture={captureAutosave}
      />,
    ))
    await act(async () => captured?.saveNow())

    expect(mocks.updateDraft).toHaveBeenCalledWith('client-1', 'draft-1', {
      ...edited,
      expectedUpdatedAt: '2026-07-15T01:00:00.000Z',
    })
    expect(onSaved).toHaveBeenCalledWith(savedAgreement)
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(captured?.state).toBe('saved')
  })

  it('rejects failed flushes and keeps the draft in a failed state', async () => {
    mocks.updateDraft.mockRejectedValue(new Error('network failed'))
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <Probe
        payload={baseline}
        onSaved={vi.fn()}
        onConflict={vi.fn()}
        onCapture={captureAutosave}
      />,
    ))
    await act(async () => root?.render(
      <Probe
        payload={{ ...baseline, title: 'Edited title' }}
        onSaved={vi.fn()}
        onConflict={vi.fn()}
        onCapture={captureAutosave}
      />,
    ))

    let saveError: unknown
    await act(async () => {
      try {
        await captured?.saveNow()
      } catch (error) {
        saveError = error
      }
    })
    expect(saveError).toEqual(new Error('network failed'))
    expect(captured?.state).toBe('failed')
  })

  it('stays saving when confirmation pauses an in-flight request', async () => {
    let resolveUpdate: ((value: { data: Agreement }) => void) | undefined
    const pendingUpdate = new Promise<{ data: Agreement }>((resolve) => {
      resolveUpdate = resolve
    })
    mocks.updateDraft.mockReturnValue(pendingUpdate)
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <Probe
        payload={baseline}
        onSaved={vi.fn()}
        onConflict={vi.fn()}
        onCapture={captureAutosave}
      />,
    ))
    await act(async () => root?.render(
      <Probe
        payload={{ ...baseline, title: 'Edited while saving' }}
        onSaved={vi.fn()}
        onConflict={vi.fn()}
        onCapture={captureAutosave}
      />,
    ))

    let saveRequest: Promise<void> | undefined
    await act(async () => {
      saveRequest = captured?.saveNow()
      await Promise.resolve()
    })
    expect(captured?.state).toBe('saving')

    await act(async () => captured?.pause())
    expect(captured?.state).toBe('saving')

    await act(async () => {
      resolveUpdate?.({
        data: {
          id: 'draft-1',
          updatedAt: '2026-07-15T01:02:00.000Z',
        } as Agreement,
      })
      await saveRequest
    })
    expect(captured?.state).toBe('saved')
  })
})
