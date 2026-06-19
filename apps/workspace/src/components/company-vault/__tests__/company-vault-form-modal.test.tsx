import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CompanyVaultCredential } from '../../../lib/api-client'
import { CompanyVaultFormModal } from '../company-vault-form-modal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'common.cancel': 'Cancel',
        'companyVault.addTitle': 'Add credential',
        'companyVault.createCredential': 'Add credential',
        'companyVault.editTitle': 'Edit credential',
        'companyVault.formDescription': 'Tool name is required. Username, password, and note can be blank.',
        'companyVault.note': 'Note',
        'companyVault.notePlaceholder': 'Add usage notes or recovery instructions',
        'companyVault.password': 'Password',
        'companyVault.passwordPlaceholder': 'Optional password',
        'companyVault.saveChanges': 'Save changes',
        'companyVault.toolName': 'Tool',
        'companyVault.toolNamePlaceholder': 'Drake, IRS e-Services, TaxBandits',
        'companyVault.toolNameRequired': 'Tool name is required',
        'companyVault.username': 'Username',
        'companyVault.usernamePlaceholder': 'Optional username',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  ModalHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  ModalTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
}))

function credential(overrides: Partial<CompanyVaultCredential> = {}): CompanyVaultCredential {
  return {
    id: 'cred_1',
    toolName: 'TaxDome',
    username: 'staff@example.com',
    password: 'secret-password',
    note: 'Office login',
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    ...overrides,
  }
}

describe('CompanyVaultFormModal', () => {
  it('does not render when closed', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultFormModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    )

    expect(markup).toBe('')
  })

  it('renders an empty add form with submit disabled until a tool name exists', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultFormModal open onClose={vi.fn()} onSubmit={vi.fn()} />
    )

    expect(markup).toContain('Add credential')
    expect(markup).toContain('Tool name is required. Username, password, and note can be blank.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Add credential<\/button>/)
  })

  it('renders edit form values and save action', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultFormModal
        open
        credential={credential()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    )

    expect(markup).toContain('Edit credential')
    expect(markup).toContain('value="TaxDome"')
    expect(markup).toContain('value="staff@example.com"')
    expect(markup).toContain('value="secret-password"')
    expect(markup).toContain('Office login')
    expect(markup).toContain('Save changes')
  })
})
