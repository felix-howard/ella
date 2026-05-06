/**
 * React-PDF component: Section 21 Signatures for NDA v2.
 *
 * Renders the dual-column (Firm / Client) signature block. The entire block
 * is wrapped in <View wrap={false}> to prevent page-splitting mid-section.
 *
 * Three render modes:
 *   'preview'  — all values are placeholder lines; no real data shown.
 *   'view'     — Firm side shows real signature (CPA signed at create time);
 *                Client side shows placeholders (awaiting client signature).
 *   'signed'   — Both sides show real values + PNG signature images.
 */
import { Image, Text, View } from '@react-pdf/renderer'
import React from 'react'
import { pdfStyles as s } from './pdf-styles'

export type PdfSignatureMode = 'preview' | 'view' | 'signed'

export interface PdfSignatureBlockProps {
  mode: PdfSignatureMode

  // Firm side
  firmName: string
  firmSignerName: string
  firmSignerTitle: string
  /** PNG bytes of the Firm's drawn signature. Required in 'signed'/'view' modes. */
  firmSignaturePngBuffer?: Buffer
  /** Formatted date string for Firm signature (e.g. "May 6, 2026"). */
  firmSignedAt?: string

  // Client side
  clientType: 'INDIVIDUAL' | 'BUSINESS'
  clientNameOrBusiness: string
  clientAuthRepName?: string
  clientAuthRepTitle?: string
  /** PNG bytes of the Client's drawn signature. Required in 'signed' mode. */
  clientSignaturePngBuffer?: Buffer
  /** Formatted date string for Client signature. */
  clientSignedAt?: string
}

// ── Internal sub-components ────────────────────────────────────────────────

interface SigRowProps {
  label: string
  value?: string
  showPlaceholder?: boolean
}

/** One label + value (or underline placeholder) row. */
function SigRow({ label, value, showPlaceholder }: SigRowProps) {
  return (
    <View style={s.sigRow}>
      <Text style={s.sigRowLabel}>{label}</Text>
      {showPlaceholder || !value ? (
        <View style={s.sigPlaceholderLine} />
      ) : (
        <Text style={s.sigRowValue}>{value}</Text>
      )}
    </View>
  )
}

interface SigImageRowProps {
  label: string
  pngBuffer?: Buffer
  showPlaceholder?: boolean
}

/** Signature image row — shows PNG if available, else underline placeholder. */
function SigImageRow({ label, pngBuffer, showPlaceholder }: SigImageRowProps) {
  return (
    <View style={s.sigRow}>
      <Text style={s.sigRowLabel}>{label}</Text>
      {pngBuffer && !showPlaceholder ? (
        <Image src={pngBuffer} style={s.sigImage} />
      ) : (
        <View style={s.sigPlaceholderLine} />
      )}
    </View>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function PdfSignatureBlock({
  mode,
  firmName,
  firmSignerName,
  firmSignerTitle,
  firmSignaturePngBuffer,
  firmSignedAt,
  clientType,
  clientNameOrBusiness,
  clientAuthRepName,
  clientAuthRepTitle,
  clientSignaturePngBuffer,
  clientSignedAt,
}: PdfSignatureBlockProps) {
  const isPreview = mode === 'preview'
  // In 'view' mode the Firm has already signed; Client has not yet.
  const firmSigned = mode === 'signed' || mode === 'view'
  const clientSigned = mode === 'signed'

  return (
    <View wrap={false} style={s.sigSection}>
      <Text style={s.sigSectionHeading}>21. Signatures</Text>

      {/* ── Firm column ── */}
      <Text style={s.sigColumnHeader}>Firm</Text>

      <SigRow label="Firm Name" value={firmName} showPlaceholder={isPreview} />
      <SigRow label="Authorized Representative" value={firmSignerName} showPlaceholder={isPreview} />
      <SigRow label="Title" value={firmSignerTitle} showPlaceholder={isPreview} />
      <SigImageRow
        label="Signature"
        pngBuffer={firmSigned ? firmSignaturePngBuffer : undefined}
        showPlaceholder={isPreview || !firmSigned}
      />
      <SigRow label="Date" value={firmSignedAt} showPlaceholder={isPreview || !firmSigned} />

      <View style={s.divider} />

      {/* ── Client column ── */}
      <Text style={s.sigColumnHeader}>Client</Text>

      <SigRow
        label="Client Name / Business Name"
        value={clientNameOrBusiness}
        showPlaceholder={isPreview}
      />

      {/* Business-only rows */}
      {clientType === 'BUSINESS' && (
        <>
          <SigRow
            label="Authorized Representative"
            value={clientAuthRepName}
            showPlaceholder={isPreview || !clientSigned}
          />
          <SigRow
            label="Title, if applicable"
            value={clientAuthRepTitle}
            showPlaceholder={isPreview || !clientSigned}
          />
        </>
      )}

      <SigImageRow
        label="Signature"
        pngBuffer={clientSigned ? clientSignaturePngBuffer : undefined}
        showPlaceholder={!clientSigned}
      />
      <SigRow label="Date" value={clientSignedAt} showPlaceholder={!clientSigned} />
    </View>
  )
}
