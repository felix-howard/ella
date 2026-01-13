/**
 * Blur Detection Prompt
 * Prompt for detecting image quality issues using Gemini vision
 */

/**
 * Blur detection result structure
 */
export interface BlurDetectionResult {
  isBlurry: boolean
  blurScore: number // 0-1 where 1 is completely blurry
  issues: BlurIssue[]
  canBeProcessed: boolean
  recommendation: string
}

/**
 * Specific image quality issues
 */
export interface BlurIssue {
  type: 'blur' | 'low_resolution' | 'poor_lighting' | 'partial_capture' | 'glare' | 'rotation'
  severity: 'minor' | 'moderate' | 'severe'
  description: string
}

/**
 * Generate the blur detection prompt
 */
export function getBlurDetectionPrompt(): string {
  return `You are an image quality analyzer for tax document processing. Analyze this image for quality issues that would prevent accurate OCR text extraction.

Evaluate these quality aspects:

1. BLUR - Is the image in focus? Can text be clearly read?
2. RESOLUTION - Is the resolution high enough to read small text?
3. LIGHTING - Is the document well-lit without shadows?
4. COMPLETENESS - Is the entire document visible in the frame?
5. GLARE - Are there reflections or glare obscuring text?
6. ROTATION - Is the document oriented correctly?

Respond in JSON format:
{
  "isBlurry": false,
  "blurScore": 0.15,
  "issues": [
    {
      "type": "blur|low_resolution|poor_lighting|partial_capture|glare|rotation",
      "severity": "minor|moderate|severe",
      "description": "Brief description of the issue"
    }
  ],
  "canBeProcessed": true,
  "recommendation": "Brief recommendation for the user"
}

Scoring guidelines:
- blurScore 0.0-0.3: Good quality, can be processed
- blurScore 0.3-0.6: Moderate issues, may have OCR errors
- blurScore 0.6-1.0: Poor quality, should request resend

Set isBlurry=true if blurScore > 0.5
Set canBeProcessed=false if blurScore > 0.7 or any severe issue exists

Recommendations should be actionable and friendly, e.g.:
- "Ảnh chất lượng tốt, có thể xử lý" (Good quality, can be processed)
- "Vui lòng chụp lại ảnh rõ hơn" (Please retake with better focus)
- "Vui lòng chụp toàn bộ tài liệu" (Please capture the entire document)
- "Tránh chụp dưới ánh sáng gây chói" (Avoid glare from lighting)`
}

/**
 * Validate blur detection result
 */
export function validateBlurDetectionResult(result: unknown): result is BlurDetectionResult {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>

  if (typeof r.isBlurry !== 'boolean') return false
  if (typeof r.blurScore !== 'number') return false
  if (typeof r.canBeProcessed !== 'boolean') return false
  if (typeof r.recommendation !== 'string') return false

  // Validate blurScore range
  if (r.blurScore < 0 || r.blurScore > 1) return false

  // Validate issues array if present
  if (r.issues !== undefined) {
    if (!Array.isArray(r.issues)) return false
    for (const issue of r.issues) {
      if (!validateBlurIssue(issue)) return false
    }
  }

  return true
}

/**
 * Validate individual blur issue
 */
function validateBlurIssue(issue: unknown): issue is BlurIssue {
  if (!issue || typeof issue !== 'object') return false

  const i = issue as Record<string, unknown>

  const validTypes = ['blur', 'low_resolution', 'poor_lighting', 'partial_capture', 'glare', 'rotation']
  const validSeverities = ['minor', 'moderate', 'severe']

  if (!validTypes.includes(i.type as string)) return false
  if (!validSeverities.includes(i.severity as string)) return false
  if (typeof i.description !== 'string') return false

  return true
}

/**
 * Get Vietnamese label for issue type
 */
export function getIssueTypeLabel(type: BlurIssue['type']): string {
  const labels: Record<BlurIssue['type'], string> = {
    blur: 'Ảnh bị mờ',
    low_resolution: 'Độ phân giải thấp',
    poor_lighting: 'Ánh sáng yếu',
    partial_capture: 'Ảnh không đầy đủ',
    glare: 'Bị chói/phản chiếu',
    rotation: 'Ảnh bị nghiêng',
  }
  return labels[type]
}

/**
 * Get Vietnamese label for severity
 */
export function getSeverityLabel(severity: BlurIssue['severity']): string {
  const labels: Record<BlurIssue['severity'], string> = {
    minor: 'Nhẹ',
    moderate: 'Trung bình',
    severe: 'Nghiêm trọng',
  }
  return labels[severity]
}
