# XMLiquidity

Professional trading platform — white-labeled fork.

## Structure

- `client/` — main user-facing React + Vite app
- `client/admin/` — admin panel (separate Vite app, runs on port 5174)
- `server/` — FastAPI backend (`server/app`)

## Local development

### Client (user app)

```sh
cd client
npm install
npm run dev
```

Vite serves on http://localhost:5173 by default.

### Admin panel

```sh
cd client/admin
npm install
npm run dev
```

Runs on http://localhost:5174.

### Server (FastAPI)

```sh
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload
```
