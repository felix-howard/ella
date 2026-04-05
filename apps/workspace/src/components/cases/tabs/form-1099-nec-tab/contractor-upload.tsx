/**
 * Excel upload dropzone for importing contractor data
 * Accepts .xlsx/.xls files, sends to server for parsing
 */
import { useState, useRef } from 'react'
import { FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type ParseResult } from '../../../../lib/api-client'

interface ContractorUploadProps {
  businessId: string
  onParsed: (data: ParseResult) => void
}

export function ContractorUpload({ businessId, onParsed }: ContractorUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) { setError('Only .xlsx/.xls files supported'); return }
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5MB'); return }
    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await api.contractors.uploadExcel(businessId, formData)
      if (result.data.errors.length > 0) {
        setError(result.data.errors.join('. '))
        return
      }
      if (result.data.contractors.length === 0) {
        setError('No contractors found in file. Check the Excel format.')
        return
      }
      onParsed(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin" />
            <p className="mt-3 text-sm font-medium text-foreground">Parsing Excel file...</p>
            <p className="text-xs text-muted-foreground mt-1">Extracting contractor data</p>
          </>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              Drop Excel file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports .xlsx and .xls files (max 5MB)
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
