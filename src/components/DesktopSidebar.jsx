import {
  Compass,
  Home,
  Library,
  Radio,
  Music2,
} from 'lucide-react'

import logo from '../assets/logo.png'

const navItems = [
  { id: 'Home', icon: Home, label: 'Home' },
  { id: 'Browse', icon: Compass, label: 'Browse' },
  { id: 'Radio', icon: Radio, label: 'Radio' },
  { id: 'Library', icon: Library, label: 'Library' },
]

function DesktopSidebar({
  activeTab,
  onSelectTab,
  playlists = [],
  selectedPlaylist = null,
  onSelectPlaylist,
}) {
  const handlePlaylistClick = (playlist) => {
    if (!playlist?.id) return

    onSelectPlaylist?.(playlist)
  }

  return (
    <aside className="hidden min-h-screen w-[260px] border-r border-white/[0.06] bg-[#08090B] px-5 py-7 lg:flex lg:flex-col">
      {/* Brand */}
      <div className="mb-9 flex items-center gap-3">
        <img
          src={logo}
          alt="AURAAN"
          className="h-11 w-11 shrink-0 rounded-2xl object-contain"
        />

        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
            AURAAN
          </h2>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1.5">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTab?.(id)}
            aria-current={
              activeTab === id ? 'page' : undefined
            }
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/60 ${
              activeTab === id
                ? 'border-white/[0.08] bg-white/[0.07] text-white'
                : 'border-transparent text-white/50 hover:bg-white/[0.035] hover:text-white/85'
            }`}
          >
            <Icon
              size={18}
              strokeWidth={activeTab === id ? 2 : 1.8}
            />

            {label}
          </button>
        ))}
      </nav>

      {/* Playlist area */}
      <div className="mt-10 flex items-center justify-between text-white/35">
        <p className="text-[10px] font-medium uppercase tracking-[0.26em]">
          Your music
        </p>

        <Music2 size={14} />
      </div>

      {playlists.length > 0 ? (
        <div className="mt-4 space-y-2">
          {playlists.slice(0, 4).map((playlist) => {
            const isSelected =
              selectedPlaylist?.id === playlist.id

            const songCount = Array.isArray(
              playlist.songs,
            )
              ? playlist.songs.length
              : Number(playlist.totalSongs) || 0

            const playlistCover =
              playlist.cover_url ||
              playlist.coverUrl ||
              playlist.cover ||
              playlist.artwork ||
              playlist.image ||
              null

            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() =>
                  handlePlaylistClick(playlist)
                }
                aria-current={
                  isSelected ? 'page' : undefined
                }
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50 ${
                  isSelected
                    ? 'border-[#7567F8]/25 bg-[#7567F8]/[0.08]'
                    : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                }`}
              >
                {/* Playlist cover */}
                <div
                  className={`h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br ${
                    playlist.accent ||
                    'from-[#7567F8] to-[#9B94FF]'
                  }`}
                >
                  {playlistCover ? (
                    <img
                      src={playlistCover}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          'none'
                      }}
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {playlist.title ||
                      playlist.name ||
                      'Untitled playlist'}
                  </p>

                  <p className="text-xs text-white/40">
                    {songCount}{' '}
                    {songCount === 1
                      ? 'track'
                      : 'tracks'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/[0.07] bg-white/[0.015] px-3 py-4">
          <p className="text-xs leading-5 text-white/35">
            Your saved music and playlists will
            appear here.
          </p>
        </div>
      )}
    </aside>
  )
}

export default DesktopSidebar

