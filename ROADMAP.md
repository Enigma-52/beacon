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

## Phase 4 — Feed + Deep Research ✅
- [x] OSS feed — tracked repos with AI-ranked issues, styled like goodfirstissue.dev
- [x] Language sidebar filter
- [x] 24h analysis cache — skip re-running if result is fresh
- [x] Issue Deep Researcher agent — approach, files to touch, similar merged PRs, effort, reviewer
- [x] Contributor Matcher agent — rank issues across all repos by skill/language fit
- [x] Issue research drawer with live WS step stream
- [x] Cancel running issue research
- [x] Linked PR detection via GitHub timeline API
- [x] `/r/:id` shareable repo detail route

## Bonus — Developer Experience ✅
- [x] WebSocket streaming of agent events to the UI in real time
- [x] Stop/cancel running analysis mid-stream
- [x] Pino structured logging (pretty in dev, JSON in prod)
- [x] JSON Schema tests for all AI output shapes
- [x] Route tests with mocked DAOs (supertest)
- [x] GitHub Actions CI — auto-updates coverage badge in README on every push

---

## Phase 5 — Repo Chat ❌
- [ ] `POST /ask` — takes `{ repo_id, question }`
- [ ] Pull relevant stored analysis as context (issues, architecture, health)
- [ ] Stream answer via OpenRouter (chunked transfer)
- [ ] Chat UI panel below the analysis tabs
- [ ] Suggested follow-up question chips
- [ ] `conversations` table for history per repo session

## Phase 6 — Frontend Polish ❌
- [ ] Mobile-responsive layout (feed + drawer)
- [ ] Dark/light mode toggle
- [ ] Keyboard shortcut to open issue research (press `R` on highlighted issue)
- [ ] Pagination / infinite scroll on feed
- [ ] Repo search/filter bar in feed
- [ ] Toast notifications for cache hits and research completion
- [ ] Skeleton loaders instead of plain "Loading…" text

---

## v0.2 — Contributor Intelligence ❌
> Turn Beacon into a personalized tool, not just a repo explorer.
- [ ] Contributor profile page — GitHub username → auto-detect skills from public repos
- [ ] `/match` UI — form with skill tags + level, returns personalized issue feed
- [ ] "Your Path" view — curated list of issues ranked for your profile across all tracked repos
- [ ] Per-issue effort estimate factoring contributor's past PR size and complexity
- [ ] Skill gap indicator — "you haven't worked with Go before, here's why it's still approachable"
- [ ] Bookmark issues — save to a personal shortlist across repos

## v0.3 — Staleness + Re-ranking Engine ❌
> Keep the feed fresh and signal quality over time.
- [ ] Scheduled re-analysis — cron job re-runs stale repos (> 7 days) automatically
- [ ] Issue staleness scoring — detect issues that went quiet, got stale, or were silently fixed
- [ ] Re-score issues after new PRs or comments are detected (webhook or polling)
- [ ] "Newly beginner-friendly" signal — detect when a maintainer adds `good-first-issue` label post-analysis
- [ ] Contributor activity heatmap on health tab (commits per week, last 26 weeks)
- [ ] Trend alerts — notify when a repo's health trend changes from `stable` → `declining`

## v0.4 — PR Pattern Intelligence ❌
> Help contributors understand *how* to contribute, not just *what* to contribute.
- [ ] PR Pattern Matcher — given an issue, find the 3 most similar merged PRs with full diffs
- [ ] Auto-generate a PR template suggestion based on similar merged PRs
- [ ] "Who merged this" — show which maintainer approved the most similar PRs (not just reviewers)
- [ ] First-time contributor detection — flag issues where past contributors were first-timers
- [ ] Estimated review time — based on historical PR → merge latency for that module
- [ ] PR success signals — "issues in this label get merged 80% of the time in < 3 days"

## v0.5 — Community Signals ❌
> Surface signals that go beyond the code.
- [ ] Maintainer availability score — recent issue response time, comment frequency
- [ ] "Dead PR" detector — PRs that were opened, ignored, and abandoned (signals what *not* to work on)
- [ ] Duplicate issue detection — flag issues likely already being worked on or duplicated
- [ ] External discussion signals — detect HN / Reddit / Twitter mentions of the repo (via search APIs)
- [ ] Issue sentiment analysis — detect frustrated maintainers, welcoming tone, or stale bikeshedding
- [ ] `GET /repos/:id/health-history` — track health metrics over time (requires periodic snapshots)

## v0.6 — Embeds + Integrations ❌
> Bring Beacon into existing developer workflows.
- [ ] GitHub App — post a Beacon analysis comment on new issues automatically
- [ ] VS Code extension — surface ranked issues for any repo you're browsing
- [ ] CLI tool — `beacon analyze github.com/foo/bar` outputs a markdown report
- [ ] Embeddable widget — `<beacon-issues repo="foo/bar" />` web component for project sites
- [ ] Slack bot — `/beacon analyze github.com/foo/bar` in your team's channel
- [ ] API key + rate limiting — expose Beacon as a public API for third-party integrations

## v1.0 — Platform ❌
> Multi-user, persistent, production-grade.
- [ ] Auth — GitHub OAuth login
- [ ] User accounts — saved repos, bookmarked issues, personal match profile
- [ ] Team workspaces — shared repo feeds, collaborative bookmarks
- [ ] Notifications — email/webhook when a new high-score beginner issue appears in a tracked repo
- [ ] Public repo pages — shareable `beacon.sh/r/facebook/react` with SEO-friendly HTML
- [ ] Analytics dashboard — which repos get the most research clicks, which issues get claimed
- [ ] Self-hostable via single `docker compose up` with env-only config
