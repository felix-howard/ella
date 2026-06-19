import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CompanyVaultCredential } from '../../../lib/api-client'
import { CompanyVaultTable } from '../company-vault-table'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      const labels: Record<string, string> = {
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'companyVault.actions': 'Actions',
        'companyVault.copyPassword': 'Copy password',
        'companyVault.copyUsername': 'Copy username',
        'companyVault.deleteCredential': `Delete ${vars?.toolName ?? ''}`,
        'companyVault.editCredential': `Edit ${vars?.toolName ?? ''}`,
        'companyVault.note': 'Note',
        'companyVault.password': 'Password',
        'companyVault.passwordCopied': 'Password copied',
        'companyVault.toolName': 'Tool',
        'companyVault.username': 'Username',
        'companyVault.usernameCopied': 'Username copied',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('../../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
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

describe('CompanyVaultTable', () => {
  it('renders credentials with copy, edit, and delete actions', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultTable credentials={[credential()]} onEdit={vi.fn()} onDelete={vi.fn()} />
    )

    expect(markup).toContain('TaxDome')
    expect(markup).toContain('staff@example.com')
    expect(markup).toContain('secret-password')
    expect(markup).toContain('Office login')
    expect(markup).toContain('aria-label="Copy username"')
    expect(markup).toContain('aria-label="Copy password"')
    expect(markup).toContain('aria-label="Edit TaxDome"')
    expect(markup).toContain('aria-label="Delete TaxDome"')
  })

  it('hides copy buttons and shows placeholders for empty optional fields', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultTable
        credentials={[credential({ username: null, password: null, note: null })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(markup).not.toContain('aria-label="Copy username"')
    expect(markup).not.toContain('aria-label="Copy password"')
    expect(markup.match(/>-\s*</g)).toHaveLength(3)
  })
})
