import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getStreamUrl } from '../services/musicApi'

const STORAGE_KEY = 'music_player_state'
const STORAGE_VERSION = 1

const VEROME_PROVIDER = 'verome'
const REPEAT_MODES = {
  OFF: 'off',
  QUEUE: 'queue',
  ONE: 'one',
}

const isValidRepeatMode = (value) =>
  value === REPEAT_MODES.OFF ||
  value === REPEAT_MODES.QUEUE ||
  value === REPEAT_MODES.ONE

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
  if (!isRealTrack(track)) {
    return null
  }

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
  repeatMode: REPEAT_MODES.OFF,
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
      repeatMode: isValidRepeatMode(parsed.repeatMode)
      ? parsed.repeatMode
      : REPEAT_MODES.OFF,
    }
  } catch {
    return emptyState()
  }
}

const persistState = (
  track,
  queue,
  currentTime,
  repeatMode = REPEAT_MODES.OFF,
) => {
  const storage = getStorage()

  if (!storage) {
    return
  }

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
        repeatMode,
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

const getMediaArtwork = (track) => {
  const artwork =
    track?.artwork

  if (!artwork) {
    return undefined
  }

  return [
    {
      src: artwork,
      sizes: '512x512',
      type: 'image/png',
    },
  ]
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

  const togglePlayRef =
    useRef(null)

  const nextTrackRef =
    useRef(null)

  const previousTrackRef =
    useRef(null)

  const seekToRef =
    useRef(null)

  const currentTrackRef =
    useRef(
      initialRestoredTrack,
    )

  const queueRef =
    useRef(
      initialRestoredQueue,
    )

  const repeatModeRef =
    useRef(
      isValidRepeatMode(
        restoredState.repeatMode,
      )
        ? restoredState.repeatMode
        : REPEAT_MODES.OFF,
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
    repeatMode,
    setRepeatModeState,
  ] = useState(
    repeatModeRef.current,
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
        repeatModeRef.current,
      )
    }, [
      getCurrentPlaybackTime,
    ])

  /*
   * ---------------------------------------------------------
   * MEDIA SESSION
   * ---------------------------------------------------------
   *
   * This connects AURAAN's player to:
   *
   * - Android media notification
   * - Android lock screen controls
   * - Bluetooth headset controls
   * - Earphone play/pause buttons
   * - Browser media controls
   *
   * It only controls the native audio player.
   *
   * Verome / YouTube remains iframe based.
   */
  const updateMediaSession =
    useCallback(
      (track, playing, current, total) => {
        if (
          typeof navigator ===
            'undefined' ||
          !('mediaSession' in navigator)
        ) {
          return
        }

        const mediaSession =
          navigator.mediaSession

        if (!track) {
          try {
            mediaSession.metadata =
              null
          } catch {
            // Ignore Media Session failures.
          }

          return
        }

        try {
          if (
            typeof MediaMetadata !==
            'undefined'
          ) {
            mediaSession.metadata =
              new MediaMetadata({
                title:
                  track.title ||
                  'Unknown title',

                artist:
                  track.artist ||
                  'Unknown artist',

                album:
                  track.album ||
                  'AURAAN',

                artwork:
                  getMediaArtwork(
                    track,
                  ),
              })
          }
        } catch {
          // Some browsers may reject metadata.
        }

        try {
          mediaSession.playbackState =
            playing
              ? 'playing'
              : 'paused'
        } catch {
          // Ignore unsupported playbackState.
        }

        try {
          const safeDuration =
            Number(total)

          const safePosition =
            Number(current)

          if (
            Number.isFinite(
              safeDuration,
            ) &&
            safeDuration > 0 &&
            Number.isFinite(
              safePosition,
            )
          ) {
            mediaSession.setPositionState?.(
              {
                duration:
                  safeDuration,

                playbackRate: 1,

                position:
                  Math.min(
                    Math.max(
                      safePosition,
                      0,
                    ),
                    safeDuration,
                  ),
              },
            )
          }
        } catch {
          // Ignore position-state failures.
        }
      },
      [],
    )

  const startVeromeProgress =
    useCallback(() => {
      stopVeromeProgress()

      veromeProgressIntervalRef.current =
        window.setInterval(() => {
          const player =
            veromePlayerRef.current

          if (!player) {
            return
          }

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
              repeatModeRef.current,
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
              repeatModeRef.current,
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
                                  window
                                    .location
                                    .origin,
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
                                      // Duration may load later.
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
                                      repeatModeRef.current,
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

                                    let next = null

                                    if (
                                      repeatModeRef.current ===
                                      REPEAT_MODES.ONE
                                    ) {
                                      next = track
                                    } else if (
                                      currentIndex >= 0
                                    ) {
                                      next =
                                        queueRef.current[
                                          currentIndex +
                                            1
                                        ] || (
                                          repeatModeRef.current ===
                                          REPEAT_MODES.QUEUE
                                            ? queueRef.current[0]
                                            : null
                                        )
                                    }

                                    if (
                                      next
                                    ) {
                                      void startTrackRef.current?.(
                                        next,
                                        true,
                                        repeatModeRef.current ===
                                          REPEAT_MODES.ONE,
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

  /*
   * ---------------------------------------------------------
   * NATIVE AUDIO PLAYER
   * ---------------------------------------------------------
   */
  useEffect(() => {
    const audio =
      new Audio()

    audio.preload =
      'metadata'

    /*
     * Important for mobile background playback.
     *
     * We intentionally do NOT attach the audio
     * element to React's visible DOM.
     *
     * The browser can continue playing this
     * audio element when the page is backgrounded
     * when the platform/browser permits it.
     */
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
          restorePosition <
            audio.duration
        ) {
          try {
            audio.currentTime =
              restorePosition
          } catch {
            // Ignore restore failures.
          }
        }

        restorePositionRef.current =
          0
      }

    const handleTimeUpdate =
      () => {
        const time =
          Number(
            audio.currentTime,
          ) || 0

        setCurrentTime(
          time,
        )

        persistState(
          currentTrackRef.current,
          queueRef.current,
          time,
          repeatModeRef.current,
        )

        updateMediaSession(
          currentTrackRef.current,
          !audio.paused,
          time,
          Number.isFinite(
            audio.duration,
          )
            ? audio.duration
            : duration,
        )
      }

    const handlePlay =
      () => {
        setIsPlaying(
          true,
        )

        setIsLoading(
          false,
        )

        updateMediaSession(
          currentTrackRef.current,
          true,
          audio.currentTime ||
            0,
          Number.isFinite(
            audio.duration,
          )
            ? audio.duration
            : duration,
        )
      }

    const handlePause =
      () => {
        setIsPlaying(
          false,
        )

        setIsLoading(
          false,
        )

        updateMediaSession(
          currentTrackRef.current,
          false,
          audio.currentTime ||
            0,
          Number.isFinite(
            audio.duration,
          )
            ? audio.duration
            : duration,
        )

        persistCurrentPlayback()
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
        const repeatMode =
          repeatModeRef.current

        if (
          repeatMode ===
          REPEAT_MODES.ONE
        ) {
          try {
            audio.currentTime =
              0
          } catch {
            // Ignore restart seek errors.
          }

          void audio
            .play()
            .catch(
              () => {
                setIsPlaying(
                  false,
                )
              },
            )

          return
        }

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

        let next = null

        if (
          currentIndex >=
          0
        ) {
          next =
            queueRef.current[
              currentIndex +
                1
            ] || null
        }

        if (
          !next &&
          repeatMode ===
            REPEAT_MODES.QUEUE &&
          queueRef.current.length
        ) {
          next =
            queueRef.current[0]
        }

        if (
          next
        ) {
          void startTrackRef.current?.(
            next,
            true,
            false,
          )

          return
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
          repeatModeRef.current,
        )

        updateMediaSession(
          currentTrackRef.current,
          false,
          0,
          Number.isFinite(
            audio.duration,
          )
            ? audio.duration
            : duration,
        )
      }

    const handleError =
      () => {
        setIsLoading(
          false,
        )

        setIsPlaying(
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

    return () => {
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

      audio.pause()

      audio.src = ''

      if (
        audioRef.current ===
        audio
      ) {
        audioRef.current =
          null
      }
    }
  }, [
    duration,
    persistCurrentPlayback,
    updateMediaSession,
  ])

  /*
   * ---------------------------------------------------------
   * START TRACK
   * ---------------------------------------------------------
   */
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

        /*
         * ---------------------------------------------------
         * VEROME / YOUTUBE
         * ---------------------------------------------------
         */
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
              repeatModeRef.current,
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

        /*
         * ---------------------------------------------------
         * NATIVE AUDIO
         * ---------------------------------------------------
         */
        const audio =
          audioRef.current

        if (!audio) {
          return
        }

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

        updateMediaSession(
          track,
          false,
          isRestoringSameTrack
            ? restorePositionRef.current
            : 0,
          parseTrackDuration(
            track.durationSeconds ??
              track.duration,
          ),
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
            repeatModeRef.current,
          )
        }

        try {
          let streamUrl =
            forceRefresh
              ? null
              : streamCacheRef.current.get(
                  cacheKey,
                )

          if (!streamUrl) {
            let streamRequest =
              streamRequestsRef.current.get(
                cacheKey,
              )

            if (!streamRequest) {
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

          updateMediaSession(
            track,
            false,
            0,
            duration,
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
        duration,
        stopVeromeProgress,
        updateMediaSession,
      ],
    )

  useEffect(() => {
    startTrackRef.current =
      startTrack
  }, [
    startTrack,
  ])

  /*
   * ---------------------------------------------------------
   * PLAY TRACK
   * ---------------------------------------------------------
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
        repeatModeRef.current,
      )

      await startTrack(
        track,
        true,
      )
    }

  /*
   * ---------------------------------------------------------
   * TOGGLE PLAY
   * ---------------------------------------------------------
   */
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

  /*
   * ---------------------------------------------------------
   * NEXT TRACK
   * ---------------------------------------------------------
   */
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

      if (
        repeatModeRef.current ===
        REPEAT_MODES.QUEUE &&
        queueRef.current.length >
          0
      ) {
        await startTrack(
          queueRef.current[0],
          true,
        )

        return
      }

      stopPlayback()
    }

  /*
   * ---------------------------------------------------------
   * PREVIOUS TRACK
   * ---------------------------------------------------------
   */
  const previousTrack =
    async () => {
      const track =
        currentTrackRef.current

      if (!track) {
        return
      }

      const currentTime =
        getCurrentPlaybackTime()

      if (
        currentTime >
        3
      ) {
        seek(
          0,
        )

        return
      }

      const currentIndex =
        queueRef.current.findIndex(
          (item) =>
            item.provider ===
              track.provider &&
            item.id ===
              track.id,
        )

      if (
        currentIndex >
        0
      ) {
        await startTrack(
          queueRef.current[
            currentIndex -
              1
          ],
          true,
        )

        return
      }

      seek(
        0,
      )
    }

  /*
   * ---------------------------------------------------------
   * SEEK
   * ---------------------------------------------------------
   */
  const seekTo =
    (value) => {
      const nextTime =
        Number(
          value,
        )

      if (
        !Number.isFinite(
          nextTime,
        )
      ) {
        return
      }

      const track =
        currentTrackRef.current

      if (
        isVeromeTrack(
          track,
        )
      ) {
        const player =
          veromePlayerRef.current

        if (
          player
        ) {
          try {
            player.seekTo(
              nextTime,
              true,
            )
          } catch {
            // Ignore seek failures.
          }
        }

        setCurrentTime(
          nextTime,
        )

        return
      }

      const audio =
        audioRef.current

      if (
        audio
      ) {
        try {
          audio.currentTime =
            Math.max(
              0,
              Math.min(
                nextTime,
                Number.isFinite(
                  audio.duration,
                )
                  ? audio.duration
                  : nextTime,
              ),
            )
        } catch {
          // Ignore seek failures.
        }
      }

      setCurrentTime(
        nextTime,
      )
    }

      /*
   * ---------------------------------------------------------
   * REPEAT
   * ---------------------------------------------------------
   */
  const setRepeatMode =
    useCallback(
      (mode) => {
        if (!isValidRepeatMode(mode)) {
          return
        }

        repeatModeRef.current =
          mode

        setRepeatModeState(
          mode,
        )

        persistState(
          currentTrackRef.current,
          queueRef.current,
          getCurrentPlaybackTime(),
          mode,
        )
      },
      [
        getCurrentPlaybackTime,
      ],
    )

  const toggleRepeat =
    useCallback(() => {
      const current =
        repeatModeRef.current

      const next =
        current === REPEAT_MODES.OFF
          ? REPEAT_MODES.QUEUE
          : current === REPEAT_MODES.QUEUE
            ? REPEAT_MODES.ONE
            : REPEAT_MODES.OFF

      setRepeatMode(next)
    }, [
      setRepeatMode,
    ])
  /*
   * ---------------------------------------------------------
   * STOP PLAYBACK
   * ---------------------------------------------------------
   */
  const stopPlayback =
    () => {
      requestIdRef.current +=
        1

      const audio =
        audioRef.current

      if (audio) {
        audio.pause()

        try {
          audio.currentTime =
            0
        } catch {
          // Ignore reset failures.
        }
      }

      const player =
        veromePlayerRef.current

      if (player) {
        try {
          player.pauseVideo()
          player.seekTo(
            0,
            true,
          )
        } catch {
          // Ignore player reset failures.
        }
      }

      stopVeromeProgress()

      setIsPlaying(
        false,
      )

      setIsLoading(
        false,
      )

      setCurrentTime(
        0,
      )

      updateMediaSession(
        currentTrackRef.current,
        false,
        0,
        duration,
      )
    }

  /*
   * ---------------------------------------------------------
   * QUEUE MANAGEMENT
   * ---------------------------------------------------------
   */
  const addToQueue =
    (track) => {
      if (!isRealTrack(track)) {
        return
      }

      const exists =
        queueRef.current.some(
          (item) =>
            item.provider ===
              track.provider &&
            item.id ===
              track.id,
        )

      if (exists) {
        return
      }

      const nextQueue = [
        ...queueRef.current,
        track,
      ]

      queueRef.current =
        nextQueue

      setQueue(
        nextQueue,
      )

      persistState(
        currentTrackRef.current,
        nextQueue,
        getCurrentPlaybackTime(),
        repeatModeRef.current,
      )
    }

  const removeFromQueue =
    (track) => {
      if (!isRealTrack(track)) {
        return
      }

      const nextQueue =
        queueRef.current.filter(
          (item) =>
            !(
              item.provider ===
                track.provider &&
              item.id ===
                track.id
            ),
        )

      queueRef.current =
        nextQueue

      setQueue(
        nextQueue,
      )

      persistState(
        currentTrackRef.current,
        nextQueue,
        getCurrentPlaybackTime(),
        repeatModeRef.current,
      )
    }
  
    const reorderQueue =
    (fromIndex, toIndex) => {
      const currentQueue =
        queueRef.current

      if (
        !Number.isInteger(fromIndex) ||
        !Number.isInteger(toIndex) ||
        fromIndex < 0 ||
        fromIndex >= currentQueue.length ||
        toIndex < 0 ||
        toIndex >= currentQueue.length ||
        fromIndex === toIndex
      ) {
        return
      }

      const nextQueue = [
        ...currentQueue,
      ]

      const [
        movedTrack,
      ] = nextQueue.splice(
        fromIndex,
        1,
      )

      nextQueue.splice(
        toIndex,
        0,
        movedTrack,
      )

      queueRef.current =
        nextQueue

      setQueue(
        nextQueue,
      )

      persistState(
        currentTrackRef.current,
        nextQueue,
        getCurrentPlaybackTime(),
        repeatModeRef.current,
      )
    }

  const clearQueue =
    () => {
      queueRef.current =
        []

      setQueue(
        [],
      )

      persistState(
        currentTrackRef.current,
        [],
        getCurrentPlaybackTime(),
        repeatModeRef.current,
      )
    }
  /* ---------------------------------------------------------
   * REGISTER MEDIA NOTIFICATION CONTROLS
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      typeof navigator ===
        'undefined' ||
      !('mediaSession' in navigator)
    ) {
      return
    }

    const mediaSession =
      navigator.mediaSession

    const registerAction =
      (
        action,
        handler,
      ) => {
        try {
          mediaSession.setActionHandler(
            action,
            handler,
          )
        } catch {
          // Action not supported by this browser.
        }
      }

    const clearAction =
      (action) => {
        try {
          mediaSession.setActionHandler(
            action,
            null,
          )
        } catch {
          // Ignore unsupported actions.
        }
      }

    registerAction(
      'play',
      () => {
        void togglePlayRef.current?.()
      },
    )

    registerAction(
      'pause',
      () => {
        void togglePlayRef.current?.()
      },
    )

    registerAction(
      'nexttrack',
      () => {
        void nextTrackRef.current?.()
      },
    )

    registerAction(
      'previoustrack',
      () => {
        void previousTrackRef.current?.()
      },
    )

    registerAction(
      'seekbackward',
      (
        details,
      ) => {
        const current =
          getCurrentPlaybackTime()

        const offset =
          Number(
            details?.seekOffset,
          ) || 10

        seekToRef.current?.(
          Math.max(
            0,
            current - offset,
          ),
        )
      },
    )

    registerAction(
      'seekforward',
      (
        details,
      ) => {
        const current =
          getCurrentPlaybackTime()

        const offset =
          Number(
            details?.seekOffset,
          ) || 10

        seekToRef.current?.(
          current + offset,
        )
      },
    )

    registerAction(
      'seekto',
      (
        details,
      ) => {
        const seekTime =
          Number(
            details?.seekTime,
          )

        if (
          Number.isFinite(
            seekTime,
          )
        ) {
          seekToRef.current?.(
            seekTime,
          )
        }
      },
    )

    return () => {
      clearAction('play')
      clearAction('pause')
      clearAction('nexttrack')
      clearAction('previoustrack')
      clearAction('seekbackward')
      clearAction('seekforward')
      clearAction('seekto')
    }
  }, [
    getCurrentPlaybackTime,
  ])

  /*
   * ---------------------------------------------------------
   * RETURN PLAYER API
   * ---------------------------------------------------------
   */
  return {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    error,
    repeatMode,

    playTrack,
    togglePlay,
    seekTo,
    nextTrack,
    previousTrack,
    setRepeatMode,
    toggleRepeat,

    addToQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,


    veromePlayerContainerRef,
  }
}

export default useMusicPlayer