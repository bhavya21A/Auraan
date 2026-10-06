import {
  searchMusic,
  searchArtists,
} from "./musicApi"

import {
  searchVerome,
  getVeromeArtist,
} from "./veromeApi"

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const DEFAULT_MIX_COUNT = 8
const DEFAULT_TRACKS_PER_MIX = 40

/*
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

const getTrackKey = (track) =>
  `${track?.provider || "unknown"}-${track?.id || ""}`

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()

const normalizeArtistName = (value) =>
  normalizeText(value).toLowerCase()

const uniqueTracks = (tracks = []) => {
  const seen = new Set()

  return tracks.filter((track) => {
    const key = getTrackKey(track)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

/*
 * JioSaavn and Verome can return the same song
 * with different provider IDs.
 *
 * Use title + artist to remove those duplicates.
 */
const getTrackContentKey = (track) => {
  const title = normalizeText(track?.title).toLowerCase()

  const artist = normalizeText(
    track?.artist ||
      track?.artistName ||
      "",
  ).toLowerCase()

  if (!title || !artist) {
    return ""
  }

  return `${title}::${artist}`
}

const uniqueContentTracks = (tracks = []) => {
  const seen = new Set()

  return tracks.filter((track) => {
    const providerKey = getTrackKey(track)
    const contentKey = getTrackContentKey(track)

    const key = contentKey || providerKey

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

/*
 * =========================================================
 * ARTWORK HELPERS
 * =========================================================
 *
 * Only real provider artwork is returned.
 *
 * No sample/fallback image is generated here.
 */

const getArtworkFromObject = (value) => {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return value.trim() || null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const artwork = getArtworkFromObject(item)

      if (artwork) {
        return artwork
      }
    }

    return null
  }

  if (typeof value === "object") {
    const possibleFields = [
      "artwork",
      "image",
      "imageUrl",
      "image_url",
      "imageUrlHigh",
      "image_url_high",
      "avatar",
      "avatarUrl",
      "avatar_url",
      "picture",
      "pictureUrl",
      "photo",
      "photoUrl",
      "cover",
      "coverUrl",
      "cover_url",
      "thumbnail",
      "thumbnailUrl",
      "thumbnail_url",
      "artistImage",
      "artist_image",
    ]

    for (const field of possibleFields) {
      const candidate = value[field]

      const artwork =
        getArtworkFromObject(candidate)

      if (artwork) {
        return artwork
      }
    }

    /*
     * Some APIs nest artwork inside another object.
     */
    const nestedFields = [
      "images",
      "artworks",
      "photos",
      "media",
    ]

    for (const field of nestedFields) {
      const nestedArtwork =
        getArtworkFromObject(
          value[field],
        )

      if (nestedArtwork) {
        return nestedArtwork
      }
    }
  }

  return null
}

const getArtistArtwork = (artist) =>
  getArtworkFromObject(artist)

/*
 * =========================================================
 * ARTIST NAME EXTRACTION
 * =========================================================
 */

const ignoredArtistNames = new Set([
  "",
  "various artists",
  "various artist",
  "unknown artist",
  "unknown",
  "va",
])

const cleanArtistName = (value) => {
  const name = normalizeText(value)

  if (!name) {
    return ""
  }

  const normalized =
    normalizeArtistName(name)

  if (ignoredArtistNames.has(normalized)) {
    return ""
  }

  return name
}

const getArtistNamesForTrack = (track) => {
  const names = []

  /*
   * Prefer structured artist arrays.
   */
  const trackArtists =
    Array.isArray(track?.artists)
      ? track.artists
      : []

  trackArtists.forEach((artist) => {
    const name =
      typeof artist === "string"
        ? artist
        : artist?.name ||
          artist?.title ||
          artist?.artistName

    const cleaned = cleanArtistName(name)

    if (cleaned) {
      names.push(cleaned)
    }
  })

  /*
   * Some normalized tracks only expose
   * `artist`.
   */
  const artistValue =
    track?.artist ||
    track?.artistName ||
    track?.singer ||
    ""

  if (artistValue) {
    String(artistValue)
      .split(
        /\s*(?:,|&|\band\b|\||\/)\s*/i,
      )
      .forEach((name) => {
        const cleaned = cleanArtistName(name)

        if (cleaned) {
          names.push(cleaned)
        }
      })
  }

  return [
    ...new Set(
      names.map((name) =>
        normalizeText(name),
      ),
    ),
  ]
}

const getArtistNames = (tracks = []) => {
  const artists = new Set()

  tracks.forEach((track) => {
    getArtistNamesForTrack(track).forEach(
      (artist) => {
        const normalized =
          normalizeArtistName(artist)

        if (normalized) {
          artists.add(normalized)
        }
      },
    )
  })

  return artists
}

const trackBelongsToArtist = (
  track,
  artistName,
) => {
  const target =
    normalizeArtistName(artistName)

  if (!target) {
    return false
  }

  const trackArtists =
    getArtistNamesForTrack(track)

  return trackArtists.some(
    (artist) =>
      normalizeArtistName(artist) ===
      target,
  )
}

/*
 * =========================================================
 * PROVIDER CACHE
 * =========================================================
 */

const artistProviderCache = new Map()

/*
 * =========================================================
 * JIOSAAVN ARTIST ARTWORK
 * =========================================================
 */

const findJioArtistArtwork = async (
  artistName,
) => {
  try {
    const response =
      await searchArtists(
        artistName,
        "jiosaavn",
        {
          limit: 10,
        },
      )

    const artists =
      Array.isArray(response?.results)
        ? response.results
        : []

    if (!artists.length) {
      return null
    }

    const normalizedName =
      normalizeArtistName(artistName)

    /*
     * Exact artist + artwork first.
     */
    const exactArtist =
      artists.find(
        (artist) =>
          normalizeArtistName(
            artist?.name ||
              artist?.title,
          ) === normalizedName &&
          Boolean(
            getArtistArtwork(artist),
          ),
      )

    if (exactArtist) {
      return getArtistArtwork(
        exactArtist,
      )
    }

    /*
     * Exact artist without artwork.
     */
    const exactWithoutArtwork =
      artists.find(
        (artist) =>
          normalizeArtistName(
            artist?.name ||
              artist?.title,
          ) === normalizedName,
      )

    const exactArtwork =
      getArtistArtwork(
        exactWithoutArtwork,
      )

    if (exactArtwork) {
      return exactArtwork
    }

    /*
     * Last provider-backed fallback:
     * first result with usable artwork.
     */
    const artworkArtist =
      artists.find((artist) =>
        Boolean(
          getArtistArtwork(artist),
        ),
      )

    return (
      getArtistArtwork(
        artworkArtist,
      ) || null
    )
  } catch (error) {
    console.warn(
      `JioSaavn artist artwork lookup failed for ${artistName}:`,
      error,
    )

    return null
  }
}

/*
 * =========================================================
 * JIOSAAVN ARTIST SONGS
 * =========================================================
 */

const fetchJioSaavnArtistSongs =
  async (
    artistName,
    targetCount = DEFAULT_TRACKS_PER_MIX,
  ) => {
    try {
      const response =
        await searchMusic(
          artistName,
          "jiosaavn",
          {
            /*
             * Ask for substantially more than
             * the final mix size so we have room
             * to remove unrelated songs and
             * duplicates.
             */
            limit: Math.max(
              100,
              targetCount * 4,
            ),
          },
        )

      const results =
        Array.isArray(response?.results)
          ? response.results
          : []

      /*
       * Only retain tracks that actually belong
       * to this artist.
       */
      const artistTracks =
        results.filter((track) =>
          trackBelongsToArtist(
            track,
            artistName,
          ),
        )

      return uniqueContentTracks(
        artistTracks,
      )
    } catch (error) {
      console.warn(
        `JioSaavn artist song lookup failed for ${artistName}:`,
        error,
      )

      return []
    }
  }

/*
 * =========================================================
 * VEROME ARTIST DATA
 * =========================================================
 */

const fetchVeromeArtistData =
  async (artistName) => {
    try {
      const response =
        await searchVerome(
          artistName,
        )

      const results =
        Array.isArray(response?.results)
          ? response.results
          : []

      if (!results.length) {
        return {
          artwork: null,
          songs: [],
        }
      }

      const normalizedName =
        normalizeArtistName(artistName)

      /*
       * Find artist-type results.
       */
      const artistResults =
        results.filter(
          (result) => {
            const type =
              String(
                result?.type ||
                  result?.resultType ||
                  "",
              ).toLowerCase()

            return (
              type === "artist" ||
              type === "artists"
            )
          },
        )

      /*
       * Exact artist match first.
       */
      const exactArtist =
        artistResults.find(
          (artist) =>
            normalizeArtistName(
              artist?.name ||
                artist?.title,
            ) === normalizedName,
        ) ||
        artistResults.find(
          (artist) =>
            Boolean(
              getArtistArtwork(
                artist,
              ),
            ),
        ) ||
        artistResults[0] ||
        null

      let artistArtwork =
        getArtistArtwork(
          exactArtist,
        )

      /*
       * Verome can return songs directly.
       */
      const searchSongs =
        results.filter(
          (result) => {
            const type =
              String(
                result?.type ||
                  result?.resultType ||
                  "",
              ).toLowerCase()

            return (
              type === "song" ||
              type === "track"
            )
          },
        )

      let songs =
        searchSongs.filter(
          (track) =>
            trackBelongsToArtist(
              track,
              artistName,
            ),
        )

      /*
       * If a real Verome artist exists,
       * request its detail data.
       */
      if (exactArtist?.id) {
        try {
          const detail =
            await getVeromeArtist(
              String(
                exactArtist.id,
              ),
            )

          const detailArtist =
            detail?.artist ||
            detail?.result ||
            null

          const detailArtwork =
            getArtistArtwork(
              detailArtist,
            )

          if (detailArtwork) {
            artistArtwork =
              detailArtwork
          }

          if (
            Array.isArray(
              detail?.songs,
            )
          ) {
            const detailSongs =
              detail.songs.map(
                (song) => ({
                  ...song,

                  type:
                    song?.type ||
                    "song",

                  provider:
                    song?.provider ||
                    "verome",

                  artist:
                    song?.artist ||
                    detailArtist?.name ||
                    artistName,
                }),
              )

            songs = [
              ...songs,
              ...detailSongs,
            ]
          }
        } catch (error) {
          console.warn(
            `Verome artist detail lookup failed for ${artistName}:`,
            error,
          )
        }
      }

      /*
       * Last artwork lookup from search results.
       */
      if (!artistArtwork) {
        const artworkResult =
          results.find((result) =>
            Boolean(
              getArtistArtwork(result),
            ),
          )

        artistArtwork =
          getArtistArtwork(
            artworkResult,
          ) || null
      }

      return {
        artwork:
          artistArtwork || null,

        songs:
          uniqueContentTracks(
            songs,
          ).filter((track) =>
            trackBelongsToArtist(
              track,
              artistName,
            ),
          ),
      }
    } catch (error) {
      console.warn(
        `Verome artist lookup failed for ${artistName}:`,
        error,
      )

      return {
        artwork: null,
        songs: [],
      }
    }
  }

/*
 * =========================================================
 * COMBINED JIOSAAVN + VEROME ARTIST DATA
 * =========================================================
 */

const fetchArtistProviderData =
  async (
    artistName,
    targetCount = DEFAULT_TRACKS_PER_MIX,
  ) => {
    const cleanedName =
      cleanArtistName(artistName)

    const normalizedName =
      normalizeArtistName(
        cleanedName,
      )

    if (!normalizedName) {
      return {
        artistName,
        artwork: null,
        songs: [],
      }
    }

    if (
      artistProviderCache.has(
        normalizedName,
      )
    ) {
      return artistProviderCache.get(
        normalizedName,
      )
    }

    const promise =
      (async () => {
        const [
          jioArtwork,
          jioSongs,
          veromeData,
        ] = await Promise.all([
          findJioArtistArtwork(
            cleanedName,
          ),

          fetchJioSaavnArtistSongs(
            cleanedName,
            targetCount,
          ),

          fetchVeromeArtistData(
            cleanedName,
          ),
        ])

        /*
         * JioSaavn artwork has priority.
         * Verome artwork is the fallback.
         */
        const artwork =
          jioArtwork ||
          veromeData?.artwork ||
          null

        /*
         * Combine both providers and
         * remove content duplicates.
         */
        const songs =
          uniqueContentTracks([
            ...jioSongs,
            ...(veromeData?.songs || []),
          ])

        return {
          artistName: cleanedName,
          artwork,
          songs,
        }
      })()

    artistProviderCache.set(
      normalizedName,
      promise,
    )

    return promise
  }

/*
 * =========================================================
 * SIMPLE DAILY MIX
 * =========================================================
 */

export function buildDailyMix({
  favorites = [],
  recentlyPlayed = [],
  listeningHistory = [],
  limit = 10,
}) {
  const history =
    listeningHistory.length > 0
      ? listeningHistory
      : recentlyPlayed

  const recentArtists =
    getArtistNames(recentlyPlayed)

  const favoriteArtists =
    getArtistNames(favorites)

  const candidates =
    uniqueTracks([
      ...favorites,
      ...history,
    ])

  const scored =
    candidates.map(
      (track, index) => {
        const artistNames =
          getArtistNamesForTrack(track)

        const hasRecentArtist =
          artistNames.some(
            (artist) =>
              recentArtists.has(
                normalizeArtistName(
                  artist,
                ),
              ),
          )

        const hasFavoriteArtist =
          artistNames.some(
            (artist) =>
              favoriteArtists.has(
                normalizeArtistName(
                  artist,
                ),
              ),
          )

        const isFavorite =
          favorites.some(
            (favorite) =>
              getTrackKey(favorite) ===
              getTrackKey(track),
          )

        let score = 0

        if (isFavorite) {
          score += 5
        }

        if (hasFavoriteArtist) {
          score += 4
        }

        if (hasRecentArtist) {
          score += 3
        }

        score += Math.max(
          0,
          2 - index * 0.1,
        )

        return {
          track,
          score,
        }
      },
    )

  return scored
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(0, limit)
    .map(
      ({ track }) => track,
    )
}

/*
 * =========================================================
 * ARTIST SCORING
 * =========================================================
 */

const buildArtistScores = ({
  personalTracks = [],
  favorites = [],
  discoveryTracks = [],
}) => {
  const artistScores = new Map()

  personalTracks.forEach(
    (track, index) => {
      const artists =
        getArtistNamesForTrack(track)

      artists.forEach((artist) => {
        const normalized =
          normalizeArtistName(artist)

        if (!normalized) {
          return
        }

        const current =
          artistScores.get(
            normalized,
          ) || 0

        /*
         * Recent tracks have slightly more weight.
         */
        const recencyBonus =
          Math.max(
            1,
            4 - index * 0.04,
          )

        const isFavorite =
          favorites.some(
            (favorite) =>
              getTrackKey(favorite) ===
              getTrackKey(track),
          )

        const favoriteBonus =
          isFavorite ? 5 : 0

        artistScores.set(
          normalized,
          current +
            recencyBonus +
            favoriteBonus,
        )
      })
    },
  )

  /*
   * Discovery artists are only a weak signal.
   *
   * They can help when the user has a small
   * listening history, but personal artists
   * always rank above them.
   */
  discoveryTracks.forEach(
    (track) => {
      const artists =
        getArtistNamesForTrack(track)

      artists.forEach((artist) => {
        const normalized =
          normalizeArtistName(artist)

        if (
          !normalized ||
          artistScores.has(normalized)
        ) {
          return
        }

        artistScores.set(
          normalized,
          0.5,
        )
      })
    },
  )

  return [
    ...artistScores.entries(),
  ]
    .sort(
      (a, b) =>
        b[1] - a[1],
    )
    .map(
      ([artist]) => artist,
    )
}

/*
 * =========================================================
 * MULTIPLE DAILY MIXES
 * =========================================================
 *
 * Creates up to 8 mixes.
 *
 * The artist groups are intentionally separated
 * instead of putting the strongest artists into
 * every mix.
 */

export function buildDailyMixes({
  listeningHistory = [],
  favorites = [],
  recentlyPlayed = [],
  discoveryTracks = [],
  mixCount = DEFAULT_MIX_COUNT,
  tracksPerMix = DEFAULT_TRACKS_PER_MIX,
}) {
  const history =
    listeningHistory.length > 0
      ? listeningHistory
      : recentlyPlayed

  const personalTracks =
    uniqueTracks([
      ...history,
      ...favorites,
    ])

  const allTracks =
    uniqueTracks([
      ...personalTracks,
      ...discoveryTracks,
    ])

  if (!allTracks.length) {
    return []
  }

  const artistScores =
    buildArtistScores({
      personalTracks,
      favorites,
      discoveryTracks,
    })

  if (!artistScores.length) {
    return []
  }

  /*
   * Don't invent artist groups when there aren't
   * enough meaningful artist signals.
   */
  const actualMixCount =
    Math.min(
      mixCount,
      artistScores.length,
    )

  /*
   * Use a balanced round-robin distribution.
   *
   * This prevents Mix 1 from receiving all
   * of the strongest artists while Mix 8 gets
   * only weak discovery artists.
   */
  const mixArtistGroups =
    Array.from(
      {
        length: actualMixCount,
      },
      () => [],
    )

  artistScores.forEach(
    (artist, artistIndex) => {
      mixArtistGroups[
        artistIndex %
          actualMixCount
      ].push(artist)
    },
  )

  const mixes = []

  for (
    let mixIndex = 0;
    mixIndex < actualMixCount;
    mixIndex += 1
  ) {
    const mixArtists =
      mixArtistGroups[mixIndex]

    if (!mixArtists.length) {
      continue
    }

    const artistSet =
      new Set(mixArtists)

    /*
     * =======================================================
     * PERSONAL SONGS FOR THIS MIX
     * =======================================================
     */

    const personalCandidates =
      personalTracks.filter(
        (track) =>
          getArtistNamesForTrack(
            track,
          ).some((artist) =>
            artistSet.has(
              normalizeArtistName(
                artist,
              ),
            ),
          ),
      )

    /*
     * =======================================================
     * DISCOVERY SONGS FOR THIS MIX
     * =======================================================
     */

    const discoveryCandidates =
      discoveryTracks.filter(
        (track) =>
          getArtistNamesForTrack(
            track,
          ).some((artist) =>
            artistSet.has(
              normalizeArtistName(
                artist,
              ),
            ),
          ),
      )

    /*
     * Personal songs first.
     */
    const selected =
      uniqueContentTracks([
        ...personalCandidates,
        ...discoveryCandidates,
      ]).slice(
        0,
        tracksPerMix,
      )

    /*
     * Determine the representative artist.
     *
     * Prefer the artist that appears most often
     * in the user's selected songs.
     */
    const artistTrackCounts =
      new Map()

    selected.forEach((track) => {
      getArtistNamesForTrack(track).forEach(
        (artist) => {
          const normalized =
            normalizeArtistName(artist)

          if (!artistSet.has(normalized)) {
            return
          }

          artistTrackCounts.set(
            normalized,
            (
              artistTrackCounts.get(
                normalized,
              ) || 0
            ) + 1,
          )
        },
      )
    })

    const representativeArtist =
      [
        ...artistTrackCounts.entries(),
      ].sort(
        (a, b) =>
          b[1] - a[1],
      )[0]?.[0] ||
      mixArtists[0] ||
      ""

    const displayArtists =
      mixArtists
        .slice(0, 3)
        .map((artist) =>
          artist
            .split(" ")
            .map(
              (part) =>
                part.charAt(0).toUpperCase() +
                part.slice(1),
            )
            .join(" "),
        )

    const description =
      mixArtists.length === 1
        ? `Based on ${displayArtists[0]}`
        : `Featuring ${displayArtists.join(
            ", ",
          )}`

    mixes.push({
      id: `daily-mix-${mixIndex + 1}`,

      type: "daily-mix",

      title: `Daily Mix ${mixIndex + 1}`,

      description,

      artists: mixArtists,

      representativeArtist,

      artistArtwork: null,

      artwork: null,

      songs: selected,
    })
  }

  return mixes
}

/*
 * =========================================================
 * MIX SONG SELECTION
 * =========================================================
 *
 * This function expands a mix with provider songs.
 *
 * Important:
 * - user's own songs come first
 * - then provider songs
 * - no cross-provider duplicate content
 * - no artificial/fake tracks
 * - maximum 40 songs
 */

const buildHydratedMixSongs = ({
  mix,
  providerDataByArtist,
  tracksPerMix,
}) => {
  const mixArtists =
    Array.isArray(mix?.artists)
      ? mix.artists
      : []

  const existingSongs =
    Array.isArray(mix?.songs)
      ? mix.songs
      : []

  /*
   * Gather provider songs artist-by-artist.
   *
   * Keeping artists in their ranked order makes
   * the resulting mix more coherent.
   */
  const providerSongs = []

  mixArtists.forEach(
    (artistName) => {
      const data =
        providerDataByArtist.get(
          normalizeArtistName(
            artistName,
          ),
        )

      if (
        Array.isArray(data?.songs)
      ) {
        providerSongs.push(
          ...data.songs,
        )
      }
    },
  )

  /*
   * First pass:
   * preserve the user's actual tracks.
   */
  const personalFirst =
    uniqueContentTracks([
      ...existingSongs,
      ...providerSongs,
    ])

  /*
   * If provider data contains more than 40
   * songs, this naturally stops at 40.
   */
  return personalFirst.slice(
    0,
    tracksPerMix,
  )
}

/*
 * =========================================================
 * HYDRATE DAILY MIXES
 * =========================================================
 *
 * buildDailyMixes()
 *       ↓
 * hydrateDailyMixes()
 *       ↓
 * JioSaavn + Verome
 *       ↓
 * artist artwork + provider songs
 *       ↓
 * up to 40 real songs per mix
 */

export async function hydrateDailyMixes(
  mixes = [],
  {
    tracksPerMix = DEFAULT_TRACKS_PER_MIX,
  } = {},
) {
  if (
    !Array.isArray(mixes) ||
    !mixes.length
  ) {
    return []
  }

  /*
   * Collect every artist used by every mix.
   */
  const artistNames = [
    ...new Set(
      mixes.flatMap(
        (mix) =>
          Array.isArray(
            mix?.artists,
          )
            ? mix.artists
            : [],
      ),
    ),
  ].filter((artist) =>
    cleanArtistName(artist),
  )

  if (!artistNames.length) {
    return mixes
  }

  /*
   * Fetch each artist from both providers.
   *
   * fetchArtistProviderData() is cached, so
   * the same artist is not repeatedly requested
   * across different mixes.
   */
  const providerResults =
    await Promise.all(
      artistNames.map(
        (artistName) =>
          fetchArtistProviderData(
            artistName,
            tracksPerMix,
          ),
      ),
    )

  const providerDataByArtist =
    new Map(
      providerResults.map(
        (result) => [
          normalizeArtistName(
            result.artistName,
          ),
          result,
        ],
      ),
    )

  /*
   * Expand every mix.
   */
  return mixes.map((mix) => {
    const mixArtists =
      Array.isArray(
        mix?.artists,
      )
        ? mix.artists
        : []

    const songs =
      buildHydratedMixSongs({
        mix,
        providerDataByArtist,
        tracksPerMix,
      })

    /*
     * Representative artist artwork first.
     */
    const representativeData =
      providerDataByArtist.get(
        normalizeArtistName(
          mix?.representativeArtist,
        ),
      )

    /*
     * If representative artwork is unavailable,
     * use another artist from THIS mix.
     */
    const fallbackArtistData =
      mixArtists
        .map(
          (artistName) =>
            providerDataByArtist.get(
              normalizeArtistName(
                artistName,
              ),
            ),
        )
        .find(
          (data) =>
            Boolean(data?.artwork),
        ) || null

    const artistArtwork =
      representativeData?.artwork ||
      fallbackArtistData?.artwork ||
      null

    return {
      ...mix,

      songs,

      /*
       * Real provider artwork only.
       */
      artistArtwork,

      artwork: artistArtwork,
    }
  })
}

/*
 * =========================================================
 * FAVORITES
 * =========================================================
 */

export function buildFavorites({
  favorites = [],
  limit = 10,
}) {
  return uniqueTracks(
    favorites,
  ).slice(
    0,
    limit,
  )
}

/*
 * =========================================================
 * KEEP LISTENING
 * =========================================================
 */

export function buildKeepListening({
  recentlyPlayed = [],
  listeningHistory = [],
  limit = 10,
}) {
  const source =
    listeningHistory.length > 0
      ? listeningHistory
      : recentlyPlayed

  return uniqueTracks(
    source,
  ).slice(
    0,
    limit,
  )
}

/*
 * =========================================================
 * FRESH PICKS
 * =========================================================
 */

export function buildFreshPicks({
  tracks = [],
  favorites = [],
  recentlyPlayed = [],
  listeningHistory = [],
  limit = 10,
}) {
  const excludedKeys =
    new Set([
      ...favorites,
      ...recentlyPlayed,
      ...listeningHistory,
    ].map(getTrackKey))

  return uniqueTracks(tracks)
    .filter(
      (track) =>
        !excludedKeys.has(
          getTrackKey(track),
        ),
    )
    .slice(
      0,
      limit,
    )
}

export async function hydrateMadeForYouPicks({
  favorites = [],
  recentlyPlayed = [],
  limit = 10,
} = {}) {
  const personalTracks =
    uniqueContentTracks([
      ...favorites,
      ...recentlyPlayed,
    ])

  const personalKeys = new Set()

  personalTracks.forEach((track) => {
    const providerKey = getTrackKey(track)
    const contentKey = getTrackContentKey(track)

    if (providerKey) {
      personalKeys.add(providerKey)
    }

    if (contentKey) {
      personalKeys.add(contentKey)
    }
  })

  const artistNames = [
    ...getArtistNames(personalTracks),
  ].slice(0, 6)

  let providerSongs = []

  try {
    const artistResults =
      await Promise.all(
        artistNames.map((artistName) =>
          fetchArtistProviderData(
            artistName,
            30,
          ),
        ),
      )

    providerSongs =
      uniqueContentTracks(
        artistResults.flatMap(
          (result) =>
            Array.isArray(result?.songs)
              ? result.songs
              : [],
        ),
      )
  } catch (error) {
    console.warn(
      "Unable to build personalized Made For You picks:",
      error,
    )
  }

  const isPersonalTrack = (track) => {
    const providerKey =
      getTrackKey(track)

    const contentKey =
      getTrackContentKey(track)

    return (
      personalKeys.has(providerKey) ||
      (
        contentKey &&
        personalKeys.has(contentKey)
      )
    )
  }

  let freshCandidates =
    providerSongs.filter(
      (track) =>
        !isPersonalTrack(track),
    )

  /*
   * If the user's artist catalog does not give
   * us enough unseen songs, use JioSaavn search
   * as a discovery fallback.
   */
  if (
    freshCandidates.length <
    limit * 2
  ) {
    const fallbackQueries = [
      "new hindi songs",
      "new bollywood songs",
      "english pop",
    ]

    try {
      const fallbackResults =
        await Promise.all(
          fallbackQueries.map(
            (query) =>
              searchMusic(
                query,
                "jiosaavn",
                {
                  limit: 20,
                },
              ),
          ),
        )

      const fallbackSongs =
        fallbackResults.flatMap(
          (response) =>
            Array.isArray(
              response?.results,
            )
              ? response.results
              : [],
        )

      freshCandidates =
        uniqueContentTracks([
          ...freshCandidates,
          ...fallbackSongs,
        ]).filter(
          (track) =>
            !isPersonalTrack(track),
        )
    } catch (error) {
      console.warn(
        "Unable to load Fresh Picks fallback:",
        error,
      )
    }
  }

  const freshPicks =
    uniqueContentTracks(
      freshCandidates,
    ).slice(0, limit)

  /*
   * For Your Mood is based primarily on artists
   * already associated with the listener, but uses
   * tracks they have not already played.
   */
  const personalArtistNames =
    getArtistNames(personalTracks)

  let moodPicks =
    uniqueContentTracks(
      providerSongs.filter(
        (track) => {
          if (isPersonalTrack(track)) {
            return false
          }

          return getArtistNamesForTrack(
            track,
          ).some((artist) =>
            personalArtistNames.has(
              normalizeArtistName(
                artist,
              ),
            ),
          )
        },
      ),
    )

  /*
   * Keep the two shelves meaningfully different.
   */
  const freshKeys = new Set(
    freshPicks.map((track) =>
      getTrackKey(track),
    ),
  )

  moodPicks =
    moodPicks.filter(
      (track) =>
        !freshKeys.has(
          getTrackKey(track),
        ),
    )

  /*
   * If the personalized mood pool is too small,
   * use the remaining discovery pool.
   */
  if (
    moodPicks.length <
    limit
  ) {
    moodPicks =
      uniqueContentTracks([
        ...moodPicks,
        ...freshCandidates,
      ]).filter(
        (track) =>
          !freshKeys.has(
            getTrackKey(track),
          ),
      )
  }

  return {
    freshPicks:
      freshPicks.slice(0, limit),

    moodPicks:
      moodPicks.slice(0, limit),
  }
}

/*
 * =========================================================
 * MADE FOR YOU COLLECTIONS
 * =========================================================
 *
 * Daily Mixes always start with a 40-song target.
 *
 * Other Made For You collections still use
 * the supplied `limit`.
 */

export function buildMadeForYouCollections({
  favorites = [],
  recentlyPlayed = [],
  listeningHistory = [],
  discoveryTracks = [],
  limit = 10,
  mixCount = DEFAULT_MIX_COUNT,
}) {
  const dailyMixes =
    buildDailyMixes({
      favorites,
      recentlyPlayed,
      listeningHistory,
      discoveryTracks,

      /*
       * Explicitly target 8 Daily Mixes by default.
       */
      mixCount,

      /*
       * Daily Mixes target 40 songs regardless
       * of the card collection's `limit`.
       */
      tracksPerMix:
        DEFAULT_TRACKS_PER_MIX,
    })

  return [
    ...dailyMixes,

    {
      id: "favorites",

      title:
        "Your Favorites",

      description:
        "Songs you love",

      songs:
        buildFavorites({
          favorites,
          limit,
        }),
    },

    {
      id: "keep-listening",

      title:
        "Keep Listening",

      description:
        "Based on your history",

      songs:
        buildKeepListening({
          recentlyPlayed,
          listeningHistory,
          limit,
        }),
    },

    {
      id: "fresh-picks",

      title:
        "Fresh Picks",

      description:
        "Something new for you",

      songs:
        buildFreshPicks({
          tracks:
            discoveryTracks,
          favorites,
          recentlyPlayed,
          listeningHistory,
          limit,
        }),
    },

    {
      id: "your-mood",

      title:
        "For Your Mood",

      description:
        "Music that fits right now",

      songs: [],
    },
  ]
}