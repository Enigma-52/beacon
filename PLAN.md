# Beacon — Build Plan

**What it is:** Paste a GitHub repo URL, get structured AI-powered intelligence about it — ranked issues, architecture overview, health snapshot, and a Q&A interface.

**Stack:** React · Node.js (Express) · Postgres · OpenRouter · GitHub REST API

---

## How it works (the loop)

```
User pastes repo URL
  → Backend fetches data from GitHub API
  → Stores raw data in Postgres
  → Sends relevant data to OpenRouter (LLM)
  → Stores AI analysis result in Postgres
  → Frontend displays it
```

No vector DB. No embeddings. Just GitHub data + a good prompt + an LLM.

---

## Phases

### Phase 1 — Scaffold (Day 1–2)
Get the skeleton running end to end.

- `frontend/` — Vite + React app, single page with a URL input and a results area
- `backend/` — Express app with two routes: `POST /analyze` and `GET /report/:id`
- Postgres with two tables:
  - `repos` — url, github_data (JSONB), status, created_at
  - `reports` — repo_id, analysis (JSONB), created_at
- `.env` for `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `DATABASE_URL`

---

### Phase 2 — GitHub Data Collection (Day 2–3)
Build the collector. On `POST /analyze`, fetch and store:

- Repo metadata (name, description, stars, language, license)
- Top 30 open issues (title, labels, comments, age)
- Last 20 merged PRs (title, files changed, reviewer, merge time)
- Top 10 contributors (commits, files touched)
- File tree (top 2 levels — just names, not content)
- README text

All stored as JSONB in the `repos` table. Fetch once, re-use for analysis.

---

### Phase 3 — AI Analysis (Day 3–4)
Send collected data to OpenRouter. One call per analysis type, results stored in `reports`.

**Four analysis outputs:**

1. **Issue Rankings** — score each issue 1–10 for approachability, with a one-line reason
2. **Architecture Summary** — what the repo does, key modules, who owns what (inferred from PRs)
3. **Health Snapshot** — PR merge speed, contributor concentration, activity trend
4. **Suggested starting points** — top 3 files/docs to read before contributing

Use a cheap-but-capable model via OpenRouter (e.g. `google/gemini-flash-1.5` or `mistral/mistral-nemo`). Keep prompts tight — pass only the relevant slice of data per call, not everything.

---

### Phase 4 — Frontend UI (Day 4–5)
Simple, clean React UI. No auth, no routing complexity.

**Single page layout:**
```
[ GitHub repo URL input ]  [ Analyze button ]

Tabs: Issues | Architecture | Health | Start Here

Each tab shows the AI output for that analysis type.
Loading state while backend is working.
```

- Poll `GET /report/:id` every 3s until status is `done`
- Render results as clean cards, not raw JSON
- One shared results page per repo (shareable by URL)

---

### Phase 5 — Q&A (Day 6–7)
Add a chat input below the results.

- `POST /ask` — takes `{ repo_id, question }`
- Backend pulls the stored repo data from Postgres
- Builds a prompt: repo context + user question
- Sends to OpenRouter, streams response back
- Frontend renders it inline

No history, no sessions — just stateless Q&A grounded in the already-fetched repo data.

---

## Postgres Schema

```sql
CREATE TABLE repos (
  id          SERIAL PRIMARY KEY,
  url         TEXT UNIQUE NOT NULL,
  github_data JSONB,
  status      TEXT DEFAULT 'pending', -- pending | fetching | analyzing | done | error
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id          SERIAL PRIMARY KEY,
  repo_id     INT REFERENCES repos(id),
  analysis    JSONB,  -- { issues, architecture, health, starting_points }
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

That's it. No migrations framework needed for v0.1 — just run the SQL once.

---

## Folder Structure

```
beacon/
  backend/
    index.js          # Express app
    routes/
      analyze.js      # POST /analyze, GET /report/:id
      ask.js          # POST /ask
    services/
      github.js       # GitHub API fetching
      openrouter.js   # LLM calls
      db.js           # Postgres queries
    .env
  frontend/
    src/
      App.jsx
      components/
        SearchBar.jsx
        ReportTabs.jsx
        ChatBox.jsx
    index.html
```

---

## What we skip for now

- Auth / user accounts
- Caching / rate limit handling (add later)
- Vector search / embeddings (not needed yet)
- Webhook-based auto-refresh
- Docker / deployment setup

---

## Done = what v0.1 looks like

User pastes `https://github.com/facebook/react`, hits Analyze, and within ~30s sees:

- Top 5 approachable issues with scores and reasons
- A plain-English architecture summary
- A health snapshot (is this repo active? who's reviewing?)
- 3 recommended files to read first
- A chat box to ask follow-up questions
