/**
 * Shared hook for category expand/collapse logic
 * Used by WizardStep2Income and WizardStep3Deductions
 */

import { useState, useCallback } from 'react'

export interface CategoryItem {
  key: string
  label: string
  hint?: string
  detailFields?: DetailField[]
}

export interface DetailField {
  key: string
  label: string
  type: 'number' | 'text' | 'currency'
  placeholder?: string
}

/**
 * Hook for managing category expand/collapse state
 * @param initialExpanded - Array of category IDs to expand initially
 */
export function useCategoryToggle(initialExpanded: string[] = []) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(initialExpanded)
  )

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const isExpanded = useCallback(
    (categoryId: string) => expandedCategories.has(categoryId),
    [expandedCategories]
  )

  return {
    expandedCategories,
    toggleCategory,
    isExpanded,
  }
}

/**
 * Helper to handle item toggle with cascading clear of detail fields
 */
export function createItemToggleHandler(
  answers: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void
) {
  return (item: CategoryItem) => {
    const currentValue = answers[item.key] === true
    onChange(item.key, !currentValue)

    // Clear detail fields when unchecking
    if (currentValue && item.detailFields) {
      item.detailFields.forEach((field) => {
        onChange(field.key, undefined)
      })
    }
  }
}
