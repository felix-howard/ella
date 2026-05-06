/**
 * React-PDF component: Parties / Header block for NDA v2.
 *
 * Rendered before body sections — NOT parsed from HTML. Displays the
 * "entered into as of {Date} by and between" paragraph with firm + client
 * details. Falls back to bracketed placeholders in preview mode.
 */
import { Text, View } from '@react-pdf/renderer'
import React from 'react'
import { pdfStyles as s } from './pdf-styles'

export interface PdfHeaderBlockProps {
  /** Formatted date string (e.g. "May 6, 2026"). Use "[Date]" for preview. */
  date: string
  firmName: string
  /** Full address string: "123 Main St, Houston, TX 77001" */
  firmAddress: string
  /** Business name or "FirstName LastName" depending on clientType. */
  clientNameOrBusiness: string
  /** Full address string for the client. "[Address]" in preview. */
  clientAddress: string
}

export function PdfHeaderBlock({
  date,
  firmName,
  firmAddress,
  clientNameOrBusiness,
  clientAddress,
}: PdfHeaderBlockProps) {
  return (
    <View style={s.partiesBlock}>
      <Text style={s.partiesText}>
        {'This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into as of '}
        <Text style={s.partiesBold}>{date}</Text>
        {' by and between:'}
      </Text>

      <Text style={s.partiesText}>
        <Text style={s.partiesBold}>{firmName}</Text>
        {', located at '}
        <Text style={s.partiesBold}>{firmAddress}</Text>
        {' ("Firm"),'}
      </Text>

      <Text style={s.partiesText}>{'and'}</Text>

      <Text style={s.partiesText}>
        <Text style={s.partiesBold}>{clientNameOrBusiness}</Text>
        {', located at '}
        <Text style={s.partiesBold}>{clientAddress}</Text>
        {' ("Client").'}
      </Text>

      <Text style={s.partiesText}>
        {'The Firm and Client may be referred to individually as a "Party" and collectively as the "Parties."'}
      </Text>
    </View>
  )
}
