import type { Context } from 'hono'
import { ActivityActorType, ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../lib/db'

const SENSITIVE_METADATA_KEY_PATTERN =
  /(url|signed[_-]?url|r2[_-]?key|storage[_-]?key|object[_-]?key|ssn|tin|ein|ocr|raw[_-]?text|token|auth)/i
const REDACTED_VALUE = '[REDACTED]'
const URL_VALUE_PATTERN = /^https?:\/\//i
const SSN_VALUE_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/
const TIN_VALUE_PATTERN = /\b\d{2}-?\d{7}\b/
const JWT_VALUE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const BEARER_VALUE_PATTERN = /^bearer\s+\S+/i
const LONG_SECRET_VALUE_PATTERN = /^[A-Za-z0-9+/=_-]{32,}$/
const STORAGE_KEY_VALUE_PATTERN =
  /^(clients|cases|uploads|raw-images|staff-signatures|agreements|draft-returns|portal)\//
const LONG_TEXT_VALUE_LIMIT = 500

export interface AuditRequestContext {
  ipAddress?: string
  userAgent?: string
  route?: string
  method?: string
}

export interface ActivityLogInput {
  organizationId?: string | null
  clientId?: string | null
  caseId?: string | null
  rawImageId?: string | null
  magicLinkId?: string | null
  actorType: ActivityActorType
  actorStaffId?: string | null
  action: string
  riskLevel?: ActivityRiskLevel
  metadata?: unknown
  request?: AuditRequestContext
}

interface LogActivityOptions {
  strict?: boolean
}

function normalizeHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function getAuditRequestContext(c: Context): AuditRequestContext {
  // Ella runs behind a managed edge/proxy that is expected to overwrite these headers.
  const forwardedFor = normalizeHeader(c.req.header('x-forwarded-for'))
  const ipAddress =
    normalizeHeader(c.req.header('cf-connecting-ip')) ||
    normalizeHeader(c.req.header('x-real-ip')) ||
    forwardedFor?.split(',')[0]?.trim()

  return {
    ipAddress,
    userAgent: normalizeHeader(c.req.header('user-agent')),
    route: c.req.path,
    method: c.req.method,
  }
}

function redactValue(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      URL_VALUE_PATTERN.test(trimmed) ||
      SSN_VALUE_PATTERN.test(trimmed) ||
      TIN_VALUE_PATTERN.test(trimmed) ||
      JWT_VALUE_PATTERN.test(trimmed) ||
      BEARER_VALUE_PATTERN.test(trimmed) ||
      LONG_SECRET_VALUE_PATTERN.test(trimmed) ||
      STORAGE_KEY_VALUE_PATTERN.test(trimmed) ||
      trimmed.length > LONG_TEXT_VALUE_LIMIT
    ) {
      return REDACTED_VALUE
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item)).filter((item) => item !== undefined)
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) continue
      const redacted = redactValue(nestedValue)
      if (redacted !== undefined) result[key] = redacted
    }
    return result
  }
  return value
}

export function redactActivityMetadata(metadata: unknown): Prisma.InputJsonValue | undefined {
  if (metadata === undefined) return undefined
  const redacted = redactValue(metadata)
  if (redacted === undefined) return undefined
  return redacted as Prisma.InputJsonValue
}

export async function logActivity(
  input: ActivityLogInput,
  options: LogActivityOptions = {}
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        organizationId: input.organizationId || undefined,
        clientId: input.clientId || undefined,
        caseId: input.caseId || undefined,
        rawImageId: input.rawImageId || undefined,
        magicLinkId: input.magicLinkId || undefined,
        actorType: input.actorType,
        actorStaffId: input.actorStaffId || undefined,
        action: input.action,
        riskLevel: input.riskLevel || ActivityRiskLevel.LOW,
        metadata: redactActivityMetadata(input.metadata) ?? Prisma.JsonNull,
        ipAddress: input.request?.ipAddress,
        userAgent: input.request?.userAgent,
        route: input.request?.route,
        method: input.request?.method,
      },
    })
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity', {
      action: input.action,
      actorType: input.actorType,
      actorStaffId: input.actorStaffId,
      organizationId: input.organizationId,
      clientId: input.clientId,
      caseId: input.caseId,
      rawImageId: input.rawImageId,
      magicLinkId: input.magicLinkId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (options.strict) throw error
  }
}

export async function logActivities(
  inputs: ActivityLogInput[],
  options: LogActivityOptions = {}
): Promise<void> {
  if (inputs.length === 0) return

  try {
    await prisma.activityLog.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId || undefined,
        clientId: input.clientId || undefined,
        caseId: input.caseId || undefined,
        rawImageId: input.rawImageId || undefined,
        magicLinkId: input.magicLinkId || undefined,
        actorType: input.actorType,
        actorStaffId: input.actorStaffId || undefined,
        action: input.action,
        riskLevel: input.riskLevel || ActivityRiskLevel.LOW,
        metadata: redactActivityMetadata(input.metadata) ?? Prisma.JsonNull,
        ipAddress: input.request?.ipAddress,
        userAgent: input.request?.userAgent,
        route: input.request?.route,
        method: input.request?.method,
      })),
    })
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity batch', {
      count: inputs.length,
      actions: [...new Set(inputs.map((input) => input.action))],
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (options.strict) throw error
  }
}

type StaffActivityLogInput = Omit<ActivityLogInput, 'actorType' | 'actorStaffId'> & {
  actorStaffId: string
}

export async function logStaffActivities(
  inputs: StaffActivityLogInput[],
  options?: LogActivityOptions
): Promise<void> {
  await logActivities(
    inputs.map((input) => ({
      ...input,
      actorType: ActivityActorType.STAFF,
    })),
    options
  )
}

export async function logStaffActivity(
  input: StaffActivityLogInput,
  options?: LogActivityOptions
): Promise<void> {
  await logActivity(
    {
      ...input,
      actorType: ActivityActorType.STAFF,
    },
    options
  )
}

export async function logSystemActivity(
  input: Omit<ActivityLogInput, 'actorType' | 'actorStaffId'>,
  options?: LogActivityOptions
): Promise<void> {
  await logActivity(
    {
      ...input,
      actorType: ActivityActorType.SYSTEM,
      actorStaffId: undefined,
    },
    options
  )
}
