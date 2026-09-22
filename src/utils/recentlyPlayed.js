const STORAGE_KEY = 'music_recently_played'
const STORAGE_VERSION = 1
const MAX_ITEMS = 20

const getStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

const sanitizeTrack = (track) => {
  if (!track || typeof track.id !== 'string' || !track.provider) return null

  const duration = Number(track.durationSeconds ?? track.duration)

  return {
    id: track.id,
    provider: track.provider,
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || null,
    artwork: track.artwork || null,
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    playable: track.playable !== false,
  }
}

const dedupe = (items) => items.filter((item, index, allItems) => (
  allItems.findIndex((candidate) => candidate.provider === item.provider && candidate.id === item.id) === index
))

export const readRecentlyPlayed = () => {
  const storage = getStorage()
  if (!storage) return []

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '')
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.items)) return []
    return dedupe(parsed.items.map(sanitizeTrack).filter(Boolean)).slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

export const addRecentlyPlayed = (track) => {
  const item = sanitizeTrack(track)
  if (!item || !item.playable) return readRecentlyPlayed()

  const items = [item, ...readRecentlyPlayed().filter((candidate) => (
    candidate.provider !== item.provider || candidate.id !== item.id
  ))].slice(0, MAX_ITEMS)
  const storage = getStorage()

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, items }))
    } catch {
      // Storage may be unavailable or full; playback must continue normally.
    }
  }

  return items
}

export const clearRecentlyPlayed = () => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures so clearing never interrupts playback.
  }
}

export { MAX_ITEMS, STORAGE_KEY }
