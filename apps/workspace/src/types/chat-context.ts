/**
 * ChatContext - discriminated union describing who the chatbox is talking to.
 * Drives API endpoints, realtime filters, query keys, and UX gating.
 */

export type ChatContext =
  | { type: 'case'; caseId: string; clientId: string }
  | { type: 'lead'; leadId: string }

/** Resolve the scalar id that identifies this context for query keys / filters. */
export function chatContextId(ctx: ChatContext): string {
  return ctx.type === 'case' ? ctx.caseId : ctx.leadId
}
