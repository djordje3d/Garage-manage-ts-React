const DEFAULT_MAX_DIM = 1200
const DEFAULT_JPEG_QUALITY = 0.85

export function resizeImageToJpeg(
  file: File,
  options?: { maxDim?: number; quality?: number },
): Promise<Blob> {
  const maxDim = options?.maxDim ?? DEFAULT_MAX_DIM
  const quality = options?.quality ?? DEFAULT_JPEG_QUALITY

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const r = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * r)
        height = Math.round(height * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

export const TICKET_IMAGE_MAX_DIM = DEFAULT_MAX_DIM
export const TICKET_IMAGE_JPEG_QUALITY = DEFAULT_JPEG_QUALITY
