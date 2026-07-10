# Beacon — Roadmap

Shipped work lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); the original design
is archived at [docs/design/original-build-plan.md](docs/design/original-build-plan.md).

## Shipped

### v0.1 — Core loop ✅
- Vite + React SPA, Express + TypeScript API, Postgres (repos/reports), Docker Compose
- Agentic analysis via OpenRouter tool-calling: ranked issues, architecture, health, starting points
- Schema validation (ajv) on all AI output; iteration cap + error circuit breaker
- WebSocket streaming of agent events; cancel mid-run

### v0.2 — Feed + deep research ✅
- OSS feed of tracked repos with AI-ranked issues, language sidebar
- 24h analysis cache; 7-day issue-research cache
- Issue Deep Researcher agent (approach, files, similar PRs, effort, reviewer) with live WS steps
- Contributor Matcher — rank issues across repos by skill/language fit
- Linked-PR detection via timeline API; shareable `/r/:id` route
- Pino logging, route tests, JSON Schema tests, CI coverage badge

### v0.3 — Sturdy + cinematic (this release) ✅
- Retry/backoff/timeout on all outbound HTTP; model fallback chain; token budget per run
- Per-IP rate limiting, central error handler, in-flight dedup, DB indexes, graceful shutdown
- **Repo Chat** — streamed Q&A grounded in stored analysis, per-session history, follow-up chips
- Design-system CSS, animated hero, skeletons, toasts, score rings, keyboard nav, responsive feed
- Docs restructure: ARCHITECTURE.md + API.md

## Next

### v0.4 — Contributor intelligence
- Contributor profile page — GitHub username → auto-detect skills from public repos
- "Your Path" view — curated issues ranked for your profile across tracked repos
- Per-issue effort estimates factoring your past PR history
- Bookmark issues to a personal shortlist

### v0.5 — Staleness + re-ranking
- Scheduled re-analysis of stale repos (> 7 days)
- Re-score issues when new PRs/comments appear; "newly beginner-friendly" signal
- Contributor activity heatmap; health-trend alerts

### v0.6 — PR pattern intelligence
- PR Pattern Matcher — 3 most similar merged PRs with diffs for any issue
- PR template suggestions from merged-PR history; estimated review time per module
- First-time-contributor detection; per-label merge-rate signals

### v0.7 — Community signals
- Maintainer availability score; dead-PR detector; duplicate-issue detection
- Issue sentiment; health history over time

### v0.8 — Embeds + integrations
- GitHub App comment bot, VS Code extension, CLI (`beacon analyze …`), Slack bot
- Public API with keys + rate limits; embeddable widget

### v1.0 — Platform
- GitHub OAuth, saved repos/bookmarks, team workspaces
- Notifications for new high-score beginner issues
- SEO-friendly public repo pages; analytics; one-command self-hosting
