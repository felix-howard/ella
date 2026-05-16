import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContractorAgreementGate } from '../contractor-agreement-gate'

const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true },
  user: { fullName: 'Agent One', firstName: 'Agent' },
  refetch: vi.fn(),
  status: {
    data: { required: false, hasAccepted: false, currentVersion: '2026.05.15' } as
      | { required: boolean; hasAccepted: boolean; currentVersion: string }
      | undefined,
    isLoading: false,
    isError: false,
  },
}))

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mocks.auth,
  useUser: () => ({ user: mocks.user }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

vi.mock('../use-contractor-agreements', () => ({
  useContractorAgreementStatus: () => ({
    ...mocks.status,
    refetch: mocks.refetch,
  }),
}))

vi.mock('../contractor-agreement-modal', () => ({
  ContractorAgreementModal: ({ staffName, version }: { staffName: string; version: string }) => (
    <section data-testid="contractor-modal" data-staff-name={staffName} data-version={version}>
      Independent Contractor Agreement
    </section>
  ),
}))

function renderGate() {
  return renderToStaticMarkup(
    <ContractorAgreementGate>
      <main>Workspace content</main>
    </ContractorAgreementGate>,
  )
}

describe('ContractorAgreementGate', () => {
  afterEach(() => {
    mocks.auth = { isLoaded: true, isSignedIn: true }
    mocks.user = { fullName: 'Agent One', firstName: 'Agent' }
    mocks.status = {
      data: { required: false, hasAccepted: false, currentVersion: '2026.05.15' },
      isLoading: false,
      isError: false,
    }
    mocks.refetch.mockClear()
  })

  it('renders children when the signed-in staff member is not a contractor agent', () => {
    const markup = renderGate()

    expect(markup).toContain('Workspace content')
    expect(markup).not.toContain('Independent Contractor Agreement')
  })

  it('renders children when the contractor agent already accepted the current agreement', () => {
    mocks.status = {
      data: { required: true, hasAccepted: true, currentVersion: '2026.05.15' },
      isLoading: false,
      isError: false,
    }

    expect(renderGate()).toContain('Workspace content')
  })

  it('blocks workspace access with the contractor agreement modal when acceptance is missing', () => {
    mocks.status = {
      data: { required: true, hasAccepted: false, currentVersion: '2026.05.15' },
      isLoading: false,
      isError: false,
    }

    const markup = renderGate()

    expect(markup).toContain('Independent Contractor Agreement')
    expect(markup).toContain('data-staff-name="Agent One"')
    expect(markup).not.toContain('Workspace content')
  })

  it('fails closed when contractor agreement status cannot be verified', () => {
    mocks.status = {
      data: undefined,
      isLoading: false,
      isError: true,
    }

    const markup = renderGate()

    expect(markup).toContain('Unable to verify contractor agreement status')
    expect(markup).not.toContain('Workspace content')
  })
})
