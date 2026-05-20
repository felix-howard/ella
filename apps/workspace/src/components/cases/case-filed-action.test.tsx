import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CaseFiledAction, CaseFiledActionConfirmModal, IdentityRetentionExtendModal } from './case-filed-action'

const translations: Record<string, string> = {
  'clientDetail.extendRetention': 'Extend identity retention',
  'clientDetail.extendRetentionDays': '{{count}} days',
  'clientDetail.extendRetentionDesc': 'Choose how long to keep currently scheduled identity document storage files before deletion.',
  'clientDetail.extendRetentionNote': 'This delays deletion only for identity documents already scheduled for retention deletion.',
  'clientDetail.extendRetentionTitle': 'Extend identity retention',
  'clientDetail.markFiled': 'Mark return filed',
  'clientDetail.markFiledConfirm': 'Mark return filed',
  'clientDetail.markFiledConfirmDesc': 'Mark this tax return as filed.',
  'clientDetail.markFiledConfirmTitle': 'Mark return filed?',
  'clientDetail.markFiledMetadataNote': 'Database metadata and audit history remain available.',
  'clientDetail.markFiledRetentionNote': 'Identity documents will be scheduled for storage deletion after the retention window.',
  'clientDetail.reopen': 'Reopen filing',
  'clientDetail.reopenConfirm': 'Reopen filing',
  'clientDetail.reopenConfirmDesc': 'Reopen this filed tax return.',
  'clientDetail.reopenConfirmTitle': 'Reopen filing?',
  'clientDetail.reopenRetentionNote': 'Pending identity document deletion schedules will be cleared for documents not yet deleted.',
  'common.cancel': 'Cancel',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (translations[key] ?? key).replace('{{count}}', String(options?.count ?? '')),
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  ModalHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  ModalTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

describe('CaseFiledAction', () => {
  it('shows mark return filed for a non-review active case', () => {
    const markup = renderToStaticMarkup(
      <CaseFiledAction
        activeCase={{ id: 'case_1', isFiled: false, status: 'IN_PROGRESS', filedAt: null }}
        onMarkFiled={vi.fn()}
        onReopen={vi.fn()}
      />,
    )

    expect(markup).toContain('Mark return filed')
    expect(markup).not.toContain('Reopen filing')
  })

  it('shows reopen filing for a filed case', () => {
    const markup = renderToStaticMarkup(
      <CaseFiledAction
        activeCase={{ id: 'case_1', isFiled: true, status: 'FILED', filedAt: '2026-05-20T00:00:00.000Z' }}
        onMarkFiled={vi.fn()}
        onReopen={vi.fn()}
        canExtendIdentityRetention
        onExtendIdentityRetention={vi.fn()}
      />,
    )

    expect(markup).toContain('Reopen filing')
    expect(markup).toContain('Extend identity retention')
    expect(markup).not.toContain('Mark return filed')
  })

  it('treats filed status drift as filed for action visibility', () => {
    const markup = renderToStaticMarkup(
      <CaseFiledAction
        activeCase={{ id: 'case_1', isFiled: false, status: 'FILED', filedAt: null }}
        onMarkFiled={vi.fn()}
        onReopen={vi.fn()}
      />,
    )

    expect(markup).toContain('Reopen filing')
    expect(markup).not.toContain('Mark return filed')
  })

  it('confirmation explains identity retention and audit metadata', () => {
    const markup = renderToStaticMarkup(
      <CaseFiledActionConfirmModal
        action="mark-filed"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(markup).toContain('Identity documents will be scheduled for storage deletion')
    expect(markup).toContain('Database metadata and audit history remain available')
  })

  it('extend retention modal explains delayed deletion and offers day choices', () => {
    const markup = renderToStaticMarkup(
      <IdentityRetentionExtendModal
        open
        onCancel={vi.fn()}
        onExtend={vi.fn()}
      />,
    )

    expect(markup).toContain('Choose how long to keep currently scheduled identity document storage files')
    expect(markup).toContain('30 days')
    expect(markup).toContain('60 days')
    expect(markup).toContain('90 days')
    expect(markup).toContain('This delays deletion only for identity documents already scheduled')
  })
})
