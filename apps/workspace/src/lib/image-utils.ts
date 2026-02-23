/**
 * Image compression utilities for avatar uploads
 * Uses native Canvas API for client-side compression
 */

const MAX_SIZE = 400 // Max dimension (400x400)
const TARGET_SIZE_KB = 200
const INITIAL_QUALITY = 0.85
const MIN_QUALITY = 0.5
const MAX_COMPRESSION_ATTEMPTS = 10

/**
 * Compress image to target size using Canvas API
 * @param file Original file from input
 * @returns Compressed blob and data URL for preview
 */
export async function compressImage(file: File): Promise<{
  blob: Blob
  dataUrl: string
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      // Revoke ObjectURL to prevent memory leak
      URL.revokeObjectURL(objectUrl)

      try {
        // Calculate new dimensions
        let { width, height } = img
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          } else {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }

        // Draw to canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // Compress with quality reduction loop (with iteration limit)
        let quality = INITIAL_QUALITY
        let attempts = 0

        const compress = () => {
          canvas.toBlob(
            (result) => {
              if (!result) {
                reject(new Error('Compression failed'))
                return
              }

              attempts++

              // Check size - stop if under target, at min quality, or max attempts
              if (
                result.size <= TARGET_SIZE_KB * 1024 ||
                quality <= MIN_QUALITY ||
                attempts >= MAX_COMPRESSION_ATTEMPTS
              ) {
                const dataUrl = canvas.toDataURL('image/jpeg', quality)
                resolve({ blob: result, dataUrl, width, height })
                return
              }

              // Reduce quality and retry
              quality -= 0.1
              compress()
            },
            'image/jpeg',
            quality
          )
        }

        compress()
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      // Revoke ObjectURL on error to prevent memory leak
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

/**
 * Validate file is an image
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  return validTypes.includes(file.type)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
