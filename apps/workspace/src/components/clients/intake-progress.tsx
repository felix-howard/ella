/**
 * IntakeProgress - Visual progress indicator for intake form completion
 * Shows percentage of required visible questions that have been answered
 */

import { useMemo } from 'react'
import type { IntakeQuestion as IntakeQuestionType } from '../../lib/api-client'

interface IntakeProgressProps {
  questions: IntakeQuestionType[]
  answers: Record<string, unknown>
}

/**
 * Evaluate simple condition (key:value format) against answers
 */
function evaluateConditionClient(
  conditionJson: string | null,
  answers: Record<string, unknown>
): boolean {
  if (!conditionJson) return true
  try {
    const condition = JSON.parse(conditionJson)
    // Simple key:value condition
    if (condition.key && 'value' in condition) {
      return answers[condition.key] === condition.value
    }
    // Legacy flat object format (all keys must match)
    for (const [key, val] of Object.entries(condition)) {
      if (answers[key] !== val) return false
    }
    return true
  } catch {
    return true
  }
}

export function IntakeProgress({ questions, answers }: IntakeProgressProps) {
  const { progress, answered, total } = useMemo(() => {
    // Filter to visible questions (condition met or no condition)
    const visible = questions.filter(q =>
      evaluateConditionClient(q.condition, answers)
    )
    // All visible questions are considered for progress
    // (IntakeQuestion doesn't have isRequired field, treat all as required for UX)
    // Count answered questions (not undefined or empty string)
    const answeredList = visible.filter(q => {
      const val = answers[q.questionKey]
      return val !== undefined && val !== '' && val !== null
    })

    const percent = visible.length > 0
      ? Math.round((answeredList.length / visible.length) * 100)
      : 100

    return {
      progress: percent,
      answered: answeredList.length,
      total: visible.length,
    }
  }, [questions, answers])

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {answered}/{total} ({progress}%)
      </span>
    </div>
  )
}
