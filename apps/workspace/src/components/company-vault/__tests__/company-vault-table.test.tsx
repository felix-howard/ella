import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CompanyVaultCredential } from '../../../lib/api-client'
import { CompanyVaultTable } from '../company-vault-table'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  arrayMove: <T,>(items: T[], oldIndex: number, newIndex: number) => {
    const next = [...items]
    const [item] = next.splice(oldIndex, 1)
    if (item) next.splice(newIndex, 0, item)
    return next
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => '',
    },
  },
}))

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
        'companyVault.dragHandle': 'Drag to reorder',
        'companyVault.editCredential': `Edit ${vars?.toolName ?? ''}`,
        'companyVault.note': 'Note',
        'companyVault.password': 'Password',
        'companyVault.passwordCopied': 'Password copied',
        'companyVault.reorder': 'Reorder',
        'companyVault.reorderDisabled': 'Reordering is disabled',
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
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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
    sortOrder: 10,
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

  it('wraps full notes instead of applying truncate styling', () => {
    const markup = renderToStaticMarkup(
      <CompanyVaultTable
        credentials={[credential({
          note: 'Use Google Authenticate for 2 step verification before login',
        })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
      />
    )

    expect(markup).toContain('Use Google Authenticate for 2 step verification before login')
    expect(markup).toContain('whitespace-pre-wrap')
    expect(markup).not.toContain('block truncate text-sm text-muted-foreground')
  })
})
