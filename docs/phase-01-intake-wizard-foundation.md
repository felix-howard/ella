# Phase 1 Foundation - Intake Wizard Refactor

**Status:** In Progress (2026-01-22)
**Branch:** fix/minor-fix

## Overview

Phase 1 Foundation establishes the core data model and security foundation for the intake wizard refactor. This phase focuses on:

1. Server-side SSN encryption (AES-256-GCM)
2. Comprehensive identity field configuration (17+ fields)
3. Frontend display utilities (masking, formatting)
4. Database schema updates for encrypted fields

## Key Changes

### 1. SSN Encryption Service (New)

**File:** `apps/api/src/services/crypto/index.ts`

Server-side encryption for sensitive SSN fields using AES-256-GCM with authenticated encryption.

**Core Functions:**

| Function | Purpose |
|----------|---------|
| `encryptSSN(ssn)` | Encrypt SSN → base64 (IV + AuthTag + Ciphertext) |
| `decryptSSN(encrypted)` | Decrypt encrypted SSN (with plain-text fallback) |
| `maskSSN(ssn)` | Display mask: "***-**-6789" |
| `isValidSSN(ssn)` | Validate format (9 digits, valid prefix) |
| `formatSSN(ssn)` | Format with dashes: "123-45-6789" |
| `encryptSensitiveFields(data, clientId, staffId?)` | Encrypt all SSN fields + audit log |
| `decryptSensitiveFields(data, clientId, staffId?)` | Decrypt for display + audit log |

**Encryption Details:**

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32 bytes (256 bits) from `SSN_ENCRYPTION_KEY` env var (64-char hex)
- **IV:** 12 bytes random per encryption (GCM recommended)
- **AuthTag:** 16 bytes (128 bits for authentication)
- **Format:** Base64(IV || AuthTag || Ciphertext)
- **Performance:** Key cached in memory after first use

**SSN Validation Rules:**

```
Must be 9 digits: true
Cannot start with 000: ✗
Cannot start with 666: ✗
Cannot start with 9XX: ✗
Middle two digits cannot be 00: ✗
Last four digits cannot be 0000: ✗
```

**Dependent Handling:**

```typescript
// Handles nested SSN in dependents array
{
  dependents: [
    { name: 'John', ssn: '123-45-6789' },  // Encrypted
    { name: 'Jane', ssn: '987-65-4321' },  // Encrypted
  ]
}
```

**Audit Logging Integration:**

- Encryption: Logs as `{field}_encrypted` with `[ENCRYPTED]` marker
- Decryption: Logs as `{field}_accessed` with `[DECRYPTED_FOR_VIEW]` marker
- Non-blocking: Async logging doesn't slow API responses
- Staff tracking: Records who decrypted sensitive data

**Environment Setup:**

```bash
# Generate 32-byte (256-bit) random hex key
# Example (generate new for production):
openssl rand -hex 32
# Output: a1b2c3d4e5f6...a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4

# Set in .env:
SSN_ENCRYPTION_KEY=a1b2c3d4e5f6...a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

**Security Notes:**

- NEVER log or expose unencrypted SSN
- Decryption only on authorized staff access (audit logged)
- Key rotation requires app restart (no hot reload)
- Migration period: Falls back to plain text if decryption fails

### 2. Frontend Crypto Utilities

**File:** `apps/workspace/src/lib/crypto.ts`

Display-only utilities (no encryption logic). Provides masking and formatting for UI.

**Functions:**

| Function | Purpose |
|----------|---------|
| `maskSSN(ssn)` | Display mask: "***-**-6789" |
| `formatSSN(ssn)` | Format with dashes |
| `formatSSNInput(input)` | Format while typing (auto-add dashes) |
| `isValidSSN(ssn)` | Validate format for form input |
| `getSSNValidationError(ssn)` | Get Vietnamese error message |

**Example Usage:**

```typescript
// In intake form component
import { maskSSN, formatSSNInput, getSSNValidationError } from '@lib/crypto'

// Format as user types
const handleChange = (e) => {
  const formatted = formatSSNInput(e.target.value)
  setSSN(formatted)
}

// Validate on blur
const error = getSSNValidationError(ssn)

