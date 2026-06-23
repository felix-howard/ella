/**
 * Debounced recipient (Client + Lead) search for the "Send quote" combobox.
 *
 * Filtering happens server-side (`GET /recipients/search`); this hook only
 * debounces the query and maps the grouped response into flat `ComboboxItem`s.
 * Each item's `id` encodes `type:id` so the panel can recover the recipient
 * without holding a parallel lookup map.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ComboboxItem } from '@ella/ui'
import { useAuth } from '@clerk/clerk-react'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { api, type RecipientResult } from '../../lib/api-client'

const DEBOUNCE_MS = 250

export interface UseRecipientSearchResult {
  items: ComboboxItem[]
  recipientByItemId: ReadonlyMap<string, RecipientSearchMetadata>
  loading: boolean
}

export interface RecipientSearchMetadata {
  id: string
  type: 'client' | 'lead'
  label: string
  hint?: string
  hasPhone: boolean
}

export const recipientSearchQueryKey = (orgId: string | null | undefined, query: string) =>
  ['recipient-search', orgId ?? 'no-org', query] as const

export function useRecipientSearch(query: string): UseRecipientSearchResult {
  const { orgId } = useAuth()
  const [debounced, isDebouncing] = useDebouncedValue(query.trim(), DEBOUNCE_MS)
  const enabled = Boolean(orgId) && debounced.length > 0

  const { data, isFetching } = useQuery({
    queryKey: recipientSearchQueryKey(orgId, debounced),
    queryFn: () => api.recipients.search(debounced),
    enabled,
    staleTime: 30_000,
  })

  const { items, recipientByItemId } = useMemo(() => {
    if (!data) {
      return {
        items: [] as ComboboxItem[],
        recipientByItemId: new Map<string, RecipientSearchMetadata>(),
      }
    }
    const rows = [
      ...data.clients.map((r) => toComboboxItem(r, 'Clients')),
      ...data.leads.map((r) => toComboboxItem(r, 'Leads')),
    ]
    return {
      items: rows.map(({ metadata: _metadata, ...item }) => item),
      recipientByItemId: new Map(rows.map((row) => [row.id, row.metadata])),
    }
  }, [data])

  return { items, recipientByItemId, loading: enabled && (isDebouncing || isFetching) }
}

export function encodeRecipientId(type: 'client' | 'lead', id: string): string {
  return `${type}:${id}`
}

export function decodeRecipientId(value: string): { type: 'client' | 'lead'; id: string } | null {
  const separator = value.indexOf(':')
  if (separator < 0) return null
  const type = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if ((type !== 'client' && type !== 'lead') || !id) return null
  return { type, id }
}

function toComboboxItem(
  recipient: RecipientResult,
  group: string,
): ComboboxItem & { metadata: RecipientSearchMetadata } {
  const label = displayName(recipient)
  const id = encodeRecipientId(recipient.type, recipient.id)
  const hint = buildHint(recipient, label)
  return {
    id,
    label,
    group,
    badge: recipient.type === 'client' ? 'Client' : 'Lead',
    hint,
    metadata: {
      id: recipient.id,
      type: recipient.type,
      label,
      hint,
      hasPhone: Boolean(recipient.phoneLast4),
    },
  }
}

function displayName(recipient: RecipientResult): string {
  const name = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ').trim()
  return name || recipient.businessName?.trim() || 'Unnamed'
}

/** Secondary line: business name (when it isn't already the label) · •••• last4. */
function buildHint(recipient: RecipientResult, label: string): string | undefined {
  const parts: string[] = []
  const business = recipient.businessName?.trim()
  if (business && business !== label) parts.push(business)
  if (recipient.phoneLast4) parts.push(`•••• ${recipient.phoneLast4}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
