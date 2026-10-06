import {
  ArrowLeft,
  Play,
  Shuffle,
} from "lucide-react"

import Artwork from "../Artwork"
import SongRow from "../SongRow"

function MadeForYouCollectionPage({
  collection,
  username = "You",
  onBack,
  onOpenPlayer,
  handleSongMoreOptions,
  currentSong,
  playerLoading,
  playerError,
  isPlaying,
  sameTrack,
  favoriteProps,
}) {
  if (!collection) {
    return (
      <div className="pb-28 lg:pb-10">
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
          <p className="text-sm font-medium text-white/70">
            No collection selected.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-5 min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
          >
            Back to home
          </button>
        </div>
      </div>
    )
  }

  const songs = Array.isArray(collection.songs)
    ? collection.songs
    : []

  const playableSongs = songs.filter(
    (song) =>
      song?.playable !== false &&
      Boolean(song?.provider),
  )

  const handlePlay = () => {
    if (!playableSongs.length) return

    onOpenPlayer?.(
      playableSongs[0],
      playableSongs,
      true,
    )
  }

  const handleShuffle = () => {
    if (!playableSongs.length) return

    const shuffled = [...playableSongs]

    for (
      let index = shuffled.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1),
      )

      ;[
        shuffled[index],
        shuffled[randomIndex],
      ] = [
        shuffled[randomIndex],
        shuffled[index],
      ]
    }

    onOpenPlayer?.(
      shuffled[0],
      shuffled,
      true,
    )
  }

  return (
    <div className="space-y-8 pb-28 lg:pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#101114]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />

        <div className="relative p-5 sm:p-8">
          <button
            type="button"
            onClick={onBack}
            className="mb-7 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/40 transition hover:text-white/80"
          >
            <ArrowLeft size={15} />
            Back to Made For You
          </button>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="h-44 w-44 shrink-0 overflow-hidden rounded-[24px] bg-white/5 ring-1 ring-white/[0.08] sm:h-52 sm:w-52">
              <Artwork
                src={collection.image}
                className="h-full w-full object-cover"
                iconSize={48}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                Made For {username}
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                {collection.title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
                {collection.description}
              </p>

              <p className="mt-3 text-xs text-white/30">
                {songs.length}{" "}
                {songs.length === 1
                  ? "song"
                  : "songs"}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={!playableSongs.length}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play
                    size={17}
                    fill="currentColor"
                  />
                  Play
                </button>

                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={!playableSongs.length}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.09] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Shuffle size={17} />
                  Shuffle
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {songs.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Songs
            </h2>

            <span className="text-xs text-white/30">
              {songs.length} tracks
            </span>
          </div>

          <div className="space-y-1">
            {songs.map((song, index) => (
              <SongRow
                key={`${song?.provider || "unknown"}-${song?.id || index}`}
                index={index + 1}
                song={song}
                onOpenPlayer={() =>
                  onOpenPlayer?.(
                    song,
                    playableSongs,
                    true,
                  )
                }
                onMoreOptions={() =>
                  handleSongMoreOptions?.(song)
                }
                isActive={
                  sameTrack?.(
                    currentSong,
                    song,
                  ) || false
                }
                isLoading={
                  playerLoading &&
                  sameTrack?.(
                    currentSong,
                    song,
                  )
                }
                isPlaying={
                  isPlaying &&
                  sameTrack?.(
                    currentSong,
                    song,
                  )
                }
                error={
                  playerError &&
                  sameTrack?.(
                    currentSong,
                    song,
                  )
                    ? playerError
                    : null
                }
                {...(
                  favoriteProps
                    ? favoriteProps(song)
                    : {}
                )}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-14 text-center">
          <p className="text-sm font-medium text-white/70">
            Nothing here yet
          </p>

          <p className="mt-2 text-sm text-white/35">
            Keep listening and this collection
            will become more personalized.
          </p>
        </section>
      )}
    </div>
  )
}

export default MadeForYouCollectionPage