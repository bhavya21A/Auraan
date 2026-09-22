import { useCallback, useEffect, useRef, useState } from 'react'
import { getStreamUrl } from '../services/musicApi'

const STORAGE_KEY = 'music_player_state'
const STORAGE_VERSION = 1

const isRealTrack = (track) => Boolean(track?.provider && track?.id)

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

const sanitizeTrack = (track) => {
  if (!isRealTrack(track)) return null

  return {
    ...track,
    id: String(track.id),
    provider: String(track.provider),
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || null,
    artwork: track.artwork || null,
    durationSeconds: Number(track.durationSeconds ?? track.duration) || 0,
    playable: track.playable !== false,
  }
}

const readPersistedState = () => {
  const storage = getStorage()
  if (!storage) return { track: null, queue: [], currentTime: 0 }

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '')
    if (parsed?.version !== STORAGE_VERSION) {
      return { track: null, queue: [], currentTime: 0 }
    }

    const track = sanitizeTrack(parsed.track)
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.map(sanitizeTrack).filter(Boolean)
      : []

    return {
      track,
      queue,
      currentTime:
        Number.isFinite(Number(parsed.currentTime)) && Number(parsed.currentTime) >= 0
          ? Number(parsed.currentTime)
          : 0,
    }
  } catch {
    return { track: null, queue: [], currentTime: 0 }
  }
}

const persistState = (track, queue, currentTime) => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        track: sanitizeTrack(track),
        queue: queue.map(sanitizeTrack).filter(Boolean),
        currentTime:
          Number.isFinite(Number(currentTime)) && Number(currentTime) >= 0
            ? Number(currentTime)
            : 0,
      }),
    )
  } catch {
    // Playback should continue even if browser storage is unavailable.
  }
}

