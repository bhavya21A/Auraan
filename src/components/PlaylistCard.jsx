import { Play, MoreHorizontal } from 'lucide-react'

function PlaylistCard({ playlist, onSelectPlaylist }) {
  return (
    <button
      type="button"
      onClick={() => onSelectPlaylist(playlist)}
      className="group min-w-[230px] rounded-[30px] border border-white/10 bg-white/[0.03] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05] sm:min-w-[260px]"
      aria-label={`Open playlist ${playlist.title}`}
    >
      <div className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${playlist.accent} p-5`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.32),transparent_18%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative flex min-h-[160px] flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">Playlist</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{playlist.title}</h3>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/30"
              aria-label={`More options for ${playlist.title}`}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">{playlist.totalSongs} tracks</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelectPlaylist(playlist)
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105"
              aria-label={`Play ${playlist.title}`}
            >
              <Play size={16} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-white">{playlist.creator}</p>
        <p className="mt-1 text-sm text-white/55">{playlist.description}</p>
      </div>
    </button>
  )
}

export default PlaylistCard
