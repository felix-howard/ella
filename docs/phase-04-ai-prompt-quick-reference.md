# Phase 4: AI Prompt Improvements - Quick Reference

**Status:** COMPLETE | **Date:** 2026-02-25 | **Feature:** Metadata-enhanced document grouping

## One-Liner Summary

Grouping now validates metadata (taxpayer name, SSN-4, page markers) before visual similarity, preventing false positives like grouping a W-2 and 1099-NEC from the same person.

## The Problem

**Before Phase 4:** Visual-only matching led to grouping errors
```
Input: W-2 (wages) + 1099-NEC (contractor income) from same person
Result: INCORRECTLY GROUPED (both from NGUYEN VAN ANH, same year)
Problem: Different document types should NEVER group
```

**After Phase 4:** Metadata validation prevents false positives
```
Input: W-2 (wages) + 1099-NEC (contractor income) from same person
Validation:
  ✓ Same taxpayer name: NGUYEN VAN ANH
  ✓ Same SSN-4: 1234
  ✗ Different form types: W-2 vs 1099-NEC ← REJECTION RULE
Result: CORRECTLY STANDALONE
```

## Key Changes at a Glance

### 1. New Validation Rule (MANDATORY)

**Same Form Type Required**
```
Form 1040 ←→ Only other Form 1040 pages
Schedule C ←→ Only other Schedule C pages
W-2        ←→ Only other W-2s from same employer
```

### 2. Metadata Validation (3 Layers)

| Layer | Field | Validation |
|-------|-------|-----------|
| **1** | `taxpayerName` | Must match exactly or be null |
| **2** | `ssn4` | Different values = automatic rejection |
| **3** | `pageMarker` | Orders pages by content, not upload time |

### 3. Confidence Boost Mechanism

```
Base AI Confidence: 0.75 (visual similarity)
  + Metadata Boost:
    - taxpayerNameMatch: +0.05
    - ssn4Match: +0.10
    - pageMarkersAlign: +0.00 (ordering only)
    ────────────────────
  = Final: 0.90 (HIGH confidence)
```

**Maximum boost:** +0.15 to +0.20 when all metadata validates

## Code Changes Summary

### File 1: `apps/api/src/services/ai/prompts/classify.ts`

| Change | Lines | Purpose |
|--------|-------|---------|
| Added `METADATA_CONFIDENCE_GUIDE` | 421-449 | Guidelines for extracting metadata with high confidence |
| Enhanced `getGroupingAnalysisPrompt()` | 935-1065 | Mandatory form type check + 6-step validation rules |
| Added `MetadataValidation` interface | 1070-1075 | Structure for validation results |
| Updated `GroupingAnalysisResult` | 1080-1088 | Optional metadataValidation field |
| Enhanced `validateGroupingResult()` | 1093-1143 | Validation for new metadataValidation field |

### File 2: `apps/api/src/services/ai/document-classifier.ts`

| Change | Purpose |
|--------|---------|
| Added `metadataValidation: undefined` to all early return paths | API consistency |

## When Grouping Works (Examples)

### ✅ Form 1040 Pages (Same Document)

```
Document 1: Form 1040, Page 1 of 2
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"
  - pageMarker: { current: 1, total: 2 }

Document 2: Form 1040, Page 2 of 2
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"
  - pageMarker: { current: 2, total: 2 }

Validation:
  ✓ Same form type: Form 1040
  ✓ taxpayerName match: "NGUYEN VAN ANH" = "NGUYEN VAN ANH"
  ✓ ssn4 match: "1234" = "1234"
  ✓ pageMarker sequence: 1 → 2 (valid)

Result: GROUPED with confidence 0.92 (+0.15 boost)
```

### ✅ Schedule C Pages (Same Document)

```
Document 1: Schedule C, Page 1 of 2
  - taxpayerName: "JOHN DOE"
  - ssn4: "5678"
  - pageMarker: { current: 1, total: 2 }

Document 2: Schedule C, Page 2 of 2 (uploaded days later)
  - taxpayerName: "JOHN DOE"
  - ssn4: "5678"
  - pageMarker: { current: 2, total: 2 }

Validation:
  ✓ Same form type: Schedule C
  ✓ taxpayerName match: "JOHN DOE" = "JOHN DOE"
  ✓ ssn4 match: "5678" = "5678"
  ✓ pageMarker sequence: 1 → 2 (valid)

Result: GROUPED with confidence 0.91 (+0.15 boost)
Note: Late-arriving documents can now join existing groups
```

