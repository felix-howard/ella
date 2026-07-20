// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agreement } from '../../lib/api-client'
import { NdaList } from './agreement-list'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('./agreement-card', () => ({
  NdaCard: ({ nda }: { nda: Agreement }) => <div>{nda.title}</div>,
}))

const agreements = [
  {
    id: 'agreement_1',
    title: 'First agreement',
    status: 'SIGNED',
    updatedAt: '2026-07-19T10:00:00.000Z',
  },
  {
    id: 'agreement_2',
    title: 'Focused agreement',
    status: 'SIGNED',
    updatedAt: '2026-07-19T11:00:00.000Z',
  },
] as Agreement[]

let root: ReturnType<typeof createRoot> | null = null
let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function renderList(focusedAgreementId: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <NdaList
        entity={{ type: 'client', id: 'client_1' }}
        ndas={agreements}
        isLoading={false}
        isError={false}
        focusedAgreementId={focusedAgreementId}
      />,
    )
  })
  return container
}

describe('NdaList service deep-link focus', () => {
  it('focuses, scrolls to, and outlines the exact agreement', async () => {
    const container = await renderList('agreement_2')
    const target = container.querySelector<HTMLElement>('[data-agreement-id="agreement_2"]')

    expect(target?.dataset.focusedAgreement).toBe('true')
    expect(target?.className).toContain('ring-2 ring-primary ring-offset-2')
    expect(document.activeElement).toBe(target)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(container.querySelectorAll('[data-focused-agreement="true"]')).toHaveLength(1)
  })

  it('does not focus or scroll when the agreement id is stale', async () => {
    const container = await renderList('agreement_missing')

    expect(container.querySelector('[data-focused-agreement]')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('uses instant scrolling when reduced motion is requested', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)

    await renderList('agreement_1')

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })
})
