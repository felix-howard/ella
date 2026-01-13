/**
 * Success Screen Component
 * Shows success state after successful upload
 * Provides options to upload more or return home
 */
import { memo } from 'react'
import { CheckCircle2, Upload, Home } from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'

interface SuccessScreenProps {
  uploadedCount: number
  language: Language
  onUploadMore: () => void
  onDone: () => void
}

export const SuccessScreen = memo(function SuccessScreen({
  uploadedCount,
  language,
  onUploadMore,
  onDone,
}: SuccessScreenProps) {
  const t = getText(language)

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      {/* Success icon with animation */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-in zoom-in-50 duration-300">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>

        <h2 className="text-2xl font-semibold text-foreground mb-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-100">
          {t.thankYou}
        </h2>

        <p className="text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-150">
          {uploadedCount} {t.filesUploaded}
        </p>
      </div>

      {/* Success message */}
      <div className="w-full max-w-sm p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-8 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-200">
        <p className="text-sm text-center text-foreground">
          {language === 'VI'
            ? 'Tài liệu của bạn đang được xử lý. Chúng tôi sẽ liên hệ nếu cần thêm thông tin.'
            : 'Your documents are being processed. We will contact you if more information is needed.'}
        </p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-sm space-y-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-300">
        <Button
          variant="outline"
          className="w-full h-14 rounded-2xl text-base gap-2"
          onClick={onUploadMore}
        >
          <Upload className="w-5 h-5" />
          {t.uploadMore}
        </Button>

        <Button
          className="w-full h-14 rounded-2xl text-base gap-2"
          onClick={onDone}
        >
          <Home className="w-5 h-5" />
          {t.done}
        </Button>
      </div>
    </div>
  )
})

export default SuccessScreen
