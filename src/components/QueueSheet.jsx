import { X, Music2 } from 'lucide-react'
import Artwork from './Artwork'

function QueueSheet({ isOpen, onClose, queue, currentSong, onSelectTrack }) {
  if (!isOpen) return null

  return (
    <div className="queue-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="queue-sheet max-h-[min(82vh,680px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] border border-white/10 bg-[#111319] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-30px_80px_rgba(0,0,0,0.6)] sm:rounded-[30px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex justify-center">
          <div className="flex h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Queue</p>
            <h3 className="text-xl font-semibold text-white">Now playing</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/5 text-white/75 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70" aria-label="Close queue">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${currentSong.cover || 'from-white/10 to-white/5'}`}>
              <Artwork src={currentSong.artwork} className="absolute inset-0 h-full w-full object-cover" iconSize={16} />
              <Music2 size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{currentSong.title}</p>
              <p className="truncate text-xs text-white/55">{currentSong.artist}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {queue.map((song, index) => (
            <button
              key={`${song.provider || 'local'}-${song.id}`}
              type="button"
              onClick={() => onSelectTrack?.(song)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70 ${song.provider === currentSong.provider && song.id === currentSong.id ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}
            >
              <div className="flex w-7 items-center justify-center text-xs text-white/45">{index + 1}</div>
              <div className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${song.cover || 'from-white/10 to-white/5'}`}>
                <Artwork src={song.artwork} className="absolute inset-0 h-full w-full object-cover" iconSize={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{song.title}</p>
                <p className="truncate text-xs text-white/50">{song.artist}</p>
              </div>
              <span className="text-xs text-white/45">{song.duration}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default QueueSheet
