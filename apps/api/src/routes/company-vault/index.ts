import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { ActivityRiskLevel, type CompanyVaultCredential } from '@ella/db'
import { prisma } from '../../lib/db'
import { requireOrg, type AuthVariables } from '../../middleware/auth'
import { decryptSensitiveValue, encryptSensitiveValue } from '../../services/crypto'
import {
  getAuditRequestContext,
  getChangedFieldNames,
  logStaffActivity,
} from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'

const companyVaultRoute = new Hono<{ Variables: AuthVariables }>()

companyVaultRoute.use('*', requireOrg)

const optionalSecretSchema = z.string().max(500).nullable().optional()
const companyVaultCreateSchema = z.object({
  toolName: z.string().trim().min(1).max(120),
  username: optionalSecretSchema,
  password: optionalSecretSchema,
  note: z.string().max(2000).nullable().optional(),
})
const companyVaultUpdateSchema = companyVaultCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required' }
)
function getOrganizationId(user: AuthVariables['user']): string {
  if (!user.organizationId) {
    throw new Error('Organization context missing after requireOrg')
  }
  return user.organizationId
}
function getStaffId(user: AuthVariables['user']): string {
  if (!user.staffId) {
    throw new Error('Staff context missing after authMiddleware')
  }
  return user.staffId
}
function normalizeOptional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return value
}
function encryptOptional(value: string | null | undefined): string | null | undefined {
  const normalized = normalizeOptional(value)
  if (normalized === undefined || normalized === null) return normalized
  return encryptSensitiveValue(normalized)
}
function decryptOptional(value: string | null): string | null {
  return value ? decryptSensitiveValue(value) : null
}
function serializeCredential(credential: CompanyVaultCredential) {
  return {
    id: credential.id,
    toolName: credential.toolName,
    username: decryptOptional(credential.usernameEncrypted),
    password: decryptOptional(credential.passwordEncrypted),
    note: decryptOptional(credential.noteEncrypted),
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  }
}
async function logVaultActivity(
  input: {
    organizationId: string
    staffId: string
    credentialId: string
    toolName: string
    action: string
    summary: string
    changedFields?: string[]
  },
  c: Parameters<typeof getAuditRequestContext>[0]
) {
  await logStaffActivity({
    organizationId: input.organizationId,
    actorStaffId: input.staffId,
    category: ACTIVITY_CATEGORIES.COMPANY_VAULT,
    targetType: ACTIVITY_TARGET_TYPES.COMPANY_VAULT_CREDENTIAL,
    targetId: input.credentialId,
    targetLabel: input.toolName,
    summary: input.summary,
    action: input.action,
    riskLevel: ActivityRiskLevel.MEDIUM,
    metadata: {
      credentialId: input.credentialId,
      ...(input.changedFields ? { changedFields: input.changedFields } : {}),
    },
    request: getAuditRequestContext(c),
  })
}
companyVaultRoute.get('/', async (c) => {
  const organizationId = getOrganizationId(c.get('user'))
  const search = c.req.query('search')?.trim().toLowerCase()

  const credentials = await prisma.companyVaultCredential.findMany({
    where: { organizationId },
    orderBy: [{ toolName: 'asc' }, { createdAt: 'asc' }],
  })
  const serialized = credentials.map(serializeCredential)
  const data = search
    ? serialized.filter((credential) =>
        credential.toolName.toLowerCase().includes(search) ||
        credential.username?.toLowerCase().includes(search)
      )
    : serialized
  return c.json({ credentials: data })
})
companyVaultRoute.post('/', zValidator('json', companyVaultCreateSchema), async (c) => {
  const user = c.get('user')
  const organizationId = getOrganizationId(user)
  const staffId = getStaffId(user)
  const data = c.req.valid('json')
  const credential = await prisma.companyVaultCredential.create({
    data: {
      organizationId,
      toolName: data.toolName,
      usernameEncrypted: encryptOptional(data.username),
      passwordEncrypted: encryptOptional(data.password),
      noteEncrypted: encryptOptional(data.note),
    },
  })
  await logVaultActivity({
    organizationId,
    staffId,
    credentialId: credential.id,
    toolName: credential.toolName,
    action: ACTIVITY_ACTIONS.COMPANY_VAULT.CREATED,
    summary: 'Created company vault credential',
  }, c)

  return c.json({ credential: serializeCredential(credential) }, 201)
})
companyVaultRoute.patch('/:id', zValidator('json', companyVaultUpdateSchema), async (c) => {
  const user = c.get('user')
  const organizationId = getOrganizationId(user)
  const staffId = getStaffId(user)
  const data = c.req.valid('json')
  const changedFields = getChangedFieldNames(data)
  const updateData = {
    ...(data.toolName !== undefined ? { toolName: data.toolName } : {}),
    ...(data.username !== undefined ? { usernameEncrypted: encryptOptional(data.username) } : {}),
    ...(data.password !== undefined ? { passwordEncrypted: encryptOptional(data.password) } : {}),
    ...(data.note !== undefined ? { noteEncrypted: encryptOptional(data.note) } : {}),
  }
  const result = await prisma.companyVaultCredential.updateMany({
    where: { id: c.req.param('id'), organizationId },
    data: updateData,
  })
  if (result.count === 0) return c.json({ error: 'Credential not found' }, 404)
  const credential = await prisma.companyVaultCredential.findFirstOrThrow({
    where: { id: c.req.param('id'), organizationId },
  })
  await logVaultActivity({
    organizationId,
    staffId,
    credentialId: credential.id,
    toolName: credential.toolName,
    action: ACTIVITY_ACTIONS.COMPANY_VAULT.UPDATED,
    summary: 'Updated company vault credential',
    changedFields,
  }, c)

  return c.json({ credential: serializeCredential(credential) })
})
companyVaultRoute.delete('/:id', async (c) => {
  const user = c.get('user')
  const organizationId = getOrganizationId(user)
  const staffId = getStaffId(user)
  const credential = await prisma.companyVaultCredential.findFirst({
    where: { id: c.req.param('id'), organizationId },
  })
  if (!credential) return c.json({ error: 'Credential not found' }, 404)
  const result = await prisma.companyVaultCredential.deleteMany({
    where: { id: credential.id, organizationId },
  })
  if (result.count === 0) return c.json({ error: 'Credential not found' }, 404)
  await logVaultActivity({
    organizationId,
    staffId,
    credentialId: credential.id,
    toolName: credential.toolName,
    action: ACTIVITY_ACTIONS.COMPANY_VAULT.DELETED,
    summary: 'Deleted company vault credential',
  }, c)

  return c.json({ success: true })
})

export { companyVaultRoute }
