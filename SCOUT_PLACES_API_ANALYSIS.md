# Google Places API Address Autocomplete - File Inventory

## Summary
Found existing Google Places API address autocomplete implementation in portal app contractor intake form. Workspace app business-info-form has plain text fields without autocomplete.

---

## 1. Address Autocomplete Component (Implemented)

### File Location
`/c/Users/Admin/Desktop/ella/apps/portal/src/components/contractor-intake/address-autocomplete.tsx`

### Key Lines
- **26**: API key from `VITE_GOOGLE_MAPS_API_KEY`
- **32-51**: Google Maps script loader with callback pattern
- **72-73**: Service and session token refs
- **84-88**: Service initialization on ready state
- **101-131**: fetchPredictions function with debounce (300ms at line 138)
- **108-128**: getPlacePredictions call with US country restriction
- **141-191**: handleSelectPrediction extracts address components
- **170-185**: Address component parsing (street, city, state, zip)
- **193-232**: UI dropdown with MapPin icon

### Returns
Object with address, city, state, zip extracted from Google Places response.

---

## 2. Contractor Intake Form (Portal App)

### File Location
`/c/Users/Admin/Desktop/ella/apps/portal/src/components/contractor-intake/contractor-intake-form.tsx`

### Integration Points
- **Line 9**: Import AddressAutocomplete
- **Lines 214-219**: handleAddressSelect callback
- **Lines 354-362**: AddressAutocomplete rendered in form
- **Lines 365-400**: City, State, ZIP fields accept autocomplete output

---

## 3. Business Info Form (Workspace App)

### File Location
`/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/business-info-form.tsx`

### Current Address Fields (Plain Text - NO Autocomplete)
- **Lines 168-184**: Address input
- **Lines 188-203**: City input  
- **Lines 204-220**: State input (2 chars max, uppercase)
- **Lines 221-238**: ZIP input (max 10 chars)

### Interface (Lines 17-27)
BusinessInfoData with address, city, state, zip properties.

---

## 4. Client Creation Wizard

### File Location
`/c/Users/Admin/Desktop/ella/apps/workspace/src/routes/clients/new.tsx`

### Business Info Usage
- **Line 350**: Renders BusinessInfoForm
- **Lines 228-238**: Maps businessInfo to API payload
  - businessAddress
  - businessCity
  - businessState
  - businessZip

### Validation (Lines 143-167)
- State: 2 chars, valid US code
- ZIP: Matches /^\d{5}(-\d{4})?$/ pattern
- Phone: 10 digits for business-only path

---

## 5. Component Exports

### File Location
`/c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/index.ts`

### Lines 22-23
Exports BusinessInfoForm and BasicInfoForm for new.tsx route.

---

## 6. Environment & Dependencies

### Portal Package
- **File**: `/c/Users/Admin/Desktop/ella/apps/portal/package.json`
- **Line 32**: `@types/google.maps: ^3.58.1`
- **Env Var**: `VITE_GOOGLE_MAPS_API_KEY` (used in address-autocomplete.tsx line 26)

### Workspace
- No Google Maps integration currently in workspace app
- Would need VITE_GOOGLE_MAPS_API_KEY if Places API added

---

## Complete File Reference

| File | Type | Purpose | Status |
|------|------|---------|--------|
| apps/portal/src/components/contractor-intake/address-autocomplete.tsx | Component | Google Places autocomplete | ✓ Implemented |
| apps/portal/src/components/contractor-intake/contractor-intake-form.tsx | Form | 1099-NEC contractor entry | ✓ Uses autocomplete |
| apps/workspace/src/components/clients/business-info-form.tsx | Form | Business info for client creation | ✗ Plain text fields |
| apps/workspace/src/routes/clients/new.tsx | Route | Client creation wizard | ⚠ Calls BusinessInfoForm |
| apps/workspace/src/components/clients/index.ts | Export | Component barrel | ✓ Ready |

---

## Key Technical Details

### Address Component Parsing
From contractor-intake/address-autocomplete.tsx lines 164-185:
- street_number + route = address
- locality or sublocality_level_1 = city
- administrative_area_level_1 (short_name) = state
- postal_code = zip

### Session Token Strategy
Lines 72, 87, 113, 153, 157: Uses AutocompleteSessionToken to:
1. Batch predictions in single session
2. Reduce billing (multiple requests = 1 session charge)
3. Reset after getDetails completes

### Input Validation
- Lines 103-104: Min 3 characters before fetching
- Line 111: US only (country: us)
- Line 112: types: ['address']

