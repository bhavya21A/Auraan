import SongRow from "../SongRow"
import { buildDailyMix } from "../../services/discoveryRecommendations"

function MadeForYouCollection({
  collection,
  favorites = [],
  recentlyPlayed = [],
  handleOpenPlayer,
  handleSongMoreOptions,
  currentSong,
  playerLoading,
  playerError,
  isPlaying,
  sameTrack,
  favoriteProps,
}) {
  if (!collection) {
    return null
  }

  const isDailyMix =
    collection.id === "daily-mix" ||
    collection.type === "daily-mix" ||
    collection.title?.toLowerCase() === "daily mix"

  const songs = isDailyMix
    ? buildDailyMix({
        favorites,
        recentlyPlayed,
        limit: 10,
      })
    : collection.songs || []

  return (
    <section className="mt-6 rounded-[24px] border border-white/[0.07] bg-[#101114] p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
            Made for you
          </p>

          <h3 className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-white">
            {collection.title}
          </h3>

          <p className="mt-1 text-sm text-white/40">
            {collection.description}
          </p>
        </div>

        <span className="shrink-0 text-xs text-white/30">
          {songs.length}{" "}
          {songs.length === 1 ? "song" : "songs"}
        </span>
      </div>

      {songs.length ? (
        <div className="space-y-1">
          {songs.map((song, index) => (
            <SongRow
              key={`${song.provider || "unknown"}-${song.id}-${index}`}
              song={song}
              number={index + 1}
              onOpenPlayer={(track) =>
                handleOpenPlayer(track, songs)
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
                  : ""
              }
              {...favoriteProps(song)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm font-medium text-white/70">
            Nothing here yet.
          </p>

          <p className="mt-2 text-xs leading-5 text-white/35">
            Keep listening and saving music to personalize this
            collection.
          </p>
        </div>
      )}
    </section>
  )
}

export default MadeForYouCollection