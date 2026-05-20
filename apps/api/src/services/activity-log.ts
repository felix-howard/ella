import type { Context } from 'hono'
import { ActivityActorType, ActivityRiskLevel, Prisma } from '@ella/db'
import { prisma } from '../lib/db'
import { getClientIp } from '../middleware/rate-limiter'
import {
  ACTIVITY_TARGET_TYPES,
  categoryForAction,
  isActivityCategory,
  isActivityTargetType,
  normalizeActivityAction,
  type ActivityCategory,
  type ActivityTargetType,
} from './activity-actions'

const SENSITIVE_METADATA_KEY_PATTERN =
  /(url|signed[_-]?url|r2[_-]?key|storage[_-]?key|object[_-]?key|ssn|tin|ein|ocr|raw[_-]?text|token|auth|content|body|message|message[_-]?text|sms[_-]?message|^text$|notes?|phone|email|address|avatar|signature)/i
const SAFE_IDENTIFIER_KEY_PATTERN = /(^id$|ids?$)/i
const REDACTED_VALUE = '[REDACTED]'
const URL_VALUE_PATTERN = /^https?:\/\//i
const SSN_VALUE_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/
const TIN_VALUE_PATTERN = /\b\d{2}-?\d{7}\b/
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_VALUE_PATTERN = /(?:\+?\d[\s().-]?){10,}/
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
  category?: ActivityCategory | null
  targetType?: ActivityTargetType | null
  targetId?: string | null
  targetLabel?: string | null
  summary?: string | null
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

export interface ActivityTimelineItem {
  id: string
  action: string
  category: ActivityCategory
  targetType: ActivityTargetType
  targetId: string | null
  targetLabel: string | null
  summary: string
  actorType: ActivityActorType
  actorStaffId: string | null
  riskLevel: ActivityRiskLevel
  createdAt: string
}

interface ActivityTimelineRecord {
  id: string
  action: string
  category?: string | null
  targetType?: string | null
  targetId?: string | null
  targetLabel?: string | null
  summary?: string | null
  actorType: ActivityActorType
  actorStaffId?: string | null
  riskLevel: ActivityRiskLevel
  createdAt: Date
}

function normalizeHeader(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function getAuditRequestContext(c: Context): AuditRequestContext {
  return {
    ipAddress: getClientIp(c),
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
      EMAIL_VALUE_PATTERN.test(trimmed) ||
      PHONE_VALUE_PATTERN.test(trimmed) ||
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
      if (
        SENSITIVE_METADATA_KEY_PATTERN.test(key) &&
        !SAFE_IDENTIFIER_KEY_PATTERN.test(key)
      ) continue
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

export function getChangedFieldNames(input: Record<string, unknown>): string[] {
  return Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
}

function resolveCategory(input: ActivityLogInput): ActivityCategory {
  return input.category ?? categoryForAction(input.action)
}

function resolveTargetType(input: ActivityLogInput): ActivityTargetType {
  if (input.targetType) return input.targetType
  if (input.rawImageId) return ACTIVITY_TARGET_TYPES.RAW_IMAGE
  if (input.magicLinkId) return ACTIVITY_TARGET_TYPES.MAGIC_LINK
  if (input.caseId) return ACTIVITY_TARGET_TYPES.CASE
  if (input.clientId) return ACTIVITY_TARGET_TYPES.CLIENT
  return ACTIVITY_TARGET_TYPES.UNKNOWN
}

function resolveTargetId(input: ActivityLogInput): string | undefined {
  return (
    input.targetId ||
    input.rawImageId ||
    input.magicLinkId ||
    input.caseId ||
    input.clientId ||
    undefined
  )
}

function buildFallbackSummary(input: ActivityLogInput): string {
  const category = resolveCategory(input).toLowerCase().replaceAll('_', ' ')
  const action = normalizeActivityAction(input.action).replaceAll('.', ' ').replaceAll('_', ' ')
  return `${category}: ${action}`
}

function trimDisplayValue(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}

function buildActivityCreateData(input: ActivityLogInput): Prisma.ActivityLogCreateManyInput {
  return {
    organizationId: input.organizationId || undefined,
    clientId: input.clientId || undefined,
    caseId: input.caseId || undefined,
    rawImageId: input.rawImageId || undefined,
    magicLinkId: input.magicLinkId || undefined,
    category: resolveCategory(input),
    targetType: resolveTargetType(input),
    targetId: resolveTargetId(input),
    targetLabel: trimDisplayValue(input.targetLabel),
    summary: trimDisplayValue(input.summary) ?? buildFallbackSummary(input),
    actorType: input.actorType,
    actorStaffId: input.actorStaffId || undefined,
    action: normalizeActivityAction(input.action),
    riskLevel: input.riskLevel || ActivityRiskLevel.LOW,
    metadata: redactActivityMetadata(input.metadata) ?? Prisma.JsonNull,
    ipAddress: input.request?.ipAddress,
    userAgent: input.request?.userAgent,
    route: input.request?.route,
    method: input.request?.method,
  }
}

export function toActivityTimelineItem(record: ActivityTimelineRecord): ActivityTimelineItem {
  const category = isActivityCategory(record.category)
    ? record.category
    : categoryForAction(record.action)
  const targetType = isActivityTargetType(record.targetType)
    ? record.targetType
    : ACTIVITY_TARGET_TYPES.UNKNOWN
  return {
    id: record.id,
    action: record.action,
    category,
    targetType,
    targetId: record.targetId ?? null,
    targetLabel: record.targetLabel ?? null,
    summary: record.summary || record.action.replaceAll('.', ' ').replaceAll('_', ' '),
    actorType: record.actorType,
    actorStaffId: record.actorStaffId ?? null,
    riskLevel: record.riskLevel,
    createdAt: record.createdAt.toISOString(),
  }
}

export async function logActivity(
  input: ActivityLogInput,
  options: LogActivityOptions = {}
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: buildActivityCreateData(input),
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
      data: inputs.map(buildActivityCreateData),
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

export async function logClientPortalActivity(
  input: Omit<ActivityLogInput, 'actorType' | 'actorStaffId'>,
  options?: LogActivityOptions
): Promise<void> {
  await logActivity(
    {
      ...input,
      actorType: ActivityActorType.CLIENT_PORTAL,
      actorStaffId: undefined,
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

export async function logMutationActivity(
  input: ActivityLogInput,
  options: LogActivityOptions = {}
): Promise<void> {
  await logActivity(input, options)
}
