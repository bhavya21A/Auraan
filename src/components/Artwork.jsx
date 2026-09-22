import { Music2 } from 'lucide-react'
import { useState } from 'react'

function Artwork({ src, alt = '', className = '', iconSize = 18 }) {
  const [failedSource, setFailedSource] = useState(null)
  const hasError = Boolean(src && failedSource === src)

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-white/[0.06] text-white/45 ${className}`} aria-label={alt || 'Artwork unavailable'}>
        <Music2 size={iconSize} aria-hidden="true" />
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailedSource(src)} />
}

export default Artwork
