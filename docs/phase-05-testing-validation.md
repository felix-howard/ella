# Phase 05 - Testing & Validation

**Date:** 2026-01-20
**Status:** COMPLETE
**Test Coverage:** 78 total tests (46 checklist generator + 32 classification)

## Overview

Phase 05 focuses on comprehensive test coverage for core business logic:
1. **Checklist Generator Service** - Validates condition evaluation, count-based items, research scenarios, profile fallback
2. **Document Classification** - Tests classification prompt structure and document type validation (64 types)

## Test Suite Details

### Checklist Generator Tests

**File:** `apps/api/src/services/__tests__/checklist-generator.test.ts`
**Lines:** ~1,310 LOC
**Framework:** Vitest
**Tests:** 46 total

#### Test Categories

| Category | Tests | Purpose |
|----------|-------|---------|
| Basic Condition Evaluation | 8 | Required templates, non-required, condition parsing, intakeAnswers priority |
| Compound Conditions | 6 | AND/OR logic, nested conditions (2-3 levels), depth limits |
| Simple Conditions | 6 | Operators: ===, !==, >, <, >=, <= |
| Count-Based Items | 5 | w2Count, rentalPropertyCount, k1Count, num1099NECReceived mappings |
| Research Scenarios | 5 | W2 employee, self-employed + vehicle, foreign accounts, rental properties |
| Profile Fallback | 3 | intakeAnswers priority, legacy fallback, missing keys |
| Performance | 2 | 100 templates (<100ms), 10-condition OR (<50ms) |
| Edge Cases | 5 | Invalid JSON, oversized JSON, array intakeAnswers, missing keys |

#### New Phase 05 Tests (16 total)

1. **Count-Based Items Tests (5)**

```typescript
// Uses rentalPropertyCount for RENTAL_STATEMENT expectedCount
const profile = {
  intakeAnswers: { hasRentalProperty: true, rentalPropertyCount: 3 }
}
// Result: expectedCount = 3

// Uses template default when count not provided
const profile = {
  intakeAnswers: { hasRentalProperty: true }
}
// Result: expectedCount = 1 (template default)

// Ignores zero or negative counts
const profile = {
  intakeAnswers: { hasW2: true, w2Count: 0 }
}
// Result: expectedCount = 1 (falls back to template)
```

**Mappings Tested:**
- W2 → `w2Count`
- SCHEDULE_K1, K1_1065, K1_1120S, K1_1041 → `k1Count`
- RENTAL_STATEMENT, LEASE_AGREEMENT, RENTAL_PL → `rentalPropertyCount`
- FORM_1099_NEC → `num1099NECReceived`

2. **Research-Based Scenarios Tests (5)**

Real-world tax situations with expected document lists:

**Simple W2 Employee:**
- Has: W2 (2 count), SSN, ID
- Conditions: hasW2=true, w2Count=2
- Expected: 3 items with correct expectedCount

**Self-Employed with Vehicle:**
- Compound condition: `AND(hasSelfEmployment=true, hasBusinessVehicle=true)`
- Expected: MILEAGE_LOG included

**Foreign Accounts Above FBAR Threshold:**
- Compound AND: `AND(hasForeignAccounts=true, fbarMaxBalance > 10000)`
- fbarMaxBalance=15000 → FBAR_STATEMENT included
- fbarMaxBalance=5000 → FBAR_STATEMENT excluded

**Multiple Rental Properties:**
- rentalPropertyCount=3
- Expected: LEASE_AGREEMENT (3), RENTAL_STATEMENT (3), PROPERTY_TAX_STATEMENT (3)

3. **Profile Fallback Tests (3)**

Priority resolution when key exists in multiple sources:

```typescript
// intakeAnswers takes priority
profile = {
  hasW2: true,           // legacy profile
  intakeAnswers: { hasW2: false }  // newer data source
}
// Result: hasW2=false (intakeAnswers wins)

// Fallback to legacy profile
profile = {
  hasSelfEmployment: true,
  intakeAnswers: {}
}
// Result: hasSelfEmployment=true (uses profile)

// Missing in both sources
profile = {
  intakeAnswers: {}
}
// Result: template skipped (no data to evaluate)
```

