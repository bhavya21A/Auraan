import { X } from 'lucide-react'

function LyricsSheet({ isOpen, onClose, song, lyrics }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-[80vh] w-full max-w-xl rounded-t-[30px] border border-white/10 bg-[#12141b] px-4 pb-6 pt-4 shadow-[0_-30px_80px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Lyrics</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{song.title}</h3>
            <p className="text-sm text-white/55">{song.artist}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/75">
            <X size={18} />
          </button>
        </div>

        <div className="h-[calc(80vh-110px)] overflow-y-auto rounded-[24px] border border-white/10 bg-white/[0.02] p-5 text-center text-white/80">
          <div className="space-y-4 leading-relaxed">
            {lyrics.split('\n').map((line, index) => (
              <p key={`${line}-${index}`} className={line.startsWith('[') ? 'text-xs uppercase tracking-[0.24em] text-pink-300/80' : ''}>
                {line || ' '}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LyricsSheet
