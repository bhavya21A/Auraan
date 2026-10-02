import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStreamUrl } from '../services/musicApi'

const STORAGE_KEY = 'music_player_state'
const STORAGE_VERSION = 1
const VEROME_PROVIDER = 'verome'
const YOUTUBE_IFRAME_API_SRC =
  'https://www.youtube.com/iframe_api'

let youtubeApiPromise = null

const isRealTrack = (track) =>
  Boolean(track?.provider && track?.id)

const isVeromeTrack = (track) =>
  track?.provider === VEROME_PROVIDER &&
  Boolean(track?.id)

const parseTrackDuration = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0
      ? value
      : 0
  }

  const text = String(value || '').trim()

  if (!text) {
    return 0
  }

  if (text.includes(':')) {
    const parts = text
      .split(':')
      .map((part) => Number(part.trim()))

    if (
      parts.length === 2 &&
      Number.isFinite(parts[0]) &&
      Number.isFinite(parts[1])
    ) {
      return Math.max(
        0,
        parts[0] * 60 + parts[1],
      )
    }

    if (
      parts.length === 3 &&
      Number.isFinite(parts[0]) &&
      Number.isFinite(parts[1]) &&
      Number.isFinite(parts[2])
    ) {
      return Math.max(
        0,
        parts[0] * 3600 +
          parts[1] * 60 +
          parts[2],
      )
    }
  }

  const numericValue = Number(text)

  return Number.isFinite(numericValue) &&
    numericValue >= 0
    ? numericValue
    : 0
}

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

const sanitizeTrack = (track) => {
  if (!isRealTrack(track)) return null

  const durationSeconds =
    parseTrackDuration(
      track.durationSeconds ??
        track.duration,
    )

  return {
    ...track,
    id: String(track.id),
    provider: String(track.provider),
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || null,
    artwork: track.artwork || null,
    durationSeconds,
    playable: track.playable !== false,
  }
}

const emptyState = () => ({
  track: null,
  queue: [],
  currentTime: 0,
})

const readPersistedState = () => {
  const storage = getStorage()

  if (!storage) {
    return emptyState()
  }

  try {
    const parsed = JSON.parse(
      storage.getItem(STORAGE_KEY) || '',
    )

    if (
      parsed?.version !==
      STORAGE_VERSION
    ) {
      return emptyState()
    }

    const track =
      sanitizeTrack(parsed.track)

    const queue = Array.isArray(
      parsed.queue,
    )
      ? parsed.queue
          .map(sanitizeTrack)
          .filter(Boolean)
      : []

    return {
      track,
      queue,
      currentTime:
        Number.isFinite(
          Number(parsed.currentTime),
        ) &&
        Number(parsed.currentTime) >= 0
          ? Number(parsed.currentTime)
          : 0,
    }
  } catch {
    return emptyState()
  }
}

const persistState = (
  track,
  queue,
  currentTime,
) => {
  const storage = getStorage()

  if (!storage) return

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,

        track:
          sanitizeTrack(track),

        queue: queue
          .map(sanitizeTrack)
          .filter(Boolean),

        currentTime:
          Number.isFinite(
            Number(currentTime),
          ) &&
          Number(currentTime) >= 0
            ? Number(currentTime)
            : 0,
      }),
    )
  } catch {
    // Ignore storage failures.
  }
}

