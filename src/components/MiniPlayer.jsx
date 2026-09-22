import { Play, Pause, SkipBack, SkipForward, ListMusic } from 'lucide-react'
import Artwork from './Artwork'

function MiniPlayer({
  song,
  isPlaying,
  isLoading = false,
  error = '',
  currentTime = 0,
  duration = 0,
  onTogglePlay,
  onOpenPlayer,
  onPreviousTrack,
  onNextTrack,
  onOpenQueue,
}) {
  if (!song) return null

  const progress =
    Number.isFinite(duration) && duration > 0
      ? Math.min(Math.max((currentTime / duration) * 100, 0), 100)
      : 0

  return (
    <div className="fixed inset-x-0 bottom-[76px] z-30 px-3 pb-2 lg:bottom-4 lg:px-6">
      <div className="mx-auto max-w-5xl rounded-[26px] border border-white/10 bg-[#151821]/90 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex w-full items-center gap-3 rounded-[22px] bg-white/[0.03] px-2 py-2 text-left">
          {/* Track information */}
          <button
            type="button"
            onClick={onOpenPlayer}
            className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70"
            aria-label={`Open now playing for ${song.title}`}
          >
            <div
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${
                song.cover || 'from-white/10 to-white/5'
              }`}
            >
              <Artwork
                src={song.artwork}
                className="absolute inset-0 h-full w-full object-cover"
                iconSize={16}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {song.title}
              </p>

              <p className="truncate text-xs text-white/55">
                {song.artist}
              </p>
            </div>
          </button>

          {/* Player controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Previous */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onPreviousTrack()
              }}
              disabled={isLoading}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
              aria-label="Previous track"
            >
              <SkipBack size={14} />
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onTogglePlay()
              }}
              disabled={isLoading}
              className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-glow transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
              aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : isPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play
                  size={16}
                  fill="currentColor"
                  className="ml-0.5"
                />
              )}
            </button>

            {/* Next */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onNextTrack()
              }}
              disabled={isLoading}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
              aria-label="Next track"
            >
              <SkipForward size={14} />
            </button>

            {/* Queue */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenQueue()
              }}
              className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-white/8 text-white transition active:scale-95"
              aria-label="Open queue"
            >
              <ListMusic size={14} />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div
          className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/10"
          aria-label="Playback progress"
        >
          <div
            className="h-full bg-pink-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error ? (
          <p className="px-2 pt-1 text-[11px] text-white/55">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default MiniPlayer