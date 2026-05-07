/**
 * Signature Pad Card
 * Allows staff to draw and save their PNG signature for NDA signing.
 * Uses react-signature-canvas; uploads via POST /staff/me/signature.
 */
import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, PenLine, Trash2, Save } from 'lucide-react'
import { Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useInvalidateNdaReadiness } from '../agreements/use-nda-readiness'

const QUERY_KEY = ['staff-signature']

export function SignaturePadCard() {
  const queryClient = useQueryClient()
  const invalidateReadiness = useInvalidateNdaReadiness()
  const sigRef = useRef<SignatureCanvas>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)

  // Load existing signature
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.staff.getSignature(),
  })

  const uploadMutation = useMutation({
    mutationFn: (signatureBase64: string) => api.staff.uploadSignature(signatureBase64),
    onSuccess: () => {
      toast.success('Signature saved successfully')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateReadiness()
      setIsDrawing(false)
      setHasStroke(false)
    },
    onError: () => {
      toast.error('Failed to save signature. Please try again.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.staff.deleteSignature(),
    onSuccess: () => {
      toast.success('Signature removed')
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      invalidateReadiness()
    },
    onError: () => {
      toast.error('Failed to remove signature')
    },
  })

  const handleStrokeEnd = () => {
    setHasStroke(Boolean(sigRef.current && !sigRef.current.isEmpty()))
  }

  const handleClear = () => {
    sigRef.current?.clear()
    setHasStroke(false)
  }

  const handleSave = () => {
    const canvas = sigRef.current
    if (!canvas || canvas.isEmpty()) {
      toast.error('Please draw your signature first')
      return
    }
    // react-signature-canvas@1.1.0-alpha.2: use toDataURL directly (getTrimmedCanvas removed)
    const dataUrl = canvas.toDataURL('image/png')
    uploadMutation.mutate(dataUrl)
  }

  const handleStartDrawing = () => {
    setIsDrawing(true)
    setHasStroke(false)
    // Clear after a tick so canvas is mounted and rendered
    setTimeout(() => sigRef.current?.clear(), 0)
  }

  return (
    <div data-settings-focus="signature" className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Signature</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your signature will be used on NDAs sent to clients.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isDrawing && data?.signedUrl ? (
          /* Show current saved signature */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current signature:</p>
            <div className="border border-border rounded-lg p-3 bg-white inline-block">
              <img
                src={data.signedUrl}
                alt="Your signature"
                className="max-h-20 max-w-xs object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleStartDrawing}>
                <PenLine className="w-4 h-4 mr-2" />
                Redraw
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Remove
              </Button>
            </div>
          </div>
        ) : !isDrawing ? (
          /* No signature yet */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No signature saved yet.</p>
            <Button variant="outline" size="sm" onClick={handleStartDrawing}>
              <PenLine className="w-4 h-4 mr-2" />
              Draw Signature
            </Button>
          </div>
        ) : (
          /* Drawing mode */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Draw your signature in the box below:
            </p>
            <div className="border-2 border-dashed border-border rounded-lg bg-white overflow-hidden">
              <SignatureCanvas
                ref={sigRef}
                penColor="#1a1a1a"
                canvasProps={{
                  width: 480,
                  height: 140,
                  className: 'w-full touch-none',
                  style: { maxWidth: '100%' },
                }}
                onEnd={handleStrokeEnd}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasStroke || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Signature
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear} disabled={uploadMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDrawing(false)}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
