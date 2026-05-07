/**
 * Unit tests for org-level agreement template CRUD operations.
 *
 * Covers happy path for each op (create, list, get, update, archive,
 * unarchive), HTML sanitization at write boundary, the TOCTOU-safe
 * updateMany pattern, and cross-org isolation (other-org access → 404).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    agreementTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../../lib/db'
import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  archiveTemplate,
  unarchiveTemplate,
} from '../template-ops'

const mockCreate = vi.mocked(prisma.agreementTemplate.create)
const mockFindFirst = vi.mocked(prisma.agreementTemplate.findFirst)
const mockFindMany = vi.mocked(prisma.agreementTemplate.findMany)
const mockFindUnique = vi.mocked(prisma.agreementTemplate.findUnique)
const mockUpdateMany = vi.mocked(prisma.agreementTemplate.updateMany)

function tpl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    organizationId: 'org-1',
    createdByUserId: 'staff-1',
    name: 'Standard Engagement Letter',
    type: 'ENGAGEMENT_LETTER',
    contentHtml: '<p>Engagement scope</p>',
    defaultDepositAmount: null,
    isArchived: false,
    createdAt: new Date('2026-04-25T00:00:00Z'),
    updatedAt: new Date('2026-04-25T00:00:00Z'),
    ...overrides,
  }
}

describe('Agreement template ops', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTemplate', () => {
    it('sanitizes contentHtml and persists with org + creator scopes', async () => {
      mockCreate.mockResolvedValueOnce(tpl() as any)

      await createTemplate({
        orgId: 'org-1',
        staffId: 'staff-1',
        name: '  Standard Engagement Letter  ',
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Engagement scope</p><script>alert(1)</script>',
      })

      const data = (mockCreate.mock.calls[0][0] as any).data
      // Trim applied to name.
      expect(data.name).toBe('Standard Engagement Letter')
      // Sanitize stripped <script>; <p> survived.
      expect(data.contentHtml).toContain('<p>Engagement scope</p>')
      expect(data.contentHtml).not.toContain('<script>')
      expect(data.organizationId).toBe('org-1')
      expect(data.createdByUserId).toBe('staff-1')
      expect(data.type).toBe('ENGAGEMENT_LETTER')
      expect(data.defaultDepositAmount).toBeNull()
    })

    it('throws 422 when contentHtml is empty after sanitization', async () => {
      await expect(
        createTemplate({
          orgId: 'org-1',
          staffId: 'staff-1',
          name: 'Empty body',
          type: 'NDA',
          // Only disallowed tags → sanitizer strips → empty string.
          contentHtml: '<script>x</script><iframe src="evil"></iframe>',
        }),
      ).rejects.toMatchObject({ status: 422 })
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('persists defaultDepositAmount when supplied', async () => {
      mockCreate.mockResolvedValueOnce(tpl({ defaultDepositAmount: '500.00' }) as any)

      await createTemplate({
        orgId: 'org-1',
        staffId: 'staff-1',
        name: 'EL with deposit',
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>EL</p>',
        defaultDepositAmount: '500.00',
      })

      const data = (mockCreate.mock.calls[0][0] as any).data
      expect(data.defaultDepositAmount).toBe('500.00')
    })
  })

  describe('listTemplates', () => {
    it('scopes by orgId and excludes archived by default', async () => {
      mockFindMany.mockResolvedValueOnce([tpl()] as any)

      await listTemplates({ orgId: 'org-1' })

      const where = (mockFindMany.mock.calls[0][0] as any).where
      expect(where).toEqual({
        organizationId: 'org-1',
        isArchived: false,
      })
    })

    it('filters by type when supplied', async () => {
      mockFindMany.mockResolvedValueOnce([] as any)

      await listTemplates({ orgId: 'org-1', type: 'NDA' })

      const where = (mockFindMany.mock.calls[0][0] as any).where
      expect(where.type).toBe('NDA')
    })

    it('includes archived when includeArchived=true', async () => {
      mockFindMany.mockResolvedValueOnce([] as any)

      await listTemplates({ orgId: 'org-1', includeArchived: true })

      const where = (mockFindMany.mock.calls[0][0] as any).where
      // Whether the key is omitted or set to undefined doesn't matter; it
      // must NOT be `false` (which would exclude archived).
      expect(where.isArchived).not.toBe(false)
    })

    it('orders by updatedAt desc', async () => {
      mockFindMany.mockResolvedValueOnce([] as any)
      await listTemplates({ orgId: 'org-1' })
      const args = mockFindMany.mock.calls[0][0] as any
      expect(args.orderBy).toEqual({ updatedAt: 'desc' })
    })
  })

  describe('getTemplate (cross-org isolation)', () => {
    it('returns the template when org-scoped lookup succeeds', async () => {
      mockFindFirst.mockResolvedValueOnce(tpl() as any)

      const result = await getTemplate({ orgId: 'org-1', id: 'tpl-1' })

      expect(result.id).toBe('tpl-1')
      const where = (mockFindFirst.mock.calls[0][0] as any).where
      expect(where).toEqual({ id: 'tpl-1', organizationId: 'org-1' })
    })

    it('throws 404 (not 403) when template belongs to another org', async () => {
      // Cross-org request: findFirst with org-scoped where returns null even
      // though the row exists for org-2. Service must surface 404 to avoid
      // leaking template existence.
      mockFindFirst.mockResolvedValueOnce(null)

      await expect(
        getTemplate({ orgId: 'org-1', id: 'tpl-belongs-to-org-2' }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('updateTemplate', () => {
    it('applies partial update and re-fetches the row', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tpl({ name: 'Renamed EL' }) as any)

      const result = await updateTemplate({
        orgId: 'org-1',
        id: 'tpl-1',
        name: 'Renamed EL',
      })

      expect(result.name).toBe('Renamed EL')
      const where = (mockUpdateMany.mock.calls[0][0] as any).where
      // Org-scoped update closes the TOCTOU window — both id + orgId in WHERE.
      expect(where).toEqual({ id: 'tpl-1', organizationId: 'org-1' })
      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data.name).toBe('Renamed EL')
      // Untouched fields not present in data.
      expect(data).not.toHaveProperty('contentHtml')
    })

    it('sanitizes contentHtml on update', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tpl() as any)

      await updateTemplate({
        orgId: 'org-1',
        id: 'tpl-1',
        contentHtml: '<p>Updated</p><script>x</script>',
      })

      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data.contentHtml).toContain('<p>Updated</p>')
      expect(data.contentHtml).not.toContain('<script>')
    })

    it('throws 422 when contentHtml is empty after sanitization', async () => {
      await expect(
        updateTemplate({
          orgId: 'org-1',
          id: 'tpl-1',
          contentHtml: '<script>x</script>',
        }),
      ).rejects.toMatchObject({ status: 422 })
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it('throws 404 when no row matched (cross-org or missing)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      await expect(
        updateTemplate({ orgId: 'org-1', id: 'tpl-x', name: 'x' }),
      ).rejects.toMatchObject({ status: 404 })
      expect(mockFindUnique).not.toHaveBeenCalled()
    })

    it('clears defaultDepositAmount when null passed', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tpl() as any)

      await updateTemplate({
        orgId: 'org-1',
        id: 'tpl-1',
        defaultDepositAmount: null,
      })

      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data.defaultDepositAmount).toBeNull()
    })
  })

  describe('archiveTemplate / unarchiveTemplate', () => {
    it('archive sets isArchived=true (soft delete preserves FKs)', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tpl({ isArchived: true }) as any)

      await archiveTemplate({ orgId: 'org-1', id: 'tpl-1' })

      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data).toEqual({ isArchived: true })
    })

    it('archive throws 404 for cross-org request', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      await expect(
        archiveTemplate({ orgId: 'org-1', id: 'tpl-other-org' }),
      ).rejects.toMatchObject({ status: 404 })
    })

    it('unarchive sets isArchived=false', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 1 } as any)
      mockFindUnique.mockResolvedValueOnce(tpl() as any)

      await unarchiveTemplate({ orgId: 'org-1', id: 'tpl-1' })

      const data = (mockUpdateMany.mock.calls[0][0] as any).data
      expect(data).toEqual({ isArchived: false })
    })

    it('unarchive throws 404 for cross-org request', async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 } as any)

      await expect(
        unarchiveTemplate({ orgId: 'org-1', id: 'tpl-other-org' }),
      ).rejects.toMatchObject({ status: 404 })
    })
  })
})
