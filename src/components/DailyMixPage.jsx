import {
  ArrowLeft,
  Play,
  Shuffle,
} from "lucide-react"

import Artwork from "./Artwork"
import SongRow from "./SongRow"

function formatDuration(value) {
  const numericValue = Number(value)

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    return "--:--"
  }

  const totalSeconds =
    Math.floor(numericValue)

  return `${Math.floor(
    totalSeconds / 60,
  )}:${String(
    totalSeconds % 60,
  ).padStart(2, "0")}`
}

function DailyMixPage({
  mix,
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
  if (!mix) {
    return (
      <div className="pb-28 lg:pb-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mt-8 rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
          <p className="text-sm text-white/50">
            No Daily Mix selected.
          </p>
        </div>
      </div>
    )
  }

  const songs = Array.isArray(mix.songs)
    ? mix.songs
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

    const shuffled = [
      ...playableSongs,
    ]

    for (
      let index = shuffled.length - 1;
      index > 0;
      index -= 1
    ) {
      const randomIndex =
        Math.floor(
          Math.random() *
            (index + 1),
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
    <div className="space-y-7 pb-28 lg:pb-10">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Hero */}
      <section className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#101114]">
        <div className="flex flex-col gap-7 p-5 sm:p-7 md:flex-row md:items-end">
          {/* Artist artwork */}
          <div className="h-52 w-52 shrink-0 overflow-hidden rounded-[24px] bg-[#18191d] ring-1 ring-white/[0.08] sm:h-60 sm:w-60">
            <Artwork
              src={mix.image}
              alt={
                mix.representativeArtist ||
                "Daily Mix"
              }
              className="h-full w-full object-cover"
              iconSize={42}
            />
          </div>

          {/* Information */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
              Made For You
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              {mix.title}
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/50">
              Made for {username}
            </p>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/40">
              {mix.description ||
                "A personalized mix built from your listening habits."}
            </p>

            {mix.artists?.length ? (
              <p className="mt-2 max-w-2xl truncate text-xs text-white/30">
                {mix.artists
                  .slice(0, 6)
                  .map(
                    (artist) =>
                      artist
                        .charAt(0)
                        .toUpperCase() +
                      artist.slice(1),
                  )
                  .join(", ")}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-white/30">
              {songs.length}{" "}
              {songs.length === 1
                ? "song"
                : "songs"}
            </p>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePlay}
                disabled={
                  !playableSongs.length
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Play
                  size={16}
                  fill="currentColor"
                />
                Play
              </button>

              <button
                type="button"
                onClick={handleShuffle}
                disabled={
                  !playableSongs.length
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Shuffle size={16} />
                Shuffle
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Songs */}
      <section className="space-y-2">
        {songs.length ? (
          songs.map((song, index) => {
            const favorite =
              favoriteProps?.(
                song,
              ) || {}

            return (
              <SongRow
                key={`${song.provider || "song"}-${song.id || index}`}
                song={{
                  ...song,
                  duration:
                    formatDuration(
                      song.durationSeconds ??
                        song.duration,
                    ),
                }}
                number={index + 1}
                onOpenPlayer={(track) =>
                  onOpenPlayer?.(
                    track,
                    playableSongs,
                    true,
                  )
                }
                isActive={
                  sameTrack?.(
                    currentSong,
                    song,
                  ) || false
                }
                isLoading={
                  sameTrack?.(
                    currentSong,
                    song,
                  ) &&
                  playerLoading
                }
                isPlaying={
                  sameTrack?.(
                    currentSong,
                    song,
                  ) &&
                  isPlaying
                }
                error={
                  sameTrack?.(
                    currentSong,
                    song,
                  )
                    ? playerError
                    : ""
                }
                isFavorite={
                  favorite.isFavorite
                }
                onToggleFavorite={
                  favorite.onToggleFavorite
                }
                onMoreOptions={
                  handleSongMoreOptions
                }
              />
            )
          })
        ) : (
          <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8">
            <p className="text-sm text-white/50">
              This Daily Mix does not have any
              songs yet.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default DailyMixPage