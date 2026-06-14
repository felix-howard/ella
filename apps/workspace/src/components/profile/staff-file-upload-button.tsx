import { useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@ella/ui'
import type { StaffFileKind } from '../../lib/api-client'
import { useStaffFileUpload } from './use-staff-file-upload'

interface StaffFileUploadButtonProps {
  staffId: string
  kind: StaffFileKind
  invoiceYear?: number
  invoiceMonth?: number
  disabled?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  children: ReactNode
}

export function StaffFileUploadButton({
  staffId,
  kind,
  invoiceYear,
  invoiceMonth,
  disabled,
  variant,
  size,
  className,
  children,
}: StaffFileUploadButtonProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useStaffFileUpload({ staffId, kind, notifyOnError: true })

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    await upload.upload({ file, invoiceYear, invoiceMonth })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled || upload.isUploading}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || upload.isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
        {upload.isUploading ? t('profile.staffFiles.uploading', { progress: upload.progress }) : children}
      </Button>
    </>
  )
}
