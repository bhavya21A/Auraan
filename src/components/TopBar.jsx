import { Search, Bell } from 'lucide-react'

function BrandMark() {
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#7567F8]/25 bg-[#7567F8]/10"
      aria-hidden="true"
    >
      <div className="absolute left-[12px] top-[9px] h-5 w-[3px] rotate-[28deg] rounded-full bg-[#8B83FF]" />
      <div className="absolute left-[20px] top-[9px] h-5 w-[3px] -rotate-[28deg] rounded-full bg-[#7567F8]" />
      <div className="absolute bottom-[8px] left-[15px] h-[3px] w-[10px] rounded-full bg-[#7567F8]" />
    </div>
  )
}

function TopBar({
  title,
  searchValue,
  onOpenSearch,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#08090B]/90 px-4 pb-4 pt-5 backdrop-blur-xl lg:px-7 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden">
            <BrandMark />
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

          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/50 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#7567F8]/20 bg-[#7567F8]/10 text-xs font-semibold text-[#A9A4FF]">
              A
            </div>

            <div className="pr-2 text-left">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Account
              </p>

              <p className="text-sm font-medium text-white/80">
                Guest
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar