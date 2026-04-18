# Movie Recommendation Web App (Full Stack)

This project is a complete local full-stack movie recommendation app.

- **Backend:** Flask + pandas + scikit-learn
- **Frontend:** React + Tailwind (Vite)
- **Dataset:** `tmdb_5000_movies.csv`

## Project Structure

```text
movie reccomendation/
  backend/
    app.py
    recommender.py
    requirements.txt
    data/
      tmdb_5000_movies.csv   <-- place dataset here
  frontend/
    package.json
    index.html
    tailwind.config.js
    postcss.config.js
    vite.config.js
    src/
      App.jsx
      main.jsx
      index.css
      components/
        MovieCard.jsx
```

## 1) Backend Setup (Flask)

Open terminal:

```bash
cd backend
python -m venv .venv
```

Activate virtual environment:

- **Windows PowerShell**
  ```bash
  .\.venv\Scripts\Activate.ps1
  ```
- **Mac/Linux**
  ```bash
  source .venv/bin/activate
  ```

Install dependencies:

```bash
pip install -r requirements.txt
```

Place your dataset file at:

```text
backend/data/tmdb_5000_movies.csv
```

Run backend:

```bash
python app.py
```

Backend API runs on: `http://127.0.0.1:5000`

### Backend API Endpoints

- `POST /recommend`
  - Request JSON:
    ```json
    { "movie_name": "Avatar" }
    ```
  - Response: top 5 similar movies

- `GET /genre/<genre>`
  - Example: `/genre/Action`
  - Response: top 10 movies in that genre

## 2) Frontend Setup (React + Tailwind)

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on Vite's local URL (usually `http://localhost:5173`).

## Notes

- This app runs fully **locally**.
- No external AI API is used.
- If movie title search returns no result, try exact title spelling from the dataset.
