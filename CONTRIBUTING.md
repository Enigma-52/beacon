# Contributing to Beacon

Thanks for wanting to help. Beacon is small and moves fast — here's everything you need.

## Run it locally

```bash
cp .env.example .env        # add your OPENROUTER_API_KEY
make dev-db                 # Postgres in Docker
make dev-backend            # Express + tsx watch on :3001
make dev-frontend           # Vite on :5173
```

Or everything at once: `docker compose up --build`.

Seed a few repos so the feed isn't empty:

```bash
make seed
```

## Project layout

- `backend/src/` — Express API, agents, GitHub tools. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- `frontend/src/` — React SPA, hand-rolled design system in `src/styles/`.
- `docs/API.md` — every endpoint; keep it in sync when you touch routes.

## Before you open a PR

```bash
make test        # backend + frontend suites must pass
```

- TypeScript strict mode is on in both packages — no `any` unless you're wrapping untyped API responses.
- New routes need a test (see `backend/src/test/routes.test.ts` for the DAO-mock pattern).
- AI calls go through `services/openrouter.ts` — never call fetch against OpenRouter directly. Keep prompts compact; JSON in prompts is `JSON.stringify` without pretty-printing.
- UI work: use the tokens in `src/styles/tokens.css`; no new CSS frameworks, no inline hex colors.

## Good first areas

- `ROADMAP.md` lists what's next — anything unchecked is fair game.
- Feed UX, new agent tools, and cost-reduction ideas are especially welcome.

## Reporting bugs

Open an issue with the repo URL you analyzed, what you expected, and the backend log line if you have it (requests are logged with latency).
