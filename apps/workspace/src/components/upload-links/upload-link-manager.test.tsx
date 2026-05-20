import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { UploadLinkData } from '../../lib/api-client'
import { UploadLinkManager } from './upload-link-manager'

const mutate = vi.fn()
const invalidateQueries = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { data: [activeLink()] },
    isLoading: false,
    isError: false,
  }),
  useMutation: () => ({
    mutate,
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'uploadLinks.daysLeft') return `(${values?.days} days left)`
      if (key === 'uploadLinks.expiresOn') return `Expires ${values?.date}`
      if (key === 'uploadLinks.usageCount') return `${values?.count} uses`
      return key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  ModalHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  ModalTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../lib/api-client', () => ({
  api: {
    uploadLinks: {
      listForCase: vi.fn(),
      revoke: vi.fn(),
      extend: vi.fn(),
      generate: vi.fn(),
    },
  },
}))

vi.mock('../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function activeLink(overrides: Partial<UploadLinkData> = {}): UploadLinkData {
  return {
    id: 'link_1',
    status: 'ACTIVE',
    url: 'https://portal.test/upload/abc123',
    scope: 'CASE',
    clientGroupId: null,
    expiresAt: '2026-05-25T00:00:00.000Z',
    revokedAt: null,
    extendedAt: null,
    lastUsedAt: null,
    usageCount: 2,
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  }
}

describe('UploadLinkManager', () => {
  it('renders active link controls without a separate token field', () => {
    const markup = renderToStaticMarkup(
      <UploadLinkManager caseId="case_1" clientId="client_1" onSendSms={vi.fn()} />,
    )

    expect(markup).toContain('https://portal.test/upload/abc123')
    expect(markup).toContain('uploadLinks.open')
    expect(markup).toContain('uploadLinks.resendSms')
    expect(markup).toContain('uploadLinks.revoke')
    expect(markup).not.toContain('Token')
  })
})
