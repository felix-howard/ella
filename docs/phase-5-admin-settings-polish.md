# Phase 5: Admin Settings Polish

**Status:** COMPLETE
**Date:** 2026-01-19
**Components:** JSON Validation + Size Limits + Comprehensive Test Suite

## Overview

Phase 5 polishes the admin settings feature with production-ready validation, DoS protection, and comprehensive test coverage. The admin settings interface allows staff to manage checklists, intake questions, and document types centrally.

## Changes

### 1. JSON Validation (schemas.ts)

Added two specialized Zod validators to `apps/api/src/routes/admin/schemas.ts`:

**jsonStringSchema** (Lines 15-30)
- Validates string contains valid JSON
- 2000 char size limit (DoS protection)
- Optional, allows empty strings
- Used for: Intake question `options`, Doc type aliases/keywords

**conditionJsonSchema** (Lines 36-57)
- Validates condition object format: `{ key: boolean | string | number }`
- Rejects arrays and primitives
- 2000 char size limit
- Type-safe value validation
- Used for: Intake question `condition`, Checklist template `condition`

### 2. Schema Updates

**Intake Questions** (lines 76-89)
- `options`: JSON string for SELECT field options (validated)
- `condition`: Condition JSON (validated, optional)

**Checklist Templates** (lines 106-120)
- `condition`: Condition JSON (validated, optional)
- Size constraints on all string fields (50-500 chars)

**Doc Type Library** (lines 144-155)
- `aliases`: Array of strings, max 50 items, each max 100 chars
- `keywords`: Array of strings, max 50 items, each max 100 chars

## Test Suite (admin-routes.test.ts)

**29 Tests** covering 3 modules:

### Intake Questions Tests (8 tests)
1. GET all questions without filters
2. GET with taxType filter
3. GET with section filter
4. GET single question by ID
5. POST create question (valid)
6. POST with invalid JSON in options (fails)
7. PUT update question
8. DELETE question

### Checklist Templates Tests (5 tests)
1. GET all templates without filters
2. POST create template (valid)
3. POST with invalid condition JSON (fails)
4. PUT update template (preserves taxType/docType)
5. DELETE template

### Doc Type Library Tests (3 tests)
1. GET all doc types with filters
2. POST create doc type (valid with aliases/keywords)
3. PUT update doc type (preserves code)
4. DELETE doc type

### Schema Validation Tests (13 tests)
1. Valid condition JSON object with mixed value types
2. Condition rejects array values
3. Condition rejects primitive values
4. Condition rejects non-object types
5. Valid JSON string with data
6. JSON schema allows empty string
7. JSON schema rejects invalid JSON
8. Size limit: JSON exceeding 2000 chars fails
9. Size limit: Condition exceeding 2000 chars fails
10. Condition with numbers, strings, booleans (all valid)
11. Condition with null values (rejected)
12. Condition with nested objects (rejected)
13. JSON string transformation and edge cases

## Admin Routes API

### Intake Questions
- **GET** `/admin/intake-questions?taxType=FORM_1040&section=income&isActive=true`
- **GET** `/admin/intake-questions/:id`
- **POST** `/admin/intake-questions` (create)
- **PUT** `/admin/intake-questions/:id` (update)
- **DELETE** `/admin/intake-questions/:id`

### Checklist Templates
- **GET** `/admin/checklist-templates?taxType=FORM_1040&category=income`
- **GET** `/admin/checklist-templates/:id`
- **POST** `/admin/checklist-templates` (create)
- **PUT** `/admin/checklist-templates/:id` (update, preserves taxType/docType)
- **DELETE** `/admin/checklist-templates/:id`

### Doc Type Library
- **GET** `/admin/doc-type-library?category=income&isActive=true&search=w2`
- **GET** `/admin/doc-type-library/:id`
- **POST** `/admin/doc-type-library` (create)
- **PUT** `/admin/doc-type-library/:id` (update, preserves code)
- **DELETE** `/admin/doc-type-library/:id`

## Validation Rules

| Field | Constraint | Purpose |
|-------|-----------|---------|
| questionKey | 1-50 chars, alphanumeric + underscore | Database identifier |
| labelVi/labelEn | 1-200 chars | UI display (Vietnamese + English) |
| docType | 1-50 chars | Tax form code |
| condition | Valid JSON object, max 2000 chars | Dynamic checklist logic |
| options | Valid JSON string, max 2000 chars | SELECT field choices |
| aliases/keywords | Max 50 items, each 100 chars | Doc type discovery |

## Admin Settings UI Tabs

The admin settings page includes 4 tabs:

1. **Appearance** - UI theme settings
2. **Checklist** - Checklist template management (CRUD)
3. **Questions** - Intake question management (CRUD)
4. **Doc Library** - Document type library (CRUD)

Each tab has full CRUD (Create, Read, Update, Delete) support with React Query for data fetching and mutation.

## Security Considerations

- **DoS Protection:** 2000 char limit on JSON fields prevents large payloads
- **Type Safety:** Zod validation ensures data shape before database insertion
- **Immutability:** `taxType`, `docType`, `code` fields cannot be updated
- **Constraint Validation:** All numeric fields have min/max bounds
- **Format Validation:** JSON structure validation prevents malformed data

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/routes/admin/schemas.ts` | Added `jsonStringSchema` and `conditionJsonSchema` validators |
| `apps/api/src/routes/admin/__tests__/admin-routes.test.ts` | NEW: 29 integration tests for all CRUD operations |

## Next Steps

To use Phase 5 Admin Settings Polish:

1. **No additional setup required** - Validation is automatic via Zod
2. **JSON fields** - Must pass `jsonStringSchema` or `conditionJsonSchema` validation
3. **UI Development** - Implement admin settings forms in workspace app using provided schemas as guide
4. **Testing** - Run test suite: `pnpm test apps/api/src/routes/admin`

## Related Documentation

- [System Architecture](./system-architecture.md) - Admin module architecture
- [Code Standards](./code-standards.md) - Zod validation patterns
- [Phase 2 - Checklist Questionnaire](./phase-2-checklist-questionnaire-redesign.md) - Intake question usage
- [Phase 4 - Checklist Display](./phase-4-checklist-display-enhancement.md) - Checklist template usage

---

**Last Updated:** 2026-01-19
**Test Coverage:** 29 integration tests (all passing)
**Schema Version:** 1.0
