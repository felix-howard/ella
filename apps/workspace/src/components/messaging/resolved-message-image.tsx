import { useEffect, useRef, useState } from 'react'
import { cn } from '@ella/ui'
import { ImageOff } from 'lucide-react'
import { fetchMediaBlobUrl } from '../../lib/api-client'

interface ResolvedMessageImageProps {
  url: string
  alt: string
  className?: string
  imageClassName?: string
  fit: 'contain' | 'cover'
}

export function ResolvedMessageImage({
  url,
  alt,
  className,
  imageClassName,
  fit,
}: ResolvedMessageImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const objectUrlRef = useRef<string | null>(null)
  const isRelativePath = url.startsWith('/')
  const displayUrl = isRelativePath ? resolvedUrl : url

  useEffect(() => {
    if (!isRelativePath) return

    let cancelled = false
    fetchMediaBlobUrl(url)
      .then((objectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        objectUrlRef.current = objectUrl
        setResolvedUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [isRelativePath, url])

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-white/5', className)}>
        <ImageOff className="h-8 w-8 text-white/50" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}
      {displayUrl && (
        <img
          src={displayUrl}
          alt={alt}
          loading={fit === 'cover' ? 'lazy' : 'eager'}
          className={cn(imageClassName, loading && 'opacity-0')}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
        />
      )}
    </div>
  )
}
