# Beacon

Navigate open source like you've been there before.

Paste a GitHub repo URL and Beacon's AI agent explores it autonomously — fetching issues, PRs, contributors, and file structure — then surfaces ranked contribution opportunities, an architecture overview, a health snapshot, and the best files to start with.

## How it works

Beacon runs an **agentic tool-calling loop** powered by OpenRouter. The agent iteratively calls GitHub tools (list issues, fetch PRs, read files, etc.) until it has enough context to produce a structured analysis. Every step streams to the browser in real time over WebSocket so you can watch the agent think.

```
Browser → POST /analyze → agent loop starts
               ↓
         LLM calls tools → GitHub API → results fed back to LLM
               ↓
         LLM calls produce_analysis → validated output stored
               ↓
         WS /ws?id={repoId} streams each event live to UI
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript |
| Backend | Node.js 24 + Express + TypeScript |
| Database | Postgres 18 (JSONB for flexible storage) |
| AI | OpenRouter — default `openai/gpt-4o-mini` |
| Streaming | WebSocket (`ws`) — one connection per analysis |
| Logging | Pino (pretty in dev, JSON in prod) |
| Validation | ajv (JSON Schema draft-07 on all LLM output) |
| Deployment | Docker + docker-compose |

## Quick start

```bash
cp .env.example .env
# Set OPENROUTER_API_KEY (required)
# Set GITHUB_TOKEN (optional — increases rate limits for private-ish repos)

docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:3001
- Health: http://localhost:3001/health

## Local development

Use the Makefile for convenience:

```bash
make dev-db          # start Postgres only
make dev-backend     # run backend with hot reload (NODE_ENV=development)
make dev-frontend    # run Vite dev server
make test            # run all tests
```

Or run manually:

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Start analysis. Body: `{ "url": "https://github.com/owner/repo" }` |
| `GET` | `/report/:id` | Poll analysis status and results |
| `POST` | `/cancel/:id` | Abort a running analysis |
| `WS` | `/ws?id={repoId}` | Stream agent events in real time |

### Agent event types (WebSocket)

```typescript
{ type: 'started';      owner, repo, model }
{ type: 'iteration';    iteration, messageCount }
{ type: 'tool_call';    name, args }
{ type: 'tool_result';  name, success, summary }
{ type: 'done';         iterations, totalTokens }
{ type: 'error';        message }
```

## Project structure

```
beacon/
  backend/
    src/
      agents/       agentic loop (analysis.agent.ts) + event types
      tools/        tool definitions, executor, GitHub API calls
      prompts/      system prompt for the analysis agent
      schemas/      JSON Schema definitions + ajv validators
      routes/       /analyze, /report/:id, /cancel/:id
      services/     db, event-bus, cancellation, processor, logger
      dao/          typed query functions (repos, reports)
  frontend/
    src/
      components/   SearchBar, AgentLog, ReportTabs (Issues/Architecture/Health/Start Here)
      hooks/        useAgentStream (WebSocket)
      api.ts        fetch wrappers
      analysisTypes.ts  shared Analysis type definitions
  docker-compose.yml
  Makefile
  nginx.conf        WebSocket + API proxy for production frontend
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `GITHUB_TOKEN` | No | — | GitHub personal access token (increases rate limits) |
| `OPENROUTER_MODEL` | No | `openai/gpt-4o-mini` | Any OpenRouter-compatible model |
| `DATABASE_URL` | No | set by docker-compose | Postgres connection string |
| `LOG_LEVEL` | No | `info` | Pino log level |

## Testing

```bash
cd backend && npm test    # schema validation + route tests
cd frontend && npm test   # component tests (vitest + @testing-library/react)
```

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed phase status.
