/**
 * Voicemail Helper Functions
 * Utilities for handling voicemail recordings from unknown/known callers
 */
import { prisma } from '../../lib/db'
import type { Prisma } from '@ella/db'
import { findOrCreateEngagement } from '../engagement-helpers'

// Transaction client type for type-safe transactions
type TransactionClient = Prisma.TransactionClient

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate E.164 phone number format
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isValidE164Phone(phone: string): boolean {
  // E.164: + followed by 1-9, then 9-14 more digits (10-15 total after +)
  return /^\+[1-9]\d{9,14}$/.test(phone)
}

/**
 * Sanitize phone number for safe display/storage
 * Removes potential XSS attack vectors while preserving valid E.164 characters
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone string (only +, digits, truncated to 16 chars)
 */
export function sanitizePhone(phone: string): string {
  // Remove any character that isn't + or digit
  const sanitized = phone.replace(/[^\d+]/g, '')
  // Ensure only one + at the start, truncate to safe length
  return sanitized.replace(/^\++/, '+').slice(0, 16)
}

/**
 * Sanitize recording duration from Twilio webhook
 * Parses string, clamps to valid range [0, max]
 * @param raw - Raw duration value from webhook
 * @param maxDuration - Maximum allowed duration in seconds
 * @returns Sanitized duration in seconds
 */
export function sanitizeRecordingDuration(
  raw: string | undefined,
  maxDuration: number
): number {
  const parsed = parseInt(raw || '0', 10)
  if (isNaN(parsed) || parsed < 0) return 0
  return Math.min(parsed, maxDuration)
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format voicemail duration to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23" for 83 seconds)
 */
export function formatVoicemailDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ============================================
// DATABASE HELPERS
// ============================================

/**
 * Find conversation by caller phone number
 * Looks up client by phone and returns their latest case's conversation
 * @param phone - E.164 formatted phone number
 * @returns Conversation or null if not found
 * @throws Error if phone format is invalid
 */
export async function findConversationByPhone(
  phone: string
): Promise<{ id: string } | null> {
  // SECURITY: Validate phone format BEFORE database query
  if (!isValidE164Phone(phone)) {
    return null // Invalid format = no match possible
  }

  const client = await prisma.client.findUnique({
    where: { phone },
    include: {
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { conversation: true },
      },
    },
  })

  if (!client?.taxCases[0]?.conversation) {
    return null
  }

  return { id: client.taxCases[0].conversation.id }
}

/**
 * Create placeholder client, tax case, and conversation for unknown caller
 * Used when voicemail is received from a number not in the system
 * Uses upsert pattern to handle race conditions (concurrent calls from same number)
 * @param phone - E.164 formatted caller phone (must be pre-validated)
 * @returns Created or existing conversation
 */
export async function createPlaceholderConversation(
  phone: string
): Promise<{ id: string }> {
  // SECURITY: Sanitize phone for display in client name (prevents XSS)
  const safePhone = sanitizePhone(phone)

  const result = await prisma.$transaction(async (tx: TransactionClient) => {
    // RACE CONDITION FIX: Use upsert to handle concurrent requests
    const client = await tx.client.upsert({
      where: { phone },
      create: {
        name: `Khách hàng ${safePhone}`, // "Customer {phone}" in Vietnamese (sanitized)
        phone,
        language: 'VI',
      },
      update: {}, // No update needed - just return existing
      include: {
        taxCases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { conversation: true },
        },
      },
    })

    // If client already has a conversation, return it
    if (client.taxCases[0]?.conversation) {
      return client.taxCases[0].conversation
    }

    // Create tax case for current year
    const currentYear = new Date().getFullYear()

    // Find or create engagement for this client + year
    const { engagementId } = await findOrCreateEngagement(
      tx,
      client.id,
      currentYear,
      null // No profile available in voicemail context
    )

    const taxCase = await tx.taxCase.create({
      data: {
        clientId: client.id,
        taxYear: currentYear,
        engagementId,
        taxTypes: ['FORM_1040'], // Default to individual return
        status: 'INTAKE',
      },
    })

    // Create conversation for the case
    const conversation = await tx.conversation.create({
      data: {
        caseId: taxCase.id,
        lastMessageAt: new Date(),
      },
    })

    return conversation
  })

  return { id: result.id }
}
