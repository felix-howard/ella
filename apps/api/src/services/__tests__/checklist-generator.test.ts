/**
 * Checklist Generator Unit Tests
 * Tests condition evaluation logic with intakeAnswers priority
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma before importing the module
vi.mock('../../lib/db', () => ({
  prisma: {
    checklistTemplate: {
      findMany: vi.fn(),
    },
    checklistItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    taxCase: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import { generateChecklist, refreshChecklist } from '../checklist-generator'
import type { ClientProfile, TaxType, ChecklistTemplate } from '@ella/db'

// Test helper: create mock profile
function createMockProfile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: 'test-profile-id',
    clientId: 'test-client-id',
    filingStatus: 'SINGLE',
    hasW2: false,
    hasBankAccount: false,
    hasInvestments: false,
    hasKidsUnder17: false,
    numKidsUnder17: 0,
    paysDaycare: false,
    hasKids17to24: false,
    hasSelfEmployment: false,
    hasRentalProperty: false,
    hasEmployees: false,
    hasContractors: false,
    has1099K: false,
    intakeAnswers: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ClientProfile
}

// Test helper: create mock template
function createMockTemplate(overrides: Partial<{
  id: string
  docType: string
  taxType: string
  condition: string | null
  isRequired: boolean
  expectedCount: number
  category: string
  sortOrder: number
}> = {}): ChecklistTemplate {
  return {
    id: overrides.id ?? 'template-1',
    docType: overrides.docType ?? 'W2',
    taxType: overrides.taxType ?? 'FORM_1040',
    condition: overrides.condition ?? null,
    isRequired: overrides.isRequired ?? true,
    expectedCount: overrides.expectedCount ?? 1,
    category: overrides.category ?? 'INCOME',
    sortOrder: overrides.sortOrder ?? 1,
    labelVi: 'Test Label',
    labelEn: 'Test Label',
    descriptionVi: null,
    descriptionEn: null,
    hintVi: null,
    hintEn: null,
    docTypeLibraryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ChecklistTemplate
}

describe('generateChecklist', () => {
  const mockFindMany = vi.mocked(prisma.checklistTemplate.findMany)
  const mockCreateMany = vi.mocked(prisma.checklistItem.createMany)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('includes required templates without conditions', async () => {
    const templates = [
      createMockTemplate({ id: 'template-1', isRequired: true, condition: null }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile()
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          caseId: 'case-1',
          templateId: 'template-1',
          status: 'MISSING',
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('skips non-required templates without conditions', async () => {
    const templates = [
      createMockTemplate({ id: 'template-1', isRequired: false, condition: null }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile()
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    // No items should be created since template has no condition and is not required
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('reads conditions from intakeAnswers first', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasCrypto: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // hasCrypto is in intakeAnswers, not in legacy profile fields
    const profile = createMockProfile({
      intakeAnswers: { hasCrypto: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ templateId: 'template-1' }),
      ],
      skipDuplicates: true,
    })
  })

  it('falls back to legacy profile fields when key not in intakeAnswers', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // hasW2 is in legacy profile, not in intakeAnswers
    const profile = createMockProfile({
      hasW2: true,
      intakeAnswers: {},
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ templateId: 'template-1' }),
      ],
      skipDuplicates: true,
    })
  })

  it('intakeAnswers takes priority over legacy profile fields', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: false }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // intakeAnswers says hasW2: false, legacy profile says hasW2: true
    // intakeAnswers should win
    const profile = createMockProfile({
      hasW2: true,
      intakeAnswers: { hasW2: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ templateId: 'template-1' }),
      ],
      skipDuplicates: true,
    })
  })

  it('skips template when condition key not found in either source', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ unknownKey: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: {},
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('evaluates multiple conditions with AND logic', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true, hasKidsUnder17: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // Both conditions must be met
    const profile = createMockProfile({
      intakeAnswers: { hasW2: true, hasKidsUnder17: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('skips template when any condition fails (AND logic)', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true, hasKidsUnder17: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    // Only one condition is met
    const profile = createMockProfile({
      intakeAnswers: { hasW2: true, hasKidsUnder17: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('uses w2Count for W2 expectedCount', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        docType: 'W2',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasW2: true, w2Count: 3 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          templateId: 'template-1',
          expectedCount: 3,
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('uses 12 as default expectedCount for BANK_STATEMENT', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        docType: 'BANK_STATEMENT',
        isRequired: false,
        condition: JSON.stringify({ hasBankAccount: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasBankAccount: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          expectedCount: 12,
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('handles invalid JSON condition gracefully', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: 'invalid json{',
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile()
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    // Should skip template with invalid JSON
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('rejects oversized condition JSON (DoS protection)', async () => {
    // Create condition larger than 10KB
    const largeCondition = JSON.stringify({ key: 'x'.repeat(15000) })
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: largeCondition,
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile()
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    // Should skip template with oversized condition
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('handles array intakeAnswers gracefully', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    // intakeAnswers is array instead of object - should not crash
    const profile = createMockProfile({
      intakeAnswers: ['invalid', 'array'] as unknown as ClientProfile['intakeAnswers'],
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    // Should not create items when intakeAnswers is invalid
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  // ============================================
  // Phase 01: Compound AND/OR Conditions Tests
  // ============================================

  it('evaluates compound AND condition - all pass', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'AND',
          conditions: [
            { key: 'hasSelfEmployment', value: true },
            { key: 'hasBusinessVehicle', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasSelfEmployment: true, hasBusinessVehicle: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates compound AND condition - one fails', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'AND',
          conditions: [
            { key: 'hasSelfEmployment', value: true },
            { key: 'hasBusinessVehicle', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: { hasSelfEmployment: true, hasBusinessVehicle: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('evaluates compound OR condition - first passes', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'OR',
          conditions: [
            { key: 'hasForeignIncome', value: true },
            { key: 'hasForeignAccounts', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasForeignIncome: true, hasForeignAccounts: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates compound OR condition - second passes', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'OR',
          conditions: [
            { key: 'hasForeignIncome', value: true },
            { key: 'hasForeignAccounts', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasForeignIncome: false, hasForeignAccounts: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates compound OR condition - all fail', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'OR',
          conditions: [
            { key: 'hasForeignIncome', value: true },
            { key: 'hasForeignAccounts', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: { hasForeignIncome: false, hasForeignAccounts: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  // ============================================
  // Phase 01: Simple Condition with Operators
  // ============================================

  it('evaluates simple condition with === operator (default)', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'hasW2', value: true }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { hasW2: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates simple condition with !== operator', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'filingStatus', value: 'SINGLE', operator: '!==' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { filingStatus: 'MARRIED' },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates simple condition with > operator', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'foreignBalance', value: 10000, operator: '>' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { foreignBalance: 15000 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates simple condition with > operator - fails when equal', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'foreignBalance', value: 10000, operator: '>' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: { foreignBalance: 10000 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  it('evaluates simple condition with >= operator', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'numKidsUnder17', value: 2, operator: '>=' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { numKidsUnder17: 2 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates simple condition with < operator', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'income', value: 50000, operator: '<' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { income: 30000 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates simple condition with <= operator', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ key: 'age', value: 65, operator: '<=' }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    const profile = createMockProfile({
      intakeAnswers: { age: 65 },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  // ============================================
  // Phase 01: Nested Conditions (2-3 levels)
  // ============================================

  it('evaluates nested conditions (2 levels)', async () => {
    // Example: (hasSelfEmployment AND hasBusinessVehicle) OR hasForeignIncome
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'OR',
          conditions: [
            {
              type: 'AND',
              conditions: [
                { key: 'hasSelfEmployment', value: true },
                { key: 'hasBusinessVehicle', value: true },
              ],
            },
            { key: 'hasForeignIncome', value: true },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // First branch passes (both AND conditions true)
    const profile = createMockProfile({
      intakeAnswers: { hasSelfEmployment: true, hasBusinessVehicle: true, hasForeignIncome: false },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  it('evaluates nested conditions (3 levels)', async () => {
    // Complex: ((A AND B) OR (C AND D)) AND E
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'AND',
          conditions: [
            {
              type: 'OR',
              conditions: [
                {
                  type: 'AND',
                  conditions: [
                    { key: 'hasW2', value: true },
                    { key: 'hasKidsUnder17', value: true },
                  ],
                },
                {
                  type: 'AND',
                  conditions: [
                    { key: 'hasSelfEmployment', value: true },
                    { key: 'hasHomeOffice', value: true },
                  ],
                },
              ],
            },
            { key: 'filingStatus', value: 'MARRIED', operator: '!==' },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    // Second OR branch passes (self-employment + home office), and final AND passes (not MARRIED)
    const profile = createMockProfile({
      intakeAnswers: {
        hasW2: false,
        hasKidsUnder17: false,
        hasSelfEmployment: true,
        hasHomeOffice: true,
        filingStatus: 'SINGLE',
      },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).toHaveBeenCalled()
  })

  // ============================================
  // Phase 01: Depth Limit Exceeded
  // ============================================

  it('rejects condition exceeding max depth (3 levels)', async () => {
    // Create 4 levels deep (exceeds max of 3)
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'AND',
          conditions: [
            {
              type: 'OR',
              conditions: [
                {
                  type: 'AND',
                  conditions: [
                    {
                      type: 'OR', // 4th level - should fail
                      conditions: [
                        { key: 'hasW2', value: true },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: { hasW2: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    // Should skip template when depth exceeded
    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  // ============================================
  // Phase 01: Empty Conditions Array
  // ============================================

  it('rejects compound condition with empty conditions array', async () => {
    const templates = [
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({
          type: 'AND',
          conditions: [],
        }),
      }),
    ]
    mockFindMany.mockResolvedValueOnce(templates)

    const profile = createMockProfile({
      intakeAnswers: { hasW2: true },
    })
    await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

    expect(mockCreateMany).not.toHaveBeenCalled()
  })

  // ============================================
  // Phase 05: Count-based Items
  // ============================================

  describe('count-based items', () => {
    it('uses rentalPropertyCount for RENTAL_STATEMENT expectedCount', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'RENTAL_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasRentalProperty: true, rentalPropertyCount: 3 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            templateId: 'template-1',
            expectedCount: 3,
          }),
        ],
        skipDuplicates: true,
      })
    })

    it('uses rentalPropertyCount for LEASE_AGREEMENT expectedCount', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'LEASE_AGREEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasRentalProperty: true, rentalPropertyCount: 2 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            expectedCount: 2,
          }),
        ],
        skipDuplicates: true,
      })
    })

    it('uses k1Count for SCHEDULE_K1 expectedCount', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'SCHEDULE_K1',
          isRequired: false,
          condition: JSON.stringify({ hasK1Income: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasK1Income: true, k1Count: 4 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            expectedCount: 4,
          }),
        ],
        skipDuplicates: true,
      })
    })

    it('uses num1099NECReceived for FORM_1099_NEC expectedCount', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'FORM_1099_NEC',
          isRequired: false,
          condition: JSON.stringify({ has1099NECReceived: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { has1099NECReceived: true, num1099NECReceived: 5 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            expectedCount: 5,
          }),
        ],
        skipDuplicates: true,
      })
    })

    it('uses template default when count not provided', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'RENTAL_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
          expectedCount: 1,
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasRentalProperty: true },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            expectedCount: 1,
          }),
        ],
        skipDuplicates: true,
      })
    })

    it('ignores zero or negative count values', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          docType: 'W2',
          isRequired: false,
          condition: JSON.stringify({ hasW2: true }),
          expectedCount: 1,
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasW2: true, w2Count: 0 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            expectedCount: 1,
          }),
        ],
        skipDuplicates: true,
      })
    })
  })

  // ============================================
  // Phase 05: Research-based Test Scenarios
  // ============================================

  describe('research-based scenarios', () => {
    it('Simple W2 employee: includes SSN, ID, W2', async () => {
      const templates = [
        createMockTemplate({ id: 'ssn', docType: 'SSN_CARD', isRequired: true }),
        createMockTemplate({ id: 'id', docType: 'ID_CARD', isRequired: true }),
        createMockTemplate({
          id: 'w2',
          docType: 'W2',
          isRequired: false,
          condition: JSON.stringify({ hasW2: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 3 })

      const profile = createMockProfile({
        intakeAnswers: { hasW2: true, w2Count: 2, filingStatus: 'SINGLE' },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ templateId: 'ssn' }),
          expect.objectContaining({ templateId: 'id' }),
          expect.objectContaining({ templateId: 'w2', expectedCount: 2 }),
        ]),
        skipDuplicates: true,
      })
    })

    it('Self-employed with vehicle: includes mileage log with compound condition', async () => {
      const templates = [
        createMockTemplate({
          id: 'mileage',
          docType: 'MILEAGE_LOG',
          isRequired: false,
          condition: JSON.stringify({
            type: 'AND',
            conditions: [
              { key: 'hasSelfEmployment', value: true },
              { key: 'hasBusinessVehicle', value: true },
            ],
          }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasSelfEmployment: true, hasBusinessVehicle: true },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ templateId: 'mileage' })],
        skipDuplicates: true,
      })
    })

    it('Foreign accounts above threshold: includes FBAR docs', async () => {
      const templates = [
        createMockTemplate({
          id: 'fbar',
          docType: 'FBAR_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({
            type: 'AND',
            conditions: [
              { key: 'hasForeignAccounts', value: true },
              { key: 'fbarMaxBalance', value: 10000, operator: '>' },
            ],
          }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        intakeAnswers: { hasForeignAccounts: true, fbarMaxBalance: 15000 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ templateId: 'fbar' })],
        skipDuplicates: true,
      })
    })

    it('Foreign accounts below threshold: excludes FBAR docs', async () => {
      const templates = [
        createMockTemplate({
          id: 'fbar',
          docType: 'FBAR_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({
            type: 'AND',
            conditions: [
              { key: 'hasForeignAccounts', value: true },
              { key: 'fbarMaxBalance', value: 10000, operator: '>' },
            ],
          }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)

      const profile = createMockProfile({
        intakeAnswers: { hasForeignAccounts: true, fbarMaxBalance: 5000 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).not.toHaveBeenCalled()
    })

    it('Multiple rental properties: sets correct expectedCount', async () => {
      const templates = [
        createMockTemplate({
          id: 'lease',
          docType: 'LEASE_AGREEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
        }),
        createMockTemplate({
          id: 'rental-stmt',
          docType: 'RENTAL_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
        }),
        createMockTemplate({
          id: 'prop-tax',
          docType: 'PROPERTY_TAX_STATEMENT',
          isRequired: false,
          condition: JSON.stringify({ hasRentalProperty: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 3 })

      const profile = createMockProfile({
        intakeAnswers: { hasRentalProperty: true, rentalPropertyCount: 3 },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ templateId: 'lease', expectedCount: 3 }),
          expect.objectContaining({ templateId: 'rental-stmt', expectedCount: 3 }),
          expect.objectContaining({ templateId: 'prop-tax', expectedCount: 3 }),
        ]),
        skipDuplicates: true,
      })
    })
  })

  // ============================================
  // Phase 05: Profile Fallback Tests
  // ============================================

  describe('profile fallback behavior', () => {
    it('uses intakeAnswers when key exists in both sources', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          isRequired: false,
          condition: JSON.stringify({ hasW2: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      // intakeAnswers: true, legacy profile: false -> should use intakeAnswers
      const profile = createMockProfile({
        hasW2: false,
        intakeAnswers: { hasW2: true },
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalled()
    })

    it('uses legacy profile when key only exists in profile', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          isRequired: false,
          condition: JSON.stringify({ hasSelfEmployment: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      const profile = createMockProfile({
        hasSelfEmployment: true,
        intakeAnswers: {},
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).toHaveBeenCalled()
    })

    it('returns false when key exists in neither source', async () => {
      const templates = [
        createMockTemplate({
          id: 'template-1',
          isRequired: false,
          condition: JSON.stringify({ hasUnknownField: true }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)

      const profile = createMockProfile({
        intakeAnswers: {},
      })
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)

      expect(mockCreateMany).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // Phase 05: Performance Tests
  // ============================================

  describe('performance', () => {
    it('handles 100 templates efficiently', async () => {
      // Generate 100 templates with various condition types
      const templates = Array.from({ length: 100 }, (_, i) => {
        const conditionTypes = [
          JSON.stringify({ hasW2: true }),
          JSON.stringify({ type: 'AND', conditions: [{ key: 'hasW2', value: true }, { key: 'hasBankAccount', value: true }] }),
          JSON.stringify({ type: 'OR', conditions: [{ key: 'hasW2', value: true }, { key: 'hasSelfEmployment', value: true }] }),
          JSON.stringify({ key: 'income', value: 50000, operator: '>' }),
          null,
        ]
        return createMockTemplate({
          id: `template-${i}`,
          isRequired: i % 5 === 0,
          condition: conditionTypes[i % conditionTypes.length],
        })
      })
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 50 })

      const profile = createMockProfile({
        hasW2: true,
        hasBankAccount: true,
        intakeAnswers: { hasW2: true, hasBankAccount: true, hasSelfEmployment: false, income: 75000 },
      })

      const start = performance.now()
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)
      const duration = performance.now() - start

      // Should complete in under 100ms for 100 templates
      expect(duration).toBeLessThan(100)
      expect(mockCreateMany).toHaveBeenCalled()
    })

    it('handles deeply nested OR with many conditions', async () => {
      // Create OR with 10 conditions
      const templates = [
        createMockTemplate({
          id: 'template-1',
          isRequired: false,
          condition: JSON.stringify({
            type: 'OR',
            conditions: Array.from({ length: 10 }, (_, i) => ({
              key: `condition${i}`,
              value: true,
            })),
          }),
        }),
      ]
      mockFindMany.mockResolvedValueOnce(templates)
      mockCreateMany.mockResolvedValueOnce({ count: 1 })

      // Only last condition is true
      const profile = createMockProfile({
        intakeAnswers: { condition9: true },
      })

      const start = performance.now()
      await generateChecklist('case-1', ['FORM_1040' as TaxType], profile)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(50)
      expect(mockCreateMany).toHaveBeenCalled()
    })
  })
})

describe('refreshChecklist', () => {
  const mockFindUnique = vi.mocked(prisma.taxCase.findUnique)
  const mockDeleteMany = vi.mocked(prisma.checklistItem.deleteMany)
  const mockFindMany = vi.mocked(prisma.checklistTemplate.findMany)
  const mockCreateMany = vi.mocked(prisma.checklistItem.createMany)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws error when case not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(refreshChecklist('case-1')).rejects.toThrow(
      'Case case-1 not found or missing profile'
    )
  })

  it('deletes MISSING items and regenerates', async () => {
    const profile = createMockProfile({ intakeAnswers: { hasW2: true } })
    mockFindUnique.mockResolvedValueOnce({
      id: 'case-1',
      clientId: 'client-1',
      taxTypes: ['FORM_1040'],
      client: { profile },
    } as unknown as Awaited<ReturnType<typeof prisma.taxCase.findUnique>>)
    mockDeleteMany.mockResolvedValueOnce({ count: 2 })
    mockFindMany.mockResolvedValueOnce([
      createMockTemplate({
        id: 'template-1',
        isRequired: false,
        condition: JSON.stringify({ hasW2: true }),
      }),
    ])
    mockCreateMany.mockResolvedValueOnce({ count: 1 })

    await refreshChecklist('case-1')

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1', status: 'MISSING' },
    })
    expect(mockCreateMany).toHaveBeenCalled()
  })
})
