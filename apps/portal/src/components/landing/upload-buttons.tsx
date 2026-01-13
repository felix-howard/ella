/**
 * Upload Buttons Component
 * Camera capture and gallery selection buttons
 * Mobile-first with large touch targets (44px min)
 */
import { Camera, ImageIcon, FileText } from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'

interface UploadButtonsProps {
  language: Language
  onUploadClick: () => void
  onStatusClick: () => void
}

export function UploadButtons({ language, onUploadClick, onStatusClick }: UploadButtonsProps) {
  const t = getText(language)

  return (
    <div className="px-6 py-4 flex-1 flex flex-col justify-center gap-4">
      {/* Primary Upload Action */}
      <Button
        size="lg"
        className="w-full h-14 text-base gap-3 rounded-2xl shadow-md"
        onClick={onUploadClick}
      >
        <Camera className="w-5 h-5" />
        {t.uploadDocs}
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <div className="flex-1 h-px bg-border" />
        {t.or}
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Secondary Action - View Status */}
      <Button
        variant="outline"
        size="lg"
        className="w-full h-14 text-base gap-3 rounded-2xl"
        onClick={onStatusClick}
      >
        <FileText className="w-5 h-5" />
        {t.viewStatus}
      </Button>

      {/* Supported formats info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          {t.supportedFormats}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t.maxFileSize}
        </p>
      </div>
    </div>
  )
}

// Additional camera-specific button for direct capture
export function CameraButton({ language, onCapture }: { language: Language; onCapture: () => void }) {
  const t = getText(language)

  return (
    <Button
      variant="outline"
      className="w-full h-12 gap-2 rounded-xl"
      onClick={onCapture}
    >
      <Camera className="w-5 h-5" />
      {t.takePhoto}
    </Button>
  )
}

// Gallery selection button
export function GalleryButton({ language, onSelect }: { language: Language; onSelect: () => void }) {
  const t = getText(language)

  return (
    <Button
      variant="outline"
      className="w-full h-12 gap-2 rounded-xl"
      onClick={onSelect}
    >
      <ImageIcon className="w-5 h-5" />
      {t.chooseFromGallery}
    </Button>
  )
}
