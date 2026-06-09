import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, BULK_SMS_MAX_RECIPIENTS } from '../../lib/api-client'
import type { Lead, LeadStatus } from '../../lib/api-client'

type SelectionMode = 'explicit' | 'filtered'

interface UseLeadBulkSelectionInput {
  leads: Lead[]
  debouncedSearch: string
  statusFilter: LeadStatus | ''
  tagFilter: string
  showConverted: boolean
  selectableTotal?: number
  bulkSmsMaxRecipients?: number
  getTruncatedMessage: (limit: number) => string
  getErrorMessage: (error: unknown) => string
}

export function useLeadBulkSelection({
  leads,
  debouncedSearch,
  statusFilter,
  tagFilter,
  showConverted,
  selectableTotal = 0,
  bulkSmsMaxRecipients,
  getTruncatedMessage,
  getErrorMessage,
}: UseLeadBulkSelectionInput) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('explicit')
  const [isFetchingTargets, setIsFetchingTargets] = useState(false)
  const [targetPreviewError, setTargetPreviewError] = useState<string | null>(null)
  const bulkSmsLimit = bulkSmsMaxRecipients ?? BULK_SMS_MAX_RECIPIENTS
  const selectableLeads = useMemo(() => leads.filter((lead) => lead.status !== 'CONVERTED'), [leads])
  const filterSnapshot = `${debouncedSearch}\u001f${statusFilter}\u001f${tagFilter}\u001f${showConverted}`
  const filterSnapshotRef = useRef(filterSnapshot)
  const selectionVersionRef = useRef(0)

  useEffect(() => {
    filterSnapshotRef.current = filterSnapshot
  }, [filterSnapshot])

  const markSelectionChanged = useCallback(() => {
    selectionVersionRef.current += 1
    setIsFetchingTargets(false)
  }, [])

  const clearSelection = useCallback(() => {
    markSelectionChanged()
    setSelectedIds(new Set())
    setSelectionMode('explicit')
    setTargetPreviewError(null)
  }, [markSelectionChanged])

  const handleSelect = useCallback((id: string, selected: boolean) => {
    markSelectionChanged()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id); else next.delete(id)
      return next
    })
    setSelectionMode('explicit')
    setTargetPreviewError(null)
  }, [markSelectionChanged])

  const handleSelectAll = useCallback((selected: boolean) => {
    markSelectionChanged()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const lead of selectableLeads) {
        if (selected) next.add(lead.id); else next.delete(lead.id)
      }
      return next
    })
    setSelectionMode('explicit')
    setTargetPreviewError(null)
  }, [markSelectionChanged, selectableLeads])

  const handleSelectAllFiltered = useCallback(async () => {
    if (selectableTotal > bulkSmsLimit) return
    const snapshot = filterSnapshot
    const requestVersion = selectionVersionRef.current + 1
    selectionVersionRef.current = requestVersion
    const isCurrentRequest = () =>
      filterSnapshotRef.current === snapshot && selectionVersionRef.current === requestVersion

    setIsFetchingTargets(true)
    setTargetPreviewError(null)
    try {
      const response = await api.leads.previewBulkSmsTargets({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        tag: tagFilter || undefined,
        includeConverted: showConverted || undefined,
        limit: bulkSmsLimit,
      })
      if (!isCurrentRequest()) return
      if (response.data.truncated || response.data.returnedIds.length !== response.data.selectableTotal) {
        setTargetPreviewError(getTruncatedMessage(response.data.limit))
        return
      }
      setSelectedIds(new Set(response.data.returnedIds))
      setSelectionMode('filtered')
    } catch (error) {
      if (!isCurrentRequest()) return
      setTargetPreviewError(getErrorMessage(error))
    } finally {
      if (isCurrentRequest()) setIsFetchingTargets(false)
    }
  }, [
    bulkSmsLimit,
    debouncedSearch,
    filterSnapshot,
    getErrorMessage,
    getTruncatedMessage,
    selectableTotal,
    showConverted,
    statusFilter,
    tagFilter,
  ])

  const selectedLeadIds = useMemo(() => Array.from(selectedIds), [selectedIds])
  const previewLead = useMemo(
    () => leads.find((lead) => selectedIds.has(lead.id)),
    [leads, selectedIds],
  )

  return {
    selectedIds,
    selectedLeadIds,
    selectionMode,
    previewLead,
    bulkSmsLimit,
    isFetchingTargets,
    targetPreviewError,
    clearSelection,
    handleSelect,
    handleSelectAll,
    handleSelectAllFiltered,
  }
}
