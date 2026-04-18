
from pathlib import Path

import os
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from recommender import MovieRecommendationEngine


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "tmdb_5000_movies.csv"
ENV_PATH = BASE_DIR / ".env"
TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_MOVIE_VIDEOS_URL = "https://api.themoviedb.org/3/movie/{movie_id}/videos"
TMDB_TRENDING_URL = "https://api.themoviedb.org/3/trending/movie/week"

load_dotenv(dotenv_path=ENV_PATH)
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()
print(
    f"[TMDB] .env loaded from: {ENV_PATH} | "
    f"TMDB_API_KEY loaded: {'yes' if bool(TMDB_API_KEY) else 'no'}"
)

app = Flask(__name__)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=False,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        return "", 200


engine = MovieRecommendationEngine(DATA_PATH)


def get_movie_details(title: str) -> dict:
    """
    Fetch movie details from TMDB and return frontend-safe object.
    Falls back to title-only object if API fails or no match is found.
    """
    fallback = {"title": title}
    if not title or not TMDB_API_KEY:
        return fallback

    try:
        response = requests.get(
            TMDB_SEARCH_URL,
            params={"api_key": TMDB_API_KEY, "query": title},
            timeout=8,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        if not results:
            return fallback

        movie = results[0]
        poster_path = movie.get("poster_path")
        poster_url = (
            f"{TMDB_IMAGE_BASE_URL}/{poster_path.lstrip('/')}" if poster_path else None
        )

        return {
            "title": movie.get("title") or title,
            "rating": movie.get("vote_average"),
            "overview": movie.get("overview") or "",
            "poster_url": poster_url,
        }
    except (requests.RequestException, ValueError, TypeError):
        return fallback


def enrich_movies(movies: list[dict]) -> list[dict]:
    enriched_results = []
    for movie in movies:
        movie_title = movie.get("title", "")
        enriched = get_movie_details(movie_title)
        enriched_results.append(enriched)

    return enriched_results


def get_recommendations(movie: str) -> list[dict]:
    recommendations = engine.recommend(movie)
    return enrich_movies(recommendations)


def get_trailer_url(movie_name: str) -> str | None:
    if not movie_name or not TMDB_API_KEY:
        return None

    try:
        search_response = requests.get(
            TMDB_SEARCH_URL,
            params={"api_key": TMDB_API_KEY, "query": movie_name},
            timeout=8,
        )
        search_response.raise_for_status()
        search_results = search_response.json().get("results", [])
        if not search_results:
            return None

        movie_id = search_results[0].get("id")
        if not movie_id:
            return None

        videos_response = requests.get(
            TMDB_MOVIE_VIDEOS_URL.format(movie_id=movie_id),
            params={"api_key": TMDB_API_KEY},
            timeout=8,
        )
        videos_response.raise_for_status()
        videos = videos_response.json().get("results", [])

        preferred_trailer = next(
            (
                video
                for video in videos
                if video.get("site") == "YouTube"
                and video.get("type") == "Trailer"
                and video.get("key")
            ),
            None,
        )

        if preferred_trailer:
            return f"https://www.youtube.com/embed/{preferred_trailer['key']}"

        any_youtube_video = next(
            (video for video in videos if video.get("site") == "YouTube" and video.get("key")),
            None,
        )
        if any_youtube_video:
            return f"https://www.youtube.com/embed/{any_youtube_video['key']}"
    except (requests.RequestException, ValueError, TypeError):
        return None

    return None


def get_trending_movies(limit: int = 10) -> list[dict]:
    if not TMDB_API_KEY:
        return []

    try:
        response = requests.get(
            TMDB_TRENDING_URL,
            params={"api_key": TMDB_API_KEY},
            timeout=8,
        )
        response.raise_for_status()
        results = response.json().get("results", [])

        trending = []
        for movie in results[:limit]:
            poster_path = movie.get("poster_path")
            poster_url = (
                f"{TMDB_IMAGE_BASE_URL}/{poster_path.lstrip('/')}" if poster_path else None
            )
            trending.append(
                {
                    "title": movie.get("title") or "Untitled",
                    "overview": movie.get("overview") or "",
                    "genres": "",
                    "rating": movie.get("vote_average"),
                    "poster_url": poster_url,
                }
            )

        return trending
    except (requests.RequestException, ValueError, TypeError):
        return []


@app.get("/")
def health_check():
    return jsonify({"status": "ok", "message": "Movie recommendation API is running."})


@app.route("/recommend", methods=["GET", "POST"])
def recommend_movies():
    if request.method == "GET":
        movie = (request.args.get("movie") or "").strip()
    else:
        payload = request.get_json() or {}
        movie = (payload.get("movie") or "").strip()

    if not movie:
        return jsonify({"error": "movie is required"}), 400

    recommendations = get_recommendations(movie)
    if not recommendations:
        return (
            jsonify(
                {
                    "error": "No recommendations found. Check movie title spelling.",
                    "results": [],
                }
            ),
            404,
        )

    return jsonify({"movie": movie, "results": recommendations})


@app.get("/genre/<genre>")
def movies_by_genre(genre: str):
    movies = engine.get_movies_by_genre(genre)
    if not movies:
        return jsonify({"error": "No movies found for this genre.", "results": []}), 404

    return jsonify({"genre": genre, "results": enrich_movies(movies)})


@app.get("/titles")
def movie_titles():
    titles = engine.df["title"].dropna().astype(str).tolist()
    return jsonify({"results": titles})


@app.get("/trending")
def trending_movies():
    movies = get_trending_movies(limit=10)
    return jsonify({"results": movies})


@app.get("/trailer/<movie_name>")
def movie_trailer(movie_name: str):
    trailer_url = get_trailer_url(movie_name)
    if not trailer_url:
        return jsonify({"error": "Trailer not available", "trailer_url": None}), 404

    return jsonify({"trailer_url": trailer_url})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
