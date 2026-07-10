# Beacon Overhaul — Design (2026-07-10)

Approved scope: docs restructure, backend hardening + cheap AI, cinematic UI overhaul, Repo Chat + feed upgrades. Commits go straight to `main`, small increments, one-liner messages.

## 1. Docs restructure

- `docs/ARCHITECTURE.md` — system diagram, agent loop walkthrough, data model, event flow.
- `docs/API.md` — every HTTP route, WS event types, request/response shapes.
- `docs/design/2025-plan.md` — PLAN.md archived verbatim (historical design).
- `ROADMAP.md` — pruned to reflect what ships in this pass; Phase 5/6 marked done.
- `README.md` — rewritten: pitch, quick start, links into docs/.

## 2. Backend sturdiness

- `services/http.ts` — `fetchWithRetry(url, init, { retries, timeoutMs })`: exponential backoff + jitter, honors `Retry-After`, AbortSignal-aware, per-request timeout. Used by GitHub tools, GitHub service, OpenRouter calls.
- Central Express error handler; internal errors log full detail, respond generic.
- Per-IP token-bucket rate limiter middleware (no new deps) on mutating routes.
- In-flight dedup: concurrent `POST /analyze` for the same URL joins the running job instead of racing.
- DB: indexes on `reports(repo_id, created_at)`, `issue_research(repo_id)`, `conversations(repo_id, session_id)`; graceful shutdown closing HTTP server + pool.
- `express.json({ limit: '100kb' })`.

## 3. Cheap AI

- Model fallback chain: `OPENROUTER_MODEL` then `OPENROUTER_MODEL_FALLBACKS` (comma list); on 429/5xx/schema-fail, next model.
- Compact JSON everywhere (no pretty-printing into prompts) and capped tool-result sizes.
- Token budget per agent run (`AGENT_TOKEN_BUDGET`, default 150k): when exceeded, agent is told to produce final analysis now.
- Chat grounded in *stored* analysis (no live GitHub fetches, no agent loop) — a single cheap completion per message.

## 4. Repo Chat (Phase 5)

- Table `conversations (id, repo_id, session_id, messages JSONB, created_at, updated_at)`, unique `(repo_id, session_id)`.
- `POST /ask { repo_id, question, session_id }` → SSE stream (`text/event-stream`): `token` events, then `followups` event (2–3 suggested questions), then `done`. Context: repo metadata + stored analysis + last 6 messages.
- `GET /conversations/:repoId?session_id=` → message history.
- Frontend: chat panel on repo detail page under tabs; streams tokens; follow-up chips; `session_id` in localStorage.

## 5. Cinematic frontend

- Real design system in CSS: tokens (color, space, type scale, radii, shadows, motion durations/easings), utility classes, keyframe library. Inline styles migrated to classes for the shared shell.
- Beacon motif: animated lighthouse-sweep gradient in hero, glassy sticky nav, grain/vignette background layer.
- Staggered card entrance animations, skeleton loaders for feed/report, toasts (cache hit, research done, errors).
- Score rings (SVG) replacing plain score chips; difficulty pills; health trend visual.
- Feed: search/filter bar, sort, keyboard nav (`j`/`k` move, `enter` open, `r` research), responsive down to mobile.

## Out of scope

v0.2+ roadmap items (contributor profile page, staleness engine, PR pattern matcher, integrations, auth).
