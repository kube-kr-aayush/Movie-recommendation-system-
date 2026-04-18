import { useEffect, useMemo, useRef, useState } from "react";
import MovieCard from "./components/MovieCard";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FAVORITES_STORAGE_KEY = "movie_app_favorites";

const genreOptions = ["Action", "Comedy", "Mystery", "Horror"];

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function normalizeMovie(movie) {
  const rawPoster = movie.poster || movie.poster_url || null;
  const poster_url =
    rawPoster && !String(rawPoster).startsWith("http")
      ? `${TMDB_IMAGE_BASE_URL}/${String(rawPoster).replace(/^\/+/, "")}`
      : rawPoster;

  return {
    title: movie.title || "Untitled",
    overview: movie.overview || "Overview not available.",
    genres: movie.genres || "",
    rating:
      movie.rating === 0 || movie.rating
        ? Number(movie.rating).toFixed(1)
        : "N/A",
    poster_url,
  };
}

function App() {
  const [movieName, setMovieName] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Action");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState("");
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [sortOrder, setSortOrder] = useState("rating_high");
  const [highlightedMovieTitle, setHighlightedMovieTitle] = useState("");
  const [allTitles, setAllTitles] = useState([]);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [debouncedMovieName, setDebouncedMovieName] = useState("");
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const cardRefs = useRef({});

  useEffect(() => {
    const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!storedFavorites) return;

    try {
      const parsed = JSON.parse(storedFavorites);
      if (Array.isArray(parsed)) {
        setFavorites(parsed);
      }
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMovieName(movieName.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [movieName]);

  useEffect(() => {
    const fetchTitles = async () => {
      try {
        const data = await requestJson(`${API_BASE_URL}/titles`);
        setAllTitles(Array.isArray(data.results) ? data.results : []);
      } catch {
        setAllTitles([]);
      }
    };
    fetchTitles();
  }, []);

  useEffect(() => {
    if (!debouncedMovieName) {
      setSearchSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    const query = debouncedMovieName.toLowerCase();
    const suggestions = allTitles
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, 5);
    setSearchSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);
    setActiveSuggestionIndex(-1);
  }, [debouncedMovieName, allTitles]);

  useEffect(() => {
    const fetchTrending = async () => {
      setTrendingLoading(true);
      try {
        const data = await requestJson(`${API_BASE_URL}/trending`);
        setTrendingMovies((data.results || []).map(normalizeMovie).slice(0, 10));
      } catch {
        setTrendingMovies([]);
      } finally {
        setTrendingLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const sortedResults = useMemo(() => {
    const list = [...results];
    return list.sort((a, b) => {
      const ratingA = Number(a.rating);
      const ratingB = Number(b.rating);
      const safeA = Number.isFinite(ratingA) ? ratingA : -1;
      const safeB = Number.isFinite(ratingB) ? ratingB : -1;
      return sortOrder === "rating_low" ? safeA - safeB : safeB - safeA;
    });
  }, [results, sortOrder]);

  const hasResults = useMemo(() => sortedResults.length > 0, [sortedResults]);
  const hasFavorites = useMemo(() => favorites.length > 0, [favorites]);

  const isFavorite = (movieTitle) =>
    favorites.some((movie) => movie.title === movieTitle);

  const handleFavoriteToggle = (movie) => {
    setFavorites((prev) => {
      const alreadyFavorite = prev.some((fav) => fav.title === movie.title);
      if (alreadyFavorite) {
        return prev.filter((fav) => fav.title !== movie.title);
      }
      return [movie, ...prev];
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMovie(null);
    setTrailerUrl("");
    setTrailerError("");
    setTrailerLoading(false);
  };

  const openMovieModal = (movie) => {
    setSelectedMovie(movie);
    setShowModal(true);
    setTrailerUrl("");
    setTrailerError("");
  };

  const handleWatchTrailer = async () => {
    if (!selectedMovie?.title) return;

    setTrailerLoading(true);
    setTrailerError("");
    setTrailerUrl("");

    try {
      const data = await requestJson(
        `${API_BASE_URL}/trailer/${encodeURIComponent(selectedMovie.title)}`
      );
      if (!data.trailer_url) {
        throw new Error("Trailer not available");
      }
      setTrailerUrl(data.trailer_url);
    } catch (err) {
      setTrailerError(err.message || "Trailer not available");
    } finally {
      setTrailerLoading(false);
    }
  };

  const handleFindSimilar = async (searchTerm) => {
    const query = (searchTerm ?? movieName).trim();
    if (!query) {
      setError("Please enter a movie name first.");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const url = `${API_BASE_URL}/recommend?movie=${encodeURIComponent(query)}`;
      const data = await requestJson(url);

      const resolvedName = data.movie ?? data.movie_name ?? query;
      setResults((data.results || []).map(normalizeMovie));
      setResultLabel(`Top similar movies for "${resolvedName}"`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setMovieName(suggestion);
    setShowSuggestions(false);
    setSearchSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  const handleSearchInputKeyDown = (event) => {
    if (!showSuggestions || searchSuggestions.length === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleFindSimilar();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < searchSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : searchSuggestions.length - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeSuggestionIndex >= 0) {
        const selected = searchSuggestions[activeSuggestionIndex];
        handleSuggestionSelect(selected);
        handleFindSimilar(selected);
      } else {
        handleFindSimilar();
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleGetByGenre = async () => {
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const data = await requestJson(
        `${API_BASE_URL}/genre/${encodeURIComponent(selectedGenre)}`
      );

      setResults((data.results || []).map(normalizeMovie));
      setResultLabel(`Top movies in ${data.genre}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSurpriseMe = () => {
    if (sortedResults.length === 0) return;

    const randomMovie =
      sortedResults[Math.floor(Math.random() * sortedResults.length)];
    setHighlightedMovieTitle(randomMovie.title);

    const element = cardRefs.current[randomMovie.title];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-netflix-dark px-4 py-10 text-white">
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-10 text-center">
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-netflix-red sm:text-5xl">
            Movie Recommendation App
          </h1>
          <p className="mx-auto max-w-2xl text-zinc-300">
            Search a movie to find similar titles or choose a genre for top picks.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">Favorites</h2>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              {favorites.length} saved
            </span>
          </div>

          {hasFavorites ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {favorites.map((movie, index) => (
                <button
                  key={`${movie.title}-favorite-${index}`}
                  onClick={() => openMovieModal(movie)}
                  className="min-w-[220px] rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-left transition hover:border-netflix-red hover:shadow-glow"
                >
                  <p className="truncate font-semibold text-white">{movie.title}</p>
                  <p className="mt-1 text-xs text-yellow-300">⭐ {movie.rating}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No favorites yet. Tap the heart icon on any movie card.
            </p>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">🔥 Trending Movies</h2>
            <span className="text-xs text-zinc-400">Top 10 this week</span>
          </div>
          {trendingLoading ? (
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-netflix-red" />
              <span>Loading trending movies...</span>
            </div>
          ) : trendingMovies.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {trendingMovies.map((movie, index) => (
                <button
                  key={`${movie.title}-trending-${index}`}
                  onClick={() => openMovieModal(movie)}
                  className="group overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-left transition hover:-translate-y-0.5 hover:border-netflix-red hover:shadow-glow"
                >
                  <div className="relative h-40 overflow-hidden bg-zinc-900">
                    {movie.poster_url ? (
                      <img
                        src={movie.poster_url}
                        alt={movie.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                        No poster
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold text-white">{movie.title}</p>
                    <p className="text-xs text-yellow-300">⭐ {movie.rating}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Trending movies unavailable right now.</p>
          )}
        </section>

        <div className="mb-6 grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur sm:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-200">
              Search by movie name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Avatar"
                value={movieName}
                onChange={(e) => {
                  setMovieName(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleSearchInputKeyDown}
                onFocus={() => {
                  if (searchSuggestions.length > 0) setShowSuggestions(true);
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white outline-none transition focus:border-netflix-red"
              />
              {showSuggestions && searchSuggestions.length > 0 && (
                <ul className="suggestions-dropdown absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl">
                  {searchSuggestions.map((suggestion, index) => (
                    <li key={`${suggestion}-${index}`}>
                      <button
                        onMouseDown={() => handleSuggestionSelect(suggestion)}
                        className={`w-full px-4 py-2.5 text-left text-sm transition ${
                          activeSuggestionIndex === index
                            ? "bg-netflix-red/20 text-white"
                            : "text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => handleFindSimilar()}
              disabled={loading}
              className="w-full rounded-lg bg-netflix-red px-4 py-2.5 font-semibold transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Find Similar Movies
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-200">
              Browse by genre
            </label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white outline-none transition focus:border-netflix-red"
            >
              {genreOptions.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            <button
              onClick={handleGetByGenre}
              disabled={loading}
              className="w-full rounded-lg border border-netflix-red px-4 py-2.5 font-semibold text-netflix-red transition hover:bg-netflix-red hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Get Top Movies
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handleSurpriseMe}
            disabled={!hasResults}
            className="rounded-lg bg-zinc-800 px-4 py-2.5 font-semibold text-zinc-100 transition hover:scale-[1.01] hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            🎲 Surprise Me
          </button>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-300">Sort:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-netflix-red"
            >
              <option value="rating_high">Rating (High to Low)</option>
              <option value="rating_low">Rating (Low to High)</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-300">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-netflix-red" />
            <span>Loading movies...</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && resultLabel && (
          <h2 className="mb-4 text-2xl font-bold text-white">{resultLabel}</h2>
        )}

        {hasResults && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((movie, index) => (
              <div
                key={`${movie.title}-${index}`}
                ref={(el) => {
                  cardRefs.current[movie.title] = el;
                }}
                className={
                  highlightedMovieTitle === movie.title
                    ? "rounded-xl ring-2 ring-netflix-red ring-offset-2 ring-offset-black transition"
                    : ""
                }
              >
                <MovieCard
                  movie={movie}
                  onViewDetails={openMovieModal}
                  onFavoriteToggle={handleFavoriteToggle}
                  isFavorite={isFavorite(movie.title)}
                />
              </div>
            ))}
          </section>
        )}

        {!loading && !error && !hasResults && resultLabel && (
          <p className="mt-8 text-center text-zinc-400">
            No movies found for this query.
          </p>
        )}

        {!loading && !error && !hasResults && !resultLabel && (
          <p className="mt-8 text-center text-zinc-400">
            No results yet. Search a movie or choose a genre to get started.
          </p>
        )}
      </section>

      {showModal && selectedMovie && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="modal-panel max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/60 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="mb-4 ml-auto block rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-200 transition hover:border-netflix-red hover:text-netflix-red"
            >
              X
            </button>

            <div className="grid gap-6 md:grid-cols-[280px_1fr]">
              <div className="overflow-hidden rounded-xl bg-zinc-950">
                {selectedMovie.poster_url ? (
                  <img
                    src={selectedMovie.poster_url}
                    alt={selectedMovie.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-[380px] items-center justify-center text-zinc-400">
                    Poster not available
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-3xl font-bold text-white">
                  {selectedMovie.title}
                </h3>
                <p className="mb-2 text-yellow-300">⭐ {selectedMovie.rating}</p>
                <p className="mb-4 text-sm uppercase tracking-wider text-netflix-red">
                  {selectedMovie.genres || "Genres not available"}
                </p>
                <p className="mb-5 leading-relaxed text-zinc-200">
                  {selectedMovie.overview || "Overview not available."}
                </p>

                <button
                  onClick={handleWatchTrailer}
                  disabled={trailerLoading}
                  className="rounded-lg bg-netflix-red px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Watch Trailer
                </button>

                {trailerLoading && (
                  <div className="mt-4 flex items-center gap-2 text-zinc-300">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-netflix-red" />
                    <span>Loading trailer...</span>
                  </div>
                )}

                {trailerError && !trailerLoading && (
                  <p className="mt-4 text-sm text-red-300">{trailerError}</p>
                )}

                {trailerUrl && !trailerLoading && (
                  <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800">
                    <iframe
                      className="aspect-video w-full"
                      src={trailerUrl}
                      title={`${selectedMovie.title} trailer`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
