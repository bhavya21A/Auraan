import {
  Home,
  Compass,
  Radio,
  Library,
} from 'lucide-react'

const navItems = [
  {
    id: 'Home',
    icon: Home,
    label: 'Home',
  },
  {
    id: 'Browse',
    icon: Compass,
    label: 'Browse',
  },
  {
    id: 'Radio',
    icon: Radio,
    label: 'Radio',
  },
  {
    id: 'Library',
    icon: Library,
    label: 'Library',
  },
]

function BottomNav({
  activeTab,
  onSelectTab,
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#08090B]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 py-2">
        {navItems.map(
          ({ id, icon: Icon, label }) => {
            const isActive =
              activeTab === id

            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onSelectTab(id)
                }
                aria-current={
                  isActive
                    ? 'page'
                    : undefined
                }
                aria-label={label}
                className={`relative flex min-h-[64px] touch-manipulation flex-col items-center justify-center rounded-2xl border px-2 py-2 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50 ${
                  isActive
                    ? 'border-white/[0.08] bg-white/[0.07] text-white'
                    : 'border-transparent text-white/45 hover:bg-white/[0.035] hover:text-white/80'
                }`}
              >
                {isActive ? (
                  <span
                    className="absolute top-1.5 h-0.5 w-5 rounded-full bg-[#7567F8]"
                    aria-hidden="true"
                  />
                ) : null}

                <Icon
                  size={20}
                  strokeWidth={
                    isActive ? 2 : 1.8
                  }
                />

                <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em]">
                  {label}
                </span>
              </button>
            )
          },
        )}
      </div>
    </nav>
  )
}

export default BottomNav