import { useEffect, useState, type ComponentType } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import type { PdfThumbnailProps } from '../documents/pdf-thumbnail'

type PdfThumbnailComponent = ComponentType<PdfThumbnailProps>

let pdfThumbnailPromise: Promise<{ default: PdfThumbnailComponent }> | null = null

function loadPdfThumbnail() {
  pdfThumbnailPromise ??= import('../documents/pdf-thumbnail') as Promise<{ default: PdfThumbnailComponent }>
  return pdfThumbnailPromise
}

export function SharedDocPdfThumbnail({ url }: { url: string }) {
  const [PdfThumbnail, setPdfThumbnail] = useState<PdfThumbnailComponent | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    // Load outside React.lazy so Drafts tab content never suspends during tab transitions.
    loadPdfThumbnail().then((module) => {
      if (isMounted) {
        setPdfThumbnail(() => module.default)
      }
    }).catch(() => {
      if (isMounted) {
        setLoadFailed(true)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  if (loadFailed) {
    return <FileText className="w-8 h-8 text-muted-foreground" />
  }

  if (!PdfThumbnail) {
    return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
  }

  return <PdfThumbnail url={url} width={80} />
}
