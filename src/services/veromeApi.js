const API_BASE_URL = (
  import.meta.env?.VITE_VEROME_API_URL ||
  'https://verome-api.auraan.deno.net'
).replace(/\/$/, '')

export class VeromeApiError extends Error {
  constructor(
    message,
    { status, code } = {},
  ) {
    super(message)
    this.name = 'VeromeApiError'
    this.status = status
    this.code = code
  }
}

const request = async (path) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    )

    const rawText =
      await response.text()

    let payload = null

    try {
      payload = rawText
        ? JSON.parse(rawText)
        : null
    } catch {
      throw new VeromeApiError(
        'Verome returned an invalid JSON response',
        {
          status: response.status,
          code: 'INVALID_JSON',
        },
      )
    }

    if (!response.ok) {
      throw new VeromeApiError(
        payload?.error ||
          `Verome request failed with status ${response.status}`,
        {
          status: response.status,
          code: 'HTTP_ERROR',
        },
      )
    }

    return payload
  } catch (error) {
    if (
      error instanceof
      VeromeApiError
    ) {
      throw error
    }

    throw new VeromeApiError(
      'Unable to reach Verome API',
      {
        code: 'NETWORK_ERROR',
      },
    )
  }
}

const getThumbnail = (
  item,
) => {
  if (
    !item ||
    typeof item !== 'object'
  ) {
    return null
  }

  if (item.thumbnail) {
    return item.thumbnail
  }

  if (
    Array.isArray(
      item.thumbnails,
    ) &&
    item.thumbnails.length
  ) {
    return (
      item.thumbnails.find(
        (item) => item?.url,
      )?.url || null
    )
  }

  return null
}

const getArtistNames = (
  artists,
) => {
  if (!Array.isArray(artists)) {
    return []
  }

  return artists
    .map((artist) => {
      if (
        typeof artist === 'string'
      ) {
        return artist
      }

      return (
        artist?.name || null
      )
    })
    .filter(Boolean)
}

const normalizeSearchResult = (
  result,
) => {
  if (
    !result ||
    typeof result !== 'object'
  ) {
    return null
  }

  const resultType =
    result.resultType || null

  if (
    resultType === 'artist' &&
    result.browseId
  ) {
    return {
      type: 'artist',
      provider: 'verome',
      id: String(
        result.browseId,
      ),
      name:
        result.title ||
        'Unknown artist',
      title:
        result.title ||
        'Unknown artist',
      artwork:
        getThumbnail(result),
      subtitle:
        result.subtitle || '',
    }
  }

  if (result.videoId) {
    return {
      type: 'song',
      provider: 'verome',
      id: String(
        result.videoId,
      ),
      playbackId: String(
        result.videoId,
      ),
      title:
        result.title ||
        'Unknown title',
      artist:
        getArtistNames(
          result.artists,
        ).join(', ') ||
        result.artist ||
        'Unknown artist',
      album:
        result.album?.name ||
        result.album ||
        null,
      artwork:
        getThumbnail(result),
      playable: true,
      duration:
        Number(
          result.duration,
        ) || 0,
      year:
        result.year || null,
      subtitle:
        result.subtitle || '',
    }
  }

  if (
    resultType === 'album' &&
    result.browseId
  ) {
    return {
      type: 'album',
      provider: 'verome',
      id: String(
        result.browseId,
      ),
      title:
        result.title ||
        'Unknown album',
      artist:
        result.artist ||
        result.artistName ||
        'Unknown artist',
      artwork:
        getThumbnail(result),
      year:
        result.year || null,
      subtitle:
        result.subtitle || '',
    }
  }

  return null
}

const normalizeArtistSong = (
  song,
  artistName,
) => {
  if (!song?.videoId) {
    return null
  }

  return {
    type: 'song',
    provider: 'verome',
    id: String(
      song.videoId,
    ),
    playbackId: String(
      song.videoId,
    ),
    title:
      song.title ||
      'Unknown title',
    artist:
      artistName ||
      'Unknown artist',
    album: null,
    artwork:
      song.thumbnail || null,
    playable: true,
    duration:
      Number(
        song.duration,
      ) || 0,
  }
}

const normalizeCollection = (
  item,
  type,
  artistName,
) => {
  if (!item?.browseId) {
    return null
  }

  return {
    type,
    provider: 'verome',
    id: String(
      item.browseId,
    ),
    title:
      item.title ||
      'Unknown title',
    artist:
      artistName ||
      item.artist ||
      'Unknown artist',
    artwork:
      item.thumbnail || null,
    year:
      item.year || null,
  }
}

export const searchVerome =
  async (query) => {
    if (
      !query ||
      typeof query !== 'string' ||
      !query.trim()
    ) {
      throw new VeromeApiError(
        'A search query is required',
        {
          code: 'MISSING_QUERY',
        },
      )
    }

    const normalizedQuery =
      query.trim()

    const payload =
      await request(
        `/api/search?q=${encodeURIComponent(
          normalizedQuery,
        )}`,
      )

    if (
      !payload ||
      !Array.isArray(
        payload.results,
      )
    ) {
      throw new VeromeApiError(
        'Verome returned invalid search results',
        {
          code:
            'INVALID_SEARCH_RESPONSE',
        },
      )
    }

    return {
      provider: 'verome',
      query:
        normalizedQuery,
      results:
        payload.results
          .map(
            normalizeSearchResult,
          )
          .filter(Boolean),
      continuationToken:
        payload.continuationToken ||
        null,
    }
  }

export const getVeromeArtist =
  async (browseId) => {
    if (
      !browseId ||
      typeof browseId !== 'string'
    ) {
      throw new VeromeApiError(
        'A Verome artist ID is required',
        {
          code:
            'MISSING_ARTIST_ID',
        },
      )
    }

    const payload =
      await request(
        `/api/artists/${encodeURIComponent(
          browseId,
        )}`,
      )

    if (
      !payload?.success ||
      !payload?.artist
    ) {
      throw new VeromeApiError(
        'Verome returned invalid artist data',
        {
          code:
            'INVALID_ARTIST_RESPONSE',
        },
      )
    }

    const artistName =
      payload.artist.name ||
      'Unknown artist'

    const topSongs =
      Array.isArray(
        payload.topSongs,
      )
        ? payload.topSongs
            .map(
              (song) =>
                normalizeArtistSong(
                  song,
                  artistName,
                ),
            )
            .filter(Boolean)
        : []

    const albums =
      Array.isArray(
        payload.albums,
      )
        ? payload.albums
            .map(
              (album) =>
                normalizeCollection(
                  album,
                  'album',
                  artistName,
                ),
            )
            .filter(Boolean)
        : []

    const singles =
      Array.isArray(
        payload.singles,
      )
        ? payload.singles
            .map(
              (single) =>
                normalizeCollection(
                  single,
                  'single',
                  artistName,
                ),
            )
            .filter(Boolean)
        : []

    return {
      provider: 'verome',
      artist: {
        id: String(
          payload.artist
            .browseId,
        ),
        provider: 'verome',
        name: artistName,
        description:
          payload.artist
            .description || '',
        artwork:
          payload.artist
            .thumbnail || null,
        subscribers:
          payload.artist
            .subscribers || null,
      },
      songs: topSongs,
      topSongs,
      albums,
      singles,
    }
  }

export default {
  searchVerome,
  getVeromeArtist,
}