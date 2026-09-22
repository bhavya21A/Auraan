const STORAGE_KEY = 'musicapp_playlists'

function createId() {
  return `playlist-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function readPlaylists() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

function savePlaylists(playlists) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(playlists),
  )

  return playlists
}

export function createPlaylist(name) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return null
  }

  const playlists = readPlaylists()

  const playlist = {
    id: createId(),
    title: trimmedName,
    songs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  return savePlaylists([
    ...playlists,
    playlist,
  ]).at(-1)
}

export function addSongToPlaylist(
  playlistId,
  song,
) {
  if (!playlistId || !song) {
    return false
  }

  const playlists = readPlaylists()

  const playlistIndex = playlists.findIndex(
    (playlist) =>
      playlist.id === playlistId,
  )

  if (playlistIndex === -1) {
    return false
  }

  const playlist = playlists[playlistIndex]

  const alreadyExists = playlist.songs.some(
    (existingSong) =>
      existingSong.provider === song.provider &&
      existingSong.id === song.id,
  )

  if (alreadyExists) {
    return false
  }

  const updatedPlaylist = {
    ...playlist,
    songs: [
      ...playlist.songs,
      song,
    ],
    updatedAt: Date.now(),
  }

  const updatedPlaylists = [...playlists]

  updatedPlaylists[playlistIndex] =
    updatedPlaylist

  savePlaylists(updatedPlaylists)

  return true
}

export function removeSongFromPlaylist(
  playlistId,
  song,
) {
  const playlists = readPlaylists()

  const playlistIndex = playlists.findIndex(
    (playlist) =>
      playlist.id === playlistId,
  )

  if (playlistIndex === -1) {
    return false
  }

  const playlist = playlists[playlistIndex]

  const updatedPlaylist = {
    ...playlist,
    songs: playlist.songs.filter(
      (existingSong) =>
        !(
          existingSong.provider ===
            song.provider &&
          existingSong.id === song.id
        ),
    ),
    updatedAt: Date.now(),
  }

  const updatedPlaylists = [...playlists]

  updatedPlaylists[playlistIndex] =
    updatedPlaylist

  savePlaylists(updatedPlaylists)

  return true
}

export function deletePlaylist(
  playlistId,
) {
  const playlists = readPlaylists()

  const updatedPlaylists =
    playlists.filter(
      (playlist) =>
        playlist.id !== playlistId,
    )

  savePlaylists(updatedPlaylists)

  return updatedPlaylists
}