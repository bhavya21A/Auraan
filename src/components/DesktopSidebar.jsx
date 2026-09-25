import {
  Compass,
  Home,
  Library,
  Radio,
  Music2,
  LogOut,
} from 'lucide-react'

import { supabase } from '../services/supabase'
import logo from '../assets/logo.png'

const navItems = [
  { id: 'Home', icon: Home, label: 'Home' },
  { id: 'Browse', icon: Compass, label: 'Browse' },
  { id: 'Radio', icon: Radio, label: 'Radio' },
  { id: 'Library', icon: Library, label: 'Library' },
]


function getInitial(name = '') {
  const value = String(name).trim()

  if (!value) {
    return 'U'
  }

  return value.charAt(0).toUpperCase()
}

function DesktopSidebar({
  activeTab,
  onSelectTab,
  playlists = [],
  selectedPlaylist = null,
  onSelectPlaylist,
  profileName = '',
  user = null,
  onSignOut,
}) {
  const handlePlaylistClick = (playlist) => {
    if (!playlist?.id) return

    onSelectPlaylist?.(playlist)
  }

  const handleSignOut = async () => {
    console.log('1. SIDEBAR SIGN OUT CLICKED')

    try {
      if (typeof onSignOut === 'function') {
        console.log('2. CALLING APP SIGN OUT HANDLER')

        await onSignOut()

        console.log('3. APP SIGN OUT HANDLER FINISHED')
        return
      }

      console.log(
        '2. APP SIGN OUT HANDLER NOT PROVIDED — USING SUPABASE FALLBACK',
      )

      const { error } = await supabase.auth.signOut()

      console.log('3. SUPABASE SIGN OUT RESULT:', error)

      if (error) {
        console.error(
          '4. SUPABASE SIGN OUT FAILED:',
          error,
        )
        return
      }

      console.log('5. SUPABASE SIGN OUT SUCCESS')

      window.location.reload()
    } catch (error) {
      console.error('SIGN OUT EXCEPTION:', error)
    }
  }

  const displayName =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.user_name ||
    user?.email?.split('@')[0] ||
    'User'

  const accountEmail = user?.email || 'Signed in'

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
                <div
                  className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${
                    playlist.accent ||
                    'from-[#7567F8] to-[#9B94FF]'
                  }`}
                />

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

      {/* Account */}
      <div className="relative z-50 mt-auto rounded-2xl border border-white/[0.07] bg-[#101114] p-3">
        <div className="flex items-center gap-3">
          {/* User avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#7567F8]/20 bg-[#7567F8]/10 text-sm font-semibold text-[#A9A4FF]">
            {getInitial(displayName)}
          </div>

          {/* User information */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {displayName}
            </p>

            <p className="truncate text-xs text-white/35">
              {accountEmail}
            </p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="relative z-50 mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/60"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export default DesktopSidebar