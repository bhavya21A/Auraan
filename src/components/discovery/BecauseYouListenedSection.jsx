import SongRow from '../SongRow'

const BecauseYouListenedSection = ({
  recentlyPlayed,
  handleOpenPlayer,
  handleSongMoreOptions,
  currentSong,
  playerLoading,
  playerError,
  isPlaying,
  sameTrack,
  favoriteProps,
}) => {
  const recentTracks = recentlyPlayed ?? []

  const recentArtists = recentTracks
    .map((song) => song?.artists?.[0]?.name || song?.artist)
    .filter(Boolean)

  const uniqueArtists = [...new Set(recentArtists)]

  const recommendationTracks = recentTracks
    .filter((song) => {
      const artist =
        song?.artists?.[0]?.name || song?.artist

      return artist && uniqueArtists.includes(artist)
    })
    .slice(0, 6)

  if (!recommendationTracks.length) {
    return null
  }

  const artistName =
    recommendationTracks[0]?.artists?.[0]?.name ||
    recommendationTracks[0]?.artist ||
    'your recent listening'

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
          Because you listened to
        </h3>

        <p className="mt-1 text-xs text-white/40">
          Based on {artistName}
        </p>
      </div>

      <div className="space-y-2">
        {recommendationTracks.map((song, index) => (
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
    </section>
  )
}

export default BecauseYouListenedSection