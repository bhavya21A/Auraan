import {
  X,
  Music2,
  GripVertical,
} from 'lucide-react'
import { useState } from 'react'

import Artwork from './Artwork'

function QueueSheet({
  isOpen,
  onClose,
  queue,
  currentSong,
  onSelectTrack,
  onReorderQueue,
  onRemoveFromQueue,
}) {
  const [draggedIndex, setDraggedIndex] =
    useState(null)

  if (!isOpen) return null

  const currentIndex = currentSong
    ? queue.findIndex(
        (track) =>
          track?.provider ===
            currentSong?.provider &&
          String(track?.id) ===
            String(currentSong?.id),
      )
    : -1

  const upcomingTracks =
    currentIndex >= 0
      ? queue.slice(currentIndex + 1)
      : queue

  const handleDragStart = (
    event,
    visibleIndex,
  ) => {
    setDraggedIndex(visibleIndex)

    event.dataTransfer.effectAllowed =
      'move'

    event.dataTransfer.setData(
      'text/plain',
      String(visibleIndex),
    )
  }

  const handleDragOver = (event) => {
    event.preventDefault()

    event.dataTransfer.dropEffect =
      'move'
  }

  const handleDrop = (
    event,
    targetVisibleIndex,
  ) => {
    event.preventDefault()

    const sourceVisibleIndex = Number(
      event.dataTransfer.getData(
        'text/plain',
      ),
    )

    setDraggedIndex(null)

    if (
      !Number.isInteger(
        sourceVisibleIndex,
      ) ||
      sourceVisibleIndex ===
        targetVisibleIndex
    ) {
      return
    }

    if (
      sourceVisibleIndex < 0 ||
      sourceVisibleIndex >=
        upcomingTracks.length ||
      targetVisibleIndex < 0 ||
      targetVisibleIndex >=
        upcomingTracks.length
    ) {
      return
    }

    const actualStartIndex =
      currentIndex >= 0
        ? currentIndex + 1
        : 0

    const actualFromIndex =
      actualStartIndex +
      sourceVisibleIndex

    const actualToIndex =
      actualStartIndex +
      targetVisibleIndex

    onReorderQueue?.(
      actualFromIndex,
      actualToIndex,
    )
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleRemove = (
    event,
    visibleIndex,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const actualStartIndex =
      currentIndex >= 0
        ? currentIndex + 1
        : 0

    const actualQueueIndex =
      actualStartIndex + visibleIndex

    onRemoveFromQueue?.(
      actualQueueIndex,
    )
  }

  return (
    <div
      className="queue-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="queue-sheet max-h-[min(82vh,680px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[30px] border border-white/10 bg-[#111319] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-30px_80px_rgba(0,0,0,0.6)] sm:rounded-[30px]"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="mb-5 flex justify-center">
          <div className="flex h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
              Queue
            </p>

            <h3 className="text-xl font-semibold text-white">
              Now playing
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/5 text-white/75 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70"
            aria-label="Close queue"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div
              className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${
                currentSong?.cover ||
                'from-white/10 to-white/5'
              }`}
            >
              <Artwork
                src={currentSong?.artwork}
                className="absolute inset-0 h-full w-full object-cover"
                iconSize={16}
              />

              <Music2
                size={18}
                className="text-white"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {currentSong?.title ||
                  'Nothing playing'}
              </p>

              <p className="truncate text-xs text-white/55">
                {currentSong?.artist ||
                  'No artist'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs text-white/40">
            {upcomingTracks.length}{' '}
            {upcomingTracks.length === 1
              ? 'track'
              : 'tracks'}{' '}
            coming up
          </p>

          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
            Drag to reorder
          </p>
        </div>

        {!upcomingTracks.length ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-6 text-center">
            <p className="text-sm text-white/45">
              Nothing waiting to play
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingTracks.map(
              (song, index) => {
                const isDragging =
                  draggedIndex === index

                return (
                  <button
                    key={`${song.provider || 'local'}-${song.id}-${index}`}
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(
                        event,
                        index,
                      )
                    }
                    onDragOver={
                      handleDragOver
                    }
                    onDrop={(event) =>
                      handleDrop(
                        event,
                        index,
                      )
                    }
                    onDragEnd={
                      handleDragEnd
                    }
                    onClick={() =>
                      onSelectTrack?.(song)
                    }
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                      isDragging
                        ? 'border-[#7567F8]/30 bg-[#7567F8]/10 opacity-50'
                        : 'border-transparent bg-[#0d1116] hover:border-white/[0.05] hover:bg-[#151a21]'
                    }`}
                    aria-label={`Queue position ${
                      index + 1
                    }: ${
                      song.title ||
                      'Unknown title'
                    }`}
                  >
                    <div
                      className="flex w-6 shrink-0 cursor-grab items-center justify-center text-white/25 active:cursor-grabbing"
                      title="Drag to reorder"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <GripVertical
                        size={16}
                      />
                    </div>

                    <div className="flex w-5 shrink-0 items-center justify-center text-xs tabular-nums text-white/45">
                      {index + 1}
                    </div>

                    <div
                      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${
                        song.cover ||
                        'from-white/10 to-white/5'
                      }`}
                    >
                      <Artwork
                        src={song.artwork}
                        className="absolute inset-0 h-full w-full object-cover"
                        iconSize={14}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/85">
                        {song.title}
                      </p>

                      <p className="truncate text-xs text-white/45">
                        {song.artist}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs tabular-nums text-white/45">
                      {song.duration ||
                        (song.durationSeconds
                          ? `${Math.floor(
                              song.durationSeconds /
                                60,
                            )}:${String(
                              Math.floor(
                                song.durationSeconds %
                                  60,
                              ),
                            ).padStart(
                              2,
                              '0',
                            )}`
                          : '--:--')}
                    </span>

                    <button
                      type="button"
                      onPointerDown={(
                        event,
                      ) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) =>
                        handleRemove(
                          event,
                          index,
                        )
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/70"
                      aria-label={`Remove ${
                        song.title ||
                        'track'
                      } from queue`}
                      title="Remove from queue"
                    >
                      <X size={15} />
                    </button>
                  </button>
                )
              },
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default QueueSheet