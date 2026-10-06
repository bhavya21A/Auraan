import SongRow from '../SongRow'

const FavoriteSongsSection = ({
  favorites,
  handleOpenPlayer,
  handleSongMoreOptions,
  currentSong,
  playerLoading,
  playerError,
  isPlaying,
  sameTrack,
  favoriteProps,
}) => {
  const hasFavorites = favorites?.length > 0

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
          From your favorites
        </h3>
      </div>

      {hasFavorites ? (
        <div className="space-y-2">
          {favorites
            .slice(0, 10)
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
            No favorites yet.
          </p>

          <p className="mt-2 text-xs leading-5 text-white/40">
            Favorite songs you love and they will appear
            here.
          </p>
        </div>
      )}
    </section>
  )
}

export default FavoriteSongsSection