// Display masked in overview
<div>{maskSSN(ssn)}</div>
```

### 3. Intake Form Configuration (Updated)

**File:** `apps/workspace/src/lib/intake-form-config.ts`

Centralized configuration for 95+ intake form fields organized in 18 sections.

**Key Additions (Phase 1 Foundation):**

#### Identity Fields (17 total)

**Taxpayer Identity (8 fields):**
- `taxpayerSSN` - Encrypted
- `taxpayerDOB` - ISO date string
- `taxpayerOccupation` - Text
- `taxpayerDLNumber` - Driver's license number
- `taxpayerDLIssueDate` - License issue date
- `taxpayerDLExpDate` - License expiration date
- `taxpayerDLState` - State of issue (select)
- `taxpayerIPPIN` - 6-digit IP PIN

**Spouse Identity (8 fields, conditional MFJ):**
- `spouseSSN` - Encrypted (mirrors taxpayer)
- `spouseDOB`, `spouseOccupation`, `spouseDLNumber`, `spouseDLIssueDate`, `spouseDLExpDate`, `spouseDLState`, `spouseIPPIN`

**Dependent Count (1 field):**
- `dependentCount` - Number type

#### Option Lists (New)

**US_STATES_OPTIONS (51 items):**
```typescript
[
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  // ... all 50 states
  { value: 'DC', label: 'Washington D.C.' }
]
```

**RELATIONSHIP_OPTIONS (10 items):**
```typescript
[
  { value: 'SON', label: 'Con trai' },
  { value: 'DAUGHTER', label: 'Con gái' },
  { value: 'STEPSON', label: 'Con trai riêng' },
  { value: 'STEPDAUGHTER', label: 'Con gái riêng' },
  { value: 'FOSTER_CHILD', label: 'Con nuôi' },
  { value: 'GRANDCHILD', label: 'Cháu' },
  { value: 'NIECE_NEPHEW', label: 'Cháu trai/gái' },
  { value: 'SIBLING', label: 'Anh/Chị/Em' },
  { value: 'PARENT', label: 'Cha/Mẹ' },
  { value: 'OTHER', label: 'Khác' },
]
```

#### Format Type Mapping

```typescript
boolean → BOOLEAN
currency → CURRENCY
number → NUMBER
select → SELECT
ssn → TEXT (stored encrypted)
date → TEXT (ISO string)
text → TEXT (default)
```

### 4. Database Schema (Updated)

**File:** `packages/db/prisma/schema.prisma`

IntakeAnswers model already supports JSON storage. Phase 1 adds:

- Field validation on encryption
- SSN field detection (keys containing 'ssn' case-insensitive)
- Dependent array SSN handling
- Migration: Plain-text to encrypted transition support

## Implementation Checklist

### Backend Setup

- [ ] Create `.env` entry: `SSN_ENCRYPTION_KEY=<64-char-hex>`
- [ ] Test `encryptSSN()` / `decryptSSN()` with sample data
- [ ] Verify audit logging on encryption/decryption
- [ ] Test with existing plain-text SSN data (fallback)
- [ ] Run migration: `npm run db:push` (if schema changes)

### Frontend Setup

- [ ] Import crypto utils in intake form component
- [ ] Connect `formatSSNInput()` to SSN input onChange
- [ ] Add validation error display via `getSSNValidationError()`
- [ ] Show masked SSN in overview via `maskSSN()`
- [ ] Test with all 51 US states (state select)
- [ ] Test with all 10 relationships (dependent relationships)

### Testing

- [ ] Unit: SSN encryption/decryption round-trip
- [ ] Unit: SSN validation (valid/invalid formats)
- [ ] Unit: Masking output
- [ ] Integration: Create client → set SSN → view encrypted in DB
- [ ] Integration: View profile → decrypt SSN → show masked
- [ ] Integration: Audit log entries created
- [ ] Edge case: Plain-text SSN in DB → fallback to plain text

## API Integration

### Intake Profile Update

```typescript
// apps/workspace/src/lib/api-client.ts
api.clients.updateProfile(clientId, {
  intakeAnswers: {
    taxpayerSSN: '123-45-6789',  // Sent as plain text to API
    taxpayerDOB: '1990-01-15',
    taxpayerOccupation: 'Engineer',
    taxpayerDLState: 'CA',
    spouseSSN: '987-65-4321',     // Optional (MFJ)
    dependentCount: 2,
    // ... other fields
  }
})

