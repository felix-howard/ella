/**
 * Schedule C Hook - Fetches Schedule C expense data for staff view
 * Includes expense data, magic link status, and calculated totals
 */
import { useQuery } from '@tanstack/react-query'
import { api, type ScheduleCResponse, type DigitalDoc } from '../lib/api-client'

interface UseScheduleCOptions {
  caseId: string | undefined
  enabled?: boolean
}

/**
 * Check if case has verified 1099-NEC documents
 */
function checkHas1099NEC(docs: DigitalDoc[]): boolean {
  return docs.some(
    (doc) => doc.docType === 'FORM_1099_NEC' && doc.status === 'VERIFIED'
  )
}

export function useScheduleC({ caseId, enabled = true }: UseScheduleCOptions) {
  // Fetch Schedule C data
  const {
    data: scheduleCData,
    isLoading: isScheduleCLoading,
    error: scheduleCError,
    refetch: refetchScheduleC,
  } = useQuery({
    queryKey: ['schedule-c', caseId],
    queryFn: () => api.scheduleC.get(caseId!),
    enabled: !!caseId && enabled,
    staleTime: 30000, // 30 seconds
  })

  // Fetch docs to detect 1099-NEC
  const {
    data: docsResponse,
    isLoading: isDocsLoading,
  } = useQuery({
    queryKey: ['docs', caseId],
    queryFn: () => api.cases.getDocs(caseId!),
    enabled: !!caseId && enabled,
    staleTime: 30000,
  })

  const docs = docsResponse?.docs ?? []
  const has1099NEC = checkHas1099NEC(docs)
  const necBreakdown = scheduleCData?.necBreakdown ?? []

  // Determine if we should show the Schedule C tab
  // Show if: 1099-NEC detected OR Schedule C already exists
  const showScheduleCTab = has1099NEC || !!scheduleCData?.expense

  return {
    // Schedule C data
    expense: scheduleCData?.expense ?? null,
    magicLink: scheduleCData?.magicLink ?? null,
    totals: scheduleCData?.totals ?? null,
    // 1099-NEC breakdown from API (per-payer detail)
    necBreakdown,
    // 1099-NEC detection (from docs query - includes unverified for tab visibility)
    has1099NEC,
    count1099NEC: necBreakdown.length,
    // Tab visibility
    showScheduleCTab,
    // Loading/error states
    isLoading: isScheduleCLoading || isDocsLoading,
    error: scheduleCError,
    // Actions
    refetch: refetchScheduleC,
  }
}
