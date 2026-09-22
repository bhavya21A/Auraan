function ArtistCard({ artist, onSelectArtist }) {
  return (
    <button
      type="button"
      onClick={() => onSelectArtist(artist)}
      className="group min-w-[170px] rounded-[28px] border border-white/10 bg-white/[0.03] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.05]"
      aria-label={`Open artist ${artist.name}`}
    >
      <div className={`h-40 rounded-[22px] bg-gradient-to-br ${artist.accent}`} />
      <div className="mt-3">
        <p className="text-base font-semibold text-white">{artist.name}</p>
        <p className="mt-1 text-sm text-white/55">{artist.genre}</p>
      </div>
    </button>
  )
}

export default ArtistCard
