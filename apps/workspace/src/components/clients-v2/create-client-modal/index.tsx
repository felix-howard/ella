/**
 * Create Client Modal V2 - Document-First Workflow
 * 3-step wizard: Basic Info → Tax Year → Preview & Send
 * Phase 02: Implements Step 1 (Basic Info)
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalTitle } from '@ella/ui'
import { StepIndicator } from './step-indicator'
import { Step1BasicInfo } from './step-1-basic-info'
import { Step2TaxYear } from './step-2-tax-year'
import type { CreateClientFormData, CreateClientStep } from './types'

const STEPS = [
  { label: 'Thông tin' },
  { label: 'Năm thuế' },
  { label: 'Gửi tin nhắn' },
]

const INITIAL_FORM_DATA: CreateClientFormData = {
  name: '',
  phone: '',
  email: '',
  language: 'VI',
  taxYear: new Date().getFullYear(),
  formType: '1040',
  sendSmsOnCreate: true,
}

interface CreateClientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (clientId: string) => void
}

export function CreateClientModal({
  open,
  onOpenChange,
  onSuccess: _onSuccess,
}: CreateClientModalProps) {
  const [step, setStep] = useState<CreateClientStep>(1)
  const [formData, setFormData] = useState<CreateClientFormData>(INITIAL_FORM_DATA)

  // Update form data with partial updates
  const handleUpdate = (data: Partial<CreateClientFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  // Handle modal close with state reset
  const handleClose = () => {
    onOpenChange(false)
    // Reset state after close animation completes
    setTimeout(() => {
      setStep(1)
      setFormData(INITIAL_FORM_DATA)
    }, 200)
  }

  return (
    <Modal open={open} onClose={handleClose} size="default">
      <ModalHeader>
        <ModalTitle>Thêm khách hàng</ModalTitle>
      </ModalHeader>

      <StepIndicator currentStep={step} steps={STEPS} />

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Step1BasicInfo
          formData={formData}
          onUpdate={handleUpdate}
          onNext={() => setStep(2)}
        />
      )}

      {/* Step 2: Tax Year */}
      {step === 2 && (
        <Step2TaxYear
          formData={formData}
          onUpdate={handleUpdate}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {/* Step 3: Preview & Send - Placeholder (Phase 04) */}
      {step === 3 && (
        <div className="text-muted-foreground text-center py-8">
          <p>Step 3 - Xem trước & Gửi</p>
          <p className="text-sm mt-2">Sẽ được thêm trong Phase 04</p>
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-primary hover:underline"
            >
              ← Quay lại
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Re-export types for external use
export type { CreateClientFormData, CreateClientStep } from './types'
