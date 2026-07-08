import { Hono } from 'hono'
import { vi } from 'vitest'
import type { AuthVariables } from '../../../middleware/auth'
import { prisma } from '../../../lib/db'
import { docsRoute } from '../index'

const NOW = new Date('2026-07-08T00:00:00.000Z')

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId: 'org_1',
      staffId: 'staff_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      clerkOrgId: 'clerk_org_1',
      orgRole: 'org:member',
    })
    await next()
  })
  app.route('/docs', docsRoute)
  return app
}

function rawImageFixture(checklistItemId: string | null) {
  return {
    id: 'raw_1',
    caseId: 'case_1',
    checklistItemId,
    taxCase: { id: 'case_1' },
  }
}

function updatedRawImageFixture(checklistItemId: string | null, docType = 'CREDIT_CARD_STATEMENT') {
  return {
    id: 'raw_1',
    caseId: 'case_1',
    classifiedType: docType,
    category: 'BANK_CARD_STATEMENTS',
    status: checklistItemId ? 'LINKED' : 'CLASSIFIED',
    checklistItemId,
    aiConfidence: 1,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function digitalDocFixture(checklistItemId: string | null, docType = 'CREDIT_CARD_STATEMENT') {
  return {
    id: 'doc_1',
    caseId: 'case_1',
    rawImageId: 'raw_1',
    docType,
    status: 'PENDING',
    extractedData: {},
    checklistItemId,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

export function mockManualClassificationState({
  initialChecklistItemId = null,
  lockedChecklistItemId = initialChecklistItemId,
  matchedChecklistItemId = null,
  docType = 'CREDIT_CARD_STATEMENT',
}: {
  initialChecklistItemId?: string | null
  lockedChecklistItemId?: string | null
  matchedChecklistItemId?: string | null
  docType?: string
} = {}) {
  vi.mocked(prisma.rawImage.findFirst).mockResolvedValueOnce(
    rawImageFixture(initialChecklistItemId) as never
  )
  vi.mocked(prisma.rawImage.findUnique).mockResolvedValueOnce({
    checklistItemId: lockedChecklistItemId,
  } as never)
  vi.mocked(prisma.checklistItem.findFirst).mockResolvedValueOnce(
    matchedChecklistItemId ? { id: matchedChecklistItemId } as never : null
  )
  vi.mocked(prisma.rawImage.update).mockResolvedValueOnce(
    updatedRawImageFixture(matchedChecklistItemId, docType) as never
  )
  vi.mocked(prisma.digitalDoc.upsert).mockResolvedValueOnce(
    digitalDocFixture(matchedChecklistItemId, docType) as never
  )
}

export function classifyDocType(docType: string) {
  return createApp().request('/docs/raw_1/classify', {
    method: 'POST',
    body: JSON.stringify({ docType }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function classifyCreditCardStatement() {
  return classifyDocType('CREDIT_CARD_STATEMENT')
}
