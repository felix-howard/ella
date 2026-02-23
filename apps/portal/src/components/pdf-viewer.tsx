/**
 * PDF Viewer Component
 * Uses iframe for simplicity and native PDF controls
 * Falls back to download link if iframe not supported
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDown, ExternalLink, AlertTriangle } from 'lucide-react'
import { buttonVariants, cn } from '@ella/ui'

interface PdfViewerProps {
  url: string
  filename: string
}

export function PdfViewer({ url, filename }: PdfViewerProps) {
  const { t } = useTranslation()
  const [loadError, setLoadError] = useState(false)

  // Check if browser supports PDF viewing in iframe
  // Most modern browsers do, but some mobile browsers don't
  const handleError = () => {
    setLoadError(true)
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-warning mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('draft.viewerUnsupported')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          {t('draft.viewerFallback')}
        </p>
        <div className="flex gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <ExternalLink className="w-4 h-4" />
            {t('draft.openInNewTab')}
          </a>
          <a
            href={url}
            download={filename}
            className={cn(buttonVariants({ variant: 'default' }), 'gap-2')}
          >
            <FileDown className="w-4 h-4" />
            {t('draft.download')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={url}
      className="w-full h-full border-0"
      title={filename}
      sandbox="allow-same-origin allow-scripts"
      onError={handleError}
    />
  )
}
