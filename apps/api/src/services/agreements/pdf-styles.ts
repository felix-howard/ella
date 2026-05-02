/**
 * Shared StyleSheet for NDA PDF rendering. Kept in a plain .ts module so
 * it can be imported by both pdf-document.tsx and any future layout variants.
 */
import { StyleSheet } from '@react-pdf/renderer'

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
    color: '#111827',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 14,
  },
  heading: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
    textAlign: 'justify',
  },
  signatureBlock: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  signatureImage: {
    maxWidth: 240,
    maxHeight: 80,
    marginBottom: 8,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  signatureValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  auditRow: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
  },
})
