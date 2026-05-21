import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import './ui-components.css'

export type ImageInProps = {
  src?: string | null
  alt?: string
  /** e.g. "16/9", "4/3", "1/1" */
  aspectRatio?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
}

export function ImageIn({
  src,
  alt = '',
  aspectRatio,
  objectFit = 'cover',
}: ImageInProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const imageStyle = useMemo((): CSSProperties => {
    const style: CSSProperties = {}
    if (aspectRatio) {
      style.aspectRatio = aspectRatio
    }
    if (objectFit) {
      style.objectFit = objectFit
    }
    return style
  }, [aspectRatio, objectFit])

  useEffect(() => {
    if (src) {
      setLoading(true)
      setError(false)
    }
  }, [src])

  function onLoad() {
    setLoading(false)
    setError(false)
  }

  function onError() {
    setLoading(false)
    setError(true)
  }

  if (!src) return null

  return (
    <div className="image-in-wrap relative min-h-[120px] max-h-[200px]">
      <img
        src={src}
        alt={alt}
        className={cn(
          'image-in max-h-[200px] w-full rounded-lg border border-gray-200 object-cover',
          loading || error ? 'invisible' : undefined,
        )}
        style={imageStyle}
        onLoad={onLoad}
        onError={onError}
      />
      {loading ? (
        <div
          className="image-in-skeleton absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100"
          aria-busy="true"
          aria-label="Loading image"
        >
          <span
            className="icon-spinner11 inline-block text-2xl animate-spin text-gray-400"
            aria-hidden="true"
          />
        </div>
      ) : null}
      {error ? (
        <div
          className="image-in-fallback absolute inset-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
          role="img"
          aria-label={alt || 'Image unavailable'}
        >
          Image unavailable
        </div>
      ) : null}
    </div>
  )
}
