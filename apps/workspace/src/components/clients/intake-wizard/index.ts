/**
 * Intake Wizard Module
 * 4-step wizard for client intake form
 */

export { WizardContainer } from './wizard-container'
export type { WizardContainerProps, IntakeAnswers, DependentData } from './wizard-container'

export { WizardStepIndicator } from './wizard-step-indicator'
export { WizardStep1Identity } from './wizard-step-1-identity'
export { WizardStep2Income } from './wizard-step-2-income'
export { WizardStep3Deductions } from './wizard-step-3-deductions'
export { WizardStep4Review } from './wizard-step-4-review'
export { DependentGrid } from './dependent-grid'

// Shared hooks and utilities
export { useCategoryToggle, createItemToggleHandler } from './use-category-toggle'
export * from './wizard-constants'
