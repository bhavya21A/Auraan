import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Play,
} from 'lucide-react'

import Artwork from './Artwork'
import SongRow from './SongRow'
import { getAlbum } from '../services/musicApi'

const DEFAULT_PROVIDER = 'jiosaavn'

const formatDuration = (seconds) => {
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

const getArtistName = (song) => {
  if (song?.artist) {
    return String(song.artist)
  }

  const primaryArtists = song?.artists?.primary

  if (
    Array.isArray(primaryArtists) &&
    primaryArtists.length
  ) {
    return primaryArtists
      .map((artist) => artist?.name)
      .filter(Boolean)
      .join(', ')
  }

  return (
    song?.artistName ||
    song?.primaryArtist ||
    'Unknown artist'
  )
}

const getArtwork = (song) => {
  if (song?.artwork) {
    return song.artwork
  }

  if (typeof song?.image === 'string') {
    return song.image
  }

  if (Array.isArray(song?.image)) {
    return (
      song.image.find(
        (image) => image?.quality === '500x500',
      )?.url ||
      song.image.find((image) => image?.url)?.url ||
      null
    )
  }

  return (
    song?.cover ||
    song?.coverImage ||
    null
  )
}

const getStreamUrl = (song) => {
  if (song?.streamUrl) {
    return song.streamUrl
  }

  if (!Array.isArray(song?.downloadUrl)) {
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
    const match = song.downloadUrl.find(
      (item) =>
        item?.quality === quality &&
        item?.url,
    )

    if (match?.url) {
      return match.url
    }
  }

  return (
    song.downloadUrl.find(
      (item) => item?.url,
    )?.url || null
  )
}

const normalizeAlbumSong = (song) => {
  if (!song || typeof song !== 'object') {
    return null
  }

  const id =
    song.id != null
      ? String(song.id)
      : ''

  const title = String(
    song.title ||
      song.name ||
      '',
  ).trim()

  if (!id || !title) {
    return null
  }

  const duration = Number(
    song.duration,
  )

  const streamUrl = getStreamUrl(song)

  return {
    ...song,

    id,
    provider:
      song.provider ||
      DEFAULT_PROVIDER,

    title,

    artist: getArtistName(song),

    album:
      song.album?.name ||
      song.album ||
      null,

    artwork: getArtwork(song),

    duration:
      Number.isFinite(duration) &&
      duration >= 0
        ? duration
        : 0,

    durationSeconds:
      Number.isFinite(duration) &&
      duration >= 0
        ? duration
        : 0,

    playable: Boolean(streamUrl),

    streamUrl,

    url: song.url || null,

    year: song.year || null,

    language:
      song.language || null,

    explicitContent:
      Boolean(song.explicitContent),

    cover: '',
  }
}

const normalizeAlbumData = (
  response,
  fallbackAlbum,
) => {
  const rawAlbum =
    response?.album ||
    response?.data?.album ||
    response?.data ||
    response

  const album =
    Array.isArray(rawAlbum)
      ? rawAlbum[0]
      : rawAlbum

  if (!album || typeof album !== 'object') {
    return {
      ...fallbackAlbum,
      songs: [],
    }
  }

  const rawSongs =
    album.songs ||
    album.results ||
    album.tracks ||
    album.data ||
    []

  const songs = Array.isArray(rawSongs)
    ? rawSongs
        .map(normalizeAlbumSong)
        .filter(Boolean)
    : []

  return {
    ...fallbackAlbum,
    ...album,

    id:
      album.id != null
        ? String(album.id)
        : fallbackAlbum.id,

    title:
      album.title ||
      album.name ||
      fallbackAlbum.title,

    artist:
      album.artist ||
      album.artistName ||
      album.primaryArtist ||
      fallbackAlbum.artist ||
      'Unknown artist',

    artwork:
      album.artwork ||
      album.image ||
      album.cover ||
      album.coverImage ||
      fallbackAlbum.artwork ||
      null,

    year:
      album.year ||
      fallbackAlbum.year ||
      null,

    songs,
  }
}

export default function AlbumPage({
  album,
  onBack,
  onOpenPlayer,
}) {
  const [albumData, setAlbumData] =
    useState(null)

  const [status, setStatus] =
    useState('loading')

  const [error, setError] =
    useState('')

  useEffect(() => {
    let cancelled = false

    const loadAlbum = async () => {
      if (!album?.id) {
        onBack?.()
        return
      }

      setStatus('loading')
      setError('')
      setAlbumData(null)

      try {
        const response = await getAlbum(
          String(album.id),
          DEFAULT_PROVIDER,
        )

        if (cancelled) {
          return
        }

        const normalizedAlbum =
          normalizeAlbumData(
            response,
            album,
          )

        setAlbumData(normalizedAlbum)
        setStatus('success')
      } catch (loadError) {
        if (cancelled) {
          return
        }

        console.error(
          'Failed to load album:',
          loadError,
        )

        setError(
          loadError?.message ||
            'Unable to load this album right now.',
        )

        setStatus('error')
      }
    }

    void loadAlbum()

    return () => {
      cancelled = true
    }
  }, [album, onBack])

  const songs = useMemo(
    () =>
      Array.isArray(albumData?.songs)
        ? albumData.songs
        : [],
    [albumData],
  )

  const playableSongs = useMemo(
    () =>
      songs.filter(
        (song) =>
          song.playable !== false &&
          song.streamUrl,
      ),
    [songs],
  )

  const handlePlayAlbum = () => {
    if (!playableSongs.length) {
      return
    }

    onOpenPlayer?.(
      playableSongs[0],
      playableSongs,
    )
  }

  const handlePlaySong = (song) => {
    if (
      !song ||
      song.playable === false
    ) {
      return
    }

    onOpenPlayer?.(
      song,
      playableSongs,
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] pb-28 lg:pb-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <p className="text-sm text-white/40">
              Loading album...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] pb-28 lg:pb-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8">
          <p className="text-sm text-white/70">
            {error}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.09]"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const displayAlbum =
    albumData || album

  return (
    <div className="space-y-7 pb-28 lg:pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#101114]">
        <div className="flex flex-col gap-7 p-5 sm:p-7 md:flex-row md:items-end">
          <div className="h-52 w-52 shrink-0 overflow-hidden rounded-[20px] bg-[#18191d] ring-1 ring-white/[0.08] sm:h-60 sm:w-60">
            <Artwork
              src={displayAlbum.artwork}
              className="h-full w-full object-cover"
              iconSize={42}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">
              Album
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {displayAlbum.title}
            </h1>

            <p className="mt-3 text-sm text-white/55">
              {displayAlbum.artist ||
                'Unknown artist'}

              {displayAlbum.year
                ? ` · ${displayAlbum.year}`
                : ''}

              {songs.length
                ? ` · ${songs.length} ${
                    songs.length === 1
                      ? 'song'
                      : 'songs'
                  }`
                : ''}
            </p>

            <button
              type="button"
              onClick={handlePlayAlbum}
              disabled={
                playableSongs.length === 0
              }
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Play
                size={16}
                fill="currentColor"
              />
              Play
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {songs.length ? (
          songs.map((song, index) => (
            <SongRow
              key={`${song.provider}-${song.id}`}
              song={{
                ...song,
                duration: formatDuration(
                  song.durationSeconds ??
                    song.duration,
                ),
              }}
              number={index + 1}
              onOpenPlayer={handlePlaySong}
              isActive={false}
              isLoading={false}
            />
          ))
        ) : (
          <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-8">
            <p className="text-sm text-white/50">
              No songs were found in this album.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}