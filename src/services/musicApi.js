const API_BASE_URL = (
  import.meta.env?.VITE_JIOSAAVN_API_URL || 'http://localhost:3000'
).replace(/\/$/, '')

const SUPPORTED_PROVIDERS = new Set(['jiosaavn'])

export class MusicApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'MusicApiError'
    this.status = status
    this.code = code
  }
}

const validateProvider = (provider) => {
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new MusicApiError(`Unsupported music provider: ${provider}`, {
      code: 'UNSUPPORTED_PROVIDER',
    })
  }
}

const request = async (path) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    let payload

    try {
      payload = await response.json()
    } catch {
      throw new MusicApiError('JioSaavn API returned an invalid response', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      })
    }

    if (!response.ok) {
      throw new MusicApiError(
        payload?.message ||
          `Music request failed with status ${response.status}`,
        {
          status: response.status,
          code: payload?.code || 'REQUEST_FAILED',
        },
      )
    }

    return payload
  } catch (error) {
    if (error instanceof MusicApiError) {
      throw error
    }

    throw new MusicApiError('JioSaavn API is unavailable', {
      code: 'NETWORK_ERROR',
    })
  }
}

const getImage = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return null
  }

  return (
    images.find((image) => image?.quality === '500x500')?.url ||
    images.find((image) => image?.quality === '150x150')?.url ||
    images.find((image) => image?.url)?.url ||
    null
  )
}

const getArtistName = (song) => {
  const primaryArtists = song?.artists?.primary

  if (Array.isArray(primaryArtists) && primaryArtists.length > 0) {
    return primaryArtists
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(', ')
  }

  return 'Unknown artist'
}

const selectStreamUrl = (downloadUrl = []) => {
  if (!Array.isArray(downloadUrl)) {
    return null
  }

  const preferredQualities = [
    '320kbps',
    '160kbps',
    '96kbps',
    '48kbps',
    '12kbps',
  ]

  for (const quality of preferredQualities) {
    const match = downloadUrl.find(
      (item) => item?.quality === quality && item?.url,
    )

    if (match?.url) {
      return match.url
    }
  }

  return downloadUrl.find((item) => item?.url)?.url || null
}

const normalizeSong = (song) => {
  if (!song || typeof song !== 'object') {
    throw new MusicApiError('JioSaavn returned an invalid song', {
      code: 'INVALID_TRACK',
    })
  }

  const id = song.id != null ? String(song.id) : ''
  const title = song.name != null ? String(song.name) : ''

  if (!id || !title) {
    throw new MusicApiError('JioSaavn returned an invalid song', {
      code: 'INVALID_TRACK',
    })
  }

  const streamUrl = selectStreamUrl(song.downloadUrl)

  return {
    id,
    provider: 'jiosaavn',
    title,
    artist: getArtistName(song),
    album: song.album?.name || 'Unknown album',
    artwork: getImage(song.image),
    duration: Number(song.duration) || 0,
    playable: Boolean(streamUrl),
    streamUrl,
    url: song.url || null,
    year: song.year || null,
    language: song.language || null,
    explicitContent: Boolean(song.explicitContent),
  }
}

const normalizeAlbum = (album) => {
  if (!album || typeof album !== 'object') {
    throw new MusicApiError('JioSaavn returned an invalid album', {
      code: 'INVALID_ALBUM',
    })
  }

  const id = album.id != null ? String(album.id) : ''
  const title = album.title != null ? String(album.title) : ''

  if (!id || !title) {
    throw new MusicApiError('JioSaavn returned an invalid album', {
      code: 'INVALID_ALBUM',
    })
  }

  return {
    id,
    provider: 'jiosaavn',
    title,
    artist: album.artist || 'Unknown artist',
    artwork: getImage(album.image),
    url: album.url || null,
    type: album.type || 'album',
    description: album.description || null,
    year: album.year ? Number(album.year) : null,
    language: album.language || null,
    songIds: Array.isArray(album.songIds) ? album.songIds : [],
  }
}

/**
 * Search songs
 */
export const searchMusic = async (
  query,
  provider = 'jiosaavn',
  options = {},
) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new MusicApiError('A search query is required', {
      code: 'MISSING_QUERY',
    })
  }

  validateProvider(provider)

  const params = new URLSearchParams({
    query: query.trim(),
  })

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit))
  }

  if (options.page !== undefined) {
    params.set('page', String(options.page))
  }

  const payload = await request(
    `/api/search/songs?${params.toString()}`,
  )

  if (
    !payload ||
    payload.success !== true ||
    !payload.data ||
    !Array.isArray(payload.data.results)
  ) {
    throw new MusicApiError(
      'JioSaavn returned invalid song search results',
      {
        code: 'INVALID_SEARCH_RESPONSE',
      },
    )
  }

  return {
    provider: 'jiosaavn',
    query: query.trim(),
    results: payload.data.results.map(normalizeSong),
  }
}

/**
 * Search albums
 */
export const searchAlbums = async (
  query,
  provider = 'jiosaavn',
  options = {},
) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new MusicApiError('An album search query is required', {
      code: 'MISSING_QUERY',
    })
  }

  validateProvider(provider)

  const params = new URLSearchParams({
    query: query.trim(),
  })

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit))
  }

  if (options.page !== undefined) {
    params.set('page', String(options.page))
  }

  const payload = await request(
    `/api/search/albums?${params.toString()}`,
  )

  if (
    !payload ||
    payload.success !== true ||
    !payload.data ||
    !Array.isArray(payload.data.results)
  ) {
    throw new MusicApiError(
      'JioSaavn returned invalid album search results',
      {
        code: 'INVALID_ALBUM_SEARCH_RESPONSE',
      },
    )
  }

  return {
    provider: 'jiosaavn',
    query: query.trim(),
    total: Number(payload.data.total) || 0,
    start: Number(payload.data.start) || 0,
    results: payload.data.results.map(normalizeAlbum),
  }
}

/**
 * Get a single album by ID or JioSaavn link
 */
export const getAlbum = async (
  idOrLink,
  provider = 'jiosaavn',
) => {
  if (!idOrLink || typeof idOrLink !== 'string') {
    throw new MusicApiError('An album ID or link is required', {
      code: 'MISSING_ALBUM_ID',
    })
  }

  validateProvider(provider)

  const isLink = idOrLink.includes('jiosaavn.com/album/')

  const params = new URLSearchParams()

  if (isLink) {
    params.set('link', idOrLink)
  } else {
    params.set('id', idOrLink)
  }

  const payload = await request(`/api/albums?${params.toString()}`)

  if (
    !payload ||
    payload.success !== true ||
    !payload.data
  ) {
    throw new MusicApiError(
      'JioSaavn returned an invalid album',
      {
        code: 'INVALID_ALBUM_RESPONSE',
      },
    )
  }

  return {
    provider: 'jiosaavn',
    album: payload.data,
  }
}

/**
 * Get a single track
 */
export const getTrack = async (
  id,
  provider = 'jiosaavn',
) => {
  if (!id || typeof id !== 'string') {
    throw new MusicApiError('A track ID is required', {
      code: 'MISSING_TRACK_ID',
    })
  }

  validateProvider(provider)

  const payload = await request(
    `/api/songs/${encodeURIComponent(id)}`,
  )

  if (
    !payload ||
    payload.success !== true ||
    !payload.data
  ) {
    throw new MusicApiError(
      'JioSaavn returned an invalid track',
      {
        code: 'INVALID_TRACK_RESPONSE',
      },
    )
  }

  const song = Array.isArray(payload.data)
    ? payload.data[0]
    : payload.data

  if (!song) {
    throw new MusicApiError(
      'JioSaavn returned an empty track',
      {
        code: 'EMPTY_TRACK',
      },
    )
  }

  return {
    provider: 'jiosaavn',
    track: normalizeSong(song),
  }
}

/**
 * Get playable stream URL
 */
export const getStreamUrl = async (
  id,
  provider = 'jiosaavn',
) => {
  const { track } = await getTrack(id, provider)

  if (!track.streamUrl || track.playable !== true) {
    throw new MusicApiError(
      'Track is not playable',
      {
        code: 'TRACK_NOT_PLAYABLE',
      },
    )
  }

  return {
    provider: 'jiosaavn',
    trackId: id,
    streamUrl: track.streamUrl,
    playable: true,
  }
}

export const musicApi = {
  searchMusic,
  searchAlbums,
  getAlbum,
  getTrack,
  getStreamUrl,
}

export default musicApi