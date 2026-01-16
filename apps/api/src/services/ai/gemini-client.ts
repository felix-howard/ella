/**
 * Gemini API Client
 * Google Generative AI wrapper with retry logic and error handling
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Part, GenerateContentResult } from '@google/generative-ai'
import { config } from '../../lib/config'

// Maximum image size in bytes (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

// File magic numbers for format validation (images + PDF)
const FILE_MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'image/heic': [0x00, 0x00, 0x00], // ftyp box start
  'image/heif': [0x00, 0x00, 0x00],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
}

// Retryable HTTP status codes and error patterns
const RETRYABLE_PATTERNS = [
  /rate.?limit/i,
  /timeout/i,
  /503/,
  /500/,
  /502/,
  /overloaded/i,
  /resource.?exhausted/i,
  /quota.?exceeded/i,
  /service.?unavailable/i,
]

// Initialize client with centralized config
const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey)

// Check if Gemini is configured
export const isGeminiConfigured = config.ai.isConfigured

// Cache for Gemini validation status
let geminiValidationStatus: {
  available: boolean
  model: string
  checkedAt: Date | null
  error?: string
} = {
  available: false,
  model: config.ai.model,
  checkedAt: null,
}

/**
 * Response type for AI operations
 */
export interface GeminiResponse<T> {
  success: boolean
  data?: T
  error?: string
  retries?: number
}

/**
 * Image data for Gemini vision
 */
export interface ImageData {
  mimeType: string
  data: string // base64 encoded
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Validate file buffer format using magic numbers (images + PDF)
 */
function validateFileFormat(buffer: Buffer, expectedMimeType: string): boolean {
  const magicBytes = FILE_MAGIC_NUMBERS[expectedMimeType]
  if (!magicBytes) {
    // Unknown format, allow it to pass (Gemini will reject if invalid)
    return true
  }

  // Check if buffer starts with expected magic bytes
  for (let i = 0; i < magicBytes.length; i++) {
    if (buffer[i] !== magicBytes[i]) {
      return false
    }
  }
  return true
}

/**
 * Validate file buffer size and format (images + PDF)
 */
export function validateImageBuffer(
  buffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  // Check size
  if (buffer.length > MAX_IMAGE_SIZE) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds maximum allowed (10MB)`,
    }
  }

  // Check format using magic bytes
  if (!validateFileFormat(buffer, mimeType)) {
    return {
      valid: false,
      error: `File buffer does not match expected format: ${mimeType}`,
    }
  }

  return { valid: true }
}

/**
 * Convert image buffer to Gemini-compatible Part
 */
export function imageBufferToPart(buffer: Buffer, mimeType: string): Part {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  }
}

/**
 * Parse JSON from Gemini text response
 * Handles markdown code blocks and raw JSON
 */
export function parseJsonResponse<T>(text: string): T | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.trim()

    // Handle ```json ... ``` format
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim()
    }

    return JSON.parse(cleaned) as T
  } catch {
    // Log truncated response to avoid PII exposure
    console.error('Failed to parse JSON response, length:', text.length)
    return null
  }
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const errorMessage = error.message
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(errorMessage))
}

/**
 * Generate content with retry logic
 * Handles both text-only and multimodal (text + image) prompts
 */
export async function generateContent(
  prompt: string,
  image?: ImageData
): Promise<GeminiResponse<string>> {
  if (!isGeminiConfigured) {
    return {
      success: false,
      error: 'Gemini API key not configured',
    }
  }

  const model = genAI.getGenerativeModel({ model: config.ai.model })
  const maxRetries = config.ai.maxRetries
  const retryDelay = config.ai.retryDelayMs

  let lastError: Error | null = null
  let retries = 0

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let result: GenerateContentResult

      if (image) {
        // Multimodal request (text + image)
        const imagePart: Part = {
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          },
        }
        result = await model.generateContent([prompt, imagePart])
      } else {
        // Text-only request
        result = await model.generateContent(prompt)
      }

      const response = result.response
      const text = response.text()

      return {
        success: true,
        data: text,
        retries: attempt,
      }
    } catch (error) {
      lastError = error as Error
      retries = attempt + 1

      if (isRetryableError(lastError) && attempt < maxRetries - 1) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt)
        console.warn(
          `Gemini API error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms`
        )
        await sleep(delay)
      } else if (!isRetryableError(lastError)) {
        // Non-retryable error, fail immediately
        break
      }
    }
  }

  // Sanitize error message to prevent PII exposure
  const safeError = lastError?.message
    ? lastError.message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    : 'Unknown error'

  return {
    success: false,
    error: safeError,
    retries,
  }
}

/**
 * Generate structured JSON content
 * Parses the response as JSON with type safety
 */
export async function generateJsonContent<T>(
  prompt: string,
  image?: ImageData
): Promise<GeminiResponse<T>> {
  const result = await generateContent(prompt, image)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error,
      retries: result.retries,
    }
  }

  const parsed = parseJsonResponse<T>(result.data)
  if (!parsed) {
    return {
      success: false,
      error: 'Failed to parse JSON response from Gemini',
      retries: result.retries,
    }
  }

  return {
    success: true,
    data: parsed,
    retries: result.retries,
  }
}

/**
 * Analyze image with vision capabilities
 * Convenience wrapper for image analysis tasks
 * Includes buffer validation for size and format
 */
export async function analyzeImage<T>(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<GeminiResponse<T>> {
  // Validate buffer before processing
  const validation = validateImageBuffer(imageBuffer, mimeType)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    }
  }

  const imageData: ImageData = {
    data: imageBuffer.toString('base64'),
    mimeType,
  }

  return generateJsonContent<T>(prompt, imageData)
}

/**
 * Validate Gemini model availability
 * Sends minimal test request to verify model exists
 * Non-blocking, caches result for health endpoint
 */
export async function validateGeminiModel(): Promise<{
  available: boolean
  model: string
  error?: string
}> {
  if (!isGeminiConfigured) {
    geminiValidationStatus = {
      available: false,
      model: config.ai.model,
      checkedAt: new Date(),
      error: 'API key not configured',
    }
    return geminiValidationStatus
  }

  try {
    const model = genAI.getGenerativeModel({ model: config.ai.model })
    // Minimal test: count tokens (cheapest API call)
    await model.countTokens('test')

    geminiValidationStatus = {
      available: true,
      model: config.ai.model,
      checkedAt: new Date(),
    }
    console.log(`[Gemini] Model validated: ${config.ai.model}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    geminiValidationStatus = {
      available: false,
      model: config.ai.model,
      checkedAt: new Date(),
      error: errorMessage,
    }
    console.warn(`[Gemini] Model validation failed: ${errorMessage}`)
  }

  return geminiValidationStatus
}

/**
 * Get Gemini configuration and validation status for health endpoint
 */
export function getGeminiStatus(): {
  configured: boolean
  model: string
  available: boolean
  checkedAt: string | null
  error?: string
  maxRetries: number
  maxImageSizeMB: number
} {
  return {
    configured: isGeminiConfigured,
    model: config.ai.model,
    available: geminiValidationStatus.available,
    checkedAt: geminiValidationStatus.checkedAt?.toISOString() || null,
    error: geminiValidationStatus.error,
    maxRetries: config.ai.maxRetries,
    maxImageSizeMB: MAX_IMAGE_SIZE / 1024 / 1024,
  }
}