// Backend (apps/api/src/routes/clients/index.ts)
// - Receives plain-text SSN
// - Calls encryptSensitiveFields() before saving
// - Stores encrypted version in DB
// - Logs to audit trail
```

### Fetch & Display

```typescript
// Backend returns encrypted SSN
{
  intakeAnswers: {
    taxpayerSSN: 'u7K3x...[encrypted]',
    // ...
  }
}

// Frontend decrypts server-side (already decrypted by API)
// Then masks for display:
maskSSN(taxpayerSSN) → '***-**-6789'
```

## File Organization

```
apps/
├── api/
│   └── src/
│       └── services/
│           ├── crypto/
│           │   └── index.ts          # Server-side encryption (NEW)
│           └── audit-logger.ts        # Audit logging (used for SSN access)
└── workspace/
    └── src/
        ├── lib/
        │   ├── crypto.ts              # Frontend utilities (UPDATED)
        │   ├── api-client.ts          # API integration
        │   └── intake-form-config.ts  # Field configuration (UPDATED: 17+ identity fields)
        └── components/
            └── settings/
                └── *-modal.tsx        # Intake form modals (future)

packages/
└── db/
    └── prisma/
        └── schema.prisma             # IntakeAnswers model (unchanged, supports JSON)
```

## Next Steps (Phase 2 - Future)

1. **Frontend Components**
   - SectionEditModal for identity section
   - Quick-edit modal for personal info
   - Dependent management UI

2. **Enhanced Validation**
   - Server-side SSN format validation before encryption
   - Duplicate SSN detection across dependents
   - Valid SSA prefix validation

3. **Data Migration**
   - Script to encrypt existing plain-text SSNs
   - Audit trail for migration
   - Verification of round-trip encryption/decryption

4. **Dependent Management**
   - Add/remove dependent flow
   - Dependent info form (name, DOB, relationship, SSN)
   - Array handling in state management

## Environment Variables

**Required for Phase 1 Foundation:**

```bash
SSN_ENCRYPTION_KEY=<64-char-hex-string>
```

**Generate new key:**

```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows (using Node):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Never commit keys to Git** - Use `.env.local` (git-ignored) or secrets manager in production.

## Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Database breach (encrypted data exposure) | AES-256-GCM + unique IV per SSN |
| Plain-text SSN in logs | Never log raw SSN; use [ENCRYPTED] marker |
| Unauthorized decryption | Audit log tracks all access; staff attribution |
| Man-in-the-middle (unencrypted transit) | HTTPS only (enforced by deployment) |
| Memory dumps revealing key | Key cached; restart = new key load from env |
| Invalid SSN data leaking | Pre-validation before encryption |

### Compliance

- **PII Protection:** SSN encrypted at rest (complies with NIST guidelines)
- **Audit Trail:** All access logged (complies with SOC 2)
- **Data Minimization:** No unnecessary plain-text storage
- **Staff Accountability:** Staff ID tracked for all decryptions

## Troubleshooting

### "SSN_ENCRYPTION_KEY environment variable is not set"

**Solution:** Add to `.env`:
```
SSN_ENCRYPTION_KEY=<64-char-hex>
```

### "SSN_ENCRYPTION_KEY must be 64 hex characters"

**Solution:** Generate valid key:
```bash
openssl rand -hex 32
```

### Decryption fails with "Failed to decrypt SSN"

**Cause:** Data was never encrypted (plain-text in DB)
**Solution:** Service falls back to plain-text; no error thrown

### Performance: Encryption slow

**Cause:** Key re-parsed every call
**Solution:** Already handled - key cached in memory after first use

## References

- AES-256-GCM: [Node.js Crypto Docs](https://nodejs.org/api/crypto.html)
- SSN Format: [SSA Rules](https://www.ssa.gov/employer/statementofearnings.html)
- NIST Encryption: [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

---

**Created:** 2026-01-22
**Updated:** 2026-01-22
**Status:** Ready for Development
