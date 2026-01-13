/**
 * Blur Detector Service
 * Detects image quality issues using Gemini vision
 */
import { analyzeImage, isGeminiConfigured } from './gemini-client'
import {
  getBlurDetectionPrompt,
  validateBlurDetectionResult,
  getIssueTypeLabel,
  getSeverityLabel,
} from './prompts/blur-check'
import type { BlurDetectionResult, BlurIssue } from './prompts/blur-check'

/**
 * Extended blur detection result with metadata
 */
export interface ImageQualityResult {
  success: boolean
  isBlurry: boolean
  blurScore: number
  canBeProcessed: boolean
  issues: BlurIssue[]
  recommendation: string
  issuesSummary?: string // Vietnamese summary of issues
  error?: string
  processingTimeMs?: number
}

/**
 * Threshold constants for quality assessment
 * Note: BLUR_THRESHOLD (0.5) is used by the AI prompt to set isBlurry flag
 */
const PROCESS_THRESHOLD = 0.7 // canBeProcessed = false if blurScore > this

/**
 * Detect blur and quality issues in an image
 *
 * @param imageBuffer - The image file buffer
 * @param mimeType - MIME type of the image
 * @returns Quality assessment result
 */
export async function detectBlur(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ImageQualityResult> {
  const startTime = Date.now()

  // Check if Gemini is configured
  if (!isGeminiConfigured) {
    return {
      success: false,
      isBlurry: false,
      blurScore: 0,
      canBeProcessed: true, // Assume processable if AI not available
      issues: [],
      recommendation: 'Không thể kiểm tra chất lượng ảnh (AI chưa cấu hình)',
      error: 'Gemini API key not configured',
      processingTimeMs: Date.now() - startTime,
    }
  }

  // Validate mime type
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  if (!supportedTypes.includes(mimeType)) {
    return {
      success: false,
      isBlurry: false,
      blurScore: 0,
      canBeProcessed: false,
      issues: [],
      recommendation: 'Định dạng ảnh không được hỗ trợ',
      error: `Unsupported MIME type: ${mimeType}`,
      processingTimeMs: Date.now() - startTime,
    }
  }

  try {
    const prompt = getBlurDetectionPrompt()
    const result = await analyzeImage<BlurDetectionResult>(imageBuffer, mimeType, prompt)

    if (!result.success || !result.data) {
      return {
        success: false,
        isBlurry: false,
        blurScore: 0,
        canBeProcessed: true, // Assume processable if detection fails
        issues: [],
        recommendation: 'Không thể kiểm tra chất lượng ảnh',
        error: result.error || 'Unknown error during blur detection',
        processingTimeMs: Date.now() - startTime,
      }
    }

    // Validate the response structure
    if (!validateBlurDetectionResult(result.data)) {
      return {
        success: false,
        isBlurry: false,
        blurScore: 0,
        canBeProcessed: true,
        issues: [],
        recommendation: 'Không thể phân tích kết quả kiểm tra',
        error: 'AI returned invalid blur detection format',
        processingTimeMs: Date.now() - startTime,
      }
    }

    const data = result.data

    // Generate Vietnamese summary of issues
    const issuesSummary = generateIssuesSummary(data.issues)

    return {
      success: true,
      isBlurry: data.isBlurry,
      blurScore: data.blurScore,
      canBeProcessed: data.canBeProcessed,
      issues: data.issues || [],
      recommendation: data.recommendation,
      issuesSummary,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      isBlurry: false,
      blurScore: 0,
      canBeProcessed: true,
      issues: [],
      recommendation: 'Lỗi khi kiểm tra chất lượng ảnh',
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Quick blur check - returns just pass/fail
 * Faster than full detection for simple use cases
 *
 * @param imageBuffer - The image file buffer
 * @param mimeType - MIME type of the image
 * @returns Simple pass/fail result
 */
export async function quickBlurCheck(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ pass: boolean; score: number; error?: string }> {
  const result = await detectBlur(imageBuffer, mimeType)

  return {
    pass: result.canBeProcessed,
    score: result.blurScore,
    error: result.error,
  }
}

/**
 * Generate Vietnamese summary of issues
 */
function generateIssuesSummary(issues: BlurIssue[]): string {
  if (!issues || issues.length === 0) {
    return 'Không có vấn đề về chất lượng'
  }

  const summaryParts = issues.map((issue) => {
    const typeLabel = getIssueTypeLabel(issue.type)
    const severityLabel = getSeverityLabel(issue.severity)
    return `${typeLabel} (${severityLabel})`
  })

  return summaryParts.join(', ')
}

/**
 * Get quality grade from blur score
 */
export function getQualityGrade(blurScore: number): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label: string
  labelVi: string
} {
  if (blurScore <= 0.1) {
    return { grade: 'A', label: 'Excellent', labelVi: 'Xuất sắc' }
  } else if (blurScore <= 0.3) {
    return { grade: 'B', label: 'Good', labelVi: 'Tốt' }
  } else if (blurScore <= 0.5) {
    return { grade: 'C', label: 'Acceptable', labelVi: 'Chấp nhận được' }
  } else if (blurScore <= 0.7) {
    return { grade: 'D', label: 'Poor', labelVi: 'Kém' }
  } else {
    return { grade: 'F', label: 'Unusable', labelVi: 'Không sử dụng được' }
  }
}

/**
 * Check if image should trigger a resend request
 */
export function shouldRequestResend(result: ImageQualityResult): boolean {
  // Request resend if not processable
  if (!result.canBeProcessed) return true

  // Request resend if any severe issues
  const hasSevereIssue = result.issues.some((issue) => issue.severity === 'severe')
  if (hasSevereIssue) return true

  // Request resend if blur score is too high
  if (result.blurScore > PROCESS_THRESHOLD) return true

  return false
}

/**
 * Get resend request message in Vietnamese
 */
export function getResendMessage(result: ImageQualityResult): string {
  if (result.issues.length === 0) {
    return 'Vui lòng chụp lại ảnh với chất lượng cao hơn.'
  }

  // Find the most severe issue
  const severityOrder = { severe: 0, moderate: 1, minor: 2 }
  const sortedIssues = [...result.issues].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  )

  const mainIssue = sortedIssues[0]
  const issueLabel = getIssueTypeLabel(mainIssue.type)

  return `${issueLabel}: ${mainIssue.description}. Vui lòng chụp lại ảnh.`
}

// Re-export types
export type { BlurIssue, BlurDetectionResult }
