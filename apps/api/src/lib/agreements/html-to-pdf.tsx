/**
 * Convert sanitized agreement HTML into react-pdf node tree.
 *
 * Uses `htmlparser2` (transitive via `sanitize-html`) for lenient parsing —
 * unclosed tags don't crash. Whitelist matches `sanitize-html.ts`; defence-
 * in-depth: any non-whitelist tag is rendered as inline children only.
 *
 * Block tags emit `<View>` / `<Text>` siblings consumed by `AgreementPdfDocument`
 * body. Inline marks become nested `<Text>` so styles compose with parent.
 */
import { Link, Text, View } from '@react-pdf/renderer'
import type { ChildNode, Element } from 'domhandler'
import { parseDocument } from 'htmlparser2'
import React from 'react'
import { pdfStyles } from '../../services/agreements/pdf-styles'

const BOLD_STYLE = { fontFamily: 'Helvetica-Bold' }
const ITALIC_STYLE = { fontStyle: 'italic' as const }
const H2_STYLE = [pdfStyles.heading, { fontSize: 13 }]

function isElement(n: ChildNode): n is Element {
  return n.type === 'tag'
}

function tagName(el: Element): string {
  return el.name.toLowerCase()
}

/** Render inline content (text, <strong>, <em>, <a>, <br>) for use inside <Text>. */
function renderInline(nodes: ChildNode[], keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  nodes.forEach((node, i) => {
    const key = `${keyPrefix}-${i}`
    if (node.type === 'text') {
      out.push((node as { data: string }).data)
      return
    }
    if (!isElement(node)) return
    const name = tagName(node)
    if (name === 'strong') {
      out.push(
        <Text key={key} style={BOLD_STYLE}>
          {renderInline(node.children, key)}
        </Text>,
      )
    } else if (name === 'em') {
      out.push(
        <Text key={key} style={ITALIC_STYLE}>
          {renderInline(node.children, key)}
        </Text>,
      )
    } else if (name === 'a') {
      const href = node.attribs?.href ?? ''
      if (href) {
        out.push(
          <Link key={key} src={href}>
            {renderInline(node.children, key)}
          </Link>,
        )
      } else {
        out.push(...renderInline(node.children, key))
      }
    } else if (name === 'br') {
      out.push('\n')
    } else {
      // Unknown / non-whitelisted: defence-in-depth — skip wrapper, keep children
      out.push(...renderInline(node.children, key))
    }
  })
  return out
}

/**
 * Top-level list rendering. Nested lists inside an `<li>` (e.g.
 * `<ul><li>x<ul><li>y</li></ul></li></ul>`) flatten via `renderInline`'s
 * unknown-tag fallthrough — text is preserved without bullets/structure.
 * Multi-level lists are out-of-scope for v1; revisit if staff request it.
 */
function renderListItems(el: Element, keyPrefix: string, ordered: boolean): React.ReactElement[] {
  const items = el.children.filter(isElement).filter((c) => tagName(c) === 'li')
  return items.map((li, j) => {
    const key = `${keyPrefix}-li-${j}`
    const marker = ordered ? `${j + 1}. ` : '\u2022 '
    return (
      <Text key={key} style={pdfStyles.paragraph}>
        {marker}
        {renderInline(li.children, key)}
      </Text>
    )
  })
}

/**
 * Walk top-level nodes and produce a flat array of react-pdf elements suitable
 * for spreading into the PDF body. Text nodes at the root are dropped (they're
 * almost always whitespace between block tags).
 */
export function htmlToPdfNodes(html: string): React.ReactElement[] {
  const doc = parseDocument(html ?? '')
  const out: React.ReactElement[] = []
  doc.children.forEach((node, i) => {
    if (!isElement(node)) return
    const name = tagName(node)
    const key = `n-${i}`
    if (name === 'p') {
      out.push(
        <View key={key} style={pdfStyles.section}>
          <Text style={pdfStyles.paragraph}>{renderInline(node.children, key)}</Text>
        </View>,
      )
    } else if (name === 'h2') {
      out.push(
        <Text key={key} style={H2_STYLE}>
          {renderInline(node.children, key)}
        </Text>,
      )
    } else if (name === 'h3') {
      out.push(
        <Text key={key} style={pdfStyles.heading}>
          {renderInline(node.children, key)}
        </Text>,
      )
    } else if (name === 'ul') {
      out.push(
        <View key={key} style={pdfStyles.section}>
          {renderListItems(node, key, false)}
        </View>,
      )
    } else if (name === 'ol') {
      out.push(
        <View key={key} style={pdfStyles.section}>
          {renderListItems(node, key, true)}
        </View>,
      )
    }
    // Other top-level tags silently skipped — sanitizer strips them already.
  })
  return out
}

