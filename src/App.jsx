import { useEffect, useRef, useState } from 'react'
import AuthScreen from './components/auth/AuthScreen'
import { supabase } from './services/supabase'


import {
  ArrowLeft,
  Heart,
  ListMusic,
  MoreHorizontal,
  Trash2,
  Upload,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react'

import TopBar from './components/TopBar'
import DesktopSidebar from './components/DesktopSidebar'
import BottomNav from './components/BottomNav'
import MiniPlayer from './components/MiniPlayer'
import SectionHeader from './components/SectionHeader'
import SongRow from './components/SongRow'
import QueueSheet from './components/QueueSheet'
import QueuePanel from './components/QueuePanel'
import LyricsSheet from './components/LyricsSheet'
import ProgressBar from './components/ProgressBar'
import Artwork from './components/Artwork'

import { getAlbum, searchAlbums, searchMusic } from './services/musicApi'
import { getVeromeArtist, searchVerome } from './services/veromeApi'
import { useMusicPlayer } from './hooks/useMusicPlayer'

import {
  addRecentlyPlayed,
  clearRecentlyPlayed,
  readRecentlyPlayed,
} from './utils/recentlyPlayed'

// Favorites are persisted per authenticated user in Supabase.
// The `liked_songs` table is protected by RLS, so these queries only
// read/write the currently signed-in user's rows.

const DEFAULT_PROVIDER = 'jiosaavn'
const SEARCH_PAGE_SIZE = 20
const SEARCH_ALBUM_LIMIT = 20
const SEARCH_ALBUM_PAGES = 4

const sameTrack = (left, right) => {
  if (!left || !right) return false

  if (left.provider || right.provider) {
    return (
      left.provider === right.provider &&
      left.id === right.id
    )
  }

  return left.id === right.id
}

const trackKey = (track) =>
  `${track.provider || 'local'}:${track.id}`

const dedupeTracks = (tracks) =>
  tracks.filter(
    (track, index, allTracks) =>
      allTracks.findIndex(
        (candidate) =>
          trackKey(candidate) === trackKey(track),
      ) === index,
  )

const albumKey = (album) =>
  `${album?.provider || DEFAULT_PROVIDER}:${album?.id || normalizeSearchText(album?.title)}`

const dedupeAlbums = (albums) =>
  albums.filter(
    (album, index, allAlbums) =>
      allAlbums.findIndex(
        (candidate) => albumKey(candidate) === albumKey(album),
      ) === index,
  )

function parseTrackDuration(value) {
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

  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : 0
}

function formatTrackDuration(value) {
  const totalSeconds = parseTrackDuration(value)

  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '--:--'
  }

  return `${Math.floor(totalSeconds / 60)}:${Math.floor(
    totalSeconds % 60,
  )
    .toString()
    .padStart(2, '0')}`
}

function toUiSong(track) {
  const durationSeconds = parseTrackDuration(
    track.durationSeconds ?? track.duration,
  )

  return {
    ...track,
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || null,
    artwork: track.artwork || null,
    provider: track.provider || DEFAULT_PROVIDER,
    duration: formatTrackDuration(durationSeconds),
    durationSeconds,
    playable: track.playable !== false,
    cover: '',
  }
}

function normalizeSearchAlbum(album) {
  if (!album || typeof album !== 'object') return null

  const id =
    album.id != null
      ? String(album.id)
      : album.browseId != null
        ? String(album.browseId)
        : album.albumId != null
          ? String(album.albumId)
          : ''

  const title = String(
    album.title ||
      album.name ||
      album.albumName ||
      '',
  ).trim()

  if (!id || !title) return null

  const albumArtists = Array.isArray(album.artists)
    ? album.artists
        .map((artist) =>
          typeof artist === 'string'
            ? artist
            : artist?.name || '',
        )
        .filter(Boolean)
        .join(', ')
    : ''

  const artwork =
    album.artwork ||
    album.image ||
    album.cover ||
    album.coverImage ||
    album.thumbnail ||
    (Array.isArray(album.thumbnails)
      ? album.thumbnails.find((item) => item?.url)?.url
      : null) ||
    null

  const yearText = String(
    album.year ||
      album.releaseYear ||
      album.subtitle ||
      '',
  )

  const yearMatch = yearText.match(/\b(19|20)\d{2}\b/)

  const songCount =
    Number(
      album.songCount ??
        album.song_count ??
        album.trackCount ??
        album.track_count,
    ) ||
    (Array.isArray(album.tracks)
      ? album.tracks.length
      : 0)

  return {
    ...album,
    id,
    provider: album.provider || DEFAULT_PROVIDER,
    title,
    artist:
      album.artist ||
      album.artistName ||
      album.primaryArtist ||
      albumArtists ||
      'Unknown artist',
    artwork,
    year:
      album.year ||
      album.releaseYear ||
      yearMatch?.[0] ||
      null,
    songCount,
  }
}


function normalizeVeromeArtist(artist) {
  if (!artist || typeof artist !== 'object') return null

  const id =
    artist.id != null
      ? String(artist.id)
      : artist.browseId != null
        ? String(artist.browseId)
        : artist.artistId != null
          ? String(artist.artistId)
          : ''

  const name = String(
    artist.name ||
      artist.title ||
      artist.artistName ||
      '',
  ).trim()

  if (!id || !name) return null

  const artwork =
    artist.artwork ||
    artist.image ||
    artist.thumbnail ||
    (Array.isArray(artist.thumbnails)
      ? artist.thumbnails.find((item) => item?.url)?.url
      : null) ||
    null

  return {
    ...artist,
    id,
    provider: 'verome',
    name,
    artwork,
    subtitle:
      artist.subtitle ||
      artist.description ||
      '',
    description:
      artist.description ||
      '',
    subscribers:
      artist.subscribers ||
      artist.monthlyAudience ||
      '',
  }
}

function normalizeVeromeSong(track) {
  if (!track || typeof track !== 'object') return null

  const rawId =
    track.videoId ??
    track.id ??
    track.browseId ??
    ''

  const id = String(rawId || '').trim()

  const title = String(
    track.title ||
      track.name ||
      track.trackName ||
      '',
  ).trim()

  const artistEntries = Array.isArray(track.artists)
    ? track.artists
        .map((artist) => {
          if (typeof artist === 'string') {
            return {
              name: artist,
              id: '',
            }
          }

          return {
            name:
              artist?.name ||
              artist?.title ||
              '',
            id:
              artist?.id ||
              artist?.browseId ||
              '',
          }
        })
        .filter((artist) => artist.name)
    : []

  const primaryArtist = artistEntries[0] || null

  const artist = String(
    typeof track.artist === 'string'
      ? track.artist
      : track.artist?.name ||
          track.artist?.title ||
          primaryArtist?.name ||
          '',
  ).trim()

  const album =
    typeof track.album === 'string'
      ? track.album
      : track.album?.name ||
        track.album?.title ||
        track.albumName ||
        null

  const albumId =
    track.album?.id != null
      ? String(track.album.id)
      : track.album?.browseId != null
        ? String(track.album.browseId)
        : track.albumId != null
          ? String(track.albumId)
          : ''

  const artwork =
    track.artwork ||
    track.image ||
    track.thumbnail ||
    (Array.isArray(track.thumbnails)
      ? track.thumbnails.find((item) => item?.url)?.url
      : null) ||
    null

  const duration =
    track.duration ??
    track.duration_seconds ??
    track.durationSeconds ??
    0

  if (!id || !title) return null

  return {
    ...track,
    id,
    playbackId: String(track.videoId || id),
    provider: 'verome',
    title,
    artist: artist || 'Unknown artist',
    artistId: primaryArtist?.id
      ? String(primaryArtist.id)
      : '',
    album,
    albumId: albumId || null,
    albumUrl:
      track.album?.url ||
      track.albumUrl ||
      null,
    artwork,
    duration,
    durationSeconds: parseTrackDuration(duration),
    playable:
      Boolean(track.videoId || id) &&
      track.isAvailable !== false &&
      track.playable !== false,
  }
}

const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const albumMatchesSearch = (album, query, songs = []) => {
  if (!album?.title) return false

  const albumTitle = normalizeSearchText(album.title)
  const normalizedQuery = normalizeSearchText(query)

  if (
    albumTitle &&
    (albumTitle === normalizedQuery ||
      albumTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(albumTitle))
  ) {
    return true
  }

  return songs.some(
    (song) =>
      normalizeSearchText(song.album) === albumTitle,
  )
}

function formatTime(value) {
  const numericValue = Number(value)

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    return '0:00'
  }

  const totalSeconds = Math.floor(numericValue)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds
    .toString()
    .padStart(2, '0')}`
}

const likedSongFromRow = (row) => ({
  id: String(row.song_id),
  provider: row.provider || DEFAULT_PROVIDER,
  title: row.title || 'Unknown title',
  artist: row.artist || 'Unknown artist',
  album: row.album || null,
  artwork: row.artwork || null,
  duration: Number(row.duration) || 0,
  streamUrl: row.stream_url || null,
  url: row.song_url || null,
  year: row.year || null,
  language: row.language || null,
  explicitContent: Boolean(row.explicit_content),
  playable: Boolean(row.stream_url),
})

const favoriteRowFromTrack = (track, userId) => ({
  user_id: userId,
  song_id: String(track.id),
  provider: track.provider || DEFAULT_PROVIDER,
  title: track.title || 'Unknown title',
  artist: track.artist || null,
  album: track.album || null,
  artwork: track.artwork || null,
  duration:
    Number(track.durationSeconds ?? track.duration) || 0,
  stream_url: track.streamUrl || null,
  song_url: track.url || null,
  year: track.year || null,
  language: track.language || null,
  explicit_content: Boolean(track.explicitContent),
})

const historySongFromRow = (row) => ({
  id: String(row.song_id),
  provider: row.provider || DEFAULT_PROVIDER,
  title: row.title || 'Unknown title',
  artist: row.artist || 'Unknown artist',
  album: row.album || null,
  artwork: row.artwork || null,
  duration: Number(row.duration) || 0,
  streamUrl: row.stream_url || null,
  url: row.song_url || null,
  year: row.year || null,
  language: row.language || null,
  explicitContent: Boolean(row.explicit_content),
  playable: Boolean(row.stream_url),
  playedAt: row.played_at || null,
})

const historyRowFromTrack = (track, userId) => ({
  user_id: userId,
  song_id: String(track.id),
  provider: track.provider || DEFAULT_PROVIDER,
  title: track.title || 'Unknown title',
  artist: track.artist || null,
  album: track.album || null,
  artwork: track.artwork || null,
  duration:
    Number(track.durationSeconds ?? track.duration) || 0,
  stream_url: track.streamUrl || null,
  song_url: track.url || null,
  year: track.year || null,
  language: track.language || null,
  explicit_content: Boolean(track.explicitContent),
})



const playlistSongRowFromTrack = (track, playlistId, userId) => ({
  playlist_id: playlistId,
  user_id: userId,
  song_id: String(track.id),
  provider: track.provider || DEFAULT_PROVIDER,
  title: track.title || 'Unknown title',
  artist: track.artist || null,
  album: track.album || null,
  artwork: track.artwork || null,
  duration: Number.isFinite(Number(track.durationSeconds ?? track.duration))
    ? Number(track.durationSeconds ?? track.duration)
    : 0,
  stream_url: track.streamUrl || track.stream_url || null,
  song_url: track.songUrl || track.song_url || null,
  year: track.year || null,
  language: track.language || null,
  explicit_content:
    typeof track.explicitContent === 'boolean'
      ? track.explicitContent
      : typeof track.explicit_content === 'boolean'
        ? track.explicit_content
        : null,
})

const playlistSongFromRow = (row) => ({
  id: row.song_id,
  provider: row.provider || DEFAULT_PROVIDER,
  title: row.title || 'Unknown title',
  artist: row.artist || 'Unknown artist',
  album: row.album || null,
  artwork: row.artwork || null,
  duration: Number(row.duration) || 0,
  durationSeconds: Number(row.duration) || 0,
  streamUrl: row.stream_url || null,
  stream_url: row.stream_url || null,
  songUrl: row.song_url || null,
  song_url: row.song_url || null,
  year: row.year || null,
  language: row.language || null,
  explicitContent: row.explicit_content ?? false,
  playable: Boolean(row.stream_url || row.song_url),
})

function App() {
  const [activeTab, setActiveTab] = useState('Home')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  /*
   * Currently opened playlist from the sidebar/library.
   * We keep the playlist object in state so the Playlist screen
   * knows exactly which playlist the user selected.
   */
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)

  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)

  const [isQueueOpen, setQueueOpen] = useState(false)
  const [isLyricsOpen, setIsLyricsOpen] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [showSearchSheet, setShowSearchSheet] =
    useState(false)

  const [searchResults, setSearchResults] = useState([])
  const [searchVeromeArtistResults, setSearchVeromeArtistResults] = useState([])
  const [searchFilter, setSearchFilter] = useState('All')
  const [searchAlbum, setSearchAlbum] = useState(null)
  const [searchAlbumResults, setSearchAlbumResults] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedAlbumSongs, setSelectedAlbumSongs] = useState([])
  const [albumStatus, setAlbumStatus] = useState('idle')
  const [albumError, setAlbumError] = useState('')
  const [selectedArtist, setSelectedArtist] = useState(null)
  const [selectedArtistSongs, setSelectedArtistSongs] = useState([])
  const [selectedArtistAlbums, setSelectedArtistAlbums] = useState([])
  const [selectedArtistSingles, setSelectedArtistSingles] = useState([])
  const [artistStatus, setArtistStatus] = useState('idle')
  const [artistError, setArtistError] = useState('')
  const [searchStatus, setSearchStatus] =
    useState('idle')
  const [searchError, setSearchError] = useState('')
  const [submittedQuery, setSubmittedQuery] =
    useState('')

  const [isLoadingMore, setIsLoadingMore] =
    useState(false)
  const [loadMoreError, setLoadMoreError] =
    useState('')
  const [hasMoreResults, setHasMoreResults] =
    useState(false)

  const [recentlyPlayed, setRecentlyPlayed] = useState([])
  const [listeningHistory, setListeningHistory] = useState([])

  const [favorites, setFavorites] = useState([])

  /*
   * Persistent playlists
   */
  const [playlists, setPlaylists] = useState([])

  /*
   * Playlist modal
   *
   * mode:
   * - create
   * - add
   */
  const [playlistModal, setPlaylistModal] =
    useState({
      open: false,
      mode: null,
      song: null,
    })

  const [playlistName, setPlaylistName] =
    useState('')

  const [playlistDescription, setPlaylistDescription] =
    useState('')

  const [playlistError, setPlaylistError] =
    useState('')

  const [playlistCoverUploading, setPlaylistCoverUploading] =
    useState(false)

  const [playlistDialog, setPlaylistDialog] = useState({
    open: false,
    mode: null,
    playlist: null,
  })

  const searchRequestIdRef = useRef(0)
  const artistRequestIdRef = useRef(0)
  const lastSearchQueryRef = useRef('')
  const lastRecordedTrackRef = useRef('')
  const lastRecordedHistoryRef = useRef('')
  const searchInputRef = useRef(null)
  const playlistCoverInputRef = useRef(null)

  const {
    currentTrack: playingTrack,
    queue: playerQueue,
    isPlaying,
    currentTime,
    duration: playerDuration,
    isLoading: playerLoading,
    error: playerError,
    playTrack,
    togglePlay,
    seekTo,
    nextTrack: nextPlayerTrack,
    previousTrack: previousPlayerTrack,
    veromePlayerContainerRef,
  } = useMusicPlayer()

  const currentSong =
    playingTrack || recentlyPlayed[0] || null

  /*
   * Record a real playable track when it actually starts playing.
   *
   * Recently Played and Supabase Listening History are deliberately
   * tracked separately. This is important because the authenticated
   * user can finish loading after playback has already started. The old
   * implementation marked the track as recorded before checking user.id,
   * which meant the later authenticated render skipped the Supabase insert.
   */
  useEffect(() => {
    if (
      !playingTrack ||
      !isPlaying ||
      playingTrack.playable === false
    ) {
      return
    }

    const key = trackKey(playingTrack)

    // Keep the existing local Recently Played behaviour.
    if (lastRecordedTrackRef.current !== key) {
      lastRecordedTrackRef.current = key

      setRecentlyPlayed(
        addRecentlyPlayed(playingTrack).map(toUiSong),
      )
    }

    // Supabase history must wait until the authenticated user exists.
    // Do NOT mark it as history-recorded before this check.
    if (!user?.id || !playingTrack.id || !playingTrack.provider) {
      return
    }

    const historyKey = `${user.id}:${key}`

    if (lastRecordedHistoryRef.current === historyKey) {
      return
    }

    // Mark it as pending so rapid renders cannot create duplicate rows.
    lastRecordedHistoryRef.current = historyKey

    const saveListeningHistory = async () => {
      const row = historyRowFromTrack(playingTrack, user.id)

      console.log('HISTORY: attempting insert', row)

      const { data, error } = await supabase
        .from('listening_history')
        .insert(row)
        .select(
          'id, song_id, provider, title, artist, album, artwork, duration, stream_url, song_url, year, language, explicit_content, played_at',
        )
        .maybeSingle()

      console.log('HISTORY: Supabase response', {
        data,
        error,
      })

      if (error) {
        console.error(
          'Failed to save listening history:',
          error,
        )

        // Allow a retry if the database operation failed.
        if (lastRecordedHistoryRef.current === historyKey) {
          lastRecordedHistoryRef.current = ''
        }

        return
      }

      if (data) {
        setListeningHistory((current) => {
          const nextSong = toUiSong(historySongFromRow(data))

          return [
            nextSong,
            ...current.filter(
              (item) => item.id !== nextSong.id || item.provider !== nextSong.provider,
            ),
          ]
        })
      } else {
        // The insert succeeded, but no row was returned. Keep the
        // authenticated history marker so we don't duplicate the row.
        console.log('HISTORY: insert succeeded without returned row')
      }
    }

    void saveListeningHistory()
  }, [playingTrack, isPlaying, user?.id])

  /*
   * Authentication / session
   *
   * AuthScreen handles email/password and Google sign-in.
   * This component owns the session so the existing music UI only
   * renders after Supabase confirms that a user is authenticated.
   */
  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error('Supabase session error:', error)
      }

      setUser(session?.user ?? null)
      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setAuthLoading(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /*
   * Load authenticated user's music state.
   *
   * Recently played remains local; playlists are persisted in Supabase.
   * Liked songs are now persisted in Supabase per user.
   */
  const loadPlaylistsForUser = async (userId) => {
    if (!userId) {
      setPlaylists([])
      setSelectedPlaylist(null)
      return
    }

    const { data: playlistRows, error: playlistError } = await supabase
      .from('playlists')
      .select('id, user_id, name, description, cover_url, is_public, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (playlistError) {
      console.error('Failed to load playlists:', playlistError)
      setPlaylists([])
      setSelectedPlaylist(null)
      return
    }

    const { data: songRows, error: songError } = await supabase
      .from('playlist_songs')
      .select('id, playlist_id, user_id, song_id, provider, title, artist, album, artwork, duration, stream_url, song_url, year, language, explicit_content, added_at')
      .eq('user_id', userId)
      .order('added_at', { ascending: true })

    if (songError) {
      console.error('Failed to load playlist songs:', songError)
    }

    const songsByPlaylist = new Map()

    for (const row of songRows || []) {
      const key = String(row.playlist_id)
      const songs = songsByPlaylist.get(key) || []
      songs.push(playlistSongFromRow(row))
      songsByPlaylist.set(key, songs)
    }

    const nextPlaylists = (playlistRows || []).map((row) => ({
      ...row,
      title: row.name,
      name: row.name,
      // Keep the database field and provide the common cover aliases
      // used by playlist surfaces so the desktop sidebar can render
      // the same hosted cover as the Library and Edit Playlist views.
      cover_url: row.cover_url || null,
      cover: row.cover_url || null,
      coverUrl: row.cover_url || null,
      artwork: row.cover_url || null,
      image: row.cover_url || null,
      thumbnail: row.cover_url || null,
      songs: songsByPlaylist.get(String(row.id)) || [],
      totalSongs: (songsByPlaylist.get(String(row.id)) || []).length,
    }))

    setPlaylists(nextPlaylists)

    setSelectedPlaylist((current) => {
      if (!current?.id) return null
      return nextPlaylists.find((item) => item.id === current.id) || null
    })

    return nextPlaylists
  }

  useEffect(() => {
    let cancelled = false

    const loadUserMusicState = async () => {
      if (!user) {
        setRecentlyPlayed([])
        setListeningHistory([])
        setFavorites([])
        setPlaylists([])
        setSelectedPlaylist(null)
        setSelectedAlbum(null)
        setSelectedAlbumSongs([])
        setAlbumStatus('idle')
        setAlbumError('')
        setSearchAlbum(null)
        setSearchAlbumResults([])
        return
      }

      setRecentlyPlayed(readRecentlyPlayed().map(toUiSong))
      await loadPlaylistsForUser(user.id)

      const { data: historyData, error: historyError } =
        await supabase
          .from('listening_history')
          .select(
            'id, song_id, provider, title, artist, album, artwork, duration, stream_url, song_url, year, language, explicit_content, played_at',
          )
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(100)

      if (cancelled) return

      if (historyError) {
        console.error(
          'Failed to load listening history:',
          historyError,
        )
        setListeningHistory([])
      } else {
        setListeningHistory(
          (historyData || [])
            .map(historySongFromRow)
            .map(toUiSong),
        )
      }

      const { data, error } = await supabase
        .from('liked_songs')
        .select(
          'song_id, provider, title, artist, album, artwork, duration, stream_url, song_url, year, language, explicit_content, created_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('Failed to load liked songs:', error)
        setFavorites([])
        return
      }

      setFavorites(
        (data || [])
          .map(likedSongFromRow)
          .map(toUiSong),
      )
    }

    void loadUserMusicState()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleSignOut = async () => {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Supabase sign out failed:', error)
      return
    }

    // Immediately clear the local authenticated state.
    // onAuthStateChange will also receive SIGNED_OUT.
    setUser(null)

    // Reset app state.
    setActiveTab('Home')
    setSelectedPlaylist(null)
    setSelectedAlbum(null)
    setSelectedAlbumSongs([])
    setAlbumStatus('idle')
    setAlbumError('')
    setSearchText('')
    setSearchResults([])
    setSearchVeromeArtistResults([])
    setSearchFilter('All')
    setSearchAlbum(null)
    setSearchAlbumResults([])
    setSelectedAlbum(null)
    setSelectedAlbumSongs([])
    setAlbumStatus('idle')
    setAlbumError('')
    setSelectedArtist(null)
    setSelectedArtistSongs([])
    setSelectedArtistAlbums([])
    setSelectedArtistSingles([])
    setArtistStatus('idle')
    setArtistError('')
    setSearchStatus('idle')
    setSearchError('')
    setSubmittedQuery('')
    setIsLoadingMore(false)
    setLoadMoreError('')
    setHasMoreResults(false)
    setRecentlyPlayed([])
    setListeningHistory([])
    setFavorites([])
    setPlaylists([])
    setPlaylistModal({
      open: false,
      mode: null,
      song: null,
    })
    setPlaylistName('')
    setPlaylistError('')
    setQueueOpen(false)
    setIsLyricsOpen(false)
  } catch (error) {
    console.error('Sign out failed:', error)
  }
}

  const profileName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'
  useEffect(() => {
    if (activeTab !== 'Browse') return

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeTab])


  /*
   * Search
   */
  const handleSearch = async () => {
    const query = searchText.trim()
    const normalizedQuery = query.replace(/\s+/g, ' ')

    if (!normalizedQuery) {
      searchRequestIdRef.current += 1
      artistRequestIdRef.current += 1
      lastSearchQueryRef.current = ''

      setSearchResults([])
      setSearchVeromeArtistResults([])
      setSearchFilter('All')
      setSearchAlbum(null)
      setSearchAlbumResults([])
      setSelectedAlbum(null)
      setSelectedAlbumSongs([])
      setAlbumStatus('idle')
      setAlbumError('')
      setSelectedArtist(null)
      setSelectedArtistSongs([])
      setSelectedArtistAlbums([])
      setSelectedArtistSingles([])
      setArtistStatus('idle')
      setArtistError('')
      setSearchStatus('idle')
      setSearchError('')
      setSubmittedQuery('')
      setIsLoadingMore(false)
      setLoadMoreError('')
      setHasMoreResults(false)

      return
    }

    if (
      lastSearchQueryRef.current ===
        normalizedQuery &&
      searchStatus !== 'error'
    ) {
      return
    }

    const requestId =
      searchRequestIdRef.current + 1

    searchRequestIdRef.current = requestId
    lastSearchQueryRef.current = normalizedQuery

    setActiveTab('Browse')
    setShowSearchSheet(false)
    setSearchStatus('loading')
    setSearchError('')
    setSubmittedQuery(normalizedQuery)
    setSearchVeromeArtistResults([])
    setSearchFilter('All')
    setSearchAlbum(null)
    setSearchAlbumResults([])
    setSelectedAlbum(null)
    setSelectedAlbumSongs([])
    setAlbumStatus('idle')
    setAlbumError('')
    setSelectedArtist(null)
    setSelectedArtistSongs([])
    setSelectedArtistAlbums([])
    setSelectedArtistSingles([])
    setArtistStatus('idle')
    setArtistError('')
    setIsLoadingMore(false)
    setLoadMoreError('')
    setHasMoreResults(false)

    try {
      const [
        songsResult,
        albumPagesResult,
        veromeResult,
      ] = await Promise.allSettled([
        searchMusic(
          normalizedQuery,
          DEFAULT_PROVIDER,
          {
            limit: SEARCH_PAGE_SIZE,
          },
        ),
        Promise.all(
          Array.from(
            { length: SEARCH_ALBUM_PAGES },
            (_, index) =>
              searchAlbums(
                normalizedQuery,
                DEFAULT_PROVIDER,
                {
                  limit: SEARCH_ALBUM_LIMIT,
                  page: index + 1,
                },
              ).catch(() => null),
          ),
        ),
        searchVerome(normalizedQuery),
      ])

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      const songsResponse =
        songsResult.status === 'fulfilled'
          ? songsResult.value
          : null

      const albumPageResponses =
        albumPagesResult.status === 'fulfilled'
          ? albumPagesResult.value
          : []

      const veromeResponse =
        veromeResult.status === 'fulfilled'
          ? veromeResult.value
          : null

      const jioTracks = Array.isArray(
        songsResponse?.results,
      )
        ? songsResponse.results
        : []

      const veromeSearchResults =
        Array.isArray(veromeResponse?.results)
          ? veromeResponse.results
          : []

      const veromeSongResults =
        veromeSearchResults.filter(
          (result) =>
            result?.type === 'song' ||
            result?.resultType === 'song',
        )

      const veromeArtistResults =
        veromeSearchResults
          .filter(
            (result) =>
              result?.type === 'artist' ||
              result?.resultType === 'artist',
          )
          .map(normalizeVeromeArtist)
          .filter(Boolean)

      /*
       * Verome search can return an artist as the top result instead
       * of returning the artist's songs directly. When that happens,
       * load that artist's browse data so the normal Browse Songs and
       * Albums tabs also contain the artist's real Verome content.
       *
       * Limit automatic artist expansion to the first three artist
       * results so one broad search cannot create an excessive number
       * of follow-up API requests.
       */
      const veromeArtistDetails =
        await Promise.all(
          veromeArtistResults
            .slice(0, 3)
            .map(async (artist) => {
              try {
                return await getVeromeArtist(
                  String(artist.id),
                )
              } catch (error) {
                console.warn(
                  'Verome artist expansion failed:',
                  artist?.name,
                  error,
                )
                return null
              }
            }),
        )

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      const veromeArtistSongResults =
        veromeArtistDetails.flatMap(
          (detail) =>
            Array.isArray(detail?.songs)
              ? detail.songs
              : [],
        )

      const veromeTracks = dedupeTracks(
        [
          ...veromeSongResults
            .map(normalizeVeromeSong)
            .filter(Boolean),
          ...veromeArtistSongResults
            .map(normalizeVeromeSong)
            .filter(Boolean),
        ],
      ).filter(
        (track) =>
          track?.playable !== false &&
          Boolean(track?.playbackId),
      )

      const veromeArtistAlbumResults =
        veromeArtistDetails.flatMap(
          (detail) => {
            const artistName =
              detail?.artist?.name ||
              'Unknown artist'

            const rawAlbums =
              Array.isArray(detail?.albums)
                ? detail.albums
                : Array.isArray(detail?.artist?.albums)
                  ? detail.artist.albums
                  : []

            return rawAlbums
              .map((album) =>
                normalizeSearchAlbum({
                  ...album,
                  provider:
                    album?.provider ||
                    'verome',
                  artist:
                    album?.artist ||
                    artistName,
                }),
              )
              .filter(Boolean)
          },
        )

      /*
       * Verome is the primary song source. Keep the song list
       * exclusively on Verome whenever at least one usable Verome
       * track is available. JioSaavn is only a fallback when Verome
       * has no usable songs for this search.
       */
      const results =
        veromeTracks.length > 0
          ? veromeTracks
          : dedupeTracks(
              jioTracks.map(toUiSong),
            )

      const albumResults = dedupeAlbums(
        albumPageResponses
          .flatMap((response) =>
            Array.isArray(response?.results)
              ? response.results
              : [],
          )
          .map(normalizeSearchAlbum)
          .filter(Boolean),
      )

      const veromeSearchAlbums =
        veromeSearchResults
          .filter(
            (result) =>
              result?.type === 'album' ||
              result?.resultType === 'album',
          )
          .map((result) =>
            normalizeSearchAlbum({
              ...result,
              provider:
                result.provider ||
                'verome',
            }),
          )
          .filter(Boolean)

      /*
       * JioSaavn's album-search endpoint can sometimes return fewer
       * albums than the song search exposes. Build additional album
       * cards from the unique album metadata already present in the
       * JioSaavn song results.
       */
      const songDerivedAlbums = dedupeAlbums(
        results
          .filter(
            (song) =>
              song?.provider ===
                DEFAULT_PROVIDER &&
              song?.album,
          )
          .map((song) => ({
            id: song.albumId
              ? String(song.albumId)
              : `derived-album-${encodeURIComponent(song.album)}`,
            provider: DEFAULT_PROVIDER,
            title: song.album,
            artist:
              song.artist ||
              'Unknown artist',
            artwork:
              song.artwork || null,
            year: song.year || null,
            songCount: results.filter(
              (candidate) =>
                candidate?.provider ===
                  DEFAULT_PROVIDER &&
                normalizeSearchText(
                  candidate.album,
                ) ===
                  normalizeSearchText(
                    song.album,
                  ),
            ).length,
            url: song.albumUrl || null,
            isDerived:
              !song.albumId &&
              !song.albumUrl,
          })),
      )

      const finalAlbums = dedupeAlbums([
        ...veromeSearchAlbums,
        ...veromeArtistAlbumResults,
        ...albumResults,
        ...songDerivedAlbums,
      ])

      setSearchVeromeArtistResults(
        veromeArtistResults,
      )
      setSearchAlbumResults(
        finalAlbums,
      )
      setSearchAlbum(
        finalAlbums[0] || null,
      )
      setSearchResults(results)
      setSearchFilter('All')

      const hasAnyResults =
        results.length > 0 ||
        finalAlbums.length > 0 ||
        veromeArtistResults.length > 0

      const bothProvidersFailed =
        songsResult.status === 'rejected' &&
        veromeResult.status === 'rejected'

      if (bothProvidersFailed) {
        setSearchStatus('error')
        setSearchError(
          'Unable to load music right now.',
        )
      } else {
        setSearchStatus(
          hasAnyResults
            ? 'success'
            : 'empty',
        )
      }

      setHasMoreResults(
        veromeTracks.length === 0 &&
          songsResult.status === 'fulfilled' &&
          jioTracks.length >=
            SEARCH_PAGE_SIZE,
      )
    } catch {
      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      setSearchStatus('error')
      setSearchError(
        'Unable to load music right now.',
      )
    }
  }



  /*
   * Load more search results.
   */
  const handleLoadMore = async () => {
    if (
      !submittedQuery ||
      isLoadingMore ||
      !hasMoreResults
    ) {
      return
    }

    // JioSaavn pagination is only allowed while we are using the
    // JioSaavn fallback. Never append JioSaavn tracks to a Verome
    // result set.
    if (
      searchResults.some(
        (track) =>
          track?.provider === 'verome',
      )
    ) {
      return
    }

    const requestId =
      searchRequestIdRef.current + 1

    searchRequestIdRef.current = requestId

    setIsLoadingMore(true)
    setLoadMoreError('')

    try {
      const currentJioTrackCount =
        searchResults.filter(
          (track) =>
            track?.provider ===
            DEFAULT_PROVIDER,
        ).length

      const nextLimit =
        currentJioTrackCount +
        SEARCH_PAGE_SIZE

      const response = await searchMusic(
        submittedQuery,
        DEFAULT_PROVIDER,
        {
          limit: nextLimit,
        },
      )

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      const existingKeys = new Set(
        searchResults.map(trackKey),
      )

      const newTracks = dedupeTracks(
        response.results.map(toUiSong),
      ).filter(
        (track) =>
          !existingKeys.has(trackKey(track)),
      )

      setSearchResults((currentResults) =>
        dedupeTracks([
          ...currentResults,
          ...newTracks,
        ]),
      )

      setHasMoreResults(
        response.results.length >=
          nextLimit &&
          newTracks.length > 0,
      )
    } catch {
      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      setLoadMoreError(
        'Unable to load more tracks.',
      )
    } finally {
      if (
        requestId ===
        searchRequestIdRef.current
      ) {
        setIsLoadingMore(false)
      }
    }
  }

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    handleSearch()
  }

  const handleClearSearch = () => {
    setSearchText('')

    searchRequestIdRef.current += 1
    artistRequestIdRef.current += 1
    lastSearchQueryRef.current = ''

    setSearchResults([])
    setSearchVeromeArtistResults([])
    setSearchFilter('All')
    setSearchStatus('idle')
    setSearchError('')
    setSubmittedQuery('')
    setSearchAlbum(null)
    setSearchAlbumResults([])
    setSelectedAlbum(null)
    setSelectedAlbumSongs([])
    setAlbumStatus('idle')
    setAlbumError('')
    setSelectedArtist(null)
    setSelectedArtistSongs([])
    setSelectedArtistAlbums([])
    setSelectedArtistSingles([])
    setArtistStatus('idle')
    setArtistError('')
    setLoadMoreError('')
    setHasMoreResults(false)
  }

  /*
   * Open search.
   */
  const handleOpenSearch = () => {
    const isDesktop =
      window.matchMedia(
        '(min-width: 1024px)',
      ).matches

    if (isDesktop) {
      setShowSearchSheet(false)
      setActiveTab('Browse')

      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })

      return
    }

    setShowSearchSheet(true)
  }

  /*
   * Player
   */
  /*
   * Play one album as a dedicated queue.
   * The queue is replaced completely with the album tracks.
   */
  const handlePlayAlbum = async (albumSongs) => {
    const albumQueue = Array.isArray(albumSongs)
      ? dedupeTracks(
          albumSongs.filter(Boolean),
        )
      : []

    if (!albumQueue.length) {
      return
    }

    await handleOpenPlayer(
      albumQueue[0],
      albumQueue,
      true,
    )
  }

  const handleOpenPlayer = (
  song,
  playbackQueue = searchResults,
  replaceQueue = false,
) => {
  if (!song) return

  if (
    song.provider &&
    song.playable === false
  ) {
    return
  }

  if (song.provider) {
    playTrack(
      song,
      playbackQueue,
      replaceQueue,
    )
  }
}

  /*
   * Favorites
   *
   * Likes are now user-specific and stored in Supabase.
   * The UI updates optimistically and rolls back if the database
   * operation fails.
   */
  const handleToggleFavorite = async (track) => {
    if (!user?.id || !track?.id || !track?.provider) return

    const alreadyFavorite = favorites.some((favoriteTrack) =>
      sameTrack(favoriteTrack, track),
    )

    if (alreadyFavorite) {
      const previousFavorites = favorites

      setFavorites((current) =>
        current.filter(
          (favoriteTrack) =>
            !sameTrack(favoriteTrack, track),
        ),
      )

      const { error } = await supabase
        .from('liked_songs')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', String(track.id))
        .eq('provider', track.provider)

      if (error) {
        console.error('Failed to remove liked song:', error)
        setFavorites(previousFavorites)
      }

      return
    }

    const previousFavorites = favorites
    const nextFavorite = toUiSong(track)

    setFavorites((current) => [
      nextFavorite,
      ...current.filter(
        (favoriteTrack) =>
          !sameTrack(favoriteTrack, nextFavorite),
      ),
    ])

    const { error } = await supabase
      .from('liked_songs')
      .insert(
  favoriteRowFromTrack(track, user.id),
)

    if (error) {
      console.error('Failed to save liked song:', error)
      setFavorites(previousFavorites)
    }
  }

  const handleClearFavorites = async () => {
    if (!user?.id || !favorites.length) return

    const previousFavorites = favorites
    setFavorites([])

    const { error } = await supabase
      .from('liked_songs')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to clear liked songs:', error)
      setFavorites(previousFavorites)
    }
  }

  const favoriteProps = (track) => ({
    isFavorite: favorites.some(
      (favoriteTrack) =>
        sameTrack(favoriteTrack, track),
    ),
    onToggleFavorite:
      handleToggleFavorite,
  })

  const handleClearListeningHistory = async () => {
    if (!user?.id || !listeningHistory.length) return

    const previousHistory = listeningHistory
    setListeningHistory([])

    const { error } = await supabase
      .from('listening_history')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error(
        'Failed to clear listening history:',
        error,
      )
      setListeningHistory(previousHistory)
    }
  }

  /*
   * Navigation
   */
  const handleSelectTab = (tab, payload = null) => {
    if (tab === 'Playlist') {
      if (payload?.id) {
        setSelectedPlaylist(payload)
      } else if (!selectedPlaylist && playlists.length) {
        setSelectedPlaylist(playlists[0])
      }
    }

    setActiveTab(tab)
    setShowSearchSheet(false)
    setQueueOpen(false)
  }

  /*
   * Open one specific playlist.
   * This is used by the desktop sidebar and can also be reused
   * by playlist cards elsewhere in the app.
   */
  const openPlaylist = (playlist) => {
    if (!playlist?.id) return

    const freshPlaylist =
      playlists.find((item) => item.id === playlist.id) ||
      playlist

    setSelectedPlaylist(freshPlaylist)
    setActiveTab('Playlist')
    setShowSearchSheet(false)
    setQueueOpen(false)
  }

  /*
   * Open an album from the inline search result.
   *
   * Real JioSaavn album cards are loaded by album ID/link so the
   * album page contains the songs that actually belong to that
   * album. Song-derived cards (which may not have an album ID)
   * use an exact album-title search as a safe fallback.
   */
  const openAlbum = async (album) => {
    if (!album?.title) return

    setSelectedAlbum(album)
    setSelectedAlbumSongs([])
    setAlbumStatus('loading')
    setAlbumError('')
    setActiveTab('Album')
    setShowSearchSheet(false)
    setQueueOpen(false)

    try {
      let songs = []

      if (album.provider === 'verome') {
        const veromeBaseUrl = (
          import.meta.env?.VITE_VEROME_API_URL ||
          'https://verome-api.auraan.deno.net'
        ).replace(/\/$/, '')

        const response = await fetch(
          `${veromeBaseUrl}/api/albums/${encodeURIComponent(
            String(album.id),
          )}`,
          {
            headers: {
              Accept: 'application/json',
            },
          },
        )

        if (!response.ok) {
          throw new Error(
            `Verome album request failed with status ${response.status}`,
          )
        }

        const payload = await response.json()

                const albumData =
          payload?.album ||
          payload?.data?.album ||
          payload?.data ||
          payload

        const rawSongs =
          (Array.isArray(payload?.tracks) &&
            payload.tracks) ||
          (Array.isArray(albumData?.tracks) &&
            albumData.tracks) ||
          (Array.isArray(albumData?.songs) &&
            albumData.songs) ||
          (Array.isArray(albumData?.results) &&
            albumData.results) ||
          []

        const artistName =
          album.artist ||
          payload?.artist?.name ||
          albumData?.artist?.name ||
          selectedAlbum?.artist ||
          'Unknown artist'

        songs = dedupeTracks(
          rawSongs
            .filter((song) => Boolean(song?.videoId))
            .sort(
              (left, right) =>
                Number(left?.trackNumber || 0) -
                Number(right?.trackNumber || 0),
            )
            .map((song) => {
              const duration =
                song.duration ??
                song.durationSeconds ??
                0

              return toUiSong({
                id: String(song.videoId),
                playbackId:
                  String(song.videoId),
                provider: 'verome',
                title:
                  song.title ||
                  'Unknown title',
                artist:
                  song.artist ||
                  artistName,
                album:
                  album.title ||
                  albumData?.title ||
                  null,
                artwork:
                  song.thumbnail ||
                  song.thumbnails?.[0]?.url ||
                  album.artwork ||
                  null,
                duration,
                durationSeconds:
                  parseTrackDuration(duration),
                playable: true,
              })
            }),
        )
      } else {
        const albumReference =
          album.url ||
          (album.id &&
          !String(album.id).startsWith('derived-album-') &&
          !String(album.id).startsWith('album-')
            ? String(album.id)
            : null)

        if (albumReference) {
          try {
            const response = await getAlbum(
              albumReference,
              DEFAULT_PROVIDER,
            )

            const albumData =
              response?.album ||
              response?.data ||
              response

            const rawSongs =
              (Array.isArray(
                albumData?.songs,
              ) &&
                albumData.songs) ||
              (Array.isArray(
                albumData?.tracks,
              ) &&
                albumData.tracks) ||
              (Array.isArray(
                albumData?.results,
              ) &&
                albumData.results) ||
              []

            songs = dedupeTracks(
              rawSongs
                .map(toUiSong)
                .filter(Boolean),
            )
          } catch (albumError) {
            console.warn(
              'Direct JioSaavn album lookup failed; falling back to exact album search.',
              albumError,
            )
          }
        }

        /*
         * Fallback for album cards that were derived from the song
         * search and therefore do not have a real JioSaavn album ID.
         */
        if (!songs.length) {
          const response = await searchMusic(
            album.title,
            DEFAULT_PROVIDER,
            { limit: 100 },
          )

          const albumTitle =
            normalizeSearchText(
              album.title,
            )

          songs = dedupeTracks(
            (Array.isArray(
              response?.results,
            )
              ? response.results
              : []
            )
              .map(toUiSong)
              .filter(
                (song) =>
                  normalizeSearchText(
                    song.album,
                  ) === albumTitle,
              ),
          )
        }
      }

      setSelectedAlbumSongs(songs)
      setAlbumStatus(songs.length ? 'success' : 'empty')
    } catch (error) {
      console.error(
        'Failed to load album:',
        error,
      )
      setSelectedAlbumSongs([])
      setAlbumStatus('error')
      setAlbumError(
        'Unable to load this album right now.',
      )
    }
  }

  const closeAlbum = () => {
    setSelectedAlbum(null)
    setSelectedAlbumSongs([])
    setAlbumStatus('idle')
    setAlbumError('')
    setActiveTab('Browse')
  }

  /*
   * Open a Verome artist from Browse search.
   */
  const openArtist = async (artist) => {
    if (
      artist?.provider !== 'verome' ||
      !artist?.id
    ) {
      return
    }

    const requestId =
      artistRequestIdRef.current + 1

    artistRequestIdRef.current = requestId

    setSelectedArtist(artist)
    setSelectedArtistSongs([])
    setSelectedArtistAlbums([])
    setSelectedArtistSingles([])
    setArtistStatus('loading')
    setArtistError('')
    setActiveTab('Artist')
    setShowSearchSheet(false)
    setQueueOpen(false)

    try {
      const response =
        await getVeromeArtist(
          String(artist.id),
        )

      if (
        requestId !==
        artistRequestIdRef.current
      ) {
        return
      }

      setSelectedArtist(
        normalizeVeromeArtist(
          response.artist || artist,
        ) || artist,
      )

      setSelectedArtistSongs(
        Array.isArray(response.songs)
          ? response.songs
              .map(normalizeVeromeSong)
              .filter(Boolean)
              .filter(
                (song) =>
                  song.playable !== false,
              )
          : [],
      )

      setSelectedArtistAlbums(
        Array.isArray(response.albums)
          ? response.albums
              .map((album) =>
                normalizeSearchAlbum({
                  ...album,
                  provider:
                    album?.provider ||
                    'verome',
                  artist:
                    album?.artist ||
                    response?.artist?.name ||
                    'Unknown artist',
                }),
              )
              .filter(Boolean)
          : [],
      )

      setSelectedArtistSingles(
        Array.isArray(response.singles)
          ? response.singles
          : [],
      )

      const hasSongs =
        Array.isArray(response.songs) &&
        response.songs.length > 0

      const hasAlbums =
        Array.isArray(response.albums) &&
        response.albums.length > 0

      const hasSingles =
        Array.isArray(response.singles) &&
        response.singles.length > 0

      setArtistStatus(
        hasSongs ||
        hasAlbums ||
        hasSingles
          ? 'success'
          : 'empty',
      )
    } catch (error) {
      if (
        requestId !==
        artistRequestIdRef.current
      ) {
        return
      }

      console.error(
        'Failed to load Verome artist:',
        error,
      )

      setSelectedArtistSongs([])
      setSelectedArtistAlbums([])
      setSelectedArtistSingles([])
      setArtistStatus('error')
      setArtistError(
        'Unable to load this artist right now.',
      )
    }
  }

  const closeArtist = () => {
    artistRequestIdRef.current += 1
    setSelectedArtist(null)
    setSelectedArtistSongs([])
    setSelectedArtistAlbums([])
    setSelectedArtistSingles([])
    setArtistStatus('idle')
    setArtistError('')
    setActiveTab('Browse')
  }

  /*
   * =========================================================
   * ARTIST
   * =========================================================
   */
  const renderSelectedArtist = () => {
    if (!selectedArtist) {
      return (
        <div className="pb-28 lg:pb-10">
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">
              No artist selected.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab('Browse')}
              className="mt-5 min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
            >
              Back to search
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-8 pb-28 lg:pb-10">
        <section className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#101114]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />

          <div className="relative p-5 sm:p-7">
            <button
              type="button"
              onClick={closeArtist}
              className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/40 transition hover:text-white/75"
            >
              <ArrowLeft size={14} />
              Back to search
            </button>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-full bg-[#18191d] ring-1 ring-white/[0.08]">
                <Artwork
                  src={selectedArtist.artwork}
                  className="absolute inset-0 h-full w-full object-cover"
                  iconSize={46}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                  Artist
                </p>

                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                  {selectedArtist.name}
                </h1>

                {selectedArtist.subscribers ? (
                  <p className="mt-3 text-sm text-white/45">
                    {selectedArtist.subscribers} subscribers
                  </p>
                ) : selectedArtist.subtitle ? (
                  <p className="mt-3 text-sm text-white/45">
                    {selectedArtist.subtitle}
                  </p>
                ) : null}

                {selectedArtist.description ? (
                  <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-white/45">
                    {selectedArtist.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {artistStatus === 'loading' ? (
          <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] px-5 py-7">
            <p
              className="text-sm text-white/45"
              role="status"
              aria-live="polite"
            >
              Loading artist songs and albums...
            </p>
          </section>
        ) : null}

        {artistStatus === 'error' ? (
          <section className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-7">
            <p
              className="text-sm text-white/60"
              role="alert"
            >
              {artistError}
            </p>

            <button
              type="button"
              onClick={() => {
                void openArtist(selectedArtist)
              }}
              className="mt-4 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              Try again
            </button>
          </section>
        ) : null}

        {artistStatus === 'empty' ? (
          <section className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-7">
            <p className="text-sm text-white/60">
              No artist content was found.
            </p>
          </section>
        ) : null}

        {selectedArtistSongs.length ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader title="Top songs" />

              <span className="text-xs text-white/30">
                {selectedArtistSongs.length}
              </span>
            </div>

            <div className="space-y-2">
              {selectedArtistSongs.map(
                (song, index) => (
                  <SongRow
                    key={`${song.provider}-${song.id}`}
                    song={song}
                    number={index + 1}
                    onOpenPlayer={(track) =>
                      handleOpenPlayer(
                        track,
                        selectedArtistSongs,
                      )
                    }
                    onMoreOptions={
                      handleSongMoreOptions
                    }
                    isActive={sameTrack(
                      song,
                      currentSong,
                    )}
                    isLoading={
                      playerLoading &&
                      sameTrack(
                        song,
                        currentSong,
                      )
                    }
                    isPlaying={isPlaying}
                    error={
                      playerError &&
                      sameTrack(
                        song,
                        currentSong,
                      )
                        ? playerError
                        : ''
                    }
                    {...favoriteProps(song)}
                  />
                ),
              )}
            </div>

            <p className="text-xs leading-5 text-white/30">
              Video playback appears in the Now Playing panel.
            </p>
          </section>
        ) : null}

        {selectedArtistAlbums.length ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader title="Albums" />

              <span className="text-xs text-white/30">
                {selectedArtistAlbums.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {selectedArtistAlbums.map(
                (album) => (
                  <button
                    key={`${album.provider || 'verome'}-${album.id || album.title}`}
                    type="button"
                    onClick={() => {
                      void openAlbum({
                        ...album,
                        provider:
                          album.provider ||
                          'verome',
                        id:
                          album.id ||
                          album.browseId,
                        artist:
                          album.artist ||
                          selectedArtist.name,
                      })
                    }}
                    className="min-w-0 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.055]"
                    aria-label={`Open album ${album.title}`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#18191d] ring-1 ring-white/[0.08]">
                      <Artwork
                        src={album.artwork}
                        className="absolute inset-0 h-full w-full object-cover"
                        iconSize={28}
                      />
                    </div>

                    <p className="mt-3 truncate text-sm font-semibold text-white">
                      {album.title}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {album.year || 'Album'}
                    </p>
                  </button>
                ),
              )}
            </div>
          </section>
        ) : null}

        {selectedArtistSingles.length ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader title="Singles" />

              <span className="text-xs text-white/30">
                {selectedArtistSingles.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {selectedArtistSingles.map(
                (single) => (
                  <div
                    key={`${single.provider || 'verome'}-${single.id || single.title}`}
                    className="min-w-0 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3 text-left"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#18191d] ring-1 ring-white/[0.08]">
                      <Artwork
                        src={single.artwork}
                        className="absolute inset-0 h-full w-full object-cover"
                        iconSize={28}
                      />
                    </div>

                    <p className="mt-3 truncate text-sm font-semibold text-white">
                      {single.title}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {single.year || 'Single'}
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  /*
   * =========================================================
   * ALBUM
   * =========================================================
   */
  const renderSelectedAlbum = () => {
    if (!selectedAlbum) {
      return (
        <div className="pb-28 lg:pb-10">
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">
              No album selected.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('Browse')}
              className="mt-5 min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
            >
              Back to search
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-8 pb-28 lg:pb-10">
        <section className="rounded-[24px] border border-white/[0.07] bg-[#101114] p-5 sm:p-7">
          <button
            type="button"
            onClick={closeAlbum}
            className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/40 transition hover:text-white/75"
          >
            <ArrowLeft size={14} />
            Back to search
          </button>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-[20px] bg-[#18191d] ring-1 ring-white/[0.08]">
              <Artwork
                src={selectedAlbum.artwork}
                className="absolute inset-0 h-full w-full object-cover"
                iconSize={48}
              />
            </div>

            <div className="min-w-0">
  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
    Album
  </p>

  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
    {selectedAlbum.title}
  </h1>

  <p className="mt-3 text-sm text-white/50">
    {selectedAlbum.artist || 'Unknown artist'}
    {selectedAlbum.year ? ` · ${selectedAlbum.year}` : ''}
  </p>

  {albumStatus === 'success' ? (
    <p className="mt-2 text-xs text-white/30">
      {selectedAlbumSongs.length}{' '}
      {selectedAlbumSongs.length === 1 ? 'song' : 'songs'}
    </p>
  ) : null}

  {albumStatus === 'success' && selectedAlbumSongs.length ? (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void handlePlayAlbum(
            selectedAlbumSongs,
          )
        }}
        className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
      >
        <Play size={16} fill="currentColor" />
        Play album
      </button>

      <button
        type="button"
        onClick={() => setQueueOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
      >
        <ListMusic size={16} />
        Queue
      </button>
    </div>
  ) : null}
</div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Songs" />

          {albumStatus === 'loading' ? (
            <p className="text-sm text-white/45">
              Loading album songs...
            </p>
          ) : null}

          {albumStatus === 'error' ? (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-7">
              <p className="text-sm text-white/60">{albumError}</p>
              <button
                type="button"
                onClick={() => openAlbum(selectedAlbum)}
                className="mt-4 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08]"
              >
                Try again
              </button>
            </div>
          ) : null}

          {albumStatus === 'empty' ? (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-7">
              <p className="text-sm text-white/60">
                No songs were found for this album.
              </p>
            </div>
          ) : null}

          {albumStatus === 'success' ? (
            <div className="space-y-2">
              {selectedAlbumSongs.map((song, index) => (
                <SongRow
                  key={`${song.provider}-${song.id}`}
                  song={song}
                  number={index + 1}
                  onOpenPlayer={(track) =>
                    handleOpenPlayer(track, selectedAlbumSongs)
                  }
                  onMoreOptions={handleSongMoreOptions}
                  isActive={sameTrack(song, currentSong)}
                  isLoading={
                    playerLoading &&
                    sameTrack(song, currentSong)
                  }
                  isPlaying={isPlaying}
                  error={
                    playerError &&
                    sameTrack(song, currentSong)
                      ? playerError
                      : ''
                  }
                  {...favoriteProps(song)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  /*
   * =========================================================
   * PLAYLIST FUNCTIONALITY
   * =========================================================
   */

  /*
   * Refresh playlist state from persistent storage.
   */
  const refreshPlaylists = async () => {
    if (!user?.id) return []
    return loadPlaylistsForUser(user.id)
  }

  /*
   * Open playlist UI from SongRow.
   */
  const handleSongMoreOptions = (
    action,
    song,
  ) => {
    if (!song) return

    if (action === 'create-playlist') {
      setPlaylistName('')
      setPlaylistError('')

      setPlaylistModal({
        open: true,
        mode: 'create',
        song,
      })

      return
    }

    if (action === 'playlist') {
      setPlaylistError('')

      setPlaylistModal({
        open: true,
        mode: 'add',
        song,
      })

      return
    }

    /*
     * Artist / album navigation can be connected
     * to dedicated pages later.
     */
    if (action === 'artist') {
      console.log('View artist:', song.artist)
      return
    }

    if (action === 'album') {
      console.log('View album:', song.album)
    }
  }

  /*
   * Close playlist modal.
   */
  const closePlaylistModal = () => {
    setPlaylistModal({
      open: false,
      mode: null,
      song: null,
    })

    setPlaylistName('')
    setPlaylistDescription('')
    setPlaylistError('')
    setPlaylistCoverUploading(false)
    if (playlistCoverInputRef.current) {
      playlistCoverInputRef.current.value = ''
    }
    setPlaylistDialog({ open: false, mode: null, playlist: null })
  }

  /*
   * Create a new playlist and automatically
   * add the selected song to it.
   */
  const handleCreatePlaylist = async () => {
    const name = playlistName.trim()

    if (!user?.id) {
      setPlaylistError('You must be signed in to create a playlist.')
      return
    }

    if (!name) {
      setPlaylistError('Give your playlist a name.')
      return
    }

    try {
      setPlaylistError('')

      const { data: playlist, error: playlistInsertError } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name,
          description: null,
          cover_url: null,
          is_public: false,
        })
        .select('id, user_id, name, description, cover_url, is_public, created_at, updated_at')
        .single()

      if (playlistInsertError) throw playlistInsertError

      if (playlistModal.song) {
        const { error: songInsertError } = await supabase
          .from('playlist_songs')
          .insert(playlistSongRowFromTrack(playlistModal.song, playlist.id, user.id))

        if (songInsertError) {
          console.error('Playlist created but song could not be added:', songInsertError)
          setPlaylistError('Playlist created, but the song could not be added.')
        }
      }

      await refreshPlaylists()
      closePlaylistModal()
    } catch (error) {
      console.error('Create playlist error:', error)
      setPlaylistError(error?.message || 'Unable to create playlist.')
    }
  }

  const handleAddToPlaylist = async (playlist) => {
    if (!user?.id || !playlist?.id || !playlistModal.song) return

    try {
      setPlaylistError('')

      const song = playlistModal.song
      const { data: existing, error: existingError } = await supabase
        .from('playlist_songs')
        .select('id')
        .eq('playlist_id', playlist.id)
        .eq('user_id', user.id)
        .eq('song_id', String(song.id))
        .eq('provider', song.provider || DEFAULT_PROVIDER)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        setPlaylistError('This song is already in the playlist.')
        return
      }

      const { error } = await supabase
        .from('playlist_songs')
        .insert(playlistSongRowFromTrack(song, playlist.id, user.id))

      if (error) throw error

      await supabase
        .from('playlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', playlist.id)
        .eq('user_id', user.id)

      await refreshPlaylists()
      closePlaylistModal()
    } catch (error) {
      console.error('Add to playlist error:', error)
      setPlaylistError(error?.message || 'Unable to add this song to the playlist.')
    }
  }

  const openEditPlaylistDialog = (playlist) => {
    if (!playlist?.id) return

    setPlaylistName(playlist.name || playlist.title || '')
    setPlaylistDescription(playlist.description || '')
    setPlaylistError('')
    setPlaylistCoverUploading(false)
    if (playlistCoverInputRef.current) {
      playlistCoverInputRef.current.value = ''
    }
    setPlaylistDialog({
      open: true,
      mode: 'edit',
      playlist,
    })
  }

  const openDeletePlaylistDialog = (playlist) => {
    if (!playlist?.id) return

    setPlaylistError('')
    setPlaylistCoverUploading(false)
    setPlaylistDialog({
      open: true,
      mode: 'delete',
      playlist,
    })
  }

  const closePlaylistDialog = () => {
    setPlaylistDialog({ open: false, mode: null, playlist: null })
    setPlaylistName('')
    setPlaylistDescription('')
    setPlaylistError('')
    setPlaylistCoverUploading(false)
    if (playlistCoverInputRef.current) {
      playlistCoverInputRef.current.value = ''
    }
  }

  const getPlaylistCoverStoragePath = (coverUrl) => {
    if (!coverUrl || typeof coverUrl !== 'string') return null

    const marker = '/storage/v1/object/public/playlist-covers/'
    const markerIndex = coverUrl.indexOf(marker)

    if (markerIndex === -1) return null

    const rawPath = coverUrl.slice(markerIndex + marker.length)
    const cleanPath = rawPath.split('?')[0]

    try {
      return decodeURIComponent(cleanPath)
    } catch {
      return cleanPath
    }
  }

  const getPlaylistCoverExtension = (file) => {
    if (file?.type === 'image/png') return 'png'
    if (file?.type === 'image/webp') return 'webp'
    return 'jpg'
  }

  const handlePlaylistCoverChange = async (event) => {
    const file = event.target.files?.[0]
    const playlist = playlistDialog.playlist

    if (!file || !playlist?.id || !user?.id) return

    try {
      setPlaylistError('')

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Please choose a JPG, PNG, or WebP image.')
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Playlist cover must be 5 MB or smaller.')
      }

      setPlaylistCoverUploading(true)

      const extension = getPlaylistCoverExtension(file)
      const uniqueId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const storagePath = `${user.id}/${playlist.id}/${uniqueId}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('playlist-covers')
        .upload(storagePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('playlist-covers')
        .getPublicUrl(storagePath)

      const publicUrl = publicUrlData?.publicUrl

      if (!publicUrl) {
        throw new Error('The cover uploaded, but its public URL could not be created.')
      }

      const { error: playlistUpdateError } = await supabase
        .from('playlists')
        .update({
          cover_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playlist.id)
        .eq('user_id', user.id)

      if (playlistUpdateError) {
        await supabase.storage.from('playlist-covers').remove([storagePath])
        throw playlistUpdateError
      }

      const oldCoverPath = getPlaylistCoverStoragePath(playlist.cover_url)
      const ownPrefix = `${user.id}/`

      if (oldCoverPath && oldCoverPath.startsWith(ownPrefix)) {
        const { error: removeOldCoverError } = await supabase.storage
          .from('playlist-covers')
          .remove([oldCoverPath])

        if (removeOldCoverError) {
          console.warn('New playlist cover saved, but the old cover could not be removed:', removeOldCoverError)
        }
      }

      const updatedAt = new Date().toISOString()

      setPlaylistDialog((current) => ({
        ...current,
        playlist: current.playlist
          ? {
              ...current.playlist,
              cover_url: publicUrl,
              updated_at: updatedAt,
            }
          : current.playlist,
      }))

      await refreshPlaylists()
    } catch (error) {
      console.error('Playlist cover upload error:', error)
      setPlaylistError(error?.message || 'Unable to upload playlist cover.')
    } finally {
      setPlaylistCoverUploading(false)
      if (playlistCoverInputRef.current) {
        playlistCoverInputRef.current.value = ''
      }
    }
  }

  const handleRemovePlaylistCover = async () => {
    const playlist = playlistDialog.playlist

    if (!playlist?.id || !user?.id || !playlist.cover_url) return

    try {
      setPlaylistError('')
      setPlaylistCoverUploading(true)

      const oldCoverPath = getPlaylistCoverStoragePath(playlist.cover_url)
      const ownPrefix = `${user.id}/`

      const { error: playlistUpdateError } = await supabase
        .from('playlists')
        .update({
          cover_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playlist.id)
        .eq('user_id', user.id)

      if (playlistUpdateError) throw playlistUpdateError

      if (oldCoverPath && oldCoverPath.startsWith(ownPrefix)) {
        const { error: removeCoverError } = await supabase.storage
          .from('playlist-covers')
          .remove([oldCoverPath])

        if (removeCoverError) {
          console.warn('Playlist cover was cleared, but the stored image could not be removed:', removeCoverError)
        }
      }

      const updatedAt = new Date().toISOString()

      setPlaylistDialog((current) => ({
        ...current,
        playlist: current.playlist
          ? {
              ...current.playlist,
              cover_url: null,
              updated_at: updatedAt,
            }
          : current.playlist,
      }))

      await refreshPlaylists()
    } catch (error) {
      console.error('Remove playlist cover error:', error)
      setPlaylistError(error?.message || 'Unable to remove playlist cover.')
    } finally {
      setPlaylistCoverUploading(false)
      if (playlistCoverInputRef.current) {
        playlistCoverInputRef.current.value = ''
      }
    }
  }

  const handleSavePlaylistDetails = async () => {
    const playlist = playlistDialog.playlist
    const name = playlistName.trim()
    const description = playlistDescription.trim()

    if (!user?.id || !playlist?.id) return

    if (!name) {
      setPlaylistError('Give your playlist a name.')
      return
    }

    try {
      setPlaylistError('')

      const { error } = await supabase
        .from('playlists')
        .update({
          name,
          description: description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playlist.id)
        .eq('user_id', user.id)

      if (error) throw error

      await refreshPlaylists()
      closePlaylistDialog()
    } catch (error) {
      console.error('Edit playlist error:', error)
      setPlaylistError(error?.message || 'Unable to update playlist.')
    }
  }

  const handleDeletePlaylist = async (playlist) => {
    if (!user?.id || !playlist?.id) return

    try {
      setPlaylistError('')

      const { error: songsError } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlist.id)
        .eq('user_id', user.id)

      if (songsError) throw songsError

      const { error: playlistError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlist.id)
        .eq('user_id', user.id)

      if (playlistError) throw playlistError

      if (selectedPlaylist?.id === playlist.id) {
        setSelectedPlaylist(null)
        setActiveTab('Library')
      }

      await refreshPlaylists()
      closePlaylistDialog()
    } catch (error) {
      console.error('Delete playlist error:', error)
      setPlaylistError(error?.message || 'Unable to delete playlist.')
    }
  }

  const renderPlaylistEditDialog = () => {
    if (!playlistDialog.open) return null

    const playlist = playlistDialog.playlist
    const isDelete = playlistDialog.mode === 'delete'
    const title = isDelete ? 'Delete playlist' : 'Edit playlist'

    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
        aria-hidden="false"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-edit-dialog-title"
          className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#111214] shadow-[0_35px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.03]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#A9A4FF]/70">
                AURAAN playlist
              </p>
              <h3
                id="playlist-edit-dialog-title"
                className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white"
              >
                {title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/40">
                {isDelete
                  ? 'This will permanently remove the playlist and its songs.'
                  : 'Update your playlist details.'}
              </p>
            </div>

            <button
              type="button"
              onClick={closePlaylistDialog}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-white/45 transition hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white active:scale-95"
              aria-label="Close dialog"
            >
              <X size={17} />
            </button>
          </div>

          {isDelete ? (
            <div className="p-5 sm:p-6">
              <div className="rounded-2xl border border-red-400/10 bg-red-400/[0.045] p-4">
                <p className="text-sm font-medium text-white">
                  Delete “{playlist?.name || playlist?.title || 'Untitled playlist'}”?
                </p>
                <p className="mt-2 text-xs leading-5 text-white/40">
                  This action cannot be undone. The playlist and its saved songs will be removed from your account.
                </p>
              </div>

              {playlistError ? (
                <p className="mt-3 text-xs text-red-300" role="alert">
                  {playlistError}
                </p>
              ) : null}

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={closePlaylistDialog}
                  className="min-h-11 flex-1 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeletePlaylist(playlist)}
                  className="min-h-11 flex-1 rounded-full bg-red-400/[0.12] px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-400/[0.18]"
                >
                  Delete playlist
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <label htmlFor="edit-playlist-name" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                  Playlist name
                </label>
                <input
                  id="edit-playlist-name"
                  autoFocus
                  value={playlistName}
                  onChange={(event) => {
                    setPlaylistName(event.target.value)
                    setPlaylistError('')
                  }}
                  maxLength={60}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b0c0f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7567F8]/50 focus:ring-2 focus:ring-[#7567F8]/10"
                  placeholder="My playlist"
                />
              </div>

              <div>
                <label htmlFor="edit-playlist-description" className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-white/40">
                  Description
                </label>
                <textarea
                  id="edit-playlist-description"
                  value={playlistDescription}
                  onChange={(event) => {
                    setPlaylistDescription(event.target.value)
                    setPlaylistError('')
                  }}
                  maxLength={300}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-[#0b0c0f] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-[#7567F8]/50 focus:ring-2 focus:ring-[#7567F8]/10"
                  placeholder="Add a description..."
                />
              </div>

              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white shadow-[0_12px_30px_rgba(117,103,248,0.18)]">
                    {playlist?.cover_url ? (
                      <img
                        src={playlist.cover_url}
                        alt="Playlist cover preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ListMusic size={30} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/85">
                      Playlist artwork
                    </p>

                    <p className="mt-1 max-w-md text-xs leading-5 text-white/35">
                      Upload a square JPG, PNG, or WebP image up to 5 MB.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        ref={playlistCoverInputRef}
                        id="edit-playlist-cover"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          void handlePlaylistCoverChange(event)
                        }}
                        disabled={playlistCoverUploading}
                      />

                      <label
                        htmlFor="edit-playlist-cover"
                        className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.09] hover:text-white ${
                          playlistCoverUploading
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }`}
                      >
                        <Upload size={14} />
                        {playlistCoverUploading
                          ? 'Uploading...'
                          : playlist?.cover_url
                            ? 'Change cover'
                            : 'Upload cover'}
                      </label>

                      {playlist?.cover_url ? (
                        <button
                          type="button"
                          onClick={() => void handleRemovePlaylistCover()}
                          disabled={playlistCoverUploading}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-400/15 bg-red-400/[0.05] px-4 py-2 text-xs font-medium text-red-200/75 transition hover:bg-red-400/[0.1] hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Trash2 size={14} />
                          Remove cover
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {playlistError ? (
                <p className="text-xs text-[#A9A4FF]" role="alert">
                  {playlistError}
                </p>
              ) : null}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closePlaylistDialog}
                  className="min-h-11 flex-1 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePlaylistDetails()}
                  className="min-h-11 flex-1 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-[0.98]"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  /*
   * Next / previous
   */
  const nextTrack = () => {
    if (playingTrack) {
      void nextPlayerTrack()
      return
    }

    if (!recentlyPlayed.length) return

    const currentIndex =
      recentlyPlayed.findIndex((track) =>
        sameTrack(track, currentSong),
      )

    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + 1) %
          recentlyPlayed.length
        : 0

    const nextSong =
      recentlyPlayed[nextIndex]

    handleOpenPlayer(
      nextSong,
      recentlyPlayed,
    )
  }

  const prevTrack = () => {
    if (playingTrack) {
      void previousPlayerTrack()
      return
    }

    if (!recentlyPlayed.length) return

    const currentIndex =
      recentlyPlayed.findIndex((track) =>
        sameTrack(track, currentSong),
      )

    const previousIndex =
      currentIndex > 0
        ? currentIndex - 1
        : recentlyPlayed.length - 1

    const previousSong =
      recentlyPlayed[previousIndex]

    handleOpenPlayer(
      previousSong,
      recentlyPlayed,
    )
  }

  /*
   * =========================================================
   * HOME
   * =========================================================
   */
  const renderHomeScreen = () => (
    <div className="space-y-8 pb-28 lg:pb-10">
      <section className="rounded-[24px] border border-white/[0.07] bg-[#101114] p-5 sm:p-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">
          Your music
        </p>

        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
          Welcome back
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
          Search for music and build your personal
          listening history as you go.
        </p>

        <button
          type="button"
          onClick={handleOpenSearch}
          className="mt-6 flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Search size={16} />
          Search music
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader title="Recently played" />

          {recentlyPlayed.length ? (
            <button
              type="button"
              onClick={() => {
                clearRecentlyPlayed()
                setRecentlyPlayed([])
              }}
              className="min-h-11 touch-manipulation px-2 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Clear
            </button>
          ) : null}
        </div>

        {recentlyPlayed.length ? (
          <div className="space-y-2">
            {recentlyPlayed
              .slice(0, 10)
              .map((song, index) => (
                <SongRow
                  key={`${song.provider}-${song.id}`}
                  song={song}
                  number={index + 1}
                  onOpenPlayer={(track) =>
                    handleOpenPlayer(track, [
                      track,
                    ])
                  }
                  onMoreOptions={
                    handleSongMoreOptions
                  }
                  isActive={sameTrack(
                    song,
                    currentSong,
                  )}
                  isLoading={
                    playerLoading &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                  }
                  isPlaying={isPlaying}
                  error={
                    playerError &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                      ? playerError
                      : ''
                  }
                  {...favoriteProps(song)}
                />
              ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <p className="text-sm font-medium text-white/75">
              Nothing played yet.
            </p>

            <p className="mt-2 text-xs leading-5 text-white/40">
              Search for a song and start listening.
              Your played tracks will appear here.
            </p>

            <button
              type="button"
              onClick={handleOpenSearch}
              className="mt-5 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.08] active:scale-95"
            >
              Find music
            </button>
          </div>
        )}
      </section>
    </div>
  )

  /*
   * =========================================================
   * BROWSE
   * =========================================================
   */
  const renderBrowseScreen = () => {
    const searchTabs = [
      'All',
      'Songs',
      'Albums',
      'Artists',
      'Playlists',
    ]

    const searchArtistResults =
    searchVeromeArtistResults

    const searchPlaylistResults = playlists.filter((playlist) => {
      const title = normalizeSearchText(
        playlist?.title || playlist?.name,
      )
      const description = normalizeSearchText(
        playlist?.description,
      )
      const query = normalizeSearchText(submittedQuery)

      return Boolean(
        query &&
          (title.includes(query) ||
            description.includes(query)),
      )
    })

    const showArtists =
      searchFilter === 'All' || searchFilter === 'Artists'
    const showAlbums =
      searchFilter === 'All' || searchFilter === 'Albums'
    const showSongs =
      searchFilter === 'All' || searchFilter === 'Songs'
    const showPlaylists =
      searchFilter === 'All' || searchFilter === 'Playlists'

    const hasVisibleResults =
      (showArtists && searchArtistResults.length > 0) ||
      (showAlbums && searchAlbumResults.length > 0) ||
      (showSongs && searchResults.length > 0) ||
      (showPlaylists && searchPlaylistResults.length > 0)

    return (
      <div className="space-y-8 pb-28 lg:pb-10">
        <section className="rounded-[20px] border border-white/[0.07] bg-[#101114] p-2">
          <div className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-[#0b0c0f] px-4 py-3 text-white/60">
            <Search size={17} />

            <input
              ref={searchInputRef}
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Search artists, albums, songs"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              aria-label="Search music"
            />

            {searchText ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80"
              >
                Clear
              </button>
            ) : null}
          </div>
        </section>

        {searchStatus !== 'idle' ? (
          <section className="space-y-5">
            <SectionHeader title="Search results" />

            {searchStatus === 'loading' ? (
              <p
                className="text-sm text-white/45"
                role="status"
                aria-live="polite"
              >
                Searching for music...
              </p>
            ) : null}

            {searchStatus === 'error' ? (
              <div
                className="flex flex-wrap items-center gap-3"
                role="alert"
              >
                <p className="text-sm text-white/50">
                  {searchError}
                </p>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.08] active:scale-95"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {searchStatus === 'empty' ? (
              <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-7">
                <p className="text-sm text-white/70">
                  No music found for “{submittedQuery}”.
                </p>

                <p className="mt-2 text-xs text-white/40">
                  Try another artist, song, or album.
                </p>
              </div>
            ) : null}

            {searchStatus !== 'idle' &&
            (searchStatus === 'success' || hasVisibleResults) ? (
              <div className="space-y-8">
                <div className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101114]/95 p-1.5 backdrop-blur-xl">
                  <div className="flex min-w-max gap-1">
                    {searchTabs.map((tab) => {
                      const active = searchFilter === tab

                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSearchFilter(tab)}
                          className={`min-h-10 rounded-xl px-4 py-2 text-sm font-medium transition ${
                            active
                              ? 'bg-white text-black'
                              : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                          }`}
                        >
                          {tab}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {showArtists && searchArtistResults.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        Artists
                      </h3>
                      {searchFilter === 'All' ? (
                        <button
                          type="button"
                          onClick={() => setSearchFilter('Artists')}
                          className="text-xs font-medium text-white/40 transition hover:text-white"
                        >
                          Show all
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {searchArtistResults.map((artist) => (
                        <button
                          key={`${artist.provider || DEFAULT_PROVIDER}-${artist.id}`}
                          type="button"
                          onClick={() => {
                            if (
                              artist.provider ===
                              'verome'
                            ) {
                              void openArtist(artist)
                              return
                            }

                            setSearchFilter('Songs')
                          }}
                          className="group min-w-0 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4 text-center transition hover:border-white/[0.14] hover:bg-white/[0.055]"
                          aria-label={
                            artist.provider ===
                            'verome'
                              ? `Open artist ${artist.name}`
                              : `Show songs by ${artist.name}`
                          }
                        >
                          <div className="mx-auto aspect-square w-full max-w-[150px] overflow-hidden rounded-full bg-[#18191d] ring-1 ring-white/[0.08]">
                            <Artwork
                              src={artist.artwork}
                              className="h-full w-full object-cover"
                              iconSize={28}
                            />
                          </div>

                          <p className="mt-3 truncate text-sm font-semibold text-white">
                            {artist.name}
                          </p>
                          <p className="mt-1 text-xs text-white/40">
                            {artist.provider ===
                            'verome'
                              ? artist.subtitle ||
                                'Artist'
                              : `${artist.songCount} ${
                                  artist.songCount ===
                                  1
                                    ? 'song'
                                    : 'songs'
                                }`}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {showAlbums && searchAlbumResults.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        Albums
                      </h3>
                      {searchFilter === 'All' ? (
                        <button
                          type="button"
                          onClick={() => setSearchFilter('Albums')}
                          className="text-xs font-medium text-white/40 transition hover:text-white"
                        >
                          Show all
                        </button>
                      ) : (
                        <span className="text-xs text-white/30">
                          {searchAlbumResults.length}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {searchAlbumResults.map((album) => (
                        <button
                          key={albumKey(album)}
                          type="button"
                          onClick={() => {
                            void openAlbum(album)
                          }}
                          className="group min-w-0 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-white/[0.14] hover:bg-white/[0.055]"
                          aria-label={`Open album ${album.title}`}
                        >
                          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#18191d] ring-1 ring-white/[0.08]">
                            <Artwork
                              src={album.artwork}
                              className="absolute inset-0 h-full w-full object-cover"
                              iconSize={28}
                            />
                          </div>

                          <p className="mt-3 truncate text-sm font-semibold text-white">
                            {album.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-white/40">
                            {album.artist || 'Unknown artist'}
                            {album.year ? ` · ${album.year}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {showSongs && searchResults.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        Songs
                      </h3>

                      <span className="text-xs text-white/30">
                        {searchResults.length} loaded
                      </span>
                    </div>

                    <div className="space-y-3">
                      {searchResults.map((song, index) => (
                        <SongRow
                          key={`${song.provider}-${song.id}`}
                          song={song}
                          number={index + 1}
                          onOpenPlayer={handleOpenPlayer}
                          onMoreOptions={handleSongMoreOptions}
                          isActive={sameTrack(song, currentSong)}
                          isLoading={
                            playerLoading &&
                            sameTrack(song, currentSong)
                          }
                          isPlaying={isPlaying}
                          error={
                            playerError &&
                            sameTrack(song, currentSong)
                              ? playerError
                              : ''
                          }
                          {...favoriteProps(song)}
                        />
                      ))}
                    </div>

                    {hasMoreResults ? (
                      <div className="flex flex-col items-center gap-2 pt-3">
                        {loadMoreError ? (
                          <p
                            className="text-sm text-white/50"
                            role="alert"
                          >
                            {loadMoreError}
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          aria-busy={isLoadingMore}
                          className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] active:scale-95 disabled:cursor-wait disabled:opacity-50"
                        >
                          {isLoadingMore
                            ? 'Loading...'
                            : loadMoreError
                              ? 'Try again'
                              : 'Load more'}
                        </button>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {showPlaylists && searchPlaylistResults.length ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        Playlists
                      </h3>
                      {searchFilter === 'All' ? (
                        <button
                          type="button"
                          onClick={() => setSearchFilter('Playlists')}
                          className="text-xs font-medium text-white/40 transition hover:text-white"
                        >
                          Show all
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {searchPlaylistResults.map((playlist) => (
                        <button
                          key={playlist.id}
                          type="button"
                          onClick={() => openPlaylist(playlist)}
                          className="flex min-w-0 items-center gap-4 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.055]"
                        >
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white">
                            <ListMusic size={25} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {playlist.title || playlist.name || 'Untitled playlist'}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                              {Array.isArray(playlist.songs)
                                ? playlist.songs.length
                                : 0}{' '}
                              {Array.isArray(playlist.songs) &&
                              playlist.songs.length === 1
                                ? 'song'
                                : 'songs'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {!hasVisibleResults && searchStatus !== 'loading' ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
                    <p className="text-sm text-white/60">
                      No {searchFilter.toLowerCase()} found for “{submittedQuery}”.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/[0.10] bg-white/[0.02] px-5 py-10 text-center">
            <Search
              size={22}
              className="mx-auto text-white/25"
            />

            <p className="mt-4 text-sm font-medium text-white/70">
              Search for something to listen to.
            </p>

            <p className="mt-2 text-xs text-white/40">
              Search across your music library.
            </p>
          </div>
        )}
      </div>
    )
  }

  /*
   * =========================================================
   * RADIO
   * =========================================================
   */
  const renderRadioScreen = () => (
    <div className="space-y-8 pb-28 lg:pb-10">
      <section className="rounded-[24px] border border-white/[0.07] bg-[#101114] p-5 sm:p-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">
          Radio
        </p>

        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
          Live radio
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
          Radio stations will appear here once
          real station streams are connected.
        </p>
      </section>

      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
        <p className="text-sm font-medium text-white/70">
          No radio stations connected yet.
        </p>

        <p className="mt-2 text-xs leading-5 text-white/40">
          There is intentionally no placeholder
          station data here.
        </p>
      </div>
    </div>
  )

  /*
   * =========================================================
   * LIBRARY
   * =========================================================
   */
  const renderLibraryScreen = () => (
    <div className="space-y-8 pb-28 lg:pb-10">
      <section className="rounded-[24px] border border-white/[0.07] bg-[#101114] p-5 sm:p-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">
          Library
        </p>

        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
          Your music
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">
          Your listening history, favorites, and
          playlists.
        </p>
      </section>

      {/* PLAYLISTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionHeader title="Playlists" />

            <p className="mt-1 text-xs text-white/35">
              {playlists.length}{' '}
              {playlists.length === 1
                ? 'playlist'
                : 'playlists'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPlaylistName('')
              setPlaylistError('')

              setPlaylistModal({
                open: true,
                mode: 'create',
                song: null,
              })
            }}
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
          >
            <ListMusic size={15} />
            New playlist
          </button>
        </div>

        {playlists.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.045]"
              >
                <button
                  type="button"
                  onClick={() => openPlaylist(playlist)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white">
                    {playlist.cover_url ? (
                      <img
                        src={playlist.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ListMusic size={19} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {playlist.title ||
                        playlist.name ||
                        'Untitled playlist'}
                    </p>

                    <p className="mt-1 text-xs text-white/35">
                      {Array.isArray(
                        playlist.songs,
                      )
                        ? playlist.songs.length
                        : 0}{' '}
                      {Array.isArray(
                        playlist.songs,
                      ) &&
                      playlist.songs.length === 1
                        ? 'song'
                        : 'songs'}
                    </p>
                  </div>
                </button>

                <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                  <button
                    type="button"
                    onClick={() => openEditPlaylistDialog(playlist)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditPlaylistDialog(playlist)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeletePlaylistDialog(playlist)}
                    className="ml-auto rounded-full border border-red-400/15 px-3 py-1.5 text-[11px] text-red-300/70 transition hover:bg-red-400/[0.08] hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <ListMusic
              size={22}
              className="mx-auto text-white/25"
            />

            <p className="mt-4 text-sm font-medium text-white/70">
              No playlists yet.
            </p>

            <p className="mt-2 text-xs leading-5 text-white/40">
              Create a playlist from any song's
              options menu.
            </p>
          </div>
        )}
      </section>

      {/* LISTENING HISTORY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionHeader title="Listening history" />
            <p className="mt-1 text-xs text-white/35">
              {listeningHistory.length}{' '}
              {listeningHistory.length === 1
                ? 'play'
                : 'plays'}
            </p>
          </div>

          {listeningHistory.length ? (
            <button
              type="button"
              onClick={() => {
                void handleClearListeningHistory()
              }}
              className="min-h-11 px-2 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80"
            >
              Clear
            </button>
          ) : null}
        </div>

        {listeningHistory.length ? (
          <div className="space-y-2">
            {listeningHistory.map((song, index) => (
              <SongRow
                key={`${song.provider}-${song.id}-${index}`}
                song={song}
                number={index + 1}
                onOpenPlayer={(track) =>
                  handleOpenPlayer(track, [track])
                }
                onMoreOptions={handleSongMoreOptions}
                isActive={sameTrack(song, currentSong)}
                isLoading={
                  playerLoading &&
                  sameTrack(song, currentSong)
                }
                isPlaying={isPlaying}
                error={
                  playerError &&
                  sameTrack(song, currentSong)
                    ? playerError
                    : ''
                }
                {...favoriteProps(song)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <p className="text-sm font-medium text-white/70">
              No listening history yet.
            </p>

            <button
              type="button"
              onClick={() => handleSelectTab('Browse')}
              className="mt-4 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              Browse music
            </button>
          </div>
        )}
      </section>

      {/* FAVORITES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionHeader title="Favorites" />

            <p className="mt-1 text-xs text-white/35">
              {favorites.length}{' '}
              {favorites.length === 1
                ? 'song'
                : 'songs'}
            </p>
          </div>

          {favorites.length ? (
            <button
              type="button"
              onClick={() => {
                void handleClearFavorites()
              }}
              className="min-h-11 px-2 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80"
            >
              Clear
            </button>
          ) : null}
        </div>

        {favorites.length ? (
          <div className="space-y-2">
            {favorites.map(
              (song, index) => (
                <SongRow
                  key={`${song.provider}-${song.id}`}
                  song={song}
                  number={index + 1}
                  onOpenPlayer={(track) =>
                    handleOpenPlayer(track, [
                      track,
                    ])
                  }
                  onMoreOptions={
                    handleSongMoreOptions
                  }
                  isActive={sameTrack(
                    song,
                    currentSong,
                  )}
                  isLoading={
                    playerLoading &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                  }
                  isPlaying={isPlaying}
                  error={
                    playerError &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                      ? playerError
                      : ''
                  }
                  {...favoriteProps(song)}
                />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <Heart
              size={22}
              className="mx-auto text-white/25"
            />

            <p className="mt-4 text-sm font-medium text-white/70">
              No favorites yet.
            </p>

            <p className="mt-2 text-xs text-white/40">
              Favorite songs from your search results
              and they will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  )

  /*
   * =========================================================
   * MOBILE SEARCH
   * =========================================================
   */
  const renderSearchSheet = () => (
    <div
      className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
      onClick={() =>
        setShowSearchSheet(false)
      }
    >
      <div
        className="mx-auto max-w-md rounded-b-[32px] border border-white/10 bg-[#111214] p-4 pt-5 shadow-2xl"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0c0f] px-3 py-3 text-white/60">
          <Search size={16} />

          <input
            autoFocus
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            onKeyDown={handleSearchKeyDown}
            placeholder="Search music"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
            aria-label="Search"
          />

          {searchText ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white/80"
            >
              Clear
            </button>
          ) : null}
        </div>

        <p className="mt-4 text-xs leading-5 text-white/35">
          Search artists, albums, or songs.
        </p>
      </div>
    </div>
  )

  /*
   * =========================================================
   * FULL PLAYER
   * =========================================================
   */
  const renderPlayerScreen = () => {
    const activeDuration =
      playerDuration ||
      currentSong?.durationSeconds ||
      0

    const activeQueue = playerQueue

    if (!currentSong) {
      return (
        <div className="pb-28 lg:pb-10">
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <p className="text-sm font-medium text-white/70">
              Nothing is playing.
            </p>

            <button
              type="button"
              onClick={() =>
                handleSelectTab('Browse')
              }
              className="mt-5 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70"
            >
              Search music
            </button>
          </div>
        </div>
      )
    }

    const currentIsFavorite =
      favorites.some((track) =>
        sameTrack(track, currentSong),
      )

    return (
      <div className="pb-28 lg:pb-10">
        <section className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#101114] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="relative p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setActiveTab('Home')
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07] active:scale-95"
                aria-label="Close full player"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/30">
                  Now playing
                </p>

                <p className="mt-1 text-xs text-white/20">
                  Streaming
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setIsLyricsOpen(true)
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.07] active:scale-95"
                aria-label="Open lyrics"
              >
                <ListMusic size={18} />
              </button>
            </div>

            <div className="mx-auto mt-7 max-w-2xl">
              <div className="flex flex-col items-center">
                <div className="relative aspect-square w-full max-w-[360px] overflow-hidden rounded-[24px] bg-[#18191d] shadow-[0_30px_70px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.08]">
                  <Artwork
                    src={currentSong.artwork}
                    className="absolute inset-0 h-full w-full object-cover"
                    iconSize={64}
                  />

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                </div>

                <div className="mt-7 text-center">
                  <h2 className="text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl">
                    {currentSong.title}
                  </h2>

                  <p className="mt-2 text-base text-white/50">
                    {currentSong.artist}
                  </p>

                  {currentSong.album ? (
                    <p className="mt-1 text-xs text-white/25">
                      {currentSong.album}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-8 max-w-4xl">
              <div className="mb-2 flex items-center justify-between text-[11px] tabular-nums text-white/30">
                <span>
                  {formatTime(currentTime)}
                </span>

                <span>
                  {formatTime(activeDuration)}
                </span>
              </div>

              <ProgressBar
                value={currentTime}
                total={activeDuration}
                onChange={seekTo}
              />
            </div>

            <div className="mx-auto mt-7 flex max-w-xl items-center justify-between px-1 sm:px-4">
              <button
                type="button"
                onClick={() =>
                  setIsShuffle(
                    (value) => !value,
                  )
                }
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition active:scale-95 ${
                  isShuffle
                    ? 'bg-white/10 text-white'
                    : 'bg-white/[0.025] text-white/40 hover:text-white/75'
                }`}
                aria-label="Toggle shuffle"
              >
                <Shuffle size={18} />
              </button>

              <button
                type="button"
                onClick={prevTrack}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-white/65 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
                aria-label="Previous track"
              >
                <SkipBack size={20} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={playerLoading}
                className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-black shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:scale-[1.03] active:scale-95 disabled:cursor-wait disabled:opacity-60"
                aria-label={
                  isPlaying
                    ? 'Pause'
                    : 'Play'
                }
              >
                {playerLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                ) : isPlaying ? (
                  <Pause
                    size={25}
                    fill="currentColor"
                  />
                ) : (
                  <Play
                    size={25}
                    fill="currentColor"
                    className="ml-1"
                  />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-white/65 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
                aria-label="Next track"
              >
                <SkipForward size={20} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsRepeat(
                    (value) => !value,
                  )
                }
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition active:scale-95 ${
                  isRepeat
                    ? 'bg-white/10 text-white'
                    : 'bg-white/[0.025] text-white/40 hover:text-white/75'
                }`}
                aria-label="Toggle repeat"
              >
                <Repeat size={18} />
              </button>
            </div>

            <div className="mx-auto mt-7 flex max-w-xl items-center justify-center gap-3 border-t border-white/[0.06] pt-5">
              <button
                type="button"
                onClick={() =>
                  handleToggleFavorite(
                    currentSong,
                  )
                }
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition active:scale-95 ${
                  currentIsFavorite
                    ? 'bg-white/10 text-white'
                    : 'bg-white/[0.025] text-white/40 hover:text-white/80'
                }`}
                aria-label={
                  currentIsFavorite
                    ? 'Remove from favorites'
                    : 'Add to favorites'
                }
              >
                <Heart
                  size={18}
                  fill={
                    currentIsFavorite
                      ? 'currentColor'
                      : 'none'
                  }
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setQueueOpen(true)
                }
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-5 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white active:scale-95 lg:hidden"
                aria-label="Open queue"
              >
                <ListMusic size={16} />
                Queue
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlaylistError('')

                  setPlaylistModal({
                    open: true,
                    mode: 'add',
                    song: currentSong,
                  })
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
                aria-label="Add current song to playlist"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            {playerError ? (
              <p className="mt-4 text-center text-xs text-white/35">
                Unable to play this track. Tap play
                to retry.
              </p>
            ) : null}
          </div>
        </section>

        {activeQueue.length ? (
          <div className="mt-5 hidden lg:block">
            <QueuePanel
              queue={activeQueue}
              currentSong={currentSong}
              onSelectTrack={(track) => {
                handleOpenPlayer(
                  track,
                  activeQueue,
                )
              }}
            />
          </div>
        ) : null}
      </div>
    )
  }

  /*
   * =========================================================
   * SELECTED PLAYLIST
   * =========================================================
   */
  const renderSelectedPlaylist = () => {
    const playlist = selectedPlaylist?.id
      ? playlists.find(
          (item) => item.id === selectedPlaylist.id,
        ) || selectedPlaylist
      : null

    const playlistSongs = Array.isArray(
      playlist?.songs,
    )
      ? playlist.songs.map(toUiSong)
      : []

    if (!playlist) {
      return (
        <div className="pb-28 lg:pb-10">
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
            <ListMusic
              size={28}
              className="mx-auto text-white/25"
            />

            <p className="mt-4 text-sm font-medium text-white/70">
              Select a playlist
            </p>

            <button
              type="button"
              onClick={() =>
                handleSelectTab('Library')
              }
              className="mt-5 min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              Open library
            </button>
          </div>
        </div>
      )
    }

    const playlistTitle =
      playlist.title ||
      playlist.name ||
      'Untitled playlist'

    return (
      <div className="space-y-8 pb-28 lg:pb-10">
        <section className="rounded-[24px] border border-white/[0.07] bg-[#101114] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() =>
                  handleSelectTab('Library')
                }
                className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/40 transition hover:text-white/75"
              >
                <ArrowLeft size={14} />
                Back to library
              </button>

              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">
                Playlist
              </p>

              <h2 className="mt-2 truncate text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                {playlistTitle}
              </h2>

              <p className="mt-3 text-sm text-white/45">
                {playlistSongs.length}{' '}
                {playlistSongs.length === 1
                  ? 'song'
                  : 'songs'}
              </p>

              {playlist.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                  {playlist.description}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditPlaylistDialog(playlist)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => openEditPlaylistDialog(playlist)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Edit description
                </button>
                <button
                  type="button"
                  onClick={() => openDeletePlaylistDialog(playlist)}
                  className="rounded-full border border-red-400/15 px-3 py-1.5 text-xs text-red-300/70 transition hover:bg-red-400/[0.08] hover:text-red-200"
                >
                  Delete playlist
                </button>
              </div>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white shadow-[0_16px_40px_rgba(117,103,248,0.2)] sm:h-24 sm:w-24">
              {playlist.cover_url ? (
                <img
                  src={playlist.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ListMusic size={25} />
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader title="Songs" />

          {playlistSongs.length ? (
            <div className="space-y-2">
              {playlistSongs.map((song, index) => (
                <SongRow
                  key={`${song.provider}-${song.id}-${index}`}
                  song={song}
                  number={index + 1}
                  onOpenPlayer={(track) =>
                    handleOpenPlayer(
                      track,
                      playlistSongs,
                    )
                  }
                  onMoreOptions={
                    handleSongMoreOptions
                  }
                  isActive={sameTrack(
                    song,
                    currentSong,
                  )}
                  isLoading={
                    playerLoading &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                  }
                  isPlaying={isPlaying}
                  error={
                    playerError &&
                    sameTrack(
                      song,
                      currentSong,
                    )
                      ? playerError
                      : ''
                  }
                  {...favoriteProps(song)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
              <ListMusic
                size={26}
                className="mx-auto text-white/25"
              />

              <p className="mt-4 text-sm font-medium text-white/70">
                This playlist is empty
              </p>

              <p className="mt-2 text-xs leading-5 text-white/40">
                Add songs from the three-dot menu
                in your search results.
              </p>

              <button
                type="button"
                onClick={() =>
                  handleSelectTab('Browse')
                }
                className="mt-5 min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
              >
                Browse music
              </button>
            </div>
          )}
        </section>
      </div>
    )
  }

  /*
   * =========================================================
   * PLAYLIST MODAL
   * =========================================================
   */
  const renderPlaylistModal = () => {
    if (!playlistModal.open) {
      return null
    }

    const selectedSong =
      playlistModal.song

    const isCreateMode =
      playlistModal.mode === 'create' ||
      playlistModal.mode === 'create-empty'

    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
        onClick={closePlaylistModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-dialog-title"
          className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#111214] shadow-[0_30px_100px_rgba(0,0,0,0.6)]"
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  id="playlist-dialog-title"
                  className="text-lg font-semibold tracking-[-0.03em] text-white"
                >
                  {isCreateMode
                    ? 'Create playlist'
                    : 'Add to playlist'}
                </p>

                <p className="mt-1 text-xs text-white/40">
                  {isCreateMode
                    ? 'Create a playlist and add this song to it.'
                    : selectedSong
                      ? `Choose where to add “${selectedSong.title}”.`
                      : 'Choose a playlist.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closePlaylistModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/45 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {isCreateMode ? (
            <div className="p-5">
              {selectedSong ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#18191d]">
                    <Artwork
                      src={selectedSong.artwork}
                      className="absolute inset-0 h-full w-full object-cover"
                      iconSize={17}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {selectedSong.title}
                    </p>

                    <p className="mt-1 truncate text-xs text-white/40">
                      {selectedSong.artist}
                    </p>
                  </div>
                </div>
              ) : null}

              <label
                htmlFor="playlist-name"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-white/40"
              >
                Playlist name
              </label>

              <input
                id="playlist-name"
                autoFocus
                value={playlistName}
                onChange={(event) => {
                  setPlaylistName(
                    event.target.value,
                  )
                  setPlaylistError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleCreatePlaylist()
                  }
                }}
                placeholder="My playlist"
                maxLength={60}
                className="w-full rounded-2xl border border-white/10 bg-[#0b0c0f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#7567F8]/50 focus:ring-2 focus:ring-[#7567F8]/10"
              />

              {playlistError ? (
                <p
                  className="mt-2 text-xs text-[#A9A4FF]"
                  role="alert"
                >
                  {playlistError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleCreatePlaylist}
                className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-[0.98]"
              >
                <Plus size={16} />
                Create playlist
              </button>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {playlists.length ? (
                <div className="space-y-1">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() =>
                        handleAddToPlaylist(
                          playlist,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white">
                        {playlist.cover_url ? (
                          <img
                            src={playlist.cover_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ListMusic size={17} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {playlist.title ||
                            playlist.name ||
                            'Untitled playlist'}
                        </p>

                        <p className="mt-1 text-xs text-white/35">
                          {Array.isArray(
                            playlist.songs,
                          )
                            ? playlist.songs.length
                            : 0}{' '}
                          {Array.isArray(
                            playlist.songs,
                          ) &&
                          playlist.songs.length === 1
                            ? 'song'
                            : 'songs'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <ListMusic
                    size={24}
                    className="mx-auto text-white/25"
                  />

                  <p className="mt-4 text-sm text-white/70">
                    No playlists yet.
                  </p>

                  <p className="mt-2 text-xs leading-5 text-white/35">
                    Create your first playlist to
                    add this song.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setPlaylistName('')
                      setPlaylistError('')

                      setPlaylistModal({
                        open: true,
                        mode: 'create',
                        song: selectedSong,
                      })
                    }}
                    className="mt-5 min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 active:scale-95"
                  >
                    Create playlist
                  </button>
                </div>
              )}

              {playlistError ? (
                <p
                  className="px-3 pt-2 text-xs text-[#A9A4FF]"
                  role="alert"
                >
                  {playlistError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setPlaylistName('')
                  setPlaylistError('')

                  setPlaylistModal({
                    open: true,
                    mode: 'create',
                    song: selectedSong,
                  })
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-left text-sm text-white/55 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025]">
                  <Plus size={17} />
                </div>

                Create new playlist
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  /*
   * =========================================================
   * SCREEN ROUTER
   * =========================================================
   */
  const renderScreen = () => {
    if (activeTab === 'Browse') {
      return renderBrowseScreen()
    }

    if (activeTab === 'Radio') {
      return renderRadioScreen()
    }

    if (activeTab === 'Library') {
      return renderLibraryScreen()
    }

    if (activeTab === 'Playlist') {
      return renderSelectedPlaylist()
    }

    if (activeTab === 'Album') {
      return renderSelectedAlbum()
    }

    if (activeTab === 'Artist') {
      return renderSelectedArtist()
    }

    if (activeTab === 'Player') {
      return renderPlayerScreen()
    }

    return renderHomeScreen()
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08090b] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <p className="text-sm text-white/45">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-white selection:bg-white/15 selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
        <DesktopSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (
              tab === 'Home' ||
              tab === 'Browse' ||
              tab === 'Radio' ||
              tab === 'Library'
            ) {
              handleSelectTab(tab)
            }
          }}
            playlists={playlists}
            selectedPlaylist={selectedPlaylist}
            onSelectPlaylist={openPlaylist}
            profileName={profileName}
            user={user}
            onSignOut={handleSignOut}
        />

        <main className="order-last relative min-w-0 flex-1 overflow-hidden bg-[#090a0c] lg:order-none">
          <TopBar
            title={activeTab}
            searchValue={searchText}
            onOpenSearch={handleOpenSearch}
            profileName={profileName}
          />

          <div className="tab-screen px-4 pb-32 pt-5 sm:px-6 lg:px-10">
            {renderScreen()}
          </div>
        </main>

        <aside
          className="order-first w-full shrink-0 border-b border-white/[0.07] bg-[#0b0c0f] lg:order-none lg:w-[360px] lg:border-b-0 lg:border-l lg:border-white/[0.07]"
          aria-label="Now playing"
        >
          <div className="p-4 sm:p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/35">
                  AURAAN
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
                  Now playing
                </h2>
              </div>

            </div>

            <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#101114] shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="relative aspect-video w-full bg-black">
                {currentSong?.provider === 'verome' ? (
                  <>
                    <div
                      ref={veromePlayerContainerRef}
                      className="absolute inset-0 h-full w-full"
                    />

                    {playerLoading ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      </div>
                    ) : null}
                  </>
                ) : currentSong ? (
                  <div className="absolute inset-0 bg-[#18191d]">
                    <Artwork
                      src={currentSong.artwork}
                      className="absolute inset-0 h-full w-full object-cover"
                      iconSize={56}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-transparent px-6 text-center">
                    <p className="text-sm text-white/35">
                      Choose a song to start listening.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {currentSong ? (
              <div className="mt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold tracking-[-0.03em] text-white">
                      {currentSong.title}
                    </p>

                    <p className="mt-1 truncate text-sm text-white/50">
                      {currentSong.artist}
                    </p>

                    {currentSong.album ? (
                      <p className="mt-1 truncate text-xs text-white/30">
                        {currentSong.album}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('Player')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-white/40 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
                    aria-label="Open full player"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(currentSong)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition active:scale-95 ${
                      favorites.some((item) =>
                        sameTrack(item, currentSong),
                      )
                        ? 'bg-white/10 text-white'
                        : 'bg-white/[0.025] text-white/40 hover:text-white'
                    }`}
                    aria-label="Toggle favorite"
                  >
                    <Heart
                      size={17}
                      fill={
                        favorites.some((item) =>
                          sameTrack(item, currentSong),
                        )
                          ? 'currentColor'
                          : 'none'
                      }
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenPlayer(
                        currentSong,
                        playerQueue?.length
                          ? playerQueue
                          : [currentSong],
                      )
                    }
                    disabled={playerLoading}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black transition hover:bg-white/90 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                  >
                    {playerLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    ) : isPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}

                    {isPlaying ? 'Pause' : 'Play'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setQueueOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-white/40 transition hover:bg-white/[0.07] hover:text-white active:scale-95"
                    aria-label="Open queue"
                  >
                    <ListMusic size={17} />
                  </button>
                </div>

                {playerError ? (
                  <p
                    className="mt-3 text-xs leading-5 text-white/35"
                    role="alert"
                  >
                    {playerError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {showSearchSheet
        ? renderSearchSheet()
        : null}

      <QueueSheet
        isOpen={isQueueOpen}
        onClose={() =>
          setQueueOpen(false)
        }
        queue={playerQueue}
        currentSong={currentSong}
        onSelectTrack={(track) => {
          setQueueOpen(false)

          handleOpenPlayer(
            track,
            playerQueue,
          )
        }}
      />

      <LyricsSheet
        isOpen={isLyricsOpen}
        onClose={() =>
          setIsLyricsOpen(false)
        }
        song={currentSong}
        lyrics={null}
      />

      {renderPlaylistModal()}
      {renderPlaylistEditDialog()}

      {!isQueueOpen &&
      !isLyricsOpen &&
      !playlistModal.open &&
      activeTab !== 'Player' &&
      currentSong ? (
        <MiniPlayer
          song={currentSong}
          isPlaying={isPlaying}
          isLoading={playerLoading}
          error={
            playerError
              ? 'Unable to play this track. Tap play to retry.'
              : ''
          }
          currentTime={currentTime}
          duration={
            playerDuration ||
            currentSong.durationSeconds
          }
          onTogglePlay={togglePlay}
          onOpenPlayer={() =>
            setActiveTab('Player')
          }
          onPreviousTrack={prevTrack}
          onNextTrack={nextTrack}
          onOpenQueue={() =>
            setQueueOpen(true)
          }
        />
      ) : null}

      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />
    </div>
  )
}

export default App