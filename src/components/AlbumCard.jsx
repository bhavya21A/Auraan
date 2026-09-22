import { Play, Plus } from 'lucide-react'

function AlbumCard({ album, onSelectAlbum, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelectAlbum(album)}
      className={`group min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05] ${compact ? 'p-2' : 'p-3'}`}
      aria-label={`Open album ${album.title}`}
    >
      <div className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${album.accent}`}>
        <div className="aspect-square w-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_20%),linear-gradient(135deg,rgba(255,255,255,0.15),rgba(0,0,0,0.1))]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelectAlbum(album)
          }}
          className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105"
          aria-label={`Play ${album.title}`}
        >
          <Play size={16} fill="currentColor" className="ml-0.5" />
        </button>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{album.title}</p>
          <p className="mt-1 truncate text-sm text-white/55">{album.artist}</p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:border-white/20 hover:bg-white/10"
          aria-label={`Add ${album.title} to library`}
        >
          <Plus size={16} />
        </button>
      </div>
    </button>
  )
}

export default AlbumCard
