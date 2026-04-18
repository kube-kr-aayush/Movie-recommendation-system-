from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class MovieRecommendationEngine:
    data_path: Path
    max_movies: int = 200

    def __post_init__(self) -> None:
        self.df = self._load_and_prepare_data(self.data_path)
        self.df = self.df.head(self.max_movies).reset_index(drop=True)
        self.title_to_index = {
            title.lower(): idx for idx, title in enumerate(self.df["title"])
        }
        self.vectorizer = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = self.vectorizer.fit_transform(self.df["overview"])

    @staticmethod
    def _extract_genre_names(genre_value: str) -> str:
        """
        Convert raw JSON-like genre string into a plain comma-separated string.
        Example input:
        [{"id": 28, "name": "Action"}, {"id": 12, "name": "Adventure"}]
        """
        if pd.isna(genre_value):
            return ""

        names: List[str] = []
        text = str(genre_value)

        marker = "\"name\":"
        parts = text.split(marker)
        for part in parts[1:]:
            if "\"" in part:
                cleaned = part.split("\"", 2)
                if len(cleaned) >= 2:
                    names.append(cleaned[1].strip())

        return ", ".join(names)

    def _load_and_prepare_data(self, data_path: Path) -> pd.DataFrame:
        if not data_path.exists():
            raise FileNotFoundError(
                f"Dataset not found at {data_path}. "
                "Please place tmdb_5000_movies.csv inside backend/data/."
            )

        # Keep only a small, deployment-friendly subset in memory.
        df = pd.read_csv(data_path).head(self.max_movies)
        required_columns = ["title", "overview", "genres"]
        optional_columns = ["id"]
        missing_cols = [col for col in required_columns if col not in df.columns]

        if missing_cols:
            raise ValueError(f"Missing required columns in dataset: {missing_cols}")

        keep_columns = required_columns + [col for col in optional_columns if col in df.columns]
        df = df[keep_columns].copy()
        df["overview"] = df["overview"].fillna("")
        df["genres"] = df["genres"].fillna("").apply(self._extract_genre_names)

        return df.reset_index(drop=True)

    def recommend(self, movie_name: str, top_n: int = 5) -> List[Dict[str, str]]:
        if not movie_name:
            return []

        idx = self.title_to_index.get(movie_name.strip().lower())
        if idx is None:
            return []

        # Compute similarity only for requested movie row to avoid storing NxN matrix.
        row_similarities = cosine_similarity(self.tfidf_matrix[idx], self.tfidf_matrix).flatten()
        similarity_scores = list(enumerate(row_similarities))
        similarity_scores = sorted(similarity_scores, key=lambda x: x[1], reverse=True)

        top_movies = []
        for movie_idx, score in similarity_scores[1 : top_n + 1]:
            row = self.df.iloc[movie_idx]
            top_movies.append(
                {
                    "title": row["title"],
                    "overview": row["overview"][:220].strip(),
                    "genres": row["genres"],
                    "score": round(float(score), 4),
                }
            )

        return top_movies

    def get_movies_by_genre(self, genre: str, top_n: int = 10) -> List[Dict[str, str]]:
        if not genre:
            return []

        genre_lower = genre.strip().lower()
        genre_filtered = self.df[
            self.df["genres"].str.lower().str.contains(genre_lower, na=False)
        ].copy()

        if genre_filtered.empty:
            return []

        # Use overview length as a simple proxy ranking so output feels meaningful.
        genre_filtered["overview_len"] = genre_filtered["overview"].str.len()
        genre_filtered = genre_filtered.sort_values(by="overview_len", ascending=False).head(
            top_n
        )

        results: List[Dict[str, str]] = []
        for _, row in genre_filtered.iterrows():
            results.append(
                {
                    "title": row["title"],
                    "overview": row["overview"][:220].strip(),
                    "genres": row["genres"],
                }
            )

        return results
