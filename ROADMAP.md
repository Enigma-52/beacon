# Beacon — Roadmap

## Phase 1 — Scaffold ✅
- [x] `frontend/` — Vite + React + TypeScript SPA
- [x] `backend/` — Express + TypeScript API
- [x] Postgres schema: `repos` + `reports` tables
- [x] `POST /analyze` + `GET /report/:id`
- [x] Docker + docker-compose (Node 24, Postgres 18)

## Phase 2 — GitHub Data Collection ✅
> Implemented as agent tools instead of a single upfront fetch
- [x] Repo metadata (stars, language, license, activity)
- [x] Open issues (labels, comments, age)
- [x] Merged PRs (author, reviewers, merge time)
- [x] Contributors (commit counts)
- [x] File tree (top 3 levels)
- [x] README + file content on demand
- [x] PR details (files changed, review comments)

## Phase 3 — AI Analysis ✅
> Implemented as an agentic tool-calling loop via OpenRouter
- [x] Issue rankings — score 1–10 with reason + difficulty tag
- [x] Issue signals — no comments, no prior PRs, freshness
- [x] Architecture summary — modules, ownership map with linked profiles
- [x] Health snapshot — activity, PR merge speed, contributor concentration, trend
- [x] Starting points — ranked files/docs with GitHub URLs
- [x] Agentic exploration — LLM decides what to fetch iteratively
- [x] Schema validation on LLM output (ajv)
- [x] Error circuit-breaking — bail after N consecutive tool failures

## Bonus — Developer Experience ✅
- [x] WebSocket streaming of agent events to the UI in real time
- [x] Stop/cancel running analysis mid-stream
- [x] Pino structured logging (pretty in dev, JSON in prod)
- [x] JSON Schema tests for all AI output shapes

## Phase 4 — Frontend UI 🔄
- [x] URL input + Analyze button
- [x] Agent log (live tool call stream)
- [x] Stop button
- [x] Rich issue cards (score badge, difficulty, signals, linked to GitHub)
- [x] Architecture tab (summary, modules, linked maintainer profiles)
- [x] Health tab (metrics grid)
- [x] Start Here tab (linked file cards)
- [ ] Shareable URL per repo (`/r/:id` route)
- [ ] Mobile-responsive layout

## Phase 5 — Q&A ❌
- [ ] `POST /ask` — takes `{ repo_id, question }`
- [ ] Pull relevant stored repo data as context
- [ ] Stream response via OpenRouter
- [ ] Chat UI below the analysis tabs
- [ ] Suggested follow-up questions

---

## v0.2 — Research Engine ❌
- [ ] Deeper issue signals: files referenced, prior attempt count
- [ ] Issue ranker with staleness + reviewer availability scoring
- [ ] PR Pattern Matcher tab — find similar merged PRs to your task
- [ ] Maintainer routing — who to ping, per module
- [ ] `contributor_map` JSONB column on `repos`

## v0.3 — Interactive Assistant ❌
- [ ] Conversation history per repo session (`conversations` table)
- [ ] Focused context per question (keyword match on JSONB)
- [ ] Streaming responses (chunked transfer)
- [ ] Follow-up question chips

## v0.4 — Contributor Intelligence ❌
- [ ] Contributor profile onboarding (skill level, language, goal)
- [ ] Personalized issue recommendations based on profile
- [ ] "Your Path" tab — learning path + suggested first issue
- [ ] Per-issue implementation hints (files to touch, reference PRs, effort estimate)