export function useMusicPlayer(initialTrack = null) {
  const restoredStateRef = useRef(null)
  if (restoredStateRef.current === null) {
    restoredStateRef.current = readPersistedState()
  }

  const restoredState = restoredStateRef.current
  const initialRestoredTrack = initialTrack || restoredState.track
  const initialRestoredQueue = restoredState.queue.length
    ? restoredState.queue
    : initialRestoredTrack
      ? [initialRestoredTrack]
      : []

  const audioRef = useRef(null)
  const requestIdRef = useRef(0)
  const startTrackRef = useRef(null)
  const currentTrackRef = useRef(initialRestoredTrack)
  const queueRef = useRef(initialRestoredQueue)
  const streamCacheRef = useRef(new Map())
  const streamRequestsRef = useRef(new Map())
  const retryKeysRef = useRef(new Set())
  const restorePositionRef = useRef(restoredState.currentTime)

  const [currentTrack, setCurrentTrack] = useState(initialRestoredTrack)
  const [queue, setQueue] = useState(initialRestoredQueue)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(restoredState.currentTime)
  const [duration, setDuration] = useState(
    Number(initialRestoredTrack?.durationSeconds) || Number(initialRestoredTrack?.duration) || 0,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const handleLoadedMetadata = () => {
      if (!Number.isFinite(audio.duration)) return

      setDuration(audio.duration)

      const restorePosition = restorePositionRef.current
      if (restorePosition > 0 && currentTrackRef.current) {
        const nextTime = Math.min(restorePosition, audio.duration)
        audio.currentTime = nextTime
        setCurrentTime(nextTime)
        restorePositionRef.current = 0
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      persistState(currentTrackRef.current, queueRef.current, audio.currentTime)
    }

    const handlePlay = () => {
      setIsLoading(false)
      setIsPlaying(true)
      const track = currentTrackRef.current
      if (track) retryKeysRef.current.delete(`${track.provider}:${track.id}`)
    }

    const handlePause = () => {
      setIsPlaying(false)
      persistState(currentTrackRef.current, queueRef.current, audio.currentTime)
    }

    const handleWaiting = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    const handleEnded = () => {
      setIsPlaying(false)
      setIsLoading(false)
      setCurrentTime(0)
      audio.currentTime = 0
      persistState(currentTrackRef.current, queueRef.current, 0)

      const track = currentTrackRef.current
      const currentIndex = queueRef.current.findIndex(
        (item) => item.provider === track?.provider && item.id === track?.id,
      )
      const nextTrack = currentIndex >= 0 ? queueRef.current[currentIndex + 1] : null

      if (nextTrack) {
        void startTrackRef.current?.(nextTrack, true)
      }
    }

    const handleError = () => {
      const track = currentTrackRef.current
      const cacheKey = track ? `${track.provider}:${track.id}` : null

      if (
        track &&
        cacheKey &&
        streamCacheRef.current.has(cacheKey) &&
        !retryKeysRef.current.has(cacheKey)
      ) {
        retryKeysRef.current.add(cacheKey)
        streamCacheRef.current.delete(cacheKey)
        void startTrackRef.current?.(track, true, true)
        return
      }

      setIsPlaying(false)
      setIsLoading(false)
      setError('Unable to play this track.')
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    if (initialRestoredTrack) {
      persistState(initialRestoredTrack, initialRestoredQueue, restoredState.currentTime)
    }

    return () => {
      persistState(currentTrackRef.current, queueRef.current, audio.currentTime)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [initialRestoredQueue, initialRestoredTrack, restoredState.currentTime])

  const startTrack = useCallback(async (track, shouldPlay, forceRefresh = false) => {
    if (!isRealTrack(track)) return

    const audio = audioRef.current
    if (!audio) return

    const cacheKey = `${track.provider}:${track.id}`
    const currentKey = currentTrackRef.current
      ? `${currentTrackRef.current.provider}:${currentTrackRef.current.id}`
      : null
    const isRestoringSameTrack = currentKey === cacheKey && !audio.src && restorePositionRef.current > 0

    if (
      !forceRefresh &&
      currentKey === cacheKey &&
      (streamRequestsRef.current.has(cacheKey) || (audio.src && !audio.paused))
    ) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    audio.pause()
    currentTrackRef.current = track
    setCurrentTrack(track)
    setCurrentTime(isRestoringSameTrack ? restorePositionRef.current : 0)
    setDuration(Number(track.durationSeconds) || Number(track.duration) || 0)
    setError('')
    setIsLoading(true)
    setIsPlaying(false)

    if (!isRestoringSameTrack) {
      restorePositionRef.current = 0
      persistState(track, queueRef.current, 0)
    }

    try {
      let streamUrl = forceRefresh ? null : streamCacheRef.current.get(cacheKey)

      if (!streamUrl) {
        let streamRequest = streamRequestsRef.current.get(cacheKey)

        if (!streamRequest) {
          streamRequest = getStreamUrl(track.id, track.provider)
          streamRequestsRef.current.set(cacheKey, streamRequest)

          const clearRequest = () => {
            if (streamRequestsRef.current.get(cacheKey) === streamRequest) {
              streamRequestsRef.current.delete(cacheKey)
            }
          }

          streamRequest.then(clearRequest, clearRequest)
        }

        const response = await streamRequest
        streamUrl = response.streamUrl
        streamCacheRef.current.set(cacheKey, streamUrl)
      }

      if (requestId !== requestIdRef.current) return

      audio.src = streamUrl
      audio.load()

      if (shouldPlay) {
        await audio.play()
      } else {
        setIsLoading(false)
      }
    } catch {
      if (requestId !== requestIdRef.current) return

      setIsLoading(false)
      setIsPlaying(false)
      setError('Unable to play this track.')
      retryKeysRef.current.delete(`${track.provider}:${track.id}`)
    }
  }, [])

  const playTrack = async (track, additionalTracks = []) => {
    if (!isRealTrack(track)) return

    const uniqueTracks = [...queueRef.current, ...additionalTracks, track].filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.provider === item.provider && candidate.id === item.id,
        ) === index,
    )

    queueRef.current = uniqueTracks
    setQueue(uniqueTracks)
    restorePositionRef.current = 0
    persistState(track, uniqueTracks, 0)
    await startTrack(track, true)
  }

  useEffect(() => {
    startTrackRef.current = startTrack
  }, [startTrack])

  const togglePlay = async () => {
    const audio = audioRef.current

    if (!isRealTrack(currentTrack)) return

    if (!audio?.src) {
      await startTrack(currentTrack, true)
      return
    }

    if (audio.paused) {
      try {
        setError('')
        setIsLoading(true)
        await audio.play()
      } catch {
        setIsLoading(false)
        setError('Unable to play this track.')
      }
    } else {
      audio.pause()
    }
  }

  const nextTrack = async () => {
    const track = currentTrackRef.current
    const currentIndex = queueRef.current.findIndex(
      (item) => item.provider === track?.provider && item.id === track?.id,
    )
    const next = currentIndex >= 0 ? queueRef.current[currentIndex + 1] : null

    if (next) {
      await startTrack(next, true)
      return
    }

    const audio = audioRef.current
    audio?.pause()
    if (audio) audio.currentTime = 0
    setCurrentTime(0)
    setIsPlaying(false)
    persistState(currentTrackRef.current, queueRef.current, 0)
  }

  const previousTrack = async () => {
    const audio = audioRef.current

    if ((audio?.currentTime || currentTime) > 3) {
      seekTo(0)
      return
    }

    const track = currentTrackRef.current
    const currentIndex = queueRef.current.findIndex(
      (item) => item.provider === track?.provider && item.id === track?.id,
    )
    const previous = currentIndex > 0 ? queueRef.current[currentIndex - 1] : null

    if (previous) {
      await startTrack(previous, true)
      return
    }

    seekTo(0)
  }

  const seekTo = (value) => {
    const audio = audioRef.current
    const nextTime = Number(value)
    const targetDuration =
      Number.isFinite(audio?.duration) && audio.duration > 0
        ? audio.duration
        : duration

    if (
      !audio ||
      !Number.isFinite(nextTime) ||
      !Number.isFinite(targetDuration) ||
      targetDuration <= 0
    ) {
      return
    }

    audio.currentTime = Math.min(Math.max(nextTime, 0), targetDuration)
    setCurrentTime(audio.currentTime)
    persistState(currentTrackRef.current, queueRef.current, audio.currentTime)
  }

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
  }
}

export default useMusicPlayer
