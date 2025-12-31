<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1oA4S0_LDO1XrlNE14S3vwolkGUdKmHtf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `GEMINI_API_KEY` in your backend environment to enable AI reports
3. Run the app:
   `npm run dev`

## Python Backend (Deployment Ready)

The frontend can call a FastAPI backend for Upbit data + backtesting.

### Local API

1. `cd backend`
2. `python -m venv .venv`
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `uvicorn main:app --reload --port 8000`

Vite dev server proxies `/api` to `http://localhost:8000`.

### Production

- Configure `CORS_ORIGINS` (comma-separated) to your deployed frontend origin.
- Deploy with Docker using `backend/Dockerfile` or run `uvicorn main:app --host 0.0.0.0 --port 8000`.

## Deployment Topology Options

### Option A: Same Domain (Recommended)

- Serve the frontend on the same domain and reverse-proxy `/api` to the FastAPI server.
- Benefits: no CORS headaches, simpler config.
- Example (Nginx):
  - `location /api { proxy_pass http://localhost:8000; }`
  - `location / { try_files $uri /index.html; }`

### Option B: Split Domains

- Host frontend and backend on different domains.
- Set `CORS_ORIGINS=https://your-frontend.com` on the backend.
- Set `VITE_API_BASE_URL=https://your-api.com` for the frontend build.

### Frontend Env

- Copy `.env.example` to `.env.local` and fill in values.
