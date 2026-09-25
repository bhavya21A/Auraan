import { useEffect, useRef, useState } from 'react'
import AuthScreen from './components/auth/AuthScreen'
import { supabase } from './services/supabase'


import {
  ArrowLeft,
  Heart,
  ListMusic,
  MoreHorizontal,
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

import {
  createPlaylist,
  addSongToPlaylist,
  readPlaylists,
} from './utils/playlists'

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

import { searchMusic } from './services/musicApi'
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
const SEARCH_PAGE_SIZE = 10

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

function formatTrackDuration(seconds) {
  const value = Number(seconds)

  if (!Number.isFinite(value) || value < 0) {
    return '--:--'
  }

  return `${Math.floor(value / 60)}:${Math.floor(
    value % 60,
  )
    .toString()
    .padStart(2, '0')}`
}

function toUiSong(track) {
  const duration = Number(track.duration)

  return {
    ...track,
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || null,
    artwork: track.artwork || null,
    provider: track.provider || DEFAULT_PROVIDER,
    duration: formatTrackDuration(duration),
    durationSeconds:
      Number.isFinite(duration) && duration >= 0
        ? duration
        : 0,
    playable: track.playable !== false,
    cover: '',
  }
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

  const [playlistError, setPlaylistError] =
    useState('')

  const searchRequestIdRef = useRef(0)
  const lastSearchQueryRef = useRef('')
  const lastRecordedTrackRef = useRef('')
  const lastRecordedHistoryRef = useRef('')
  const searchInputRef = useRef(null)

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
    // Do NOT mark the track as history-recorded before this check.
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

      console.log(
        'HISTORY: Supabase response',
        JSON.stringify({ data, error }, null, 2),
      )

      if (error) {
        console.error(
          'Failed to save listening history:',
          JSON.stringify(error, null, 2),
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
   * Recently played and playlists are still local for now.
   * Liked songs are now persisted in Supabase per user.
   */
  useEffect(() => {
    let cancelled = false

    const loadUserMusicState = async () => {
      if (!user) {
        setRecentlyPlayed([])
        setListeningHistory([])
        setFavorites([])
        setPlaylists([])
        setSelectedPlaylist(null)
        return
      }

      setRecentlyPlayed(readRecentlyPlayed().map(toUiSong))
      setPlaylists(readPlaylists())

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
        'FAILED TO LOAD LISTENING HISTORY:',
        JSON.stringify(historyError, null, 2),
      )

      console.error('HISTORY USER ID:', user.id)

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
        console.error(
          'FAILED TO LOAD LIKED SONGS:',
          JSON.stringify(error, null, 2),
        )

        console.error('LIKED SONGS USER ID:', user.id)

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
    setSearchText('')
    setSearchResults([])
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
   * Keep playlist state synchronized with local storage.
   */
  useEffect(() => {
    if (!user) return undefined

    const handleStorage = () => {
      setPlaylists(readPlaylists())
    }

    window.addEventListener(
      'storage',
      handleStorage,
    )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage,
      )
    }
  }, [])

  /*
   * Search
   */
  const handleSearch = async () => {
    const query = searchText.trim()
    const normalizedQuery = query.replace(/\s+/g, ' ')

    if (!normalizedQuery) {
      searchRequestIdRef.current += 1
      lastSearchQueryRef.current = ''

      setSearchResults([])
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
    lastSearchQueryRef.current =
      normalizedQuery

    setActiveTab('Browse')
    setShowSearchSheet(false)
    setSearchStatus('loading')
    setSearchError('')
    setSubmittedQuery(normalizedQuery)
    setIsLoadingMore(false)
    setLoadMoreError('')
    setHasMoreResults(false)

    try {
      const response = await searchMusic(
        normalizedQuery,
        DEFAULT_PROVIDER,
        {
          limit: SEARCH_PAGE_SIZE,
        },
      )

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      const results = dedupeTracks(
        response.results.map(toUiSong),
      )

      setSearchResults(results)

      setSearchStatus(
        results.length ? 'success' : 'empty',
      )

      setHasMoreResults(
        response.results.length >=
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

    const requestId =
      searchRequestIdRef.current + 1

    searchRequestIdRef.current = requestId

    setIsLoadingMore(true)
    setLoadMoreError('')

    try {
      const nextLimit =
        searchResults.length +
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
    lastSearchQueryRef.current = ''

    setSearchResults([])
    setSearchStatus('idle')
    setSearchError('')
    setSubmittedQuery('')
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
  const handleOpenPlayer = (
    song,
    playbackQueue = searchResults,
  ) => {
    if (!song) return

    if (
      song.provider &&
      song.playable === false
    ) {
      return
    }

    if (song.provider) {
      playTrack(song, playbackQueue)
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
   * =========================================================
   * PLAYLIST FUNCTIONALITY
   * =========================================================
   */

  /*
   * Refresh playlist state from persistent storage.
   */
  const refreshPlaylists = () => {
    const nextPlaylists = readPlaylists()
    setPlaylists(nextPlaylists)

    if (selectedPlaylist?.id) {
      const updatedSelected = nextPlaylists.find(
        (playlist) =>
          playlist.id === selectedPlaylist.id,
      )

      setSelectedPlaylist(
        updatedSelected || null,
      )
    }
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
    setPlaylistError('')
  }

  /*
   * Create a new playlist and automatically
   * add the selected song to it.
   */
  const handleCreatePlaylist = () => {
    const name = playlistName.trim()

    if (!name) {
      setPlaylistError(
        'Give your playlist a name.',
      )
      return
    }

    try {
      const playlist = createPlaylist(name)

      if (!playlist?.id) {
        setPlaylistError(
          'Unable to create playlist.',
        )
        return
      }

      if (playlistModal.song) {
        addSongToPlaylist(
          playlist.id,
          playlistModal.song,
        )
      }

      refreshPlaylists()
      closePlaylistModal()
    } catch (error) {
      console.error(
        'Create playlist error:',
        error,
      )

      setPlaylistError(
        'Unable to create playlist.',
      )
    }
  }

  /*
   * Add the selected song to an existing playlist.
   */
  const handleAddToPlaylist = (
    playlist,
  ) => {
    if (
      !playlist?.id ||
      !playlistModal.song
    ) {
      return
    }

    try {
      if (playlistModal.song) {
        addSongToPlaylist(
          playlist.id,
          playlistModal.song,
        )
      }

      refreshPlaylists()
      closePlaylistModal()
    } catch (error) {
      console.error(
        'Add to playlist error:',
        error,
      )

      setPlaylistError(
        'Unable to add this song to the playlist.',
      )
    }
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
  const renderBrowseScreen = () => (
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
        <section className="space-y-4">
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
                No music found for “
                {submittedQuery}”.
              </p>

              <p className="mt-2 text-xs text-white/40">
                Try another artist, song, or album.
              </p>
            </div>
          ) : null}

          {(
            searchStatus === 'success' ||
            (searchStatus === 'loading' &&
              searchResults.length > 0) ||
            (searchStatus === 'error' &&
              searchResults.length > 0)
          ) ? (
            <div className="space-y-3">
              <div
                className="flex items-center justify-between gap-3 text-xs text-white/35"
                aria-live="polite"
              >
                <span>
                  Results for “
                  {submittedQuery}”
                </span>

                <span>
                  {searchResults.length} loaded
                </span>
              </div>

              {searchResults.map(
                (song, index) => (
                  <SongRow
                    key={`${song.provider}-${song.id}`}
                    song={song}
                    number={index + 1}
                    onOpenPlayer={
                      handleOpenPlayer
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
            </div>
          ) : null}
        </section>
      ) : (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
          <Search
            size={22}
            className="mx-auto text-white/25"
          />

          <p className="mt-4 text-sm font-medium text-white/70">
            Search for something to listen to.
          </p>

          <p className="mt-2 text-xs text-white/40">
            Results will come from the connected
            music service.
          </p>
        </div>
      )}
    </div>
  )

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
              <button
                key={playlist.id}
                type="button"
                className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:border-white/[0.12] hover:bg-white/[0.045]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white">
                    <ListMusic size={19} />
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
                </div>
              </button>
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
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white shadow-[0_16px_40px_rgba(117,103,248,0.2)]">
              <ListMusic size={25} />
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

                  if (event.key === 'Escape') {
                    closePlaylistModal()
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
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7567F8] to-[#9B94FF] text-white">
                        <ListMusic size={17} />
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
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
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

        <main className="relative min-w-0 flex-1 overflow-hidden bg-[#090a0c]">
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