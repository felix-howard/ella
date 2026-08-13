import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type * as ReactI18next from 'react-i18next'
import type { StaffProfile } from '../../../lib/api-client'
import { parseStaffDriveEmailsInput, ProfileForm } from '../profile-form'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18next>()

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: Record<string, unknown>) => {
        if (key === 'profile.driveEmailsFallback') return `Using login email: ${values?.email}`
        return key
      },
    }),
  }
})

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../agreements/use-nda-readiness', () => ({
  useInvalidateNdaReadiness: () => vi.fn(),
}))

vi.mock('../notification-subscriptions', () => ({
  NotificationSubscriptions: () => <div>notification-subscriptions</div>,
}))

vi.mock('../terms-download-button', () => ({
  TermsDownloadButton: () => <div>terms-download-button</div>,
}))

vi.mock('../contractor-agreement-download-button', () => ({
  ContractorAgreementDownloadButton: () => <div>contractor-agreement-download-button</div>,
}))

function staff(overrides: Partial<StaffProfile> = {}): StaffProfile {
  return {
    id: 'staff-1',
    name: 'Ada Admin',
    firstName: 'Ada',
    lastName: 'Admin',
    email: 'ada@example.com',
    driveEmails: [],
    role: 'ADMIN',
    isContractorAgent: false,
    avatarUrl: null,
    phoneNumber: null,
    title: null,
    notifyOnUpload: false,
    notifyOnChat: false,
    notifyOnAgreementSigned: false,
    notifyOnClientPayment: false,
    notifyOnPaymentFailed: false,
    formSlug: null,
    autoSendUploadLink: false,
    defaultUploadLinkTemplateId: null,
    useOrgUploadLinkDefaults: true,
    defaultUploadLinkLanguage: null,
    paymentInfos: [],
    ...overrides,
  }
}

function renderProfileForm(member: StaffProfile) {
  const queryClient = new QueryClient()

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ProfileForm
        staff={member}
        canEdit
        staffId={member.id}
        canChangeRole={false}
      />
    </QueryClientProvider>
  )
}

describe('ProfileForm Drive emails', () => {
  it('normalizes comma, semicolon, and newline separated Drive emails', () => {
    expect(parseStaffDriveEmailsInput(' Drive@Example.COM ; drive@example.com\nOther@Example.com ')).toEqual({
      emails: ['drive@example.com', 'other@example.com'],
      invalidEmails: [],
      tooMany: false,
    })
  })

  it('reports invalid Drive email entries', () => {
    expect(parseStaffDriveEmailsInput('ok@example.com, not-an-email')).toEqual({
      emails: ['ok@example.com'],
      invalidEmails: ['not-an-email'],
      tooMany: false,
    })
  })

  it('reports too many Drive email entries', () => {
    expect(parseStaffDriveEmailsInput(
      Array.from({ length: 21 }, (_, index) => `drive-${index}@example.com`).join('\n')
    )).toMatchObject({
      invalidEmails: [],
      tooMany: true,
    })
  })

  it('shows login email fallback when Drive emails are blank', () => {
    const markup = renderProfileForm(staff())

    expect(markup).toContain('profile.driveEmails')
    expect(markup).toContain('Using login email: ada@example.com')
  })

  it('shows saved Drive emails when configured', () => {
    const markup = renderProfileForm(staff({ driveEmails: ['drive@example.com', 'other@example.com'] }))

    expect(markup).toContain('drive@example.com')
    expect(markup).toContain('other@example.com')
    expect(markup).not.toContain('Using login email')
  })
})
