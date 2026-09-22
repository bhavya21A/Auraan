import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Heart,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  ListPlus,
  Plus,
  UserRound,
  Disc3,
} from 'lucide-react'

import Artwork from './Artwork'

function SongRow({
  song,
  number,
  onOpenPlayer,
  isActive = false,
  isLoading = false,
  isPlaying = false,
  error = '',
  isFavorite = false,
  onToggleFavorite,
  onMoreOptions,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const isRealTrack = Boolean(song.provider)

  const isPlayable =
    !isRealTrack || song.playable !== false

  const stateLabel = !isPlayable
    ? 'Unavailable'
    : isLoading
      ? 'Loading'
      : error
        ? 'Playback error'
        : isPlaying
          ? 'Playing'
          : isActive
            ? 'Paused'
            : ''

  /*
   * Close the menu when clicking/tapping outside it.
   */
  useEffect(() => {
    if (!isMenuOpen) return

    const handlePointerDown = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      )
    }
  }, [isMenuOpen])

  const handleMenuAction = (action) => {
    setIsMenuOpen(false)

    if (onMoreOptions) {
      onMoreOptions(action, song)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isPlayable) {
          onOpenPlayer(song)
        }
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault()

          if (isPlayable) {
            onOpenPlayer(song)
          }
        }
      }}
      aria-busy={isLoading}
      aria-disabled={!isPlayable}
      aria-label={`Play ${song.title} by ${song.artist}${
        stateLabel
          ? `, ${stateLabel}`
          : ''
      }`}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        isActive
          ? 'border-[#7567F8]/20 bg-[#7567F8]/[0.07]'
          : 'border-white/[0.055] bg-white/[0.018] hover:border-white/[0.09] hover:bg-white/[0.035]'
      } ${
        !isPlayable
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer'
      } focus-within:outline-none`}
    >
      {/* Track number */}
      <div className="flex w-7 shrink-0 items-center justify-center text-xs tabular-nums text-white/30">
        {number}
      </div>

      {/* Artwork */}
      <div
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.07] bg-[#15171B] ${
          isActive
            ? 'ring-1 ring-[#7567F8]/25'
            : ''
        }`}
      >
        <Artwork
          src={song.artwork}
          className="absolute inset-0 h-full w-full object-cover"
          iconSize={16}
        />

        <div className="pointer-events-none absolute inset-0 bg-black/10" />

        {isActive && isLoading ? (
          <LoaderCircle
            size={16}
            className="relative animate-spin text-white"
            aria-hidden="true"
          />
        ) : isActive && isPlaying ? (
          <Pause
            size={14}
            fill="currentColor"
            className="relative text-white"
            aria-hidden="true"
          />
        ) : isPlayable ? (
          <Play
            size={14}
            fill="currentColor"
            className="relative ml-0.5 text-white"
            aria-hidden="true"
          />
        ) : (
          <AlertCircle
            size={16}
            className="relative text-white/55"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Track information */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-[-0.01em] text-white">
          {song.title || 'Unknown title'}
        </p>

        <p className="truncate text-xs text-white/45">
          {song.artist}
        </p>
      </div>

      {/* Album */}
      <div className="hidden max-w-[24%] truncate text-xs text-white/35 sm:block">
        {song.album || 'Unknown album'}
      </div>

      {/* Duration / Error */}
      <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-white/35">
        {error ? (
          <AlertCircle
            size={15}
            className="text-[#9B94FF]"
            aria-label="Unable to play this track"
          />
        ) : null}

        <span>{song.duration}</span>
      </div>

      {/* Favorite */}
      {onToggleFavorite &&
      song.provider ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleFavorite(song)
          }}
          className={`flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full border transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50 ${
            isFavorite
              ? 'border-[#7567F8]/25 bg-[#7567F8]/10 text-[#A9A4FF]'
              : 'border-white/[0.07] bg-white/[0.025] text-white/40 hover:bg-white/[0.06] hover:text-white/75'
          }`}
          aria-label={
            isFavorite
              ? `Remove ${song.title} from favorites`
              : `Add ${song.title} to favorites`
          }
          aria-pressed={isFavorite}
        >
          <Heart
            size={15}
            fill={
              isFavorite
                ? 'currentColor'
                : 'none'
            }
            aria-hidden="true"
          />
        </button>
      ) : null}

      {/* More options */}
      <div
        ref={menuRef}
        className="relative shrink-0"
      >
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsMenuOpen((value) => !value)
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50 ${
            isMenuOpen
              ? 'border-white/15 bg-white/10 text-white'
              : 'border-white/[0.07] bg-white/[0.025] text-white/35 hover:bg-white/[0.06] hover:text-white/75'
          }`}
          aria-label={`More options for ${song.title}`}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={15} />
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#15171B]/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                handleMenuAction('playlist')
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ListPlus
                size={16}
                className="text-white/45"
              />
              Add to playlist
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() =>
                handleMenuAction(
                  'create-playlist',
                )
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white"
            >
              <Plus
                size={16}
                className="text-white/45"
              />
              Create playlist
            </button>

            <div className="my-1 border-t border-white/[0.06]" />

            <button
              type="button"
              role="menuitem"
              onClick={() =>
                handleMenuAction('artist')
              }
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white"
            >
              <UserRound
                size={16}
                className="text-white/45"
              />
              View artist
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() =>
                handleMenuAction('album')
              }
              disabled={!song.album}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Disc3
                size={16}
                className="text-white/45"
              />
              View album
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SongRow