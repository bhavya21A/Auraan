function ProgressBar({ value, onChange, total = 100 }) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeTotal) : 0

  return (
    <div className="w-full">
      <input
        type="range"
        min={0}
        max={safeTotal}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={!Number.isFinite(total) || total <= 0}
        className="h-2 w-full touch-pan-x cursor-pointer appearance-none rounded-full bg-white/15 accent-pink-500 disabled:cursor-default disabled:opacity-50"
        aria-label="Playback progress"
      />
    </div>
  )
}

export default ProgressBar
