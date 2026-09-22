const STORAGE_KEY = 'music_favorites'
const STORAGE_VERSION = 1
const MAX_ITEMS = 100

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

const sameFavorite = (left, right) => left.provider === right.provider && left.id === right.id

const dedupe = (items) => items.filter((item, index, allItems) => (
  allItems.findIndex((candidate) => sameFavorite(candidate, item)) === index
))

export const readFavorites = () => {
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

export const isFavorite = (track) => {
  const item = sanitizeTrack(track)
  return Boolean(item && readFavorites().some((favorite) => sameFavorite(favorite, item)))
}

export const addFavorite = (track) => {
  const item = sanitizeTrack(track)
  if (!item) return readFavorites()

  const items = [item, ...readFavorites().filter((favorite) => !sameFavorite(favorite, item))].slice(0, MAX_ITEMS)
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

export const removeFavorite = (track) => {
  const item = sanitizeTrack(track)
  const items = item ? readFavorites().filter((favorite) => !sameFavorite(favorite, item)) : readFavorites()
  const storage = getStorage()

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, items }))
    } catch {
      // Ignore storage failures so unfavoriting never interrupts playback.
    }
  }

  return items
}

export const toggleFavorite = (track) => (isFavorite(track) ? removeFavorite(track) : addFavorite(track))

export const clearFavorites = () => {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures so clearing never interrupts playback.
  }
}

export { MAX_ITEMS, STORAGE_KEY }
