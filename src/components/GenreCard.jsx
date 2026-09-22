function GenreCard({ genre }) {
  return (
    <div className={`group overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br ${genre.accent} p-4`}>
      <div className="flex min-h-[120px] flex-col justify-between rounded-[22px] bg-black/10 p-4 backdrop-blur-sm">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/70">Genre</p>
        <div>
          <h3 className="text-xl font-semibold text-white">{genre.title}</h3>
          <p className="mt-1 text-sm text-white/75">{genre.caption}</p>
        </div>
      </div>
    </div>
  )
}

export default GenreCard
