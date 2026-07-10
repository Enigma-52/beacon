<div align="center">

# Beacon

**Navigate open source like you've been there before.**

Paste a GitHub repo URL. Beacon's AI agent explores it — reading issues, PRs, contributors, and code — then returns ranked contribution opportunities, an architecture breakdown, a health snapshot, and the best files to start with. Then ask it anything about the repo.

<br/>

![Node](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Postgres](https://img.shields.io/badge/Postgres-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![Coverage](https://img.shields.io/badge/coverage-30%25-red?style=flat-square)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square&logo=vitest&logoColor=white)

</div>

---

## What you get

- **Feed** — every repo you track, with its top AI-ranked issues, filterable by language, searchable, keyboard-navigable
- **Repo report** — ranked issues (score + difficulty + freshness signals), architecture + ownership map, health snapshot, "start here" reading list
- **Issue deep research** — one click on any issue: concrete approach, files to touch, similar merged PRs, effort estimate, reviewer to ping
- **Repo chat** — streamed Q&A grounded in the stored analysis, with suggested follow-ups
- **Contributor matching** — rank issues across all tracked repos against your skills

Everything the agent does streams live to the UI over WebSocket — you watch it read the repo.

## Quick start

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY
docker compose up --build
```

Open **http://localhost:5173**

## How it works

```
Paste repo URL  →  AI agent explores GitHub iteratively (tool-calling loop)
                →  Issues, PRs, contributors, file tree, files on demand
                →  Structured analysis validated against JSON Schema
                →  Streamed live to the UI · cached 24h · chat on top
```

Deep dives:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, agent loop, data model, cost controls
- [docs/API.md](docs/API.md) — every route, SSE chat stream, WebSocket events
- [ROADMAP.md](ROADMAP.md) — what's shipped and what's next

## Local dev

```bash
make dev-db          # Postgres only
make dev-backend     # backend with hot reload
make dev-frontend    # Vite dev server
make test            # run all tests
make coverage        # run tests with coverage report
```

## Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `OPENROUTER_API_KEY` | ✓ | OpenRouter API key |
| `GITHUB_TOKEN` | — | Increases GitHub rate limits |
| `OPENROUTER_MODEL` | — | Primary model (default `openai/gpt-4o-mini`) |
| `OPENROUTER_MODEL_FALLBACKS` | — | Comma-separated fallback models tried on provider errors |
| `AGENT_TOKEN_BUDGET` | — | Max total tokens per agent run (default 150000) |
| `RATE_LIMIT_PER_MIN` | — | Per-IP requests/min on mutating routes (default 20) |
