import { supabase } from '../services/supabase'

const MAX_ITEMS = 100

const sanitizeTrack = (track) => {
  if (
    !track ||
    track.id == null ||
    !track.provider
  ) {
    return null
  }

  const duration = Number(
    track.durationSeconds ?? track.duration,
  )

  return {
    id: String(track.id),
    provider: String(track.provider),
    title: track.title || 'Unknown title',
    artist: track.artist || null,
    album: track.album || null,
    artwork: track.artwork || null,
    duration:
      Number.isFinite(duration) && duration >= 0
        ? duration
        : 0,
    playable: track.playable !== false,
    streamUrl: track.streamUrl || null,
    url: track.url || null,
    year:
      track.year != null
        ? String(track.year)
        : null,
    language: track.language || null,
    explicitContent: Boolean(
      track.explicitContent,
    ),
  }
}

const rowToTrack = (row) => {
  if (!row) return null

  return {
    id: String(row.song_id),
    provider: row.provider || 'jiosaavn',
    title: row.title || 'Unknown title',
    artist: row.artist || null,
    album: row.album || null,
    artwork: row.artwork || null,
    duration: Number(row.duration) || 0,
    playable:
      row.playable !== false,
    streamUrl: row.stream_url || null,
    url: row.song_url || null,
    year: row.year || null,
    language: row.language || null,
    explicitContent:
      Boolean(row.explicit_content),
  }
}

const sameFavorite = (left, right) =>
  left?.provider === right?.provider &&
  String(left?.id) === String(right?.id)

export const readFavorites = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from('liked_songs')
    .select(
      `
        id,
        user_id,
        song_id,
        provider,
        title,
        artist,
        album,
        artwork,
        duration,
        stream_url,
        song_url,
        year,
        language,
        explicit_content,
        created_at
      `,
    )
    .eq('user_id', user.id)
    .order('created_at', {
      ascending: false,
    })
    .limit(MAX_ITEMS)

  if (error) {
    console.error(
      'Failed to load liked songs:',
      error,
    )
    return []
  }

  return (data || [])
    .map(rowToTrack)
    .filter(Boolean)
}

export const isFavorite = async (track) => {
  const item = sanitizeTrack(track)

  if (!item) {
    return false
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return false
  }

  const { data, error } = await supabase
    .from('liked_songs')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', item.provider)
    .eq('song_id', item.id)
    .maybeSingle()

  if (error) {
    console.error(
      'Failed to check liked song:',
      error,
    )
    return false
  }

  return Boolean(data)
}

export const addFavorite = async (track) => {
  const item = sanitizeTrack(track)

  if (!item) {
    return readFavorites()
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.warn(
      'Cannot like song without an authenticated user.',
    )

    return readFavorites()
  }

  const { error } = await supabase
    .from('liked_songs')
    .upsert(
      {
        user_id: user.id,
        song_id: item.id,
        provider: item.provider,
        title: item.title,
        artist: item.artist,
        album: item.album,
        artwork: item.artwork,
        duration: item.duration,
        stream_url: item.streamUrl,
        song_url: item.url,
        year: item.year,
        language: item.language,
        explicit_content: item.explicitContent,
      },
      {
        onConflict:
          'user_id,provider,song_id',
        ignoreDuplicates: true,
      },
    )

  if (error) {
    console.error(
      'Failed to like song:',
      error,
    )

    return readFavorites()
  }

  return readFavorites()
}

export const removeFavorite = async (track) => {
  const item = sanitizeTrack(track)

  if (!item) {
    return readFavorites()
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return readFavorites()
  }

  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', item.provider)
    .eq('song_id', item.id)

  if (error) {
    console.error(
      'Failed to unlike song:',
      error,
    )
  }

  return readFavorites()
}

export const toggleFavorite = async (track) => {
  const currentlyFavorite =
    await isFavorite(track)

  if (currentlyFavorite) {
    return removeFavorite(track)
  }

  return addFavorite(track)
}

export const clearFavorites = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return
  }

  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error(
      'Failed to clear liked songs:',
      error,
    )
  }
}

export { MAX_ITEMS }