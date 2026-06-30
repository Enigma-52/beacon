# Beacon

Navigate open source like you've been there before.

Paste a GitHub repo URL, get structured AI-powered intelligence — ranked issues, architecture overview, health snapshot, and a Q&A interface.

## Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Node.js 22 + Express + TypeScript
- **Database**: Postgres 17
- **AI**: OpenRouter (configurable model)
- **Deployment**: Docker + docker-compose

## Quick start

```bash
cp .env.example .env
# fill in GITHUB_TOKEN and OPENROUTER_API_KEY
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health: http://localhost:3001/health

## Development

**Backend**
```bash
cd backend
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

## Project structure

```
beacon/
  backend/          Express API
    src/
      routes/       POST /analyze, GET /report/:id
      services/     db.ts (Postgres)
      utils/        validation helpers
  frontend/         Vite + React SPA
    src/
      components/   SearchBar, ReportTabs
      api.ts        fetch wrappers
  docker-compose.yml
```

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | In progress | Scaffold — end-to-end skeleton |
| 2 | Planned | GitHub data collection |
| 3 | Planned | AI analysis via OpenRouter |
| 4 | Planned | Polished frontend UI |
| 5 | Planned | Q&A chat interface |

See [PLAN.md](./PLAN.md) for full details.
