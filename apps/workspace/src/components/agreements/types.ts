/**
 * Shared types for entity-agnostic Agreement components.
 * `EntityRef` discriminates the backing API surface (lead vs client) so hooks
 * and components can target either entity without per-call branching at the
 * call site. `Recipient` is the minimal contact shape needed by the editor +
 * SMS gating UI.
 */
export type EntityType = 'lead' | 'client'

export interface EntityRef {
  type: EntityType
  id: string
}

export interface Recipient {
  id: string
  firstName: string
  lastName?: string | null
  phone: string
}
