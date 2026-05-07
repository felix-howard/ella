/**
 * Detect unresolved bracket placeholders in agreement HTML.
 *
 * The editor/template convention uses visible placeholders like [Amount] and
 * [Describe specific scope of work here.]. We parse visible text instead of
 * scanning raw HTML so attributes or escaped markup cannot false-positive.
 */
import type { ChildNode } from 'domhandler'
import { parseDocument } from 'htmlparser2'

const PLACEHOLDER_RE = /\[[^\[\]\n]{2,120}\]/g

function textOf(nodes: ChildNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      out += (node as { data: string }).data
      continue
    }
    if ('children' in node && Array.isArray(node.children)) {
      out += textOf(node.children as ChildNode[])
    }
  }
  return out
}

export function findAgreementPlaceholders(html: string | null | undefined): string[] {
  if (!html) return []
  const doc = parseDocument(html)
  const matches = textOf(doc.children).match(PLACEHOLDER_RE) ?? []
  return Array.from(new Set(matches)).slice(0, 10)
}

export function assertNoAgreementPlaceholders(input: {
  html: string | null | undefined
  label?: string
}): void {
  const placeholders = findAgreementPlaceholders(input.html)
  if (placeholders.length === 0) return
  const label = input.label ?? 'Agreement'
  const suffix = placeholders.length > 0 ? `: ${placeholders.join(', ')}` : ''
  throw new Error(`${label} has unresolved placeholders${suffix}`)
}