4. **Performance Tests (2)**

- **100 Templates:** Mix of simple, compound, OR/AND conditions, null
  - Max 100ms execution time
  - Tests scalability

- **Deeply Nested OR:** 10 conditions in OR array
  - Max 50ms execution time
  - Tests large condition arrays

#### Prior Tests (31)

Existing tests that validate:
- Basic template inclusion/exclusion
- AND/OR logic evaluation
- Numeric operators (>, <, >=, <=, ===, !==)
- Nested conditions up to 3 levels deep
- Depth limit rejection (4+ levels)
- Empty condition arrays
- Invalid JSON handling
- DoS protection (10KB size limit)

#### Mock Architecture

```typescript
vi.mock('../../lib/db', () => ({
  prisma: {
    checklistTemplate: { findMany: vi.fn() },
    checklistItem: { createMany: vi.fn(), deleteMany: vi.fn() },
    taxCase: { findUnique: vi.fn() }
  }
}))
```

Helper factories:
- `createMockProfile()` - Default ClientProfile with overrides
- `createMockTemplate()` - Default ChecklistTemplate with overrides

---

### Classification Prompt Tests

**File:** `apps/api/src/services/ai/__tests__/classification-prompts.test.ts`
**Lines:** ~380 LOC
**Framework:** Vitest
**Tests:** 32 total

#### Test Categories

| Category | Tests | Purpose |
|----------|-------|---------|
| Few-Shot Examples | 6 | Verify prompt includes W-2, SSN, 1099-K, 1099-INT, 1099-NEC, DL |
| Vietnamese Names | 3 | Handling guide for Vietnamese family names |
| Confidence Calibration | 4 | HIGH/MEDIUM/LOW ranges, >0.95 prevention |
| Document Types | 7 | All categories and variants |
| JSON Response Format | 2 | Schema validation |
| Classification Rules | 2 | 1099 verification, CORRECTED checkbox |
| Result Validation | 8 | Valid/invalid classification objects |

#### Few-Shot Examples Tests

Verify 6 examples present in prompt:

```typescript
describe('few-shot examples', () => {
  it('includes W-2 form example') {
    expect(prompt).toContain('W-2 Form')
    expect(prompt).toContain('Wage and Tax Statement')
  }

  it('includes SSN card example') {
    expect(prompt).toContain('Social Security Card')
  }
  // ... 1099-K, 1099-INT, 1099-NEC, Driver License
})
```

#### Confidence Calibration Tests

```typescript
describe('confidence calibration', () => {
  it('defines high confidence range') {
    expect(prompt).toContain('HIGH CONFIDENCE')
    expect(prompt).toContain('0.85-0.95')
  }

  it('defines medium confidence range') {
    expect(prompt).toContain('MEDIUM CONFIDENCE')
    expect(prompt).toContain('0.60-0.84')
  }

  it('defines low confidence range') {
    expect(prompt).toContain('LOW CONFIDENCE')
    expect(prompt).toContain('< 0.60')
  }

  it('advises against overconfidence') {
    expect(prompt).toContain('Never use confidence > 0.95')
  }
})
```

#### Document Types - 64 Total

**Phase 05 Update:** Expanded from 24 → 64 doc types for comprehensive intake

**Breakdown:**
- **Identification (3):** SSN_CARD, DRIVER_LICENSE, PASSPORT
- **Employment (2):** W2, W2G
- **1099 Series (10):** INT, DIV, NEC, MISC, K, R, G, SSA, B, S
- **K-1 (4):** K1, K1_1065, K1_1120S, K1_1041
- **Deductions (3):** FORM_1098, FORM_1098_T, FORM_1095_A
- **Health (4):** 1095-A/B/C, 5498-SA
- **Education (2):** 1098-T, 1098-E
- **Business (4):** BANK_STATEMENT, PROFIT_LOSS_STATEMENT, BUSINESS_LICENSE, EIN_LETTER
- **Receipts (6):** Generic, Daycare, Charity, Medical, Property Tax, Estimated Tax
- **Home Sale (2):** CLOSING_DISCLOSURE, LEASE_AGREEMENT
- **Credits (2):** EV_PURCHASE_AGREEMENT, ENERGY_CREDIT_INVOICE
- **Prior Year (2):** Prior Return, Extension Proof
- **Foreign (4):** Bank Statement, Tax Statement, FBAR, 8938
- **Crypto (1):** Statement
- **Other (2):** Birth Certificate, RECEIPT

