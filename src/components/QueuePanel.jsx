import { ListMusic, Play } from 'lucide-react'
import Artwork from './Artwork'

function QueuePanel({
  queue = [],
  currentSong,
  onSelectTrack,
}) {
  if (!queue.length) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white/70">
            <ListMusic size={18} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Queue
            </h3>
            <p className="mt-0.5 text-xs text-white/40">
              Nothing waiting to play
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white/70">
            <ListMusic size={18} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Queue
            </h3>
            <p className="mt-0.5 text-xs text-white/40">
              {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
          Up next
        </span>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {queue.map((track, index) => {
          const isCurrent = currentSong?.id === track?.id &&
            (!currentSong?.provider || currentSong?.provider === track?.provider)

          return (
            <button
              key={`${track.provider || 'local'}-${track.id}-${index}`}
              type="button"
              onClick={() => onSelectTrack(track)}
              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                isCurrent
                  ? 'bg-white/[0.08]'
                  : 'hover:bg-white/[0.045]'
              }`}
            >
              <div className="flex w-7 shrink-0 items-center justify-center">
                {isCurrent ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white">
                    <Play size={11} fill="currentColor" />
                  </div>
                ) : (
                  <span className="text-xs text-white/30">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/[0.05]">
                <Artwork
                  src={track.artwork}
                  className="absolute inset-0 h-full w-full object-cover"
                  iconSize={15}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${
                    isCurrent ? 'text-white' : 'text-white/80'
                  }`}
                >
                  {track.title || 'Unknown title'}
                </p>

                <p className="mt-0.5 truncate text-xs text-white/40">
                  {track.artist || 'Unknown artist'}
                </p>
              </div>

              <span className="shrink-0 text-xs tabular-nums text-white/35">
                {track.duration || '--:--'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default QueuePanel