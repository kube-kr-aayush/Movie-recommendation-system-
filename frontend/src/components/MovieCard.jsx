function getRatingBadgeClass(rating) {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) return "bg-zinc-800 text-zinc-200";
  if (numericRating >= 7) return "bg-emerald-600/90 text-emerald-50";
  if (numericRating >= 5) return "bg-yellow-500/90 text-yellow-950";
  return "bg-red-600/90 text-red-50";
}

export default function MovieCard({
  movie,
  onViewDetails,
  onFavoriteToggle,
  isFavorite,
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-zinc-800 bg-netflix-card transition duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-netflix-red hover:shadow-glow">
      <div className="relative h-64 w-full overflow-hidden bg-zinc-900">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Poster not available
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />

        <button
          onClick={() => onFavoriteToggle(movie)}
          className="absolute left-3 top-3 rounded-full bg-black/70 p-2 text-lg leading-none transition hover:scale-110 hover:bg-black/90"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "❤️" : "🤍"}
        </button>

        <div
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${getRatingBadgeClass(
            movie.rating
          )}`}
        >
          ⭐ {movie.rating}
        </div>
      </div>

      <div className="p-4">
        <h3 className="mb-2 text-lg font-semibold text-white">{movie.title}</h3>
        <p className="mb-3 text-sm text-zinc-300">
          {movie.overview || "Overview not available."}
        </p>
        {movie.genres && (
          <p className="text-xs uppercase tracking-wider text-netflix-red">
            {movie.genres}
          </p>
        )}
        <button
          onClick={() => onViewDetails(movie)}
          className="mt-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-netflix-red hover:bg-netflix-red/10"
        >
          View Details
        </button>
      </div>
    </article>
  );
}