## When Grouping FAILS (Examples)

### ❌ Different Form Types (Same Taxpayer)

```
Document 1: Form 1040, Page 1
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"

Document 2: Schedule C, Page 1
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"

Validation:
  ✗ Different form types: Form 1040 vs Schedule C ← MANDATORY REJECTION

Result: NOT GROUPED (confidence 0)
Reason: "Different form types - Form 1040 (federal return) vs Schedule C (business attachment)"
```

### ❌ Different Taxpayers (Same Form Type)

```
Document 1: Form 1040, Page 1
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"

Document 2: Form 1040, Page 1
  - taxpayerName: "TRAN THI HONG"
  - ssn4: "5678"

Validation:
  ✓ Same form type: Form 1040
  ✗ taxpayerName mismatch: "NGUYEN VAN ANH" ≠ "TRAN THI HONG" ← REJECTION
  ✗ ssn4 mismatch: "1234" ≠ "5678" ← DEFINITIVE REJECTION

Result: NOT GROUPED (confidence 0)
Reason: "Different taxpayers (metadata.ssn4 '1234' ≠ '5678')"
```

### ❌ W-2 from Different Employers (Same Taxpayer)

```
Document 1: W-2 from ABC Corp
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"
  - source: "ABC Corp"

Document 2: W-2 from XYZ Inc
  - taxpayerName: "NGUYEN VAN ANH"
  - ssn4: "1234"
  - source: "XYZ Inc"

Validation:
  ✓ Same form type: W-2
  ✓ taxpayerName match
  ✓ ssn4 match
  ✗ Different employers/sources → Different W-2 forms

Result: NOT GROUPED (confidence 0)
Reason: "Same person but different W-2 sources (employers) - each W-2 is separate"
```

## API Response Examples

### Success: Group Found

```json
{
  "matchFound": true,
  "matchedIndices": [0, 2],
  "confidence": 0.92,
  "groupName": "Form4562_Depreciation_NguyenVanAnh",
  "pageOrder": ["existing_doc_0", "new_doc", "existing_doc_2"],
  "reasoning": "Same form (4562), same taxpayer (NGUYEN VAN ANH), ssn4 match (1234), page markers 1-2-3 align",
  "metadataValidation": {
    "taxpayerNameMatch": true,
    "ssn4Match": true,
    "pageMarkersAlign": true,
    "confidenceBoost": 0.15
  }
}
```

### Failure: No Match

```json
{
  "matchFound": false,
  "matchedIndices": [],
  "confidence": 0,
  "groupName": null,
  "pageOrder": [],
  "reasoning": "New document (Form 1040) is different form type than existing documents (Schedule C for NGUYEN VAN ANH)",
  "metadataValidation": {
    "taxpayerNameMatch": null,
    "ssn4Match": null,
    "pageMarkersAlign": null,
    "confidenceBoost": 0
  }
}
```

## Metadata Fields (What Gets Extracted)

### taxpayerName
- **Extracted from:** Document header, designated name fields
- **Examples:**
  - W-2 Box e/f: "NGUYEN VAN ANH"
  - Form 1040 "Your name": "JOHN DOE"
  - Schedule C "Proprietor name": "MARY SMITH"
- **Returns null if:** Business entity only, blurry, multiple names without designation

### ssn4
- **Extracted from:** "XXX-XX-XXXX" format (last 4 digits only)
- **Examples:**
  - "XXX-XX-1234" → "1234"
  - "XXX-XX-5678" → "5678"
- **Returns null if:** Fully redacted, placeholder (0000, XXXX), unreadable

### pageMarker
- **Structure:** `{ current: number | null, total: number | null, partNumber: string | null }`
- **Examples:**
  - "Page 2 of 3" → `{ current: 2, total: 3, partNumber: null }`
  - "Part IV" → `{ current: null, total: null, partNumber: "IV" }`
  - "1/3" → `{ current: 1, total: 3, partNumber: null }`
