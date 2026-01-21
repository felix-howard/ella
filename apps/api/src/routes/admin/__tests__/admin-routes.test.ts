/**
 * Admin Routes Integration Tests
 * Tests CRUD operations for admin configuration endpoints
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma before importing the module
vi.mock('../../../lib/db', () => ({
  prisma: {
    intakeQuestion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    checklistTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    docTypeLibrary: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { adminRoute } from '../index'

const app = new Hono()
app.route('/admin', adminRoute)

// ============================================
// INTAKE QUESTIONS TESTS
// ============================================

describe('Admin Intake Questions API', () => {
  const mockFindMany = vi.mocked(prisma.intakeQuestion.findMany)
  const mockFindUnique = vi.mocked(prisma.intakeQuestion.findUnique)
  const mockCreate = vi.mocked(prisma.intakeQuestion.create)
  const mockUpdate = vi.mocked(prisma.intakeQuestion.update)
  const mockDelete = vi.mocked(prisma.intakeQuestion.delete)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /admin/intake-questions', () => {
    it('returns all questions without filters', async () => {
      const mockQuestions = [
        { id: '1', questionKey: 'hasW2', labelVi: 'Có W2?', section: 'income' },
        { id: '2', questionKey: 'hasCrypto', labelVi: 'Có crypto?', section: 'income' },
      ]
      mockFindMany.mockResolvedValueOnce(mockQuestions as never)

      const res = await app.request('/admin/intake-questions')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(mockFindMany).toHaveBeenCalled()
    })

    it('filters by taxType', async () => {
      mockFindMany.mockResolvedValueOnce([])

      const res = await app.request('/admin/intake-questions?taxType=FORM_1040')

      expect(res.status).toBe(200)
      // Verify taxTypes filter is applied
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ taxTypes: { has: 'FORM_1040' } }),
        })
      )
    })

    it('filters by section', async () => {
      mockFindMany.mockResolvedValueOnce([])

      const res = await app.request('/admin/intake-questions?section=income')

      expect(res.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ section: 'income' }),
        })
      )
    })
  })

  describe('GET /admin/intake-questions/:id', () => {
    it('returns question by id', async () => {
      const mockQuestion = { id: '1', questionKey: 'hasW2', labelVi: 'Có W2?' }
      mockFindUnique.mockResolvedValueOnce(mockQuestion as never)

      const res = await app.request('/admin/intake-questions/1')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.questionKey).toBe('hasW2')
    })

    it('returns 404 for non-existent question', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/admin/intake-questions/nonexistent')

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('NOT_FOUND')
    })
  })

  describe('POST /admin/intake-questions', () => {
    it('creates question with valid data', async () => {
      const newQuestion = {
        questionKey: 'newKey',
        taxTypes: ['FORM_1040'],
        labelVi: 'Test',
        labelEn: 'Test EN',
        fieldType: 'BOOLEAN',
        section: 'income',
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newQuestion } as never)

      const res = await app.request('/admin/intake-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestion),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.questionKey).toBe('newKey')
    })

    it('rejects invalid JSON condition', async () => {
      const res = await app.request('/admin/intake-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionKey: 'test',
          taxTypes: ['FORM_1040'],
          labelVi: 'Test',
          labelEn: 'Test EN',
          fieldType: 'BOOLEAN',
          section: 'income',
          condition: 'invalid json{',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid JSON condition', async () => {
      const newQuestion = {
        questionKey: 'newKey',
        taxTypes: ['FORM_1040'],
        labelVi: 'Test',
        labelEn: 'Test EN',
        fieldType: 'BOOLEAN',
        section: 'income',
        condition: '{"hasW2": true}',
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newQuestion } as never)

      const res = await app.request('/admin/intake-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestion),
      })

      expect(res.status).toBe(201)
    })

    it('returns 409 for duplicate key', async () => {
      mockCreate.mockRejectedValueOnce({ code: 'P2002' })

      const res = await app.request('/admin/intake-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionKey: 'duplicate',
          taxTypes: ['FORM_1040'],
          labelVi: 'Test',
          labelEn: 'Test EN',
          fieldType: 'BOOLEAN',
          section: 'income',
        }),
      })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('DUPLICATE_KEY')
    })
  })

  describe('PUT /admin/intake-questions/:id', () => {
    it('updates question', async () => {
      const updated = { id: '1', labelVi: 'Updated' }
      mockUpdate.mockResolvedValueOnce(updated as never)

      const res = await app.request('/admin/intake-questions/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelVi: 'Updated' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.labelVi).toBe('Updated')
    })
  })

  describe('DELETE /admin/intake-questions/:id', () => {
    it('deletes question', async () => {
      mockDelete.mockResolvedValueOnce({ id: '1' } as never)

      const res = await app.request('/admin/intake-questions/1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})

// ============================================
// CHECKLIST TEMPLATES TESTS
// ============================================

describe('Admin Checklist Templates API', () => {
  const mockFindMany = vi.mocked(prisma.checklistTemplate.findMany)
  const mockCreate = vi.mocked(prisma.checklistTemplate.create)
  const mockUpdate = vi.mocked(prisma.checklistTemplate.update)
  const mockDelete = vi.mocked(prisma.checklistTemplate.delete)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /admin/checklist-templates', () => {
    it('returns all templates', async () => {
      const mockTemplates = [
        { id: '1', docType: 'W2', taxType: 'FORM_1040', category: 'income' },
      ]
      mockFindMany.mockResolvedValueOnce(mockTemplates as never)

      const res = await app.request('/admin/checklist-templates')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('filters by taxType and category', async () => {
      mockFindMany.mockResolvedValueOnce([])

      const res = await app.request(
        '/admin/checklist-templates?taxType=FORM_1040&category=income'
      )

      expect(res.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { taxType: 'FORM_1040', category: 'income' },
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        include: {
          docTypeLibrary: { select: { code: true, labelVi: true, labelEn: true } },
        },
      })
    })
  })

  describe('POST /admin/checklist-templates', () => {
    it('creates template with valid data', async () => {
      const newTemplate = {
        taxType: 'FORM_1040',
        docType: 'W2',
        labelVi: 'Phiếu lương W2',
        labelEn: 'W2 Wage Statement',
        category: 'income',
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newTemplate } as never)

      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })

      expect(res.status).toBe(201)
    })

    it('rejects invalid condition JSON', async () => {
      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType: 'FORM_1040',
          docType: 'W2',
          labelVi: 'Test',
          labelEn: 'Test EN',
          category: 'income',
          condition: '{"hasW2": invalid}', // Invalid JSON
        }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects condition with array value', async () => {
      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType: 'FORM_1040',
          docType: 'W2',
          labelVi: 'Test',
          labelEn: 'Test EN',
          category: 'income',
          condition: '{"hasW2": [1,2,3]}', // Array not allowed
        }),
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid condition JSON', async () => {
      const newTemplate = {
        taxType: 'FORM_1040',
        docType: 'W2',
        labelVi: 'Test',
        labelEn: 'Test EN',
        category: 'income',
        condition: '{"hasW2": true, "w2Count": 2}',
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newTemplate } as never)

      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })

      expect(res.status).toBe(201)
    })
  })

  describe('PUT /admin/checklist-templates/:id', () => {
    it('updates template', async () => {
      mockUpdate.mockResolvedValueOnce({ id: '1', labelVi: 'Updated' } as never)

      const res = await app.request('/admin/checklist-templates/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelVi: 'Updated' }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /admin/checklist-templates/:id', () => {
    it('deletes template', async () => {
      mockDelete.mockResolvedValueOnce({ id: '1' } as never)

      const res = await app.request('/admin/checklist-templates/1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
    })
  })
})

// ============================================
// DOC TYPE LIBRARY TESTS
// ============================================

describe('Admin Doc Type Library API', () => {
  const mockFindMany = vi.mocked(prisma.docTypeLibrary.findMany)
  const mockCreate = vi.mocked(prisma.docTypeLibrary.create)
  const mockUpdate = vi.mocked(prisma.docTypeLibrary.update)
  const mockDelete = vi.mocked(prisma.docTypeLibrary.delete)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /admin/doc-type-library', () => {
    it('returns all doc types', async () => {
      const mockDocTypes = [
        { id: '1', code: 'W2', labelVi: 'W2', category: 'income' },
      ]
      mockFindMany.mockResolvedValueOnce(mockDocTypes as never)

      const res = await app.request('/admin/doc-type-library')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('searches by keyword', async () => {
      mockFindMany.mockResolvedValueOnce([])

      const res = await app.request('/admin/doc-type-library?search=wage')

      expect(res.status).toBe(200)
      // Verify search is applied with OR conditions
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ code: { contains: 'wage', mode: 'insensitive' } }),
            ]),
          }),
        })
      )
    })
  })

  describe('POST /admin/doc-type-library', () => {
    it('creates doc type with valid data', async () => {
      const newDocType = {
        code: 'TEST',
        labelVi: 'Test Doc',
        labelEn: 'Test Document',
        category: 'income',
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newDocType } as never)

      const res = await app.request('/admin/doc-type-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDocType),
      })

      expect(res.status).toBe(201)
    })

    it('accepts aliases and keywords arrays', async () => {
      const newDocType = {
        code: 'TEST',
        labelVi: 'Test',
        labelEn: 'Test',
        category: 'income',
        aliases: ['test-alias', 'another-alias'],
        keywords: ['test', 'document'],
      }
      mockCreate.mockResolvedValueOnce({ id: '1', ...newDocType } as never)

      const res = await app.request('/admin/doc-type-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDocType),
      })

      expect(res.status).toBe(201)
    })

    it('rejects aliases array exceeding limit', async () => {
      const tooManyAliases = Array(51).fill('alias')
      const res = await app.request('/admin/doc-type-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'TEST',
          labelVi: 'Test',
          labelEn: 'Test',
          category: 'income',
          aliases: tooManyAliases,
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /admin/doc-type-library/:id', () => {
    it('updates doc type', async () => {
      mockUpdate.mockResolvedValueOnce({ id: '1', labelVi: 'Updated' } as never)

      const res = await app.request('/admin/doc-type-library/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelVi: 'Updated' }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /admin/doc-type-library/:id', () => {
    it('deletes doc type', async () => {
      mockDelete.mockResolvedValueOnce({ id: '1' } as never)

      const res = await app.request('/admin/doc-type-library/1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
    })
  })
})

// ============================================
// VALIDATION TESTS
// ============================================

describe('Admin Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Condition JSON validation', () => {
    const mockCreate = vi.mocked(prisma.checklistTemplate.create)

    it('rejects oversized condition (DoS protection)', async () => {
      const hugeCondition = JSON.stringify({ key: 'x'.repeat(3000) })
      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType: 'FORM_1040',
          docType: 'W2',
          labelVi: 'Test',
          labelEn: 'Test',
          category: 'income',
          condition: hugeCondition,
        }),
      })

      expect(res.status).toBe(400)
    })

    it('rejects condition with nested objects', async () => {
      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType: 'FORM_1040',
          docType: 'W2',
          labelVi: 'Test',
          labelEn: 'Test',
          category: 'income',
          condition: '{"nested": {"deep": true}}', // Nested object not allowed
        }),
      })

      expect(res.status).toBe(400)
    })

    it('accepts empty condition string', async () => {
      mockCreate.mockResolvedValueOnce({ id: '1' } as never)

      const res = await app.request('/admin/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxType: 'FORM_1040',
          docType: 'W2',
          labelVi: 'Test',
          labelEn: 'Test',
          category: 'income',
          condition: '',
        }),
      })

      expect(res.status).toBe(201)
    })
  })
})
