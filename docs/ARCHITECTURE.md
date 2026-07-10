# Beacon — Architecture

Beacon answers one question: **"How do I contribute to this repo?"** It does that by running AI agents over live GitHub data and streaming their findings to the browser in real time.

```
┌──────────────┐   HTTP + WS    ┌──────────────────────────────┐
│   Frontend   │ ─────────────▶ │           Backend            │
│  React/Vite  │ ◀───────────── │        Express + ws          │
└──────────────┘                │                              │
                                │  routes ──▶ processor        │
                                │               │              │
                                │               ▼              │
                                │        analysis agent ◀────▶ OpenRouter (LLM)
                                │               │              │
                                │        github tools ◀──────▶ GitHub REST API
                                │               │              │
                                │               ▼              │
                                │           Postgres           │
                                └──────────────────────────────┘
```

## The agentic analysis loop

Beacon does **not** dump a repo into one giant prompt. `POST /analyze` kicks off an
agent (`backend/src/agents/analysis.agent.ts`) that runs a tool-calling loop:

1. The LLM receives a system prompt (`prompts/analysis.prompt.ts`) and the repo slug.
2. It chooses which GitHub tools to call — `get_repo_info`, `list_issues`,
   `list_merged_prs`, `get_pr_details`, `list_contributors`, `get_file_tree`,
   `get_file_content`, `get_readme` (`tools/github.tools.ts`).
3. Tool results are appended to the conversation; the loop repeats (max 20 iterations).
4. When ready, the LLM calls the terminal tool `produce_analysis`. Its payload is
   validated against a JSON Schema (ajv) — invalid output fails the run rather than
   corrupting the DB.
5. Every step is emitted on the event bus and streamed to the browser over WebSocket.

Guard rails:

- **Iteration cap** (20) and **consecutive-error circuit breaker** (4 failed tool calls
  → agent is told to wrap up with what it has).
- **Token budget** — when cumulative usage crosses the budget the agent is told to
  produce the final analysis immediately.
- **Cancellation** — `POST /cancel/:id` aborts the underlying `fetch` via `AbortSignal`
  (`services/cancellation.ts`).
- **Model fallback** — on provider errors, the OpenRouter client retries down a
  configurable model chain (see `services/openrouter.ts`).
- **Retry/backoff** — all outbound HTTP (GitHub + OpenRouter) goes through
  `services/http.ts`: timeouts, exponential backoff with jitter, `Retry-After` support.

## Agents

| Agent | File | Job |
|---|---|---|
| Analysis | `agents/analysis.agent.ts` | Full repo report: ranked issues, architecture, health, starting points |
| Issue Researcher | `agents/issue-researcher.agent.ts` | Deep dive on one issue: approach, files to touch, similar merged PRs, effort, reviewer |
| Contributor Matcher | `agents/contributor-matcher.ts` | Rank issues across all tracked repos against a skill profile |
| Repo Chat | `services/chat.ts` | Conversational Q&A grounded in the stored analysis — single completion, no agent loop |

## Event flow (WebSocket)

`services/event-bus.ts` maps `repoId → Set<WebSocket>`. The browser connects to
`/ws?id=<repoId>` and receives every `AgentEvent` (`agents/events.ts`) as JSON:
`started`, `iteration`, `tool_call`, `tool_result`, `done`, `error`, plus
`research_started` / `research_done` / `research_error` for issue research.

## Data model (Postgres)

```sql
repos           (id, url UNIQUE, github_data JSONB, status, created_at, updated_at)
reports         (id, repo_id → repos, analysis JSONB, created_at)
issue_research  (id, repo_id → repos, issue_number, research JSONB, created_at,
                 UNIQUE (repo_id, issue_number))
conversations   (id, repo_id → repos, session_id, messages JSONB, created_at, updated_at,
                 UNIQUE (repo_id, session_id))
```

`status` walks `pending → fetching → analyzing → done | error`. Schema is created
idempotently on boot (`services/db.ts`) — no migration framework at this size.

## Caching & cost control

- **Analysis cache** — a repo analyzed within 24h returns the stored report instantly.
- **Issue research cache** — 7 days, keyed `(repo_id, issue_number)`.
- **In-flight dedup** — concurrent analyses of the same URL join one run.
- **Cheap-first models** — default `openai/gpt-4o-mini` via OpenRouter with an env-driven
  fallback chain; prompts use compact JSON and capped tool outputs.
- **Chat is cheap by design** — grounded in already-stored analysis, one completion per
  message, no GitHub calls.

## Frontend

React 18 + Vite SPA, react-router. Three routes:

- `/` — feed of tracked repos with AI-ranked issues (language filter, search, keyboard nav)
- `/analyze` — paste a URL, watch the agent work live, get the report
- `/r/:id` — shareable repo report + chat panel

State is plain hooks; the WS stream is wrapped in `hooks/useAgentStream.ts`. Styling is
a hand-rolled design system in `src/styles/` (tokens + component classes) — no CSS
framework.

## Repo layout

```
backend/src/
  index.ts        HTTP + WS server, graceful shutdown
  routes/         analyze, feed, research, match, ask
  agents/         the three agents + event types
  tools/          GitHub tool definitions + executor
  services/       db, http (retry), openrouter, chat, event-bus, cancellation, logger,
                  processor, rate-limit
  dao/            SQL access (repos, reports, issue-research, conversations)
  schemas/        JSON Schemas + TS types for all AI output
frontend/src/
  pages/          FeedPage
  components/     SearchBar, ReportTabs, AgentLog, IssueResearchDrawer, ChatPanel, …
  hooks/          useAgentStream
  styles/         design tokens + component CSS
```
