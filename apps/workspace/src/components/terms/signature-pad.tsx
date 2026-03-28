import { useRef, useEffect, useState, useCallback } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useTranslation } from 'react-i18next'
import { useDebouncedCallback } from 'use-debounce'
import { Button } from '@ella/ui'
import { Eraser } from 'lucide-react'

const MAX_CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 150

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void
  disabled?: boolean
}

export function SignaturePad({ onSignatureChange, disabled }: SignaturePadProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<SignatureCanvas>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: CANVAS_HEIGHT })

  const updateSize = useDebouncedCallback(() => {
    if (containerRef.current) {
      const width = Math.min(containerRef.current.offsetWidth - 2, MAX_CANVAS_WIDTH)
      setCanvasSize((prev) => {
        if (prev.width === width) return prev
        // Resize clears the canvas - notify parent
        onSignatureChange(null)
        return { width, height: CANVAS_HEIGHT }
      })
    }
  }, 200)

  useEffect(() => {
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [updateSize])

  const handleClear = useCallback(() => {
    canvasRef.current?.clear()
    onSignatureChange(null)
  }, [onSignatureChange])

  const handleEnd = useCallback(() => {
    if (canvasRef.current && !canvasRef.current.isEmpty()) {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      onSignatureChange(dataUrl)
    } else {
      onSignatureChange(null)
    }
  }, [onSignatureChange])

  return (
    <div ref={containerRef} className="w-full">
      <div className="relative border border-border rounded-lg bg-white">
        <SignatureCanvas
          ref={canvasRef}
          penColor="black"
          canvasProps={{
            width: canvasSize.width,
            height: canvasSize.height,
            className: 'rounded-lg',
            style: { touchAction: 'none' },
          }}
          onEnd={handleEnd}
        />
        {disabled && (
          <div className="absolute inset-0 bg-muted/50 rounded-lg cursor-not-allowed pointer-events-auto" />
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">
          {t('terms.signatureHint', 'Draw your signature above')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={disabled}
        >
          <Eraser className="w-4 h-4 mr-1" />
          {t('terms.clearSignature', 'Clear')}
        </Button>
      </div>
    </div>
  )
}
