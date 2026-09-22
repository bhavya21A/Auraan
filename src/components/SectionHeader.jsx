function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.025em] text-white sm:text-xl">
        {title}
      </h2>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full px-2 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/40 transition hover:bg-white/[0.04] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7567F8]/50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default SectionHeader