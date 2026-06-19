/**
 * React-PDF component for the IRC 7216 taxpayer authorization block.
 *
 * CONSENT_7216 is not a dual-party agreement. It renders the fixed consent
 * body, then a taxpayer-specific authorization/signature block populated from
 * the fields collected at signing.
 */
import { Image, Text, View } from '@react-pdf/renderer'
import React from 'react'
import { pdfStyles as s } from './pdf-styles'
import type { NdaPdfMode } from './pdf-document'

export interface PdfConsentAuthorizationBlockProps {
  mode: NdaPdfMode
  taxpayerName?: string
  businessName?: string | null
  tinLastFour?: string
  signaturePngBuffer?: Buffer
  printedName?: string
  title?: string
  signedAt?: string
  audit?: {
    signedAtIso: string
    ipAddress: string
    userAgent: string
  }
}

interface ConsentRowProps {
  label: string
  value?: string | null
  showPlaceholder: boolean
}

function ConsentRow({ label, value, showPlaceholder }: ConsentRowProps) {
  return (
    <View style={s.consentRow}>
      <Text style={s.consentRowLabel}>{label}</Text>
      {showPlaceholder || !value ? (
        <View style={s.sigPlaceholderLine} />
      ) : (
        <Text style={s.consentRowValue}>{value}</Text>
      )}
    </View>
  )
}

export function PdfConsentAuthorizationBlock({
  mode,
  taxpayerName,
  businessName,
  tinLastFour,
  signaturePngBuffer,
  printedName,
  title,
  signedAt,
  audit,
}: PdfConsentAuthorizationBlockProps) {
  const signed = mode === 'signed'
  const showPlaceholder = !signed

  return (
    <View wrap={false} style={s.consentSection}>
      <Text style={s.consentSectionHeading}>Taxpayer Authorization and Signature</Text>

      <ConsentRow label="Taxpayer Name" value={taxpayerName} showPlaceholder={showPlaceholder} />
      <ConsentRow
        label="Business Name"
        value={businessName || 'Not applicable'}
        showPlaceholder={showPlaceholder}
      />
      <ConsentRow
        label="EIN/SSN Last Four"
        value={tinLastFour ? `***-**-${tinLastFour}` : undefined}
        showPlaceholder={showPlaceholder}
      />

      <View style={s.consentRow}>
        <Text style={s.consentRowLabel}>Signature</Text>
        {signed && signaturePngBuffer ? (
          <Image src={signaturePngBuffer} style={s.sigImage} />
        ) : (
          <View style={s.sigPlaceholderLine} />
        )}
      </View>

      <ConsentRow label="Printed Name" value={printedName} showPlaceholder={showPlaceholder} />
      <ConsentRow label="Title" value={title} showPlaceholder={showPlaceholder} />
      <ConsentRow label="Date" value={signedAt} showPlaceholder={showPlaceholder} />

      {signed && audit ? (
        <View style={s.consentAuditBlock}>
          <Text style={s.auditRow}>Signed at: {audit.signedAtIso}</Text>
          <Text style={s.auditRow}>IP address: {audit.ipAddress}</Text>
          <Text style={s.auditRow}>User agent: {audit.userAgent}</Text>
        </View>
      ) : null}
    </View>
  )
}