```typescript
it('has correct total count of document types', () => {
  expect(SUPPORTED_DOC_TYPES.length).toBe(64)
})
```

#### Validation Tests

**Valid Results:**

```typescript
describe('valid results', () => {
  it('returns true for valid classification result', () => {
    const result = {
      docType: 'W2',
      confidence: 0.92,
      reasoning: 'Clear W-2 form with visible title'
    }
    expect(validateClassificationResult(result)).toBe(true)
  })

  it('returns true for result with alternativeTypes', () => {
    const result = {
      docType: 'FORM_1099_INT',
      confidence: 0.72,
      reasoning: 'Appears to be 1099-INT',
      alternativeTypes: [{ docType: 'FORM_1099_DIV', confidence: 0.2 }]
    }
    expect(validateClassificationResult(result)).toBe(true)
  })

  it('validates all 64 supported document types', () => {
    for (const docType of SUPPORTED_DOC_TYPES) {
      expect(validateClassificationResult({
        docType,
        confidence: 0.9,
        reasoning: `Valid ${docType}`
      })).toBe(true)
    }
  })
})
```

**Invalid Results:**

- Missing required fields (docType, confidence, reasoning)
- Out-of-range confidence (<0 or >1)
- Wrong types (confidence as string, docType as number)
- Invalid docType values
- Null or non-object inputs

---

## Test Framework: Vitest

**Why Vitest?**
- Fast test execution (parallel by default)
- Built-in mocking with `vi.mock()`
- ESM module support (no transpilation)
- Drop-in Jest compatibility for existing tests

**Key Features Used:**
- `describe()`, `it()` for test organization
- `expect()` for assertions
- `beforeEach()`, `afterEach()` for setup/teardown
- `vi.mocked()` for type-safe mock references
- `vi.fn()` for mock function creation
- `vi.clearAllMocks()` for test isolation

---

## Test Patterns

### Prisma Mocking

```typescript
vi.mock('../../lib/db', () => ({
  prisma: {
    checklistTemplate: {
      findMany: vi.fn(),
    },
    checklistItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

const mockFindMany = vi.mocked(prisma.checklistTemplate.findMany)
mockFindMany.mockResolvedValueOnce(templates)
```

### Factory Helpers

```typescript
function createMockProfile(overrides = {}) {
  return {
    id: 'test-profile-id',
    clientId: 'test-client-id',
    filingStatus: 'SINGLE',
    hasW2: false,
    intakeAnswers: {},
    // ...
    ...overrides,
  } as ClientProfile
}
```

### Performance Testing

```typescript
const start = performance.now()
await generateChecklist('case-1', ['FORM_1040'], profile)
const duration = performance.now() - start

expect(duration).toBeLessThan(100)
```

---

## Coverage Goals

| Module | Tests | Coverage |
|--------|-------|----------|
| Checklist Generator | 46 | Conditions, counts, fallback, performance |
| Classification Prompt | 32 | Prompt structure, 64 doc types, validation |
| **Total** | **78** | **Comprehensive business logic** |

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test checklist-generator.test.ts

# Run with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch
```

---

## Next Steps

1. **Integration Tests** - API endpoint testing with real database
2. **E2E Tests** - Full workflow testing (client upload → classification → checklist)
3. **Performance Benchmarks** - Load testing for production readiness
4. **Type Safety** - Increase test coverage for type guards

---

**Last Updated:** 2026-01-20
**Architecture Version:** 7.6.0
