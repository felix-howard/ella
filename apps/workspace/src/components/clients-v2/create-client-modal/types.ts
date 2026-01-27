/**
 * Create Client Modal V2 - Type Definitions
 * Document-first workflow: simplified 3-step client creation
 */

/** Form data collected across all steps */
export interface CreateClientFormData {
  // Step 1: Basic Info
  name: string
  phone: string
  email: string
  language: 'VI' | 'EN'

  // Step 2: Tax Year (Phase 03)
  taxYear?: number
  formType?: string

  // Step 3: Preview (Phase 04)
  sendSmsOnCreate?: boolean
}

/** Current step in the wizard (1-3) */
export type CreateClientStep = 1 | 2 | 3

/** Props shared by all step components */
export interface StepProps {
  formData: CreateClientFormData
  onUpdate: (data: Partial<CreateClientFormData>) => void
  onNext: () => void
  onBack?: () => void
}
