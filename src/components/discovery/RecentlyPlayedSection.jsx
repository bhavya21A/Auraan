import { useState } from 'react'
import { Search } from 'lucide-react'
import SongRow from '../SongRow'

const RecentlyPlayedSection = ({
  recentlyPlayed,
  clearRecentlyPlayed,
  handleOpenSearch,
  handleOpenPlayer,
  handleSongMoreOptions,
  currentSong,
  playerLoading,
  playerError,
  isPlaying,
  sameTrack,
  favoriteProps,
}) => {
  const [visibleCount, setVisibleCount] = useState(10)

  const hasRecentlyPlayed = recentlyPlayed?.length > 0

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
          Recently played
        </h3>

        {hasRecentlyPlayed ? (
          <button
            type="button"
            onClick={() => {
              clearRecentlyPlayed()
              setVisibleCount(10)
            }}
            className="min-h-11 touch-manipulation px-2 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Clear
          </button>
        ) : null}
      </div>

      {hasRecentlyPlayed ? (
        <div className="space-y-2">
          {recentlyPlayed
            .slice(0, visibleCount)
            .map((song, index) => (
              <SongRow
                key={`${song.provider}-${song.id}`}
                song={song}
                number={index + 1}
                onOpenPlayer={(track) =>
                  handleOpenPlayer(track, [track])
                }
                onMoreOptions={handleSongMoreOptions}
                isActive={sameTrack(song, currentSong)}
                isLoading={
                  playerLoading &&
                  sameTrack(song, currentSong)
                }
                isPlaying={isPlaying}
                error={
                  playerError &&
                  sameTrack(song, currentSong)
                    ? playerError
                    : ''
                }
                {...favoriteProps(song)}
              />
            ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm font-medium text-white/75">
            Nothing played yet.
          </p>

          <p className="mt-2 text-xs leading-5 text-white/40">
            Search for a song and start listening.
            Your played tracks will appear here.
          </p>

          <button
            type="button"
            onClick={handleOpenSearch}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] active:scale-95"
          >
            <Search size={15} />
            Find music
          </button>
        </div>
      )}
    </section>
  )
}

export default RecentlyPlayedSection