/**
 * Admin API routes
 * Configuration management for intake questions, checklist templates, and doc type library
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { prisma } from '../../lib/db'
import type { TaxType, FieldType, DocType } from '@ella/db'
import {
  intakeQuestionIdParamSchema,
  listIntakeQuestionsQuerySchema,
  createIntakeQuestionSchema,
  updateIntakeQuestionSchema,
  checklistTemplateIdParamSchema,
  listChecklistTemplatesQuerySchema,
  createChecklistTemplateSchema,
  updateChecklistTemplateSchema,
  docTypeLibraryIdParamSchema,
  listDocTypeLibraryQuerySchema,
  createDocTypeLibrarySchema,
  updateDocTypeLibrarySchema,
} from './schemas'

const adminRoute = new Hono()

// ============================================
// INTAKE QUESTIONS ENDPOINTS
// ============================================

// GET /admin/intake-questions - List all intake questions
adminRoute.get(
  '/intake-questions',
  zValidator('query', listIntakeQuestionsQuerySchema),
  async (c) => {
    const { taxType, section, isActive } = c.req.valid('query')

    const where: Record<string, unknown> = {}

    if (taxType) {
      where.taxTypes = { has: taxType }
    }
    if (section) {
      where.section = section
    }
    if (isActive !== undefined) {
      where.isActive = isActive
    }

    const questions = await prisma.intakeQuestion.findMany({
      where,
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    })

    return c.json({ data: questions })
  }
)

// GET /admin/intake-questions/:id - Get single intake question
adminRoute.get(
  '/intake-questions/:id',
  zValidator('param', intakeQuestionIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    const question = await prisma.intakeQuestion.findUnique({ where: { id } })

    if (!question) {
      return c.json({ error: 'NOT_FOUND', message: 'Intake question not found' }, 404)
    }

    return c.json(question)
  }
)

// POST /admin/intake-questions - Create intake question
adminRoute.post(
  '/intake-questions',
  zValidator('json', createIntakeQuestionSchema),
  async (c) => {
    const body = c.req.valid('json')

    try {
      const question = await prisma.intakeQuestion.create({
        data: {
          ...body,
          taxTypes: body.taxTypes as TaxType[],
          fieldType: body.fieldType as FieldType,
        },
      })

      return c.json(question, 201)
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return c.json(
          { error: 'DUPLICATE_KEY', message: 'Question with this key already exists' },
          409
        )
      }
      throw error
    }
  }
)

// PUT /admin/intake-questions/:id - Update intake question
adminRoute.put(
  '/intake-questions/:id',
  zValidator('param', intakeQuestionIdParamSchema),
  zValidator('json', updateIntakeQuestionSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const question = await prisma.intakeQuestion.update({
      where: { id },
      data: {
        ...body,
        taxTypes: body.taxTypes as TaxType[] | undefined,
        fieldType: body.fieldType as FieldType | undefined,
      },
    })

    return c.json(question)
  }
)

// DELETE /admin/intake-questions/:id - Delete intake question
adminRoute.delete(
  '/intake-questions/:id',
  zValidator('param', intakeQuestionIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    await prisma.intakeQuestion.delete({ where: { id } })

    return c.json({ success: true })
  }
)

// ============================================
// CHECKLIST TEMPLATES ENDPOINTS
// ============================================

// GET /admin/checklist-templates - List all checklist templates
adminRoute.get(
  '/checklist-templates',
  zValidator('query', listChecklistTemplatesQuerySchema),
  async (c) => {
    const { taxType, category } = c.req.valid('query')

    const where: Record<string, unknown> = {}

    if (taxType) {
      where.taxType = taxType
    }
    if (category) {
      where.category = category
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        docTypeLibrary: {
          select: { code: true, labelVi: true, labelEn: true },
        },
      },
    })

    return c.json({ data: templates })
  }
)

// GET /admin/checklist-templates/:id - Get single checklist template
adminRoute.get(
  '/checklist-templates/:id',
  zValidator('param', checklistTemplateIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        docTypeLibrary: true,
      },
    })

    if (!template) {
      return c.json({ error: 'NOT_FOUND', message: 'Checklist template not found' }, 404)
    }

    return c.json(template)
  }
)

// POST /admin/checklist-templates - Create checklist template
adminRoute.post(
  '/checklist-templates',
  zValidator('json', createChecklistTemplateSchema),
  async (c) => {
    const body = c.req.valid('json')

    try {
      const template = await prisma.checklistTemplate.create({
        data: {
          ...body,
          taxType: body.taxType as TaxType,
          docType: body.docType as DocType,
        },
      })

      return c.json(template, 201)
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return c.json(
          { error: 'DUPLICATE_KEY', message: 'Template for this tax type and doc type already exists' },
          409
        )
      }
      throw error
    }
  }
)

// PUT /admin/checklist-templates/:id - Update checklist template
adminRoute.put(
  '/checklist-templates/:id',
  zValidator('param', checklistTemplateIdParamSchema),
  zValidator('json', updateChecklistTemplateSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const template = await prisma.checklistTemplate.update({
      where: { id },
      data: body,
    })

    return c.json(template)
  }
)

// DELETE /admin/checklist-templates/:id - Delete checklist template
adminRoute.delete(
  '/checklist-templates/:id',
  zValidator('param', checklistTemplateIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    await prisma.checklistTemplate.delete({ where: { id } })

    return c.json({ success: true })
  }
)

// ============================================
// DOC TYPE LIBRARY ENDPOINTS
// ============================================

// GET /admin/doc-type-library - List all doc types
adminRoute.get(
  '/doc-type-library',
  zValidator('query', listDocTypeLibraryQuerySchema),
  async (c) => {
    const { category, isActive, search } = c.req.valid('query')

    const where: Record<string, unknown> = {}

    if (category) {
      where.category = category
    }
    if (isActive !== undefined) {
      where.isActive = isActive
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { labelVi: { contains: search, mode: 'insensitive' } },
        { labelEn: { contains: search, mode: 'insensitive' } },
        { aliases: { has: search.toLowerCase() } },
      ]
    }

    const docTypes = await prisma.docTypeLibrary.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    return c.json({ data: docTypes })
  }
)

// GET /admin/doc-type-library/:id - Get single doc type
adminRoute.get(
  '/doc-type-library/:id',
  zValidator('param', docTypeLibraryIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    const docType = await prisma.docTypeLibrary.findUnique({ where: { id } })

    if (!docType) {
      return c.json({ error: 'NOT_FOUND', message: 'Doc type not found' }, 404)
    }

    return c.json(docType)
  }
)

// POST /admin/doc-type-library - Create doc type
adminRoute.post(
  '/doc-type-library',
  zValidator('json', createDocTypeLibrarySchema),
  async (c) => {
    const body = c.req.valid('json')

    try {
      const docType = await prisma.docTypeLibrary.create({
        data: body,
      })

      return c.json(docType, 201)
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return c.json(
          { error: 'DUPLICATE_KEY', message: 'Doc type with this code already exists' },
          409
        )
      }
      throw error
    }
  }
)

// PUT /admin/doc-type-library/:id - Update doc type
adminRoute.put(
  '/doc-type-library/:id',
  zValidator('param', docTypeLibraryIdParamSchema),
  zValidator('json', updateDocTypeLibrarySchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    const docType = await prisma.docTypeLibrary.update({
      where: { id },
      data: body,
    })

    return c.json(docType)
  }
)

// DELETE /admin/doc-type-library/:id - Delete doc type
adminRoute.delete(
  '/doc-type-library/:id',
  zValidator('param', docTypeLibraryIdParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')

    await prisma.docTypeLibrary.delete({ where: { id } })

    return c.json({ success: true })
  }
)

// ============================================
// UTILITY ENDPOINTS
// ============================================

// GET /admin/sections - Get all unique sections from intake questions
adminRoute.get('/sections', async (c) => {
  const sections = await prisma.intakeQuestion.findMany({
    select: { section: true },
    distinct: ['section'],
    orderBy: { section: 'asc' },
  })

  return c.json({ data: sections.map((s) => s.section) })
})

// GET /admin/categories - Get all unique categories from checklist templates
adminRoute.get('/categories', async (c) => {
  const categories = await prisma.checklistTemplate.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })

  return c.json({ data: categories.map((c) => c.category) })
})

export { adminRoute }
