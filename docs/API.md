# Beacon — API Reference

Base URL: `http://localhost:3001` (the frontend proxies `/api/*` to it).
All bodies are JSON. Errors return `{ "error": "<message>" }` with a 4xx/5xx status.

## Analysis

### `POST /analyze`

Start (or reuse) an analysis of a GitHub repo.

```json
{ "url": "https://github.com/facebook/react", "force": false }
```

Set `force: true` to skip the 24h cache and re-analyze.

| Response | Meaning |
|---|---|
| `{ "id": 1, "status": "pending" }` | New run started — subscribe to `/ws?id=1` and poll `/report/1` |
| `{ "id": 1, "status": "done", "cached": true }` | Analyzed within 24h — report is ready now |
| `{ "id": 1, "status": "analyzing", "in_flight": true }` | Another client is already analyzing this URL — join its stream |
| `400` | Missing or non-GitHub URL |
| `429` | Rate limited |

### `GET /report/:id`

Repo row plus latest analysis (`analysis` is `null` until status is `done`):

```json
{
  "id": 1, "url": "…", "status": "done",
  "github_data": { "owner": "facebook", "repo": "react", "fetched_at": "…" },
  "analysis": {
    "issues": [{ "number": 1, "title": "…", "score": 8, "reason": "…",
                  "difficulty": "beginner", "github_url": "…", "signals": { "no_comments": true } }],
    "architecture": { "summary": "…", "key_modules": ["…"], "ownership": { "module": ["url"] } },
    "health": { "summary": "…", "activity": "…", "pr_merge_speed": "…",
                "contributor_concentration": "…", "trend": "growing|stable|declining|unknown" },
    "starting_points": [{ "name": "…", "path": "…", "url": "…", "reason": "…" }]
  }
}
```

### `POST /cancel/:id`

Abort a running analysis. → `{ "cancelled": true|false }`

## Feed

### `GET /feed`

All repos with `status = done`, newest first, plus the language list for the sidebar:

```json
{
  "repos": [{ "id": 1, "url": "…", "name": "owner/repo", "description": "…",
               "language": "TypeScript", "stars": 1234,
               "last_analyzed": "…", "top_issues": [ /* top 5 ranked issues */ ] }],
  "languages": ["Go", "TypeScript"]
}
```

## Issue research

### `POST /research/:repoId/:issueNumber`

Start a deep-research agent for one issue.
Returns `{ "research": …, "cached": true }` if researched within 7 days, else
`{ "status": "running" }` — progress streams over the repo's WebSocket
(`research_started` → `tool_call`/`tool_result` → `research_done`).

### `GET /research/:repoId/:issueNumber`

`{ "research": …, "cached": true, "created_at": "…" }`, `{ "status": "running" }`, or `404`.

Research shape: `{ summary, approach, files_to_change: [{path, reason, url}], similar_prs: [{number, title, url}], effort_estimate: "hours"|"days"|"week+", reviewer_to_ping, linked_pr? }`

### `POST /research/:repoId/:issueNumber/cancel`

→ `{ "cancelled": true|false }`

## Contributor matching

### `POST /match`

```json
{ "skills": ["typescript", "react"], "level": "intermediate", "interests": ["ui"] }
```

→ `{ "matches": [{ repo_id, repo, issue_number, title, github_url, fit_score, why }] }`

Ranks issues across every tracked repo against the profile.

## Repo Chat

### `POST /ask`

Ask a question about an analyzed repo. Streams the answer as **Server-Sent Events**.

```json
{ "repo_id": 1, "question": "Which files would I touch to fix issue #432?", "session_id": "abc123" }
```

SSE stream:

```
event: token      data: {"text":"You'd start in "}
event: token      data: {"text":"packages/react-dom…"}
event: followups  data: {"questions":["Show me similar merged PRs","Who reviews react-dom?"]}
event: done       data: {}
```

`session_id` is any client-generated string (Beacon's frontend keeps one in
localStorage). History is stored per `(repo_id, session_id)`; the last 6 messages are
replayed into each prompt for continuity.

### `GET /conversations/:repoId?session_id=abc123`

→ `{ "messages": [{ "role": "user"|"assistant", "content": "…", "created_at": "…" }] }`

## WebSocket — `/ws?id=<repoId>`

One connection per repo; every agent event arrives as a JSON message:

| Event | Payload |
|---|---|
| `started` | `{ owner, repo, model }` |
| `iteration` | `{ iteration, messageCount }` |
| `tool_call` | `{ name, args }` |
| `tool_result` | `{ name, success, summary }` |
| `done` | `{ iterations, totalTokens }` |
| `error` | `{ message }` |
| `research_started` | `{ owner, repo, issueNumber }` |
| `research_done` | `{}` — fetch `GET /research/…` for the result |
| `research_error` | `{ message }` |

## Misc

### `GET /health`

→ `{ "ok": true, "db": true }` — 503 when Postgres is unreachable.

### Rate limits

Mutating routes (`/analyze`, `/research`, `/match`, `/ask`) are rate-limited per IP
(token bucket, default 20 requests/min). Exceeding it returns `429` with
`{ "error": "rate limited" }`.
