/**
 * html-to-pdf converter tests — inspects React.ReactElement tree structure.
 * No JSX in tests so they live under .test.ts (vitest include pattern).
 */
import { Link, Text, View } from '@react-pdf/renderer'
import type React from 'react'
import { describe, expect, it } from 'vitest'
import { htmlToPdfNodes } from '../html-to-pdf'

type AnyEl = React.ReactElement<{
  style?: unknown
  children?: React.ReactNode
  src?: string
}>

function flattenChildren(node: React.ReactNode): React.ReactNode[] {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flattenChildren)
  return [node]
}

function findDescendant(
  node: React.ReactNode,
  predicate: (el: AnyEl) => boolean,
): AnyEl | null {
  for (const child of flattenChildren(node)) {
    if (typeof child !== 'object' || child == null) continue
    const el = child as AnyEl
    if (predicate(el)) return el
    const found = findDescendant(el.props?.children, predicate)
    if (found) return found
  }
  return null
}

function collectText(node: React.ReactNode): string {
  let s = ''
  for (const child of flattenChildren(node)) {
    if (child == null) continue
    if (typeof child === 'string' || typeof child === 'number') {
      s += String(child)
    } else if (typeof child === 'object') {
      s += collectText((child as AnyEl).props?.children)
    }
  }
  return s
}

describe('htmlToPdfNodes', () => {
  it('renders <p> as View > Text with paragraph text', () => {
    const out = htmlToPdfNodes('<p>hi</p>')
    expect(out).toHaveLength(1)
    expect(out[0]!.type).toBe(View)
    const text = findDescendant(out[0], (el) => el.type === Text)
    expect(text).not.toBeNull()
    expect(collectText(out[0])).toBe('hi')
  })

  it('renders <h2> as Text with heading style override fontSize 13', () => {
    const out = htmlToPdfNodes('<h2>Title</h2>')
    expect(out).toHaveLength(1)
    expect(out[0]!.type).toBe(Text)
    const style = (out[0] as AnyEl).props.style
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style
    expect((flat as { fontSize?: number }).fontSize).toBe(13)
    expect(collectText(out[0])).toBe('Title')
  })

  it('renders <h3> as Text with default heading style', () => {
    const out = htmlToPdfNodes('<h3>Sub</h3>')
    expect(out[0]!.type).toBe(Text)
    expect(collectText(out[0])).toBe('Sub')
  })

  it('renders <ul> as View containing one Text per <li> with bullet prefix', () => {
    const out = htmlToPdfNodes('<ul><li>a</li><li>b</li></ul>')
    expect(out).toHaveLength(1)
    expect(out[0]!.type).toBe(View)
    const items = flattenChildren((out[0] as AnyEl).props.children).filter(
      (c) => typeof c === 'object' && c !== null && (c as AnyEl).type === Text,
    ) as AnyEl[]
    expect(items).toHaveLength(2)
    expect(collectText(items[0])).toBe('\u2022 a')
    expect(collectText(items[1])).toBe('\u2022 b')
  })

  it('renders <ol> with numbered items', () => {
    const out = htmlToPdfNodes('<ol><li>a</li><li>b</li></ol>')
    const items = flattenChildren((out[0] as AnyEl).props.children).filter(
      (c) => typeof c === 'object' && c !== null && (c as AnyEl).type === Text,
    ) as AnyEl[]
    expect(items).toHaveLength(2)
    expect(collectText(items[0])).toBe('1. a')
    expect(collectText(items[1])).toBe('2. b')
  })

  it('wraps <strong> as nested Text with bold font weight', () => {
    const out = htmlToPdfNodes('<p><strong>bold</strong> rest</p>')
    const bold = findDescendant(out[0], (el) => {
      if (el.type !== Text) return false
      const style = el.props.style as { fontWeight?: number } | undefined
      return style?.fontWeight === 700
    })
    expect(bold).not.toBeNull()
    expect(collectText(bold!)).toBe('bold')
    expect(collectText(out[0])).toBe('bold rest')
  })

  it('wraps <em> as nested Text with italic fontStyle', () => {
    const out = htmlToPdfNodes('<p><em>i</em></p>')
    const italic = findDescendant(out[0], (el) => {
      if (el.type !== Text) return false
      const style = el.props.style as { fontStyle?: string } | undefined
      return style?.fontStyle === 'italic'
    })
    expect(italic).not.toBeNull()
    expect(collectText(italic!)).toBe('i')
  })

  it('renders <a href> as Link with src attribute', () => {
    const out = htmlToPdfNodes('<p><a href="https://e.com">click</a></p>')
    const link = findDescendant(out[0], (el) => el.type === Link)
    expect(link).not.toBeNull()
    expect(link!.props.src).toBe('https://e.com')
    expect(collectText(link!)).toBe('click')
  })

  it('emits newline for <br>', () => {
    const out = htmlToPdfNodes('<p>a<br />b</p>')
    expect(collectText(out[0])).toBe('a\nb')
  })

  it('returns empty array for empty input', () => {
    expect(htmlToPdfNodes('')).toEqual([])
  })

  it('renders multiple top-level blocks in order', () => {
    const out = htmlToPdfNodes('<h2>H</h2><p>p1</p><p>p2</p>')
    expect(out).toHaveLength(3)
    expect(out[0]!.type).toBe(Text)
    expect(out[1]!.type).toBe(View)
    expect(out[2]!.type).toBe(View)
  })

  it('renders <a> without href as inline text (drops Link wrapper)', () => {
    const out = htmlToPdfNodes('<p><a>plain</a></p>')
    expect(findDescendant(out[0], (el) => el.type === Link)).toBeNull()
    expect(collectText(out[0])).toBe('plain')
  })

  it('preserves multiple consecutive <br> as multiple newlines', () => {
    const out = htmlToPdfNodes('<p>a<br /><br /><br />b</p>')
    expect(collectText(out[0])).toBe('a\n\n\nb')
  })

  it('does not crash on unclosed tags (htmlparser2 lenient)', () => {
    expect(() => htmlToPdfNodes('<p>foo')).not.toThrow()
    const out = htmlToPdfNodes('<p>foo')
    expect(collectText(out[0])).toBe('foo')
  })

  it('flattens nested lists to text (multi-level lists out of v1 scope)', () => {
    const out = htmlToPdfNodes('<ul><li>x<ul><li>y</li></ul></li></ul>')
    // Outer <ul> is a View; nested <ul>/<li> fall through as inline text
    expect(out[0]!.type).toBe(View)
    expect(collectText(out[0])).toContain('x')
    expect(collectText(out[0])).toContain('y')
  })

  it('handles empty <li> and empty <p> without crashing', () => {
    expect(() => htmlToPdfNodes('<ul><li></li></ul><p></p>')).not.toThrow()
    const out = htmlToPdfNodes('<ul><li></li></ul><p></p>')
    expect(out).toHaveLength(2)
  })

  it('composes deeply nested marks (<strong><em><a>...)', () => {
    const out = htmlToPdfNodes('<p><strong><em><a href="https://e.com">x</a></em></strong></p>')
    const link = findDescendant(out[0], (el) => el.type === Link)
    expect(link).not.toBeNull()
    expect(link!.props.src).toBe('https://e.com')
    expect(collectText(out[0])).toBe('x')
  })
})
