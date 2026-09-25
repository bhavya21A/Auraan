import { Search, Bell } from 'lucide-react'
import logo from '../assets/logo.png'

function getInitial(name = '') {
  const value = name.trim()

  if (!value) {
    return 'U'
  }

  return value.charAt(0).toUpperCase()
}

function TopBar({
  title,
  searchValue,
  onOpenSearch,
  profileName = 'User',
  user = null,
}) {
  const displayName =
    profileName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User'

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08090B]/90 px-4 pb-4 pt-5 backdrop-blur-xl lg:px-7 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden">
            <img
              src={logo}
              alt="AURAAN"
              className="h-11 w-11 shrink-0 rounded-2xl object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-white/30">
              AURAAN
            </p>

            <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white">
              {title}
            </h1>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {/* Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex min-h-10 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white/55 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50 sm:min-w-[180px]"
            aria-label="Open music search"
          >
            <Search size={16} />

            <span className="hidden sm:block">
              {searchValue || 'Search'}
            </span>
          </button>

          {/* Notifications */}
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/50 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </button>

          {/* Account */}
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 md:flex">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#7567F8]/20 bg-[#7567F8]/10 text-xs font-semibold text-[#A9A4FF]">
              {getInitial(displayName)}
            </div>

            <div className="min-w-0 pr-2 text-left">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Account
              </p>

              <p className="max-w-[120px] truncate text-sm font-medium text-white/80">
                {displayName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar