import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import MadeForYouCard from "./MadeForYouCard"

import {
  buildDailyMixes,
  buildFavorites,
  buildKeepListening,
  buildFreshPicks,
  hydrateDailyMixes,
  hydrateMadeForYouPicks,
} from "../../services/discoveryRecommendations"

function normalizeArtistName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function getArtistArtwork(mix) {
  return (
    mix?.artistArtwork ||
    mix?.image ||
    null
  )
}

function mergeArtworkIntoMixes(
  mixes,
  hydratedMixes,
) {
  const hydratedById = new Map(
    hydratedMixes.map((mix) => [
      mix.id,
      mix,
    ]),
  )

  return mixes.map((mix) => {
    const hydrated =
      hydratedById.get(mix.id)

    if (!hydrated) {
      return mix
    }

    return {
      ...mix,
      ...hydrated,
      songs:
        hydrated.songs?.length
          ? hydrated.songs
          : mix.songs || [],
      artistArtwork:
        hydrated.artistArtwork ||
        mix.artistArtwork ||
        null,
    }
  })
}

function MadeForYouSection({
  username = "You",
  favorites = [],
  recentlyPlayed = [],
  discoveryTracks = [],
  onOpenDailyMix,
  onOpenCollection,
}) {
  const scrollRef = useRef(null)

  const [
    hydratedDailyMixes,
    setHydratedDailyMixes,
  ] = useState([])

  const [
    hydratedPicks,
    setHydratedPicks,
  ] = useState({
    freshPicks: [],
    moodPicks: [],
  })

  const scroll = (direction) => {
    if (!scrollRef.current) return

    scrollRef.current.scrollBy({
      left:
        direction === "left"
          ? -360
          : 360,
      behavior: "smooth",
    })
  }

  /*
   * Daily Mixes
   */
  const dailyMixes = useMemo(
    () =>
      buildDailyMixes({
        favorites,
        listeningHistory:
          recentlyPlayed,
        recentlyPlayed,
        discoveryTracks,
        mixCount: 8,
        tracksPerMix: 40,
      }),
    [
      favorites,
      recentlyPlayed,
      discoveryTracks,
    ],
  )

  useEffect(() => {
    let cancelled = false

    const loadDailyMixes = async () => {
      if (!dailyMixes.length) {
        setHydratedDailyMixes([])
        return
      }

      try {
        const hydrated =
          await hydrateDailyMixes(
            dailyMixes,
          )

        if (
          cancelled ||
          !Array.isArray(hydrated)
        ) {
          return
        }

        setHydratedDailyMixes(
          hydrated,
        )
      } catch (error) {
        console.warn(
          "Unable to hydrate Daily Mixes:",
          error,
        )
      }
    }

    void loadDailyMixes()

    return () => {
      cancelled = true
    }
  }, [dailyMixes])

  /*
   * Fresh Picks + For Your Mood
   */
  useEffect(() => {
    let cancelled = false

    const loadPicks = async () => {
      try {
        const result =
          await hydrateMadeForYouPicks({
            favorites,
            recentlyPlayed,
            limit: 10,
          })

        if (
          cancelled ||
          !result
        ) {
          return
        }

        setHydratedPicks({
          freshPicks:
            Array.isArray(
              result.freshPicks,
            )
              ? result.freshPicks
              : [],

          moodPicks:
            Array.isArray(
              result.moodPicks,
            )
              ? result.moodPicks
              : [],
        })
      } catch (error) {
        console.warn(
          "Unable to hydrate Made For You picks:",
          error,
        )
      }
    }

    void loadPicks()

    return () => {
      cancelled = true
    }
  }, [
    favorites,
    recentlyPlayed,
  ])

  const finalDailyMixes =
    useMemo(() => {
      if (
        !hydratedDailyMixes.length
      ) {
        return dailyMixes
      }

      return mergeArtworkIntoMixes(
        dailyMixes,
        hydratedDailyMixes,
      )
    }, [
      dailyMixes,
      hydratedDailyMixes,
    ])

  const favoriteSongs = useMemo(
    () =>
      buildFavorites({
        favorites,
        limit: 10,
      }),
    [favorites],
  )

  const keepListeningSongs =
    useMemo(
      () =>
        buildKeepListening({
          recentlyPlayed,
          limit: 10,
        }),
      [recentlyPlayed],
    )

  const freshPickSongs =
    useMemo(() => {
      /*
       * Keep supporting discoveryTracks if
       * another part of the app supplies them.
       * Otherwise use the provider-generated
       * personalized picks.
       */
      if (discoveryTracks.length) {
        return buildFreshPicks({
          tracks: discoveryTracks,
          favorites,
          recentlyPlayed,
          limit: 10,
        })
      }

      return hydratedPicks.freshPicks
    }, [
      discoveryTracks,
      favorites,
      recentlyPlayed,
      hydratedPicks.freshPicks,
    ])

  const moodSongs =
    hydratedPicks.moodPicks

  const dailyMixCollections =
    useMemo(
      () =>
        finalDailyMixes.map(
          (mix, index) => {
            const artistName =
              normalizeArtistName(
                mix?.representativeArtist,
              )

            const artistArtwork =
              getArtistArtwork(mix)

            return {
              ...mix,

              id:
                mix?.id ||
                `daily-mix-${index + 1}`,

              type: "daily-mix",

              title:
                mix?.title ||
                `Daily Mix ${index + 1}`,

              description:
                mix?.description ||
                (
                  artistName
                    ? `Featuring ${mix.representativeArtist}`
                    : "A mix made for you"
                ),

              image:
                artistArtwork || null,

              artistArtwork,

              songs:
                Array.isArray(
                  mix?.songs,
                )
                  ? mix.songs
                  : [],
            }
          },
        ),
      [finalDailyMixes],
    )

  const otherCollections =
    useMemo(
      () => [
        {
          id: "favorites",
          type: "made-for-you",
          title: "Your Favorites",
          description:
            "Songs you love",
          image:
            "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=700&q=80",
          songs: favoriteSongs,
        },

        {
          id: "keep-listening",
          type: "made-for-you",
          title: "Keep Listening",
          description:
            "Based on your history",
          image:
            "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=700&q=80",
          songs: keepListeningSongs,
        },

        {
          id: "fresh-picks",
          type: "made-for-you",
          title: "Fresh Picks",
          description:
            "New music based on your taste",
          image:
            "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=700&q=80",
          songs: freshPickSongs,
        },

        {
          id: "your-mood",
          type: "made-for-you",
          title: "For Your Mood",
          description:
            "Music that fits your listening mood",
          image:
            "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=700&q=80",
          songs: moodSongs,
        },
      ],
      [
        favoriteSongs,
        keepListeningSongs,
        freshPickSongs,
        moodSongs,
      ],
    )

  const collections = useMemo(
    () => [
      ...dailyMixCollections,
      ...otherCollections,
    ],
    [
      dailyMixCollections,
      otherCollections,
    ],
  )

  const handleSelectCollection = (
    collection,
  ) => {
    if (!collection) return

    if (
      collection.type ===
      "daily-mix"
    ) {
      onOpenDailyMix?.(
        collection,
      )
      return
    }

    onOpenCollection?.(
      collection,
    )
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Made For {username}
        </h2>

        <button
          type="button"
          className="text-sm text-white/50 transition hover:text-white"
        >
          See all
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() =>
            scroll("left")
          }
          aria-label="Scroll recommendations left"
          className="absolute left-0 top-[105px] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#15181d]/95 text-white shadow-lg backdrop-blur transition hover:bg-[#20242b] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ChevronLeft size={22} />
        </button>

        <div
          ref={scrollRef}
          className="made-for-you-scroll flex gap-5 overflow-x-auto scroll-smooth px-16 pb-4"
        >
          {collections.map(
            (item) => (
              <MadeForYouCard
                key={item.id}
                title={item.title}
                description={
                  item.description
                }
                image={item.image}
                onClick={() =>
                  handleSelectCollection(
                    item,
                  )
                }
              />
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            scroll("right")
          }
          aria-label="Scroll recommendations right"
          className="absolute right-0 top-[105px] z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#15181d]/95 text-white shadow-lg backdrop-blur transition hover:bg-[#20242b] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  )
}

export default MadeForYouSection