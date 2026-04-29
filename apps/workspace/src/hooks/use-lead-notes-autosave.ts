/**
 * useLeadNotesAutosave - Debounced auto-save (500ms) for Lead notes.
 * Skips the initial sync from server and guards against concurrent in-flight writes.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { useDebouncedValue } from './use-debounced-value'

interface Options {
  leadId: string
  initialNotes: string
  delay?: number
}

export function useLeadNotesAutosave({ leadId, initialNotes, delay = 500 }: Options) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(initialNotes)
  const [lastSaved, setLastSaved] = useState(initialNotes)
  const [prevLeadId, setPrevLeadId] = useState(leadId)
  const [debouncedNotes, isPending] = useDebouncedValue(notes, delay)

  // Reset local state when switching leads — hydrate from server value.
  // setState-during-render is a legitimate React pattern for resetting state on prop change.
  if (prevLeadId !== leadId) {
    setPrevLeadId(leadId)
    setLastSaved(initialNotes)
    setNotes(initialNotes)
  }

  const mutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api.leads.update(id, { notes: value || null }),
    onSuccess: (_data, { id, value }) => {
      // Only commit lastSaved if we're still on the lead this save belonged to —
      // prevents stale A-save overwriting lead B's state after a navigation.
      if (id === leadId) setLastSaved(value)
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const { mutate, isPending: isSaving } = mutation

  // Fire a save when the debounced value changes and differs from last saved.
  // Guard: skip if already saving (re-queue will happen on next debounce tick).
  useEffect(() => {
    if (debouncedNotes === lastSaved) return
    if (isSaving) return
    mutate({ id: leadId, value: debouncedNotes })
  }, [debouncedNotes, lastSaved, isSaving, leadId, mutate])

  return {
    notes,
    setNotes,
    isPending: isPending || mutation.isPending,
    isError: mutation.isError,
  }
}
