/**
 * Shared StyleSheet for NDA PDF rendering. Kept in a plain .ts module so
 * it can be imported by both pdf-document.tsx and any future layout variants.
 *
 * Additive pattern: v1 keys are preserved unchanged. v2 keys are appended.
 */
import { StyleSheet } from '@react-pdf/renderer'

export const pdfStyles = StyleSheet.create({
  // ── Page ──────────────────────────────────────────────────────────────────
  page: {
    // ~1 inch margins (72pt = 1in; 56pt ≈ 0.78in for tighter feel matching target)
    padding: 56,
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
    color: '#111827',
  },

  // ── Title / Subtitle ──────────────────────────────────────────────────────
  /** v1 used 18pt; v2 bumps to 24pt per spec. Shared key — v1 benefits too. */
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleBodySpacer: {
    height: 18,
  },
  /** v1 subtitle: org name + date. v2 subtitle: tagline below title. */
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── Body sections ─────────────────────────────────────────────────────────
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

  // ── v1 Signature block (legacy — keep untouched) ──────────────────────────
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

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
  },

  // ── v2: Divider ───────────────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    marginVertical: 16,
  },

  // ── v2: Parties / Header block ────────────────────────────────────────────
  partiesBlock: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  partiesText: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 4,
  },
  partiesBold: {
    fontFamily: 'Helvetica-Bold',
  },

  // ── v2: Section 21 Signature block ───────────────────────────────────────
  /** Outer wrapper — wrap={false} keeps it atomic across page breaks. */
  sigSection: {
    marginTop: 24,
  },
  /** "21. Signatures" heading */
  sigSectionHeading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  /** "Firm" / "Client" column subheading */
  sigColumnHeader: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    marginTop: 4,
  },
  /** One label+value row */
  sigRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  sigRowLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 190,
    color: '#374151',
  },
  sigRowValue: {
    fontSize: 11,
    flex: 1,
  },
  /** Signature image (PNG drawing) */
  sigImage: {
    maxWidth: 200,
    maxHeight: 50,
    marginBottom: 2,
  },
  /** Placeholder underline in preview / unsigned state */
  sigPlaceholderLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    height: 14,
    flex: 1,
  },
  /** v2 subtitle tagline rendered below title */
  v2Subtitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 20,
    textAlign: 'center',
  },

  // ── Consent 7216 taxpayer authorization block ───────────────────────────
  consentSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  consentSectionHeading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 14,
  },
  consentRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  consentRowLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 160,
    color: '#374151',
  },
  consentRowValue: {
    fontSize: 11,
    flex: 1,
  },
  consentAuditBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
})
