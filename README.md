<div align="center">

# Beacon

**Navigate open source like you've been there before.**

Paste a GitHub repo URL. Beacon's AI agent explores it — reading issues, PRs, contributors, and code — then returns ranked contribution opportunities, an architecture breakdown, a health snapshot, and the best files to start with.

<br/>

![Node](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Postgres](https://img.shields.io/badge/Postgres-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)
![Schema Coverage](https://img.shields.io/badge/schema%20coverage-100%25-brightgreen?style=flat-square)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square&logo=vitest&logoColor=white)

</div>

---

## Quick start

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY
docker compose up --build
```

Open **http://localhost:5173**

---

## How it works

```
Paste repo URL  →  AI agent explores GitHub iteratively
                →  Issues, PRs, contributors, file tree
                →  Structured analysis streamed live to UI
                →  Ranked issues · Architecture · Health · Start Here
```

---

## Local dev

```bash
make dev-db          # Postgres only
make dev-backend     # backend with hot reload
make dev-frontend    # Vite dev server
make test            # run all tests
make coverage        # run tests with coverage report
```

---

## Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `OPENROUTER_API_KEY` | ✓ | OpenRouter API key |
| `GITHUB_TOKEN` | — | Increases GitHub rate limits |
| `OPENROUTER_MODEL` | — | Override the default model (`gpt-4o-mini`) |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for what's done and what's next.
