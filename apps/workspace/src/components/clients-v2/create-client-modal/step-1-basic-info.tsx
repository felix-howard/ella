/**
 * Step 1: Basic Info - Name, Phone, Email, Language
 * - Phone validation: US format (818) 222-3333 or 10-15 digits
 * - Auto-formatting for phone input
 * - Email validation (RFC 5321 format)
 * - Input sanitization for XSS prevention
 */

import { useState } from 'react'
import { Button, Input } from '@ella/ui'
import { cn } from '@ella/ui'
import { stripHtmlTags } from '../../../lib/formatters'
import type { StepProps } from './types'

/** Max input lengths for security */
const MAX_NAME_LENGTH = 100
const MAX_PHONE_LENGTH = 20
const MAX_EMAIL_LENGTH = 254

/** Validate phone: 10-15 digits */
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** Validate email: RFC 5321 basic format */
function isValidEmail(email: string): boolean {
  if (!email) return true // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH
}

/** Sanitize input: strip HTML, control chars, limit length */
function sanitizeInput(value: string, maxLength: number): string {
  // Strip HTML tags
  let sanitized = stripHtmlTags(value)
  // Remove control characters (except newline, tab, carriage return)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  // Trim and limit length
  return sanitized.trim().slice(0, maxLength)
}

/** Format phone for display: supports 10-15 digits */
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15)

  // 10 digits: (XXX) XXX-XXXX
  if (digits.length <= 10) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // 11 digits with country code 1: +1 (XXX) XXX-XXXX
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // 11-15 digits: +XX XXXXXXXXXX (basic international)
  return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}`
}

export function Step1BasicInfo({ formData, onUpdate, onNext }: StepProps) {
  const [touched, setTouched] = useState({ name: false, phone: false, email: false })

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeInput(e.target.value, MAX_NAME_LENGTH)
    onUpdate({ name: sanitized })
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    onUpdate({ phone: formatted.slice(0, MAX_PHONE_LENGTH) })
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeInput(e.target.value, MAX_EMAIL_LENGTH)
    onUpdate({ email: sanitized })
  }

  const handleBlur = (field: 'name' | 'phone' | 'email') => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  // Validation checks
  const nameValid = formData.name.trim().length > 0
  const phoneValid = isValidPhone(formData.phone)
  const emailValid = isValidEmail(formData.email)
  const isValid = nameValid && phoneValid && emailValid

  // Error messages for touched fields
  const nameError = touched.name && !nameValid ? 'Vui lòng nhập tên khách hàng' : ''
  const phoneError = touched.phone && !phoneValid ? 'Số điện thoại phải có 10-15 số' : ''
  const emailError = touched.email && !emailValid ? 'Email không hợp lệ' : ''

  return (
    <div className="space-y-4">
      {/* Name field (required) */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Tên khách hàng <span className="text-destructive">*</span>
        </label>
        <Input
          id="name"
          placeholder="VD: Nguyễn Văn An"
          value={formData.name}
          onChange={handleNameChange}
          onBlur={() => handleBlur('name')}
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
          autoFocus
        />
        {nameError && (
          <p id="name-error" className="text-xs text-destructive" role="alert">
            {nameError}
          </p>
        )}
      </div>

      {/* Phone field (required) */}
      <div className="space-y-2">
        <label htmlFor="phone" className="text-sm font-medium">
          Số điện thoại <span className="text-destructive">*</span>
        </label>
        <Input
          id="phone"
          placeholder="(818) 222-3333"
          value={formData.phone}
          onChange={handlePhoneChange}
          onBlur={() => handleBlur('phone')}
          maxLength={MAX_PHONE_LENGTH}
          type="tel"
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? 'phone-error' : 'phone-hint'}
        />
        {phoneError ? (
          <p id="phone-error" className="text-xs text-destructive" role="alert">
            {phoneError}
          </p>
        ) : (
          <p id="phone-hint" className="text-xs text-muted-foreground">
            Định dạng: (XXX) XXX-XXXX hoặc 10-15 số
          </p>
        )}
      </div>

      {/* Email field (optional) */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email <span className="text-muted-foreground">(không bắt buộc)</span>
        </label>
        <Input
          id="email"
          placeholder="email@example.com"
          value={formData.email}
          onChange={handleEmailChange}
          onBlur={() => handleBlur('email')}
          maxLength={MAX_EMAIL_LENGTH}
          type="email"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p id="email-error" className="text-xs text-destructive" role="alert">
            {emailError}
          </p>
        )}
      </div>

      {/* Language toggle with ARIA radiogroup */}
      <div className="space-y-2">
        <label id="language-label" className="text-sm font-medium">
          Ngôn ngữ
        </label>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-labelledby="language-label"
        >
          <button
            type="button"
            role="radio"
            aria-checked={formData.language === 'VI'}
            onClick={() => onUpdate({ language: 'VI' })}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors',
              formData.language === 'VI'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            )}
          >
            Tiếng Việt
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={formData.language === 'EN'}
            onClick={() => onUpdate({ language: 'EN' })}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors',
              formData.language === 'EN'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted'
            )}
          >
            English
          </button>
        </div>
      </div>

      {/* Next button */}
      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!isValid}>
          Tiếp tục
        </Button>
      </div>
    </div>
  )
}
