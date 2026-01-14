/**
 * Data Entry Mode Page - Optimized workflow for copying data to OltPro
 * Features: toast feedback, keyboard nav (Tab/Enter/Arrows), copy all, complete workflow
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { cn } from '@ella/ui'
import {
  ArrowLeft,
  Copy,
  FileText,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Loader2,
} from 'lucide-react'
import { DocTabsSidebar } from '../../../components/data-entry'
import { OriginalImageViewer } from '../../../components/data-entry'
import { useClipboard } from '../../../hooks'
import { toast } from '../../../stores/toast-store'
import {
  DOC_TYPE_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
} from '../../../lib/constants'
import { formatPhone } from '../../../lib/formatters'
import type { DigitalDoc, RawImage, TaxCaseStatus } from '../../../lib/api-client'

export const Route = createFileRoute('/cases/$caseId/entry')({
  component: DataEntryPage,
  parseParams: (params) => ({ caseId: params.caseId }),
})

// Field configurations for different doc types (copy order optimized for OltPro)
const ENTRY_FIELD_CONFIG: Record<string, { key: string; label: string }[]> = {
  W2: [
    { key: 'employerEin', label: 'EIN công ty' },
    { key: 'employerName', label: 'Tên công ty' },
    { key: 'wagesTips', label: 'Box 1: Lương' },
    { key: 'federalTaxWithheld', label: 'Box 2: Thuế đã khấu' },
    { key: 'socialSecurityWages', label: 'Box 3: SS Wages' },
    { key: 'socialSecurityTax', label: 'Box 4: SS Tax' },
    { key: 'medicareWages', label: 'Box 5: Medicare Wages' },
    { key: 'medicareTax', label: 'Box 6: Medicare Tax' },
    { key: 'stateTaxWithheld', label: 'Box 17: State Tax' },
  ],
  SSN_CARD: [
    { key: 'ssn', label: 'SSN' },
    { key: 'name', label: 'Họ tên' },
  ],
  DRIVER_LICENSE: [
    { key: 'name', label: 'Họ tên' },
    { key: 'dateOfBirth', label: 'Ngày sinh' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'licenseNumber', label: 'Số bằng lái' },
  ],
  FORM_1099_INT: [
    { key: 'payerName', label: 'Ngân hàng' },
    { key: 'payerTin', label: 'TIN ngân hàng' },
    { key: 'interestIncome', label: 'Box 1: Tiền lãi' },
    { key: 'federalTaxWithheld', label: 'Box 4: Thuế đã khấu' },
  ],
  FORM_1099_NEC: [
    { key: 'payerName', label: 'Người trả' },
    { key: 'payerTin', label: 'TIN người trả' },
    { key: 'nonemployeeCompensation', label: 'Box 1: Thu nhập' },
    { key: 'federalTaxWithheld', label: 'Box 4: Thuế đã khấu' },
  ],
  FORM_1099_DIV: [
    { key: 'payerName', label: 'Công ty' },
    { key: 'ordinaryDividends', label: 'Box 1a: Cổ tức' },
    { key: 'qualifiedDividends', label: 'Box 1b: Qualified' },
    { key: 'federalTaxWithheld', label: 'Box 4: Thuế đã khấu' },
  ],
  BANK_STATEMENT: [
    { key: 'bankName', label: 'Ngân hàng' },
    { key: 'routingNumber', label: 'Routing Number' },
    { key: 'accountNumber', label: 'Số tài khoản' },
  ],
}

function DataEntryPage() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [copiedFields, setCopiedFields] = useState<Record<string, Set<string>>>({})
  const [expandedImage, setExpandedImage] = useState(false)
  const [showKeyboardHints, setShowKeyboardHints] = useState(true)
  const [focusedFieldIndex, setFocusedFieldIndex] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)
  const fieldListRef = useRef<HTMLDivElement>(null)

  const { copy } = useClipboard()

  // TODO: Replace with API call using useSuspenseQuery
  // Mock data wrapped in useMemo for stable references
  const taxCase = useMemo(() => ({
    id: caseId,
    clientId: 'client-1',
    taxYear: 2025,
    status: 'READY_FOR_ENTRY' as TaxCaseStatus,
    client: {
      id: 'client-1',
      name: 'Nguyễn Văn An',
      phone: '8182223333',
    },
  }), [caseId])

  const digitalDocs = useMemo<DigitalDoc[]>(() => [
    {
      id: 'doc-1',
      caseId,
      rawImageId: 'img-1',
      docType: 'W2',
      status: 'VERIFIED',
      extractedData: {
        employerName: 'ABC Corporation',
        employerEin: '12-3456789',
        wagesTips: 75000,
        federalTaxWithheld: 12500,
        socialSecurityWages: 75000,
        socialSecurityTax: 4650,
        medicareWages: 75000,
        medicareTax: 1087.5,
        stateTaxWithheld: 3750,
      },
      createdAt: '2026-01-11T10:05:00Z',
      updatedAt: '2026-01-11T10:05:00Z',
      rawImage: { id: 'img-1', filename: 'w2_2025.jpg', r2Key: 'images/w2_2025.jpg' },
    },
    {
      id: 'doc-2',
      caseId,
      rawImageId: 'img-2',
      docType: 'FORM_1099_INT',
      status: 'VERIFIED',
      extractedData: {
        payerName: 'Chase Bank',
        payerTin: '85-1234567',
        interestIncome: 245.67,
        federalTaxWithheld: 0,
      },
      createdAt: '2026-01-12T08:00:00Z',
      updatedAt: '2026-01-12T08:00:00Z',
      rawImage: { id: 'img-2', filename: '1099_int_chase.jpg', r2Key: 'images/1099_int.jpg' },
    },
    {
      id: 'doc-3',
      caseId,
      rawImageId: 'img-3',
      docType: 'SSN_CARD',
      status: 'VERIFIED',
      extractedData: {
        name: 'Nguyen Van An',
        ssn: '123-45-6789',
      },
      createdAt: '2026-01-10T09:00:00Z',
      updatedAt: '2026-01-10T09:00:00Z',
      rawImage: { id: 'img-3', filename: 'ssn_card.jpg', r2Key: 'images/ssn_card.jpg' },
    },
  ], [caseId])

  const rawImages = useMemo<RawImage[]>(() => [
    { id: 'img-1', caseId, filename: 'w2_2025.jpg', r2Key: 'images/w2_2025.jpg', status: 'LINKED', createdAt: '2026-01-11T10:00:00Z', updatedAt: '2026-01-11T10:00:00Z' },
    { id: 'img-2', caseId, filename: '1099_int_chase.jpg', r2Key: 'images/1099_int.jpg', status: 'LINKED', createdAt: '2026-01-12T08:00:00Z', updatedAt: '2026-01-12T08:00:00Z' },
    { id: 'img-3', caseId, filename: 'ssn_card.jpg', r2Key: 'images/ssn_card.jpg', status: 'LINKED', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-01-10T09:00:00Z' },
  ], [caseId])

  // Initialize selected doc
  useEffect(() => {
    if (!selectedDocId && digitalDocs.length > 0) {
      setSelectedDocId(digitalDocs[0].id)
    }
  }, [selectedDocId, digitalDocs])

  const selectedDoc = digitalDocs.find((d) => d.id === selectedDocId)
  const selectedImage = rawImages.find((i) => i.id === selectedDoc?.rawImageId) || null
  const fieldConfig = useMemo(
    () => selectedDoc ? (ENTRY_FIELD_CONFIG[selectedDoc.docType] || []) : [],
    [selectedDoc]
  )

  // Navigate between docs
  const currentIndex = digitalDocs.findIndex((d) => d.id === selectedDocId)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < digitalDocs.length - 1

  const goToPrev = useCallback(() => {
    if (canGoPrev) {
      setSelectedDocId(digitalDocs[currentIndex - 1].id)
      setFocusedFieldIndex(0)
    }
  }, [canGoPrev, digitalDocs, currentIndex])

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setSelectedDocId(digitalDocs[currentIndex + 1].id)
      setFocusedFieldIndex(0)
    }
  }, [canGoNext, digitalDocs, currentIndex])

  // Copy field with toast and state tracking
  const handleCopyField = useCallback(async (docId: string, fieldKey: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      toast.info('Trường này không có dữ liệu')
      return
    }

    const success = await copy(String(value))
    if (success) {
      setCopiedFields((prev) => {
        const docFields = new Set(prev[docId] || [])
        docFields.add(fieldKey)
        return { ...prev, [docId]: docFields }
      })
    }
  }, [copy])

  // Copy all fields of current doc
  const handleCopyAll = useCallback(async () => {
    if (!selectedDoc) return

    const docType = DOC_TYPE_LABELS[selectedDoc.docType] || selectedDoc.docType
    const lines = fieldConfig
      .map((f) => {
        const value = selectedDoc.extractedData[f.key]
        return value !== undefined && value !== null && value !== ''
          ? `${f.label}: ${value}`
          : null
      })
      .filter(Boolean)

    if (lines.length === 0) {
      toast.info('Không có dữ liệu để copy')
      return
    }

    const formattedText = `--- ${docType} ---\n${lines.join('\n')}`
    const success = await copy(formattedText)

    if (success) {
      const allFields = new Set(fieldConfig.map((f) => f.key))
      setCopiedFields((prev) => ({ ...prev, [selectedDoc.id]: allFields }))
      toast.success(`Đã copy tất cả ${lines.length} trường`)
    }
  }, [selectedDoc, fieldConfig, copy])

  // Debounce ref for Enter key to prevent rapid copy spam
  const lastCopyTimeRef = useRef(0)
  const COPY_DEBOUNCE_MS = 200

  // Keyboard navigation with route-level check and debounced Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Route-level check: only handle if data entry page is focused
      const dataEntryContainer = document.querySelector('[data-entry-page]')
      if (!dataEntryContainer) return

      switch (e.key) {
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            // Shift+Tab: previous field
            setFocusedFieldIndex((prev) => Math.max(0, prev - 1))
          } else {
            // Tab: next field, or next doc if at end
            if (focusedFieldIndex >= fieldConfig.length - 1) {
              if (canGoNext) {
                goToNext()
              }
            } else {
              setFocusedFieldIndex((prev) => Math.min(fieldConfig.length - 1, prev + 1))
            }
          }
          break

        case 'Enter': {
          e.preventDefault()
          // Debounce rapid Enter key presses
          const now = Date.now()
          if (now - lastCopyTimeRef.current < COPY_DEBOUNCE_MS) return
          lastCopyTimeRef.current = now

          if (selectedDoc && fieldConfig[focusedFieldIndex]) {
            const field = fieldConfig[focusedFieldIndex]
            handleCopyField(selectedDoc.id, field.key, selectedDoc.extractedData[field.key])
          }
          break
        }

        case 'ArrowUp':
          e.preventDefault()
          setFocusedFieldIndex((prev) => Math.max(0, prev - 1))
          break

        case 'ArrowDown':
          e.preventDefault()
          setFocusedFieldIndex((prev) => Math.min(fieldConfig.length - 1, prev + 1))
          break

        case 'ArrowLeft':
          e.preventDefault()
          goToPrev()
          break

        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break

        // Ctrl+Shift+C for Copy All (avoids conflict with browser Ctrl+A select all)
        case 'c':
        case 'C':
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault()
            handleCopyAll()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedFieldIndex, fieldConfig, selectedDoc, canGoNext, goToNext, goToPrev, handleCopyField, handleCopyAll])

  // Scroll focused field into view
  useEffect(() => {
    if (fieldListRef.current) {
      const fieldElements = fieldListRef.current.querySelectorAll('[data-field-row]')
      const focusedElement = fieldElements[focusedFieldIndex]
      if (focusedElement) {
        focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [focusedFieldIndex])

  // Progress calculation memoized for performance
  const { totalDocs, completedDocs, allDocsComplete } = useMemo(() => {
    const total = digitalDocs.length
    const completed = digitalDocs.filter((doc) => {
      const docFieldConfig = ENTRY_FIELD_CONFIG[doc.docType] || []
      const copiedCount = copiedFields[doc.id]?.size || 0
      return copiedCount === docFieldConfig.length && docFieldConfig.length > 0
    }).length
    return { totalDocs: total, completedDocs: completed, allDocsComplete: completed === total }
  }, [digitalDocs, copiedFields])

  // Mark entry as complete workflow
  const handleMarkComplete = useCallback(async () => {
    if (!allDocsComplete) {
      toast.error('Vui lòng copy tất cả trường trước khi hoàn tất')
      return
    }

    setIsCompleting(true)

    try {
      // TODO: Replace with actual API call
      // await api.patch(`/cases/${caseId}`, { status: 'ENTRY_COMPLETE' })
      await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate API call

      toast.success('Đã đánh dấu hoàn tất nhập liệu!')
      navigate({ to: '/clients/$clientId', params: { clientId: taxCase.clientId } })
    } catch (error) {
      console.error('Failed to mark complete:', error)
      toast.error('Không thể cập nhật trạng thái')
    } finally {
      setIsCompleting(false)
    }
  }, [allDocsComplete, navigate, taxCase.clientId])

  const statusColors = CASE_STATUS_COLORS[taxCase.status]

  return (
    <div data-entry-page className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Link
              to="/clients/$clientId"
              params={{ clientId: taxCase.clientId }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </Link>

            <div className="h-6 w-px bg-border" />

            <div>
              <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                {taxCase.client.name}
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  statusColors?.bg,
                  statusColors?.text
                )}>
                  {CASE_STATUS_LABELS[taxCase.status]}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Năm thuế {taxCase.taxYear} • {formatPhone(taxCase.client.phone)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Đã copy: {completedDocs}/{totalDocs} tài liệu
              </span>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(completedDocs / totalDocs) * 100}%` }}
                />
              </div>
            </div>

            {/* Keyboard hints toggle */}
            <button
              onClick={() => setShowKeyboardHints(!showKeyboardHints)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showKeyboardHints ? 'bg-primary-light text-primary' : 'hover:bg-muted text-muted-foreground'
              )}
              title="Hiện/ẩn phím tắt"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Complete Button */}
            <button
              onClick={handleMarkComplete}
              disabled={!allDocsComplete || isCompleting}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors',
                allDocsComplete
                  ? 'bg-success text-white hover:bg-success/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {isCompleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Hoàn tất nhập liệu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Document List */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Tài liệu ({digitalDocs.length})
            </h2>
            <DocTabsSidebar
              docs={digitalDocs}
              activeDocId={selectedDocId}
              onDocSelect={(doc) => {
                setSelectedDocId(doc.id)
                setFocusedFieldIndex(0)
              }}
              copiedFields={copiedFields}
            />
          </div>
        </aside>

        {/* Center - Image Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <OriginalImageViewer
            key={selectedImage?.id || 'empty'}
            image={selectedImage}
            expanded={expandedImage}
            onExpandToggle={() => setExpandedImage(!expandedImage)}
            className="flex-1"
          />
        </div>

        {/* Right Panel - Data Entry */}
        <aside className="w-96 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {selectedDoc ? (
            <>
              {/* Doc Header */}
              <div className="flex-shrink-0 p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">
                      {DOC_TYPE_LABELS[selectedDoc.docType] || selectedDoc.docType}
                    </h3>
                  </div>
                  <button
                    onClick={handleCopyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
                    title="Ctrl/Cmd + Shift + C"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy tất cả</span>
                  </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={goToPrev}
                    disabled={!canGoPrev}
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      canGoPrev ? 'text-primary hover:text-primary-dark' : 'text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Trước</span>
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} / {totalDocs}
                  </span>
                  <button
                    onClick={goToNext}
                    disabled={!canGoNext}
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      canGoNext ? 'text-primary hover:text-primary-dark' : 'text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    <span>Tiếp</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fields List */}
              <div ref={fieldListRef} className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {fieldConfig.map((field, index) => {
                    const value = selectedDoc.extractedData[field.key]
                    const isCopied = copiedFields[selectedDoc.id]?.has(field.key)
                    const isFocused = index === focusedFieldIndex
                    const hasValue = value !== null && value !== undefined && value !== ''

                    return (
                      <div
                        key={field.key}
                        data-field-row
                        className={cn(
                          'group flex items-center justify-between rounded-lg transition-colors py-2 px-3',
                          'hover:bg-muted/50 cursor-pointer',
                          isFocused && 'ring-2 ring-primary bg-primary-light/30'
                        )}
                        onClick={() => {
                          setFocusedFieldIndex(index)
                          if (hasValue) {
                            handleCopyField(selectedDoc.id, field.key, value)
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground">{field.label}</p>
                          {hasValue ? (
                            <p className="font-medium text-foreground truncate">{String(value)}</p>
                          ) : (
                            <p className="text-muted-foreground italic">—</p>
                          )}
                        </div>
                        {hasValue && (
                          <button
                            className={cn(
                              'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg',
                              'text-sm font-medium transition-all',
                              isCopied
                                ? 'bg-success/10 text-success'
                                : 'bg-primary text-white hover:bg-primary-dark',
                              !isFocused && 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            {isCopied ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Đã copy</span>
                              </>
                            ) : (
                              <span>Copy</span>
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Keyboard Hints */}
              {showKeyboardHints && (
                <div className="flex-shrink-0 p-3 border-t border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground text-center">
                    Tab/↑↓: chuyển trường • Enter: copy • ←/→: chuyển doc • Ctrl+Shift+C: copy all
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Chọn tài liệu để bắt đầu nhập liệu
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
