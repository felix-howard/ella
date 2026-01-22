/**
 * OCR Extractor Unit Tests
 * Tests for OCR extraction service including PDF support
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractDocumentData,
  getExtractionStatusMessage,
  needsManualVerification,
  type OcrExtractionResult,
} from '../ocr-extractor'

// Mock gemini-client module
vi.mock('../gemini-client', () => ({
  analyzeImage: vi.fn(),
  isGeminiConfigured: true,
}))

// Mock prompts/ocr module
vi.mock('../prompts/ocr', () => ({
  getOcrPromptForDocType: vi.fn().mockReturnValue('Extract W2 data...'),
  supportsOcrExtraction: vi.fn().mockReturnValue(true),
  validateExtractedData: vi.fn().mockReturnValue(true),
  getFieldLabels: vi.fn().mockReturnValue({
    employerName: 'Tên công ty',
    wagesTipsOther: 'Lương, tips và các khoản khác',
  }),
}))

// Get mocks
import { analyzeImage } from '../gemini-client'
import { supportsOcrExtraction, getOcrPromptForDocType } from '../prompts/ocr'
const mockAnalyzeImage = vi.mocked(analyzeImage)
const mockSupportsOcr = vi.mocked(supportsOcrExtraction)
const mockGetPrompt = vi.mocked(getOcrPromptForDocType)

// Test image buffer (minimal JPEG magic bytes)
function createTestImageBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
}

// Mock W2 extracted data
function createMockW2Data(): Record<string, unknown> {
  return {
    employerName: 'Acme Corp',
    employerEIN: '12-3456789',
    employeeSSN: '***-**-1234',
    wagesTipsOther: '50000.00',
    federalIncomeTaxWithheld: '5000.00',
    socialSecurityWages: '50000.00',
    socialSecurityTaxWithheld: '3100.00',
    medicareWagesAndTips: '50000.00',
    medicareTaxWithheld: '725.00',
  }
}

describe('extractDocumentData - Image OCR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupportsOcr.mockReturnValue(true)
    mockGetPrompt.mockReturnValue('Extract W2 data...')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts W2 data from image successfully', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: createMockW2Data(),
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(true)
    expect(result.docType).toBe('W2')
    expect(result.extractedData).not.toBeNull()
    expect(result.extractedData?.employerName).toBe('Acme Corp')
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.isValid).toBe(true)
  })

  it('handles unsupported mime type', async () => {
    const result = await extractDocumentData(Buffer.from('test'), 'text/plain', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported MIME type')
    expect(mockAnalyzeImage).not.toHaveBeenCalled()
  })

  it('handles unsupported doc type', async () => {
    mockSupportsOcr.mockReturnValue(false)

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'UNKNOWN')

    expect(result.success).toBe(false)
    expect(result.error).toContain('does not support OCR')
  })

  it('handles missing OCR prompt', async () => {
    mockGetPrompt.mockReturnValue(null)

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('No OCR prompt')
  })

  it('handles Gemini API failure', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: false,
      error: 'API error',
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('API error')
  })

  it('tracks processing time', async () => {
    mockAnalyzeImage.mockResolvedValueOnce({
      success: true,
      data: createMockW2Data(),
    })

    const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'W2')

    expect(result.processingTimeMs).toBeDefined()
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
  })
})

describe('getExtractionStatusMessage', () => {
  it('returns error message for failed extraction', () => {
    const result: OcrExtractionResult = {
      success: false,
      docType: 'W2',
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
      error: 'API error',
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('Lỗi')
    expect(message).toContain('API error')
  })

  it('returns validation message for invalid data', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: {},
      confidence: 0.8,
      isValid: false,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('không hợp lệ')
  })

  it('returns high confidence message', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.92,
      isValid: true,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('độ tin cậy cao')
  })

  it('returns medium confidence message', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.75,
      isValid: true,
      fieldLabels: {},
    }

    const message = getExtractionStatusMessage(result)
    expect(message).toContain('cần xác minh')
  })
})

describe('needsManualVerification', () => {
  it('returns true for failed extraction', () => {
    const result: OcrExtractionResult = {
      success: false,
      docType: 'W2',
      extractedData: null,
      confidence: 0,
      isValid: false,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns true for invalid data', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: {},
      confidence: 0.9,
      isValid: false,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns true for low confidence', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.7,
      isValid: true,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(true)
  })

  it('returns false for high confidence valid extraction', () => {
    const result: OcrExtractionResult = {
      success: true,
      docType: 'W2',
      extractedData: createMockW2Data(),
      confidence: 0.92,
      isValid: true,
      fieldLabels: {},
    }

    expect(needsManualVerification(result)).toBe(false)
  })
})

// =============================================================================
// NEW DOCUMENT TYPE EXTRACTION TESTS (Phase 2-4)
// =============================================================================
describe('extractDocumentData - New Document Types', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupportsOcr.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Phase 2 - Priority 1 OCR Types', () => {
    it('extracts FORM_1099_K data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1099-K data...')
      const mock1099KData = {
        filerName: 'Square Inc',
        payeeName: 'ABC Nail Salon',
        payeeTIN: '12-3456789',
        grossAmount: 85000.0,
        monthlyAmounts: { january: 7000, february: 7000 },
        stateTaxInfo: [],
        corrected: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1099KData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_K')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_K')
      expect(result.extractedData?.grossAmount).toBe(85000.0)
    })

    it('extracts SCHEDULE_K1 data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract Schedule K-1 data...')
      const mockK1Data = {
        partnershipName: 'ABC Partners LLC',
        partnershipEIN: '12-3456789',
        partnerName: 'John Partner',
        partnerSSN: '123-45-6789',
        ordinaryBusinessIncome: 50000,
        generalPartner: false,
        limitedPartner: true,
        domesticPartner: true,
        foreignPartner: false,
        amended: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mockK1Data })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'SCHEDULE_K1')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('SCHEDULE_K1')
      expect(result.extractedData?.ordinaryBusinessIncome).toBe(50000)
    })

    it('extracts BANK_STATEMENT data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract bank statement data...')
      const mockBankData = {
        bankName: 'Chase Bank',
        accountNumber: '****1234',
        beginningBalance: 15000,
        endingBalance: 18500,
        totalDeposits: 25000,
        totalWithdrawals: 21500,
        largeDeposits: [{ date: '01/15/2024', description: 'Deposit', amount: 5000 }],
        largeWithdrawals: [{ date: '01/10/2024', description: 'Rent', amount: 3500 }],
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mockBankData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'BANK_STATEMENT')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('BANK_STATEMENT')
      expect(result.extractedData?.bankName).toBe('Chase Bank')
    })
  })

  describe('Phase 3 - Priority 2 OCR Types', () => {
    it('extracts FORM_1099_DIV data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1099-DIV data...')
      const mock1099DivData = {
        payerName: 'Vanguard Group',
        recipientTIN: '123-45-6789',
        totalOrdinaryDividends: 1500,
        qualifiedDividends: 1200,
        stateTaxInfo: [],
        corrected: false,
        fatcaFilingRequirement: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1099DivData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_DIV')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_DIV')
      expect(result.extractedData?.totalOrdinaryDividends).toBe(1500)
    })

    it('extracts FORM_1099_R data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1099-R data...')
      const mock1099RData = {
        payerName: 'Fidelity Investments',
        recipientTIN: '123-45-6789',
        grossDistribution: 25000,
        taxableAmount: 25000,
        distributionCodes: '7',
        taxableAmountNotDetermined: false,
        totalDistribution: true,
        iraSepSimple: true,
        stateTaxInfo: [],
        localTaxInfo: [],
        corrected: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1099RData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_R')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_R')
      expect(result.extractedData?.grossDistribution).toBe(25000)
    })

    it('extracts FORM_1099_SSA data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract SSA-1099 data...')
      const mockSsaData = {
        beneficiaryName: 'JOHN DOE',
        beneficiarySSN: '123-45-6789',
        netBenefits: 18000,
        voluntaryTaxWithheld: 1800,
        formType: 'SSA-1099',
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mockSsaData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_SSA')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_SSA')
      expect(result.extractedData?.netBenefits).toBe(18000)
    })

    it('extracts FORM_1098 data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1098 data...')
      const mock1098Data = {
        recipientName: 'ABC Mortgage Company',
        payerTIN: '123-45-6789',
        mortgageInterestReceived: 12500,
        outstandingMortgagePrincipal: 350000,
        corrected: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1098Data })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1098')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1098')
      expect(result.extractedData?.mortgageInterestReceived).toBe(12500)
    })

    it('extracts FORM_1095_A data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1095-A data...')
      const mock1095AData = {
        recipientName: 'JOHN DOE',
        recipientSSN: '123-45-6789',
        policyNumber: '12345678',
        monthlyData: [{ month: 'January', enrollmentPremium: 800, slcsp: 900, advancePayment: 500 }],
        coveredIndividuals: [],
        annualAdvancePayment: 6000,
        corrected: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1095AData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1095_A')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1095_A')
      expect(result.extractedData?.policyNumber).toBe('12345678')
    })
  })

  describe('Phase 4 - Priority 3 OCR Types', () => {
    it('extracts FORM_1098_T data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1098-T data...')
      const mock1098TData = {
        filerName: 'State University',
        studentName: 'John Student',
        studentTIN: '123-45-6789',
        paymentsReceived: 15000,
        scholarshipsGrants: 5000,
        corrected: false,
        halfTimeStudent: true,
        graduateStudent: false,
        includesJanMarch: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1098TData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1098_T')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1098_T')
      expect(result.extractedData?.paymentsReceived).toBe(15000)
    })

    it('extracts FORM_1099_G data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1099-G data...')
      const mock1099GData = {
        payerName: 'State Unemployment Agency',
        recipientTIN: '123-45-6789',
        unemploymentCompensation: 15000,
        federalIncomeTaxWithheld: 1500,
        stateTaxInfo: [],
        marketGain: false,
        corrected: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1099GData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_G')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_G')
      expect(result.extractedData?.unemploymentCompensation).toBe(15000)
    })

    it('extracts FORM_1099_MISC data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract 1099-MISC data...')
      const mock1099MiscData = {
        payerName: 'ABC Property Management',
        recipientTIN: '123-45-6789',
        rents: 24000,
        royalties: null,
        stateTaxInfo: [],
        payerMadeDirectSales: false,
        corrected: false,
        fatcaFilingRequirement: false,
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mock1099MiscData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'FORM_1099_MISC')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('FORM_1099_MISC')
      expect(result.extractedData?.rents).toBe(24000)
    })
  })

  describe('ID Document Types', () => {
    it('extracts SSN_CARD data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract SSN card data...')
      const mockSsnData = {
        fullName: 'JOHN DOE',
        socialSecurityNumber: '123-45-6789',
        signatureRequired: false,
        cardType: 'REGULAR',
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mockSsnData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'SSN_CARD')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('SSN_CARD')
      expect(result.extractedData?.fullName).toBe('JOHN DOE')
    })

    it('extracts DRIVER_LICENSE data successfully', async () => {
      mockGetPrompt.mockReturnValue('Extract driver license data...')
      const mockDLData = {
        fullName: 'JOHN DOE',
        licenseNumber: 'D1234567',
        dateOfBirth: '01/15/1980',
        expirationDate: '01/15/2028',
        address: '123 Main St, City, ST 12345',
        state: 'CA',
      }
      mockAnalyzeImage.mockResolvedValueOnce({ success: true, data: mockDLData })

      const result = await extractDocumentData(createTestImageBuffer(), 'image/jpeg', 'DRIVER_LICENSE')

      expect(result.success).toBe(true)
      expect(result.docType).toBe('DRIVER_LICENSE')
      expect(result.extractedData?.licenseNumber).toBe('D1234567')
    })
  })
})
