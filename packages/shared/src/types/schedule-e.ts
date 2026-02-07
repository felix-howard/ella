/**
 * Schedule E (Form 1040) rental property types
 * Used for client form input and data storage
 */

/** Property address for Schedule E rental property */
export interface ScheduleEPropertyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/** Custom expense item for "Other" expenses list */
export interface ScheduleEOtherExpense {
  name: string;
  amount: number;
}

/**
 * IRS Property Types for Schedule E (excluding Royalties = 6)
 * 1 = Single Family Residence
 * 2 = Multi-Family Residence
 * 3 = Vacation/Short-Term Rental
 * 4 = Commercial
 * 5 = Land
 * 7 = Self-Rental
 * 8 = Other (requires description)
 */
export type ScheduleEPropertyType = 1 | 2 | 3 | 4 | 5 | 7 | 8;

/** Property identifier (A, B, or C - max 3 properties) */
export type ScheduleEPropertyId = 'A' | 'B' | 'C';

/**
 * Single rental property data for Schedule E
 * Includes address, type, rental period, income, and expenses
 */
export interface ScheduleEProperty {
  id: ScheduleEPropertyId;
  address: ScheduleEPropertyAddress;
  propertyType: ScheduleEPropertyType;
  propertyTypeOther?: string; // Required if propertyType = 8

  // Rental period
  monthsRented: number;        // Client enters (1-12)
  fairRentalDays: number;      // Calculated: monthsRented * 30
  personalUseDays: number;     // Client enters directly

  // Income
  rentsReceived: number;

  // Expenses (7 simplified IRS fields)
  insurance: number;           // Line 9
  mortgageInterest: number;    // Line 12
  repairs: number;             // Line 14
  taxes: number;               // Line 16
  utilities: number;           // Line 17
  managementFees: number;      // Line 11
  cleaningMaintenance: number; // Line 7

  // Custom expenses list
  otherExpenses: ScheduleEOtherExpense[];

  // Calculated totals
  totalExpenses: number;
  netIncome: number;
}

/** Version history entry for audit trail */
export interface ScheduleEVersionHistoryEntry {
  version: number;
  submittedAt: string;
  changes: string[];
  properties: ScheduleEProperty[];
}

/** Aggregate totals across all properties */
export interface ScheduleETotals {
  totalRent: number;
  totalExpenses: number;
  totalNet: number;
  propertyCount: number;
}

/** Status enum matching Prisma ScheduleEStatus */
export type ScheduleEStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';

/** Empty property template for form initialization */
export const createEmptyProperty = (id: ScheduleEPropertyId): ScheduleEProperty => ({
  id,
  address: { street: '', city: '', state: '', zip: '' },
  propertyType: 1,
  monthsRented: 0,
  fairRentalDays: 0,
  personalUseDays: 0,
  rentsReceived: 0,
  insurance: 0,
  mortgageInterest: 0,
  repairs: 0,
  taxes: 0,
  utilities: 0,
  managementFees: 0,
  cleaningMaintenance: 0,
  otherExpenses: [],
  totalExpenses: 0,
  netIncome: 0,
});

/** Property type labels for display */
export const PROPERTY_TYPE_LABELS: Record<ScheduleEPropertyType, { en: string; vi: string }> = {
  1: { en: 'Single Family Residence', vi: 'Nhà riêng lẻ' },
  2: { en: 'Multi-Family Residence', vi: 'Nhà nhiều căn hộ' },
  3: { en: 'Vacation/Short-Term Rental', vi: 'Cho thuê ngắn hạn' },
  4: { en: 'Commercial', vi: 'Thương mại' },
  5: { en: 'Land', vi: 'Đất trống' },
  7: { en: 'Self-Rental', vi: 'Tự cho thuê' },
  8: { en: 'Other', vi: 'Khác' },
};