const loadYouTubeIframeApi = () => {
  if (globalThis.YT?.Player) {
    return Promise.resolve(
      globalThis.YT,
    )
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise(
    (resolve, reject) => {
      const previousReady =
        globalThis.onYouTubeIframeAPIReady

      globalThis.onYouTubeIframeAPIReady =
        () => {
          try {
            previousReady?.()
          } catch {
            // Ignore another callback's failure.
          }

          if (globalThis.YT?.Player) {
            resolve(globalThis.YT)
          } else {
            reject(
              new Error(
                'YouTube IFrame API did not initialize.',
              ),
            )
          }
        }

      const existingScript =
        document.querySelector(
          `script[src="${YOUTUBE_IFRAME_API_SRC}"]`,
        )

      if (existingScript) {
        return
      }

      const script =
        document.createElement(
          'script',
        )

      script.src =
        YOUTUBE_IFRAME_API_SRC

      script.async = true

      script.onerror = () => {
        youtubeApiPromise = null

        reject(
          new Error(
            'Unable to load the YouTube IFrame API.',
          ),
        )
      }

      document.head.appendChild(
        script,
      )
    },
  )

  return youtubeApiPromise
}

export function useMusicPlayer(
  initialTrack = null,
) {
  const restoredStateRef =
    useRef(null)

  if (
    restoredStateRef.current ===
    null
  ) {
    restoredStateRef.current =
      readPersistedState()
  }

  const restoredState =
    restoredStateRef.current

  const initialRestoredTrack =
    initialTrack ||
    restoredState.track

  const initialRestoredQueue =
    useMemo(
      () =>
        restoredState.queue.length
          ? restoredState.queue
          : initialRestoredTrack
            ? [initialRestoredTrack]
            : [],
      [
        initialRestoredTrack,
        restoredState.queue,
      ],
    )

  const audioRef =
    useRef(null)

  const requestIdRef =
    useRef(0)

  const startTrackRef =
    useRef(null)

  const currentTrackRef =
    useRef(
      initialRestoredTrack,
    )

  const queueRef =
    useRef(
      initialRestoredQueue,
    )

  const streamCacheRef =
    useRef(new Map())

  const streamRequestsRef =
    useRef(new Map())

  const retryKeysRef =
    useRef(new Set())

  const restorePositionRef =
    useRef(
      restoredState.currentTime,
    )

  /*
   * This ref is attached by App.jsx to the
   * visible Verome video area.
   */
  const veromePlayerContainerRef =
    useRef(null)

  const veromePlayerRef =
    useRef(null)

  const veromeReadyPromiseRef =
    useRef(null)

  const veromePlayerKeyRef =
    useRef(null)

  const veromeProgressIntervalRef =
    useRef(null)

  const [
    currentTrack,
    setCurrentTrack,
  ] = useState(
    initialRestoredTrack,
  )

  const [
    queue,
    setQueue,
  ] = useState(
    initialRestoredQueue,
  )

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false)

  const [
    currentTime,
    setCurrentTime,
  ] = useState(
    restoredState.currentTime,
  )

  const [
    duration,
    setDuration,
  ] = useState(
    parseTrackDuration(
      initialRestoredTrack?.durationSeconds ??
        initialRestoredTrack?.duration,
    ),
  )

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const stopVeromeProgress =
    useCallback(() => {
      if (
        veromeProgressIntervalRef.current
      ) {
        clearInterval(
          veromeProgressIntervalRef.current,
        )

        veromeProgressIntervalRef.current =
          null
      }
    }, [])

  const getCurrentPlaybackTime =
    useCallback(() => {
      if (
        isVeromeTrack(
          currentTrackRef.current,
        )
      ) {
        try {
          return (
            Number(
              veromePlayerRef.current?.getCurrentTime?.(),
            ) || 0
          )
        } catch {
          return 0
        }
      }

      return (
        Number(
          audioRef.current
            ?.currentTime,
        ) || 0
      )
    }, [])

  const persistCurrentPlayback =
    useCallback(() => {
      persistState(
        currentTrackRef.current,
        queueRef.current,
        getCurrentPlaybackTime(),
      )
    }, [
      getCurrentPlaybackTime,
    ])

  const startVeromeProgress =
    useCallback(() => {
      stopVeromeProgress()

      veromeProgressIntervalRef.current =
        window.setInterval(() => {
          const player =
            veromePlayerRef.current

          if (!player) return

          try {
            const nextTime =
              Number(
                player.getCurrentTime(),
              ) || 0

            const playerDuration =
              Number(
                player.getDuration(),
              ) || 0

            setCurrentTime(
              nextTime,
            )

            if (
              playerDuration > 0
            ) {
              setDuration(
                playerDuration,
              )
            }

            persistState(
              currentTrackRef.current,
              queueRef.current,
              nextTime,
            )
          } catch {
            // Ignore transition frames.
          }
        }, 500)
    }, [
      stopVeromeProgress,
    ])

  const createVeromePlayer =
    useCallback(
      async (videoId) => {
        const container =
          veromePlayerContainerRef.current

        if (!container) {
          throw new Error(
            'Verome video player area is not mounted yet.',
          )
        }

        if (
          veromePlayerRef.current
            ?.loadVideoById
        ) {
          return veromePlayerRef.current
        }

        if (
          !veromeReadyPromiseRef.current
        ) {
          veromeReadyPromiseRef.current =
            loadYouTubeIframeApi()
              .then((YT) => {
                return new Promise(
                  (
                    resolve,
                    reject,
                  ) => {
                    try {
                      const player =
                        new YT.Player(
                          container,
                          {
                            width:
                              '100%',
                            height:
                              '100%',
                            videoId:
                              String(
                                videoId,
                              ),

                            playerVars:
                              {
                                autoplay: 0,
                                controls: 1,
                                playsinline: 1,
                                rel: 0,
                                origin:
                                  window.location.origin,
                              },

                            events: {
                              onReady:
                                (
                                  event,
                                ) => {
                                  veromePlayerRef.current =
                                    event.target

                                  veromePlayerKeyRef.current =
                                    String(
                                      videoId,
                                    )

                                  resolve(
                                    event.target,
                                  )
                                },

                              onStateChange:
                                (
                                  event,
                                ) => {
                                  const state =
                                    event?.data

                                  if (
                                    state ===
                                    1
                                  ) {
                                    setIsLoading(
                                      false,
                                    )

                                    setIsPlaying(
                                      true,
                                    )

                                    startVeromeProgress()

                                    persistCurrentPlayback()

                                    try {
                                      const playerDuration =
                                        Number(
                                          event.target.getDuration(),
                                        ) || 0

                                      if (
                                        playerDuration >
                                        0
                                      ) {
                                        setDuration(
                                          playerDuration,
                                        )
                                      }
                                    } catch {
                                      // Duration may load slightly later.
                                    }

                                    return
                                  }

                                  if (
                                    state ===
                                    2
                                  ) {
                                    setIsPlaying(
                                      false,
                                    )

                                    setIsLoading(
                                      false,
                                    )

                                    stopVeromeProgress()

                                    persistCurrentPlayback()

                                    return
                                  }

                                  if (
                                    state ===
                                    0
                                  ) {
                                    setIsPlaying(
                                      false,
                                    )

                                    setIsLoading(
                                      false,
                                    )

                                    stopVeromeProgress()

                                    setCurrentTime(
                                      0,
                                    )

                                    persistState(
                                      currentTrackRef.current,
                                      queueRef.current,
                                      0,
                                    )

                                    const track =
                                      currentTrackRef.current

                                    const currentIndex =
                                      queueRef.current.findIndex(
                                        (
                                          item,
                                        ) =>
                                          item.provider ===
                                            track?.provider &&
                                          item.id ===
                                            track?.id,
                                      )

                                    const nextTrack =
                                      currentIndex >=
                                      0
                                        ? queueRef.current[
                                            currentIndex +
                                              1
                                          ]
                                        : null

                                    if (
                                      nextTrack
                                    ) {
                                      void startTrackRef.current?.(
                                        nextTrack,
                                        true,
                                      )
                                    }

                                    return
                                  }

                                  if (
                                    state ===
                                    3
                                  ) {
                                    setIsLoading(
                                      true,
                                    )
                                  }
                                },

                              onError:
                                () => {
                                  stopVeromeProgress()

                                  setIsPlaying(
                                    false,
                                  )

                                  setIsLoading(
                                    false,
                                  )

                                  setError(
                                    'This Verome track cannot be played in the YouTube player.',
                                  )
                                },
                            },
                          },
                        )

                      veromePlayerRef.current =
                        player
                    } catch (
                      error
                    ) {
                      reject(error)
                    }
                  },
                )
              })
              .catch(
                (error) => {
                  veromeReadyPromiseRef.current =
                    null

                  throw error
                },
              )
        }

        return veromeReadyPromiseRef.current
      },
      [
        persistCurrentPlayback,
        startVeromeProgress,
        stopVeromeProgress,
      ],
    )

  useEffect(() => {
    const audio =
      new Audio()

    audio.preload =
      'metadata'

    audioRef.current =
      audio

    const handleLoadedMetadata =
      () => {
        if (
          !Number.isFinite(
            audio.duration,
          )
        ) {
          return
        }

        setDuration(
          audio.duration,
        )

        const restorePosition =
          restorePositionRef.current

        if (
          restorePosition >
            0 &&
          currentTrackRef.current
        ) {
          const nextTime =
            Math.min(
              restorePosition,
              audio.duration,
            )

          audio.currentTime =
            nextTime

          setCurrentTime(
            nextTime,
          )

          restorePositionRef.current =
            0
        }
      }

    const handleTimeUpdate =
      () => {
        setCurrentTime(
          audio.currentTime,
        )

        persistState(
          currentTrackRef.current,
          queueRef.current,
          audio.currentTime,
        )
      }

    const handlePlay = () => {
      setIsLoading(
        false,
      )

      setIsPlaying(
        true,
      )
    }

    const handlePause =
      () => {
        setIsPlaying(
          false,
        )

        persistState(
          currentTrackRef.current,
          queueRef.current,
          audio.currentTime,
        )
      }

    const handleWaiting =
      () => {
        setIsLoading(
          true,
        )
      }

    const handleCanPlay =
      () => {
        setIsLoading(
          false,
        )
      }

    const handleEnded =
      () => {
        setIsPlaying(
          false,
        )

        setIsLoading(
          false,
        )

        setCurrentTime(
          0,
        )

        audio.currentTime =
          0

        persistState(
          currentTrackRef.current,
          queueRef.current,
          0,
        )

        const track =
          currentTrackRef.current

        const currentIndex =
          queueRef.current.findIndex(
            (item) =>
              item.provider ===
                track?.provider &&
              item.id ===
                track?.id,
          )

        const nextTrack =
          currentIndex >=
          0
            ? queueRef.current[
                currentIndex +
                  1
              ]
            : null

        if (
          nextTrack
        ) {
          void startTrackRef.current?.(
            nextTrack,
            true,
          )
        }
      }

    const handleError =
      () => {
        const track =
          currentTrackRef.current

        const cacheKey =
          track
            ? `${track.provider}:${track.id}`
            : null

        if (
          track &&
          cacheKey &&
          streamCacheRef.current.has(
            cacheKey,
          ) &&
          !retryKeysRef.current.has(
            cacheKey,
          )
        ) {
          retryKeysRef.current.add(
            cacheKey,
          )

          streamCacheRef.current.delete(
            cacheKey,
          )

          void startTrackRef.current?.(
            track,
            true,
            true,
          )

          return
        }

        setIsPlaying(
          false,
        )

        setIsLoading(
          false,
        )

        setError(
          'Unable to play this track.',
        )
      }

    audio.addEventListener(
      'loadedmetadata',
      handleLoadedMetadata,
    )

    audio.addEventListener(
      'timeupdate',
      handleTimeUpdate,
    )

    audio.addEventListener(
      'play',
      handlePlay,
    )

    audio.addEventListener(
      'pause',
      handlePause,
    )

    audio.addEventListener(
      'waiting',
      handleWaiting,
    )

    audio.addEventListener(
      'canplay',
      handleCanPlay,
    )

    audio.addEventListener(
      'ended',
      handleEnded,
    )

    audio.addEventListener(
      'error',
      handleError,
    )

    if (
      initialRestoredTrack
    ) {
      persistState(
        initialRestoredTrack,
        initialRestoredQueue,
        restoredState.currentTime,
      )
    }

    return () => {
      persistState(
        currentTrackRef.current,
        queueRef.current,
        getCurrentPlaybackTime(),
      )

      stopVeromeProgress()

      try {
        veromePlayerRef.current?.pauseVideo?.()
        veromePlayerRef.current?.destroy?.()
      } catch {
        // Ignore cleanup failures.
      }

      veromePlayerRef.current =
        null

      veromePlayerKeyRef.current =
        null

      veromeReadyPromiseRef.current =
        null

      audio.pause()

      audio.removeAttribute(
        'src',
      )

      audio.load()

      audioRef.current =
        null

      audio.removeEventListener(
        'loadedmetadata',
        handleLoadedMetadata,
      )

      audio.removeEventListener(
        'timeupdate',
        handleTimeUpdate,
      )

      audio.removeEventListener(
        'play',
        handlePlay,
      )

      audio.removeEventListener(
        'pause',
        handlePause,
      )

      audio.removeEventListener(
        'waiting',
        handleWaiting,
      )

      audio.removeEventListener(
        'canplay',
        handleCanPlay,
      )

      audio.removeEventListener(
        'ended',
        handleEnded,
      )

      audio.removeEventListener(
        'error',
        handleError,
      )
    }
  }, [
    getCurrentPlaybackTime,
    initialRestoredQueue,
    initialRestoredTrack,
    restoredState.currentTime,
    stopVeromeProgress,
  ])

  const startTrack =
    useCallback(
      async (
        track,
        shouldPlay,
        forceRefresh = false,
      ) => {
        if (!isRealTrack(track)) {
          return
        }

        const requestId =
          requestIdRef.current +
          1

        requestIdRef.current =
          requestId

        const cacheKey =
          `${track.provider}:${track.id}`

        const currentKey =
          currentTrackRef.current
            ? `${currentTrackRef.current.provider}:${currentTrackRef.current.id}`
            : null

        if (
          !forceRefresh &&
          currentKey ===
            cacheKey &&
          !isVeromeTrack(
            track,
          ) &&
          (
            streamRequestsRef.current.has(
              cacheKey,
            ) ||
            (
              audioRef.current?.src &&
              !audioRef.current.paused
            )
          )
        ) {
          return
        }

        setError('')

        if (
          isVeromeTrack(
            track,
          )
        ) {
          const restoringSameTrack =
            currentKey ===
              cacheKey &&
            restorePositionRef.current >
              0

          audioRef.current?.pause()

          stopVeromeProgress()

          currentTrackRef.current =
            track

          setCurrentTrack(
            track,
          )

          setDuration(
            parseTrackDuration(
              track.durationSeconds ??
                track.duration,
            ),
          )

          setIsLoading(
            true,
          )

          setIsPlaying(
            false,
          )

          if (
            !restoringSameTrack
          ) {
            setCurrentTime(
              0,
            )

            restorePositionRef.current =
              0

            persistState(
              track,
              queueRef.current,
              0,
            )
          } else {
            setCurrentTime(
              restorePositionRef.current,
            )
          }

          try {
            const player =
              await createVeromePlayer(
                track.id,
              )

            if (
              requestId !==
              requestIdRef.current
            ) {
              return
            }

            if (
              veromePlayerKeyRef.current !==
              String(
                track.id,
              )
            ) {
              veromePlayerKeyRef.current =
                String(
                  track.id,
                )

              player.loadVideoById(
                {
                  videoId:
                    String(
                      track.id,
                    ),
                },
              )
            }

            if (
              shouldPlay
            ) {
              if (
                restoringSameTrack &&
                restorePositionRef.current >
                  0
              ) {
                try {
                  player.seekTo(
                    restorePositionRef.current,
                    true,
                  )
                } catch {
                  // Ignore while initializing.
                }

                restorePositionRef.current =
                  0
              }

              player.playVideo()
            } else {
              setIsLoading(
                false,
              )
            }
          } catch (
            error
          ) {
            if (
              requestId !==
              requestIdRef.current
            ) {
              return
            }

            setIsLoading(
              false,
            )

            setIsPlaying(
              false,
            )

            setError(
              error?.message ||
                'Unable to start the Verome video player.',
            )
          }

          return
        }

        const audio =
          audioRef.current

        if (!audio) return

        stopVeromeProgress()

        try {
          veromePlayerRef.current?.pauseVideo?.()
        } catch {
          // Ignore player transition errors.
        }

        const isRestoringSameTrack =
          currentKey ===
            cacheKey &&
          !audio.src &&
          restorePositionRef.current >
            0

        audio.pause()

        currentTrackRef.current =
          track

        setCurrentTrack(
          track,
        )

        setCurrentTime(
          isRestoringSameTrack
            ? restorePositionRef.current
            : 0,
        )

        setDuration(
          parseTrackDuration(
            track.durationSeconds ??
              track.duration,
          ),
        )

        setIsLoading(
          true,
        )

        setIsPlaying(
          false,
        )

        if (
          !isRestoringSameTrack
        ) {
          restorePositionRef.current =
            0

          persistState(
            track,
            queueRef.current,
            0,
          )
        }

        try {
          let streamUrl =
            forceRefresh
              ? null
              : streamCacheRef.current.get(
                  cacheKey,
                )

          if (
            !streamUrl
          ) {
            let streamRequest =
              streamRequestsRef.current.get(
                cacheKey,
              )

            if (
              !streamRequest
            ) {
              streamRequest =
                getStreamUrl(
                  track.id,
                  track.provider,
                )

              streamRequestsRef.current.set(
                cacheKey,
                streamRequest,
              )

              const clearRequest =
                () => {
                  if (
                    streamRequestsRef.current.get(
                      cacheKey,
                    ) ===
                    streamRequest
                  ) {
                    streamRequestsRef.current.delete(
                      cacheKey,
                    )
                  }
                }

              streamRequest.then(
                clearRequest,
                clearRequest,
              )
            }

            const response =
              await streamRequest

            streamUrl =
              response.streamUrl

            streamCacheRef.current.set(
              cacheKey,
              streamUrl,
            )
          }

          if (
            requestId !==
            requestIdRef.current
          ) {
            return
          }

          audio.src =
            streamUrl

          audio.load()

          if (
            shouldPlay
          ) {
            await audio.play()
          } else {
            setIsLoading(
              false,
            )
          }
        } catch {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return
          }

          setIsLoading(
            false,
          )

          setIsPlaying(
            false,
          )

          setError(
            'Unable to play this track.',
          )

          retryKeysRef.current.delete(
            cacheKey,
          )
        }
      },
      [
        createVeromePlayer,
        stopVeromeProgress,
      ],
    )

  useEffect(() => {
    startTrackRef.current =
      startTrack
  }, [
    startTrack,
  ])

  /*
   * playTrack
   *
   * replaceQueue = false
   * -> keep the existing queue and add the track(s)
   *
   * replaceQueue = true
   * -> completely replace the queue
   *    with additionalTracks + track
   *
   * This is what Play Album will use.
   */
  const playTrack =
    async (
      track,
      additionalTracks = [],
      replaceQueue = false,
    ) => {
      if (!isRealTrack(track)) {
        return
      }

      const sourceTracks =
        replaceQueue
          ? additionalTracks
          : [
              ...queueRef.current,
              ...additionalTracks,
            ]

      const uniqueTracks = [
        ...sourceTracks,
        track,
      ].filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.provider ===
                item.provider &&
              candidate.id ===
                item.id,
          ) ===
          index,
      )

      queueRef.current =
        uniqueTracks

      setQueue(
        uniqueTracks,
      )

      restorePositionRef.current =
        0

      persistState(
        track,
        uniqueTracks,
        0,
      )

      await startTrack(
        track,
        true,
      )
    }

  const togglePlay =
    async () => {
      const track =
        currentTrackRef.current ||
        currentTrack

      if (
        !isRealTrack(
          track,
        )
      ) {
        return
      }

      if (
        isVeromeTrack(
          track,
        )
      ) {
        const player =
          veromePlayerRef.current

        if (!player) {
          await startTrack(
            track,
            true,
          )

          return
        }

        try {
          const state =
            player.getPlayerState()

          if (
            state ===
            1
          ) {
            player.pauseVideo()

            return
          }

          setError('')

          setIsLoading(
            true,
          )

          player.playVideo()
        } catch {
          setIsLoading(
            false,
          )

          setError(
            'Unable to play this Verome track.',
          )
        }

        return
      }

      const audio =
        audioRef.current

      if (!audio?.src) {
        await startTrack(
          track,
          true,
        )

        return
      }

      if (
        audio.paused
      ) {
        try {
          setError('')

          setIsLoading(
            true,
          )

          await audio.play()
        } catch {
          setIsLoading(
            false,
          )

          setError(
            'Unable to play this track.',
          )
        }
      } else {
        audio.pause()
      }
    }

  const nextTrack =
    async () => {
      const track =
        currentTrackRef.current

      const currentIndex =
        queueRef.current.findIndex(
          (item) =>
            item.provider ===
              track?.provider &&
            item.id ===
              track?.id,
        )

      const next =
        currentIndex >=
        0
          ? queueRef.current[
              currentIndex +
                1
            ]
          : null

      if (next) {
        await startTrack(
          next,
          true,
        )

        return
      }

      stopVeromeProgress()

      try {
        veromePlayerRef.current?.pauseVideo?.()
      } catch {
        // Ignore player transition errors.
      }

      audioRef.current?.pause()

      if (
        audioRef.current
      ) {
        audioRef.current.currentTime =
          0
      }

      setCurrentTime(
        0,
      )

      setIsPlaying(
        false,
      )

      persistState(
        currentTrackRef.current,
        queueRef.current,
        0,
      )
    }

  const seekTo =
    useCallback(
      (value) => {
        const nextTime =
          Number(value)

        if (
          !Number.isFinite(
            nextTime,
          ) ||
          nextTime <
            0
        ) {
          return
        }

        if (
          isVeromeTrack(
            currentTrackRef.current,
          )
        ) {
          const player =
            veromePlayerRef.current

          if (!player) {
            return
          }

          const playerDuration =
            Number(
              player.getDuration(),
            ) ||
            duration

          if (
            !Number.isFinite(
              playerDuration,
            ) ||
            playerDuration <=
              0
          ) {
            return
          }

          const clampedTime =
            Math.min(
              Math.max(
                nextTime,
                0,
              ),
              playerDuration,
            )

          try {
            player.seekTo(
              clampedTime,
              true,
            )

            setCurrentTime(
              clampedTime,
            )

            persistState(
              currentTrackRef.current,
              queueRef.current,
              clampedTime,
            )
          } catch {
            // Ignore during transitions.
          }

          return
        }

        const audio =
          audioRef.current

        const targetDuration =
          Number.isFinite(
            audio?.duration,
          ) &&
          audio.duration >
            0
            ? audio.duration
            : duration

        if (
          !audio ||
          !Number.isFinite(
            targetDuration,
          ) ||
          targetDuration <=
            0
        ) {
          return
        }

        audio.currentTime =
          Math.min(
            Math.max(
              nextTime,
              0,
            ),
            targetDuration,
          )

        setCurrentTime(
          audio.currentTime,
        )

        persistState(
          currentTrackRef.current,
          queueRef.current,
          audio.currentTime,
        )
      },
      [
        duration,
      ],
    )

  const previousTrack =
    useCallback(
      async () => {
        const currentPosition =
          getCurrentPlaybackTime()

        if (
          currentPosition >
          3
        ) {
          seekTo(
            0,
          )

          return
        }

        const track =
          currentTrackRef.current

        const currentIndex =
          queueRef.current.findIndex(
            (item) =>
              item.provider ===
                track?.provider &&
              item.id ===
                track?.id,
          )

        const previous =
          currentIndex >
          0
            ? queueRef.current[
                currentIndex -
                  1
              ]
            : null

        if (
          previous
        ) {
          await startTrack(
            previous,
            true,
          )

          return
        }

        seekTo(
          0,
        )
      },
      [
        getCurrentPlaybackTime,
        seekTo,
        startTrack,
      ],
    )

  return {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    error,
    playTrack,
    togglePlay,
    seekTo,
    nextTrack,
    previousTrack,
    veromePlayerContainerRef,
  }
}

export default useMusicPlayer
