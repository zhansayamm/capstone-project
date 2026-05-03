# Deploying the FastAPI backend on Railway

## Prerequisites

- Code pushed to a GitHub repository.
- A Railway account at [https://railway.app](https://railway.app).

## Steps

1. **Push code to GitHub**  
   Ensure the `backend/` directory (or repo root if the service uses it) contains `Dockerfile`, `requirements.txt`, and `app/`.

2. **Create a Railway project**  
   In Railway: **New project** → **Deploy from GitHub** → select the repository.

3. **Configure the service root**  
   If the repo root is not the backend, set **Root Directory** to `backend` in the service settings.

4. **Add PostgreSQL**  
   In the project: **New** → **Database** → **PostgreSQL**. Railway injects `DATABASE_URL` into services in the same project (link the variable if needed).

5. **Environment variables**  
   In the web service:

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | Required on Railway. Supports `postgres://`, `postgresql://`, and `postgresql+psycopg2://` (unchanged). The app normalizes to `postgresql+psycopg2://`. |
   | `SECRET_KEY` | Long random string, e.g. `openssl rand -hex 32` (minimum 16 characters). Required whenever the service detects Railway or `ENVIRONMENT=production`. |
   | `ENVIRONMENT` | **`production`** is required on Railway unless you use **`staging`** for a staging slot. Deploys that still resolve as `development` on Railway abort startup (`RAILWAY_ENVIRONMENT`/`ENVIRONMENT` should be explicit). |
   | `FRONTEND_URL` | **Required on Railway** (unless you set `CORS_ORIGINS` instead). Your Vercel site origin with no path, e.g. `https://my-app.vercel.app`. Comma-separate multiple origins if needed. Not hardcoded — must match the browser `Origin` header. |
   | `CORS_ORIGINS` | Optional extra comma-separated origins merged with `FRONTEND_URL` (e.g. `http://localhost:5173` for local UI against Railway API). Must never be `*` when credentials are used. |
   | *(built-in)* | By default the API also allows **`https://*.vercel.app`** via `allow_origin_regex` (Vercel previews). Set **`CORS_VERCEL_REGEX=0`** to disable, or **`CORS_ORIGIN_REGEX`** to override. Custom domains must appear in `FRONTEND_URL` or `CORS_ORIGINS`. If OPTIONS returns **400**, the `Origin` did not match the list or regex. |

   Optional:

   - `SKIP_DB_CREATE_ALL=true` — only after you manage schema with migrations (Alembic, etc.).
   - `REDIS_URL` — if you run Celery workers for image uploads; point API and worker at the same Redis. Without Redis, **`POST /images/upload`** responds with **503** instead of crashing the process.
   - `SHOW_ERROR_DETAILS=true` — only on **non-production** local installs; hides exception messages from JSON in production.

6. **Start command**  
   The Dockerfile runs Uvicorn on `0.0.0.0` using Railway’s **`PORT`** when set (`${PORT:-8000}`), so HTTP traffic succeeds without extra configuration.

   If you deploy **without** Docker, use a start command that binds `0.0.0.0` and listens on **`$PORT`** (Railway injects it).

7. **Redeploy**  
   Trigger a redeploy after changing variables so the app picks up `DATABASE_URL` and `SECRET_KEY`.

## Post-deploy checks

- Open `https://<your-railway-domain>/docs` — Swagger UI loads.
- `GET /health` returns `{"status":"ok"}`.
- Create or list **slots** and **bookings** from the UI or `/docs` — no 500s from missing columns or enum mismatches.
- Booking `status` values persist as strings (`pending`, `approved`, `rejected`, etc.) compatible with the Python `BookingStatus` enum.

## Schema notes

- On startup the API runs `SQLModel.metadata.create_all(engine)` unless `SKIP_DB_CREATE_ALL` is set.
- `Booking.status` is stored as a **VARCHAR**, not a PostgreSQL native enum, to avoid Python/DB enum drift.
- For an **existing** database that already used a native PG enum for `bookings.status`, you may need a one-time migration to align the column type with the new definition.

## Frontend (Vercel)

Set **`FRONTEND_URL`** to your Vercel origin (e.g. `https://my-app.vercel.app`). Add **`CORS_ORIGINS=http://localhost:5173`** if you call the Railway API from the Vite dev server.

## Troubleshooting: `passlib` / `pwd_context.verify` / 72-byte bcrypt errors

If logs show **`security.py` line ~15** with **`pwd_context.verify`** or **`passlib/handlers/bcrypt`**, the running container is **not** built from the current repo: auth uses **native `bcrypt` only** now.

1. Confirm GitHub has the latest commit (no `passlib` in `backend/requirements.txt`, no `pwd_context` in `backend/app/core/security.py`).
2. In Railway: **Redeploy** the service and, if needed, **clear build cache** / force a fresh Docker build.
3. Ensure **Root Directory** is `backend` so Railway uses this **`Dockerfile`** (the image fails the build if `passlib` is accidentally installed).
4. After a successful deploy, **startup logs** must include: **`password_hash_backend=bcrypt-native-v2`**. If that line is missing, the new image is not running.
