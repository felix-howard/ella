import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountExecutiveAgreementGate } from '../account-executive-agreement-gate'

const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true },
  refetch: vi.fn(),
  status: {
    data: {
      required: false,
      hasAccepted: false,
      currentVersion: '2026.08.31',
      organizationName: 'Ella Tax Services LLC',
      signerName: 'Manager One',
    } as
      | {
          required: boolean
          hasAccepted: boolean
          currentVersion: string
          organizationName: string
          signerName: string
        }
      | undefined,
    isLoading: false,
    isError: false,
  },
}))

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

vi.mock('../use-account-executive-agreements', () => ({
  useAccountExecutiveAgreementStatus: () => ({
    ...mocks.status,
    refetch: mocks.refetch,
  }),
}))

vi.mock('../account-executive-agreement-modal', () => ({
  AccountExecutiveAgreementModal: ({
    companyName,
    signerName,
    version,
  }: {
    companyName: string
    signerName: string
    version: string
  }) => (
    <section
      data-testid="account-executive-modal"
      data-company-name={companyName}
      data-signer-name={signerName}
      data-version={version}
    >
      Account Executive Agreement
    </section>
  ),
}))

function defaultStatus() {
  return {
    data: {
      required: false,
      hasAccepted: false,
      currentVersion: '2026.08.31',
      organizationName: 'Ella Tax Services LLC',
      signerName: 'Manager One',
    },
    isLoading: false,
    isError: false,
  }
}

function renderGate() {
  return renderToStaticMarkup(
    <AccountExecutiveAgreementGate>
      <main>Workspace content</main>
    </AccountExecutiveAgreementGate>,
  )
}

describe('AccountExecutiveAgreementGate', () => {
  afterEach(() => {
    mocks.auth = { isLoaded: true, isSignedIn: true }
    mocks.status = defaultStatus()
    mocks.refetch.mockClear()
  })

  it('renders children when the signed-in staff member is not a manager', () => {
    const markup = renderGate()

    expect(markup).toContain('Workspace content')
    expect(markup).not.toContain('Account Executive Agreement')
  })

  it('renders children when the manager already accepted the current agreement', () => {
    mocks.status = {
      ...defaultStatus(),
      data: { ...defaultStatus().data, required: true, hasAccepted: true },
    }

    expect(renderGate()).toContain('Workspace content')
  })

  it('blocks workspace access with the agreement modal when acceptance is missing', () => {
    mocks.status = {
      ...defaultStatus(),
      data: { ...defaultStatus().data, required: true, hasAccepted: false },
    }

    const markup = renderGate()

    expect(markup).toContain('Account Executive Agreement')
    expect(markup).toContain('data-company-name="Ella Tax Services LLC"')
    expect(markup).toContain('data-signer-name="Manager One"')
    expect(markup).not.toContain('Workspace content')
  })

  it('fails closed when agreement status cannot be verified', () => {
    mocks.status = { data: undefined, isLoading: false, isError: true }

    const markup = renderGate()

    expect(markup).toContain('Unable to verify account executive agreement status')
    expect(markup).not.toContain('Workspace content')
  })
})
