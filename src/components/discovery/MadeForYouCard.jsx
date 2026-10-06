import { useEffect, useState } from "react"

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=700&q=80"

function MadeForYouCard({
  title,
  description,
  image,
  onClick,
  isActive,
}) {
  const [imageSrc, setImageSrc] = useState(
    image || FALLBACK_IMAGE,
  )

  /*
   * Important:
   * Daily Mix artwork is loaded asynchronously from
   * JioSaavn / Verome. When the real artwork arrives,
   * update the displayed image.
   */
  useEffect(() => {
    setImageSrc(
      image || FALLBACK_IMAGE,
    )
  }, [image])

  const handleImageError = () => {
    if (imageSrc !== FALLBACK_IMAGE) {
      setImageSrc(FALLBACK_IMAGE)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-[214px] flex-none text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        isActive ? "scale-[0.98]" : ""
      }`}
    >
      <div
        className={`aspect-square overflow-hidden rounded-[24px] bg-white/5 ${
          isActive
            ? "ring-2 ring-white/30"
            : "ring-1 ring-white/[0.04]"
        }`}
      >
        <img
          src={imageSrc}
          alt=""
          onError={handleImageError}
          className="h-full w-full object-cover transition duration-300 hover:scale-105"
        />
      </div>

      <h3 className="mt-4 truncate text-base font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 truncate text-sm text-white/40">
        {description}
      </p>
    </button>
  )
}

export default MadeForYouCard