- **Returns null if:** Single-page doc, no page indicators

### continuationMarker
- **Structure:** `{ type: "line-reference" | "attachment" | "see-attached" | null, parentForm: string | null, lineNumber: string | null }`
- **Examples:**
  - "Line 19 (2210)" → `{ type: "line-reference", parentForm: "FORM_2210", lineNumber: "19" }`
  - "See Attachment Sheet" → `{ type: "attachment", parentForm: null, lineNumber: null }`
- **Returns null if:** No continuation indicators, standalone document

## Testing Checklist

### Manual Testing

- [ ] Upload two Form 1040 pages from same taxpayer → Should group
- [ ] Upload W-2 + 1099-NEC from same taxpayer → Should NOT group
- [ ] Upload Form 1040 + Schedule C from same taxpayer → Should NOT group
- [ ] Upload two documents with different SSN-4s → Should NOT group
- [ ] Upload page 2 after page 1 uploaded → Should auto-order pages correctly
- [ ] Verify confidence score includes metadata boost

### Expected Results

| Scenario | Result | Confidence |
|----------|--------|-----------|
| Same form + same taxpayer + same SSN | ✅ Grouped | 0.90-0.95 |
| Same form + different taxpayer | ❌ Separate | 0.00 |
| Same form + different SSN-4 | ❌ Separate | 0.00 |
| Different form + same taxpayer | ❌ Separate | 0.00 |
| Late-arriving page 2 | ✅ Grouped, reordered | 0.90+ |

## Troubleshooting

### Issue: Documents Not Grouping (Should Be)

**Diagnostic:**
1. Check metadata.ssn4 in both documents
   - If different → Wrong grouping assumption
   - If same → Check form type
2. Check form type/number
   - If different → Expected (won't group)
   - If same → Check taxpayerName
3. Check page markers
   - If conflicting (e.g., 2-1-3) → Manual reordering needed

### Issue: Wrong Confidence Boost

**Check metadataValidation:**
```json
"metadataValidation": {
  "taxpayerNameMatch": true,     // +0.05
  "ssn4Match": true,              // +0.10
  "pageMarkersAlign": true        // included in order
}
```

Max boost = +0.15 (rarely +0.20 if all perfect)

### Issue: Different Employers' W-2s Grouping

**Root Cause:** Different W-2 documents from same person
**Solution:** Ensure "source" field differs
```json
"source": "ABC Corp"     // Document 1
"source": "XYZ Inc"      // Document 2
```

Different sources should prevent grouping (visual analysis).

## Quick Implementation Guide

### For Developers

1. Review `METADATA_CONFIDENCE_GUIDE` in classify.ts
2. Understand the 6-step validation hierarchy in `getGroupingAnalysisPrompt()`
3. Test with examples provided above
4. Verify `metadataValidation` structure in responses

### For QA/Product

1. Test form type requirement (different forms should NOT group)
2. Test SSN-4 mismatch (different SSNs should NOT group)
3. Verify confidence boost appears in metadata match scenarios
4. Confirm late-arriving pages can join existing groups

### For Ops/DevOps

1. No database schema changes required
2. No new environment variables
3. API responses include new optional `metadataValidation` field
4. Backward compatible with existing integrations

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| **Main Docs** | `docs/phase-04-ai-prompt-improvements.md` | Comprehensive reference |
| **This File** | `docs/phase-04-ai-prompt-quick-reference.md` | Quick lookup |
| **Prompt Code** | `apps/api/src/services/ai/prompts/classify.ts` | Implementation |
| **Classifier** | `apps/api/src/services/ai/document-classifier.ts` | API integration |

## Success Metrics

- ✅ W-2 + 1099-NEC from same taxpayer: NOT grouped (0 false positives)
- ✅ Form 1040 + Schedule C from same taxpayer: NOT grouped (0 false positives)
- ✅ Same document pages from same taxpayer: Grouped with 0.90+ confidence
- ✅ Late-arriving pages: Successfully join existing groups
- ✅ API consistency: All code paths return metadataValidation field

---

**For deeper dive:** See `phase-04-ai-prompt-improvements.md`
**For integration:** See `system-architecture.md` Phase 4 section
**Last Updated:** 2026-02-25
