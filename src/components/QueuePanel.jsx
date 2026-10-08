import {
  ListMusic,
  GripVertical,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import Artwork from './Artwork'

function QueuePanel({
  queue = [],
  currentSong,
  onSelectTrack,
  onReorderQueue,
  onRemoveFromQueue,
}) {
  const [draggedIndex, setDraggedIndex] =
    useState(null)

  const currentIndex = currentSong
    ? queue.findIndex(
        (track) =>
          track?.provider ===
            currentSong?.provider &&
          String(track?.id) ===
            String(currentSong?.id),
      )
    : -1

  /*
   * The player keeps the complete playback context.
   *
   * The visible Queue contains only songs after
   * the currently playing song.
   */
  const upcomingTracks = useMemo(
    () =>
      currentIndex >= 0
        ? queue.slice(currentIndex + 1)
        : queue,
    [queue, currentIndex],
  )

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

    /*
     * QueuePanel only displays upcoming tracks.
     * Their indexes are therefore different from
     * the actual player queue indexes.
     */
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

  const handleSelect = (track) => {
    onSelectTrack?.(track)
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

  if (!upcomingTracks.length) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-[#1b2129] text-white/75">
            <ListMusic size={18} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Queue
            </h3>

            <p className="mt-0.5 text-xs text-white/40">
              Nothing waiting to play
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#10141a] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#141920] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white/70">
            <ListMusic size={18} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Queue
            </h3>

            <p className="mt-0.5 text-xs text-white/40">
              {upcomingTracks.length}{' '}
              {upcomingTracks.length === 1
                ? 'track'
                : 'tracks'}
            </p>
          </div>
        </div>

        <span className="rounded-full border border-white/[0.08] bg-[#1b2122] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
          Drag to reorder
        </span>
      </div>

      <div className="max-h-[420px] overflow-y-auto bg-[#0d1116] p-2">
        {upcomingTracks.map(
          (track, index) => {
            const isDragging =
              draggedIndex === index

            return (
              <div
                key={`${track.provider || 'local'}-${track.id}-${index}`}
                role="button"
                tabIndex={0}
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
                onDragEnd={handleDragEnd}
                onClick={() =>
                  handleSelect(track)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' ||
                    event.key === ' '
                  ) {
                    event.preventDefault()
                    handleSelect(track)
                  }
                }}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                  isDragging
                    ? 'border-[#7567F8]/30 bg-[#7567F8]/10 opacity-50'
                    : 'border-transparent hover:border-white/[0.05] hover:bg-[#151a21]'
                }`}
                aria-label={`Queue position ${
                  index + 1
                }: ${
                  track.title ||
                  'Unknown title'
                }`}
              >
                <div
                  className="flex w-7 shrink-0 cursor-grab items-center justify-center text-white/25 active:cursor-grabbing"
                  title="Drag to reorder"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  onPointerDown={(event) =>
                    event.stopPropagation()
                  }
                >
                  <GripVertical
                    size={16}
                  />
                </div>

                <div className="flex w-5 shrink-0 items-center justify-center">
                  <span className="text-xs tabular-nums text-white/30">
                    {String(
                      index + 1,
                    ).padStart(2, '0')}
                  </span>
                </div>

                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white/[0.05]">
                  <Artwork
                    src={track.artwork}
                    className="absolute inset-0 h-full w-full object-cover"
                    iconSize={15}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/75">
                    {track.title ||
                      'Unknown title'}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-white/40">
                    {track.artist ||
                      'Unknown artist'}
                  </p>
                </div>

                <span className="shrink-0 text-xs tabular-nums text-white/35">
                  {track.duration ||
                    (track.durationSeconds
                      ? `${Math.floor(
                          track.durationSeconds /
                            60,
                        )}:${String(
                          Math.floor(
                            track.durationSeconds %
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
                  onPointerDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={(event) =>
                    handleRemove(
                      event,
                      index,
                    )
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50"
                  aria-label={`Remove ${
                    track.title ||
                    'track'
                  } from queue`}
                  title="Remove from queue"
                >
                  <X size={15} />
                </button>
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}

export default QueuePanel