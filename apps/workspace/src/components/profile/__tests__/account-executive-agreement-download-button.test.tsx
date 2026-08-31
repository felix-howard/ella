import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountExecutiveAgreementDownloadButton } from '../account-executive-agreement-download-button'

const mocks = vi.hoisted(() => ({
  queryResult: {
    data: undefined as unknown,
    isLoading: false,
    error: null as Error | null,
  },
  useQuery: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) => {
      if (!values) return fallback
      return Object.entries(values).reduce(
        (text, [key, value]) => text.replace(`{{${key}}}`, value),
        fallback,
      )
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>{children}</button>
  ),
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('../../../lib/api-client', () => {
  class ApiError extends Error {
    status: number
    code?: string

    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }

  return {
    ApiError,
    api: {
      accountExecutiveAgreements: {
        getAcceptance: vi.fn(),
        getDownloadUrl: vi.fn(),
      },
    },
  }
})

function renderButton(
  props: Partial<React.ComponentProps<typeof AccountExecutiveAgreementDownloadButton>> = {},
) {
  return renderToStaticMarkup(
    <AccountExecutiveAgreementDownloadButton staffId="staff-1" isManager canViewAgreement {...props} />,
  )
}

describe('AccountExecutiveAgreementDownloadButton', () => {
  beforeEach(() => {
    mocks.queryResult = { data: undefined, isLoading: false, error: null }
    mocks.useQuery.mockReset()
    mocks.useQuery.mockImplementation(() => mocks.queryResult)
  })

  it('does not query acceptance status when the staff member is not a manager', () => {
    mocks.useQuery.mockImplementation((options: { enabled?: boolean }) => {
      expect(options.enabled).toBe(false)
      return mocks.queryResult
    })

    const markup = renderButton({ isManager: false })

    expect(markup).toContain('Not required')
  })

  it('shows the not-signed state when the current agreement is missing', async () => {
    const { ApiError } = await import('../../../lib/api-client')
    mocks.queryResult = {
      data: undefined,
      isLoading: false,
      error: new ApiError(404, 'NOT_ACCEPTED', 'No acceptance'),
    }
    mocks.useQuery.mockImplementation(() => mocks.queryResult)

    expect(renderButton()).toContain('Required - not signed')
  })

  it('shows signed agreement metadata when acceptance exists', () => {
    mocks.queryResult = {
      data: {
        id: 'acceptance-1',
        version: '2026.08.31',
        signedAt: '2026-08-31T00:00:00.000Z',
        signerName: 'Manager One',
        signerEmail: 'manager@test.com',
      },
      isLoading: false,
      error: null,
    }
    mocks.useQuery.mockImplementation(() => mocks.queryResult)

    const markup = renderButton()

    expect(markup).toContain('Signed Account Executive Agreement')
    expect(markup).toContain('Version 2026.08.31')
    expect(markup).toContain('Download')
  })

  it('shows restricted state before querying when viewer cannot access the agreement', () => {
    const markup = renderButton({ canViewAgreement: false })

    expect(markup).toContain('Visible to member or admin only')
    expect(mocks.useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
  })
})
