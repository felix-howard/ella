import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DigitalDoc } from '../../lib/api-client'
import { VerificationModal } from './verification-modal'

const imageViewerMock = vi.hoisted(() =>
  vi.fn((_: unknown) => <div data-testid="image-viewer" />)
)
const useIsMobileMock = vi.hoisted(() => vi.fn())
const useSignedUrlMock = vi.hoisted(() => vi.fn())

vi.mock('react-dom', () => ({
  createPortal: (children: React.ReactNode) => <>{children}</>,
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}))

vi.mock('@ella/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    className,
    disabled,
    onClick,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../ui/image-viewer', () => ({
  ImageViewer: imageViewerMock,
}))

vi.mock('../ui/field-verification-item', () => ({
  FieldVerificationItem: () => <div data-testid="field-verification-item" />,
}))

vi.mock('../../hooks/use-mobile-breakpoint', () => ({
  useIsMobile: useIsMobileMock,
}))

vi.mock('../../hooks/use-signed-url', () => ({
  useSignedUrl: useSignedUrlMock,
}))

vi.mock('../../stores/toast-store', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('../../lib/constants', () => ({
  DOC_TYPE_LABELS: {
    FORM_1040: 'Form 1040',
  },
}))

vi.mock('../../lib/field-labels', () => ({
  getFieldLabelForDocType: (_docType: string, fieldKey: string) => fieldKey,
  isExcludedField: () => false,
}))

vi.mock('../../lib/doc-type-fields', () => ({
  getDocTypeFields: () => ['taxpayerName'],
}))

vi.mock('../../lib/doc-type-field-groups', () => ({
  DOC_TYPE_FIELD_GROUPS: {},
}))

vi.mock('../../lib/api-client', () => ({
  api: {
    docs: {
      triggerOcr: vi.fn(),
      verifyAction: vi.fn(),
      verifyField: vi.fn(),
    },
    images: {
      updateRotation: vi.fn(),
    },
  },
  fetchMediaBlobUrl: vi.fn(),
}))

function pdfDoc(): DigitalDoc {
  return {
    id: 'doc_1',
    caseId: 'case_1',
    rawImageId: 'raw_1',
    docType: 'FORM_1040',
    status: 'PENDING',
    extractedData: {
      taxpayerName: 'Client One',
    },
    createdAt: '2026-06-17T00:00:00.000Z',
    updatedAt: '2026-06-17T00:00:00.000Z',
    rawImage: {
      id: 'raw_1',
      filename: '2025_FORM_1040.pdf',
      r2Key: 'cases/case_1/docs/2025_FORM_1040.pdf',
      displayName: '2025_FORM_1040.pdf',
      rotation: 0,
    },
  }
}

describe('VerificationModal PDF rendering', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
    imageViewerMock.mockClear()
    useIsMobileMock.mockReturnValue(true)
    useSignedUrlMock.mockReturnValue({
      data: {
        url: 'https://bucket.r2.cloudflarestorage.com/cases/case_1/docs/2025_FORM_1040.pdf',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
  })

  it('keeps mobile PDFs in paged mode instead of rendering every page canvas', () => {
    renderToStaticMarkup(
      <VerificationModal
        doc={pdfDoc()}
        isOpen
        onClose={vi.fn()}
        caseId="case_1"
      />,
    )

    const props = imageViewerMock.mock.calls[0][0] as {
      isPdf: boolean
      pdfCurrentPage: number
      renderAllPdfPages: boolean
    }

    expect(props.isPdf).toBe(true)
    expect(props.pdfCurrentPage).toBe(1)
    expect(props.renderAllPdfPages).toBe(false)
  })
})
