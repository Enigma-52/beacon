# Beacon — Build Plan

## What Beacon actually is

Beacon is a research and navigation tool for OSS contribution — not a coding assistant.

GitHub gives you a wall of issues and a README. Everything else — who actually makes decisions, which issues are realistic to pick up, whether the project is actively maintained, what a good PR looks like here — is buried in PR history, review threads, and contributor behavior. That knowledge exists, it's just inaccessible.

Beacon reads all of that and surfaces it for someone trying to contribute. The question it answers isn't "explain this code" — it's:

- Is this repo worth contributing to right now?
- What's a realistic entry point for someone with my background?
- Who reviews what, and how do they like to work?
- Has someone attempted this before, and what happened?
- What do I need to understand before I open a single file?

That's a distinct gap. Copilot and ChatGPT help you write code. Nothing helps you navigate the social and structural reality of a new open source project before you start. That's Beacon's lane.

---

**What it is (one line):** Paste a GitHub repo URL, get structured AI-powered intelligence about it — ranked issues, architecture overview, health snapshot, and a Q&A interface.

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

---

---

# v0.2 — Research Engine

**Goal:** Make the analysis smarter and more specific. v0.1 gives you a broad overview. v0.2 gives you actionable depth — real maintainer routing, PR pattern lookup, and a proper issue ranker that goes beyond surface labels.

**No new infrastructure.** Same stack, better data collection and better prompts.

---

## What changes

### 1. Deeper GitHub data collection
Extend the collector to fetch more signal per issue and PR:

- Per issue: which files does it reference? who commented? how many attempts have been made?
- Per merged PR: which files were touched, who reviewed, how many rounds of review, how long did it take to merge?
- Per contributor: which directories do they mostly commit to? (build a rough "code ownership" map)

Store all of this in the existing `github_data` JSONB column — just richer.

### 2. Issue Ranker (upgraded)
v0.1 scores issues 1–10 with a simple prompt. v0.2 adds real signals to the prompt:

- Staleness (has anyone tried this and given up?)
- Code surface touched (is it a single file or does it span 10 modules?)
- Reviewer availability (does the maintainer who owns that code still review actively?)
- Prior similar PRs (did similar attempts get merged or closed?)

Output: ranked issue list with a `why` explanation and a `difficulty` tag (beginner / intermediate / advanced).

### 3. PR Pattern Matcher
New tab in the UI: **"Similar PRs"**

- User describes what they want to work on (or picks an issue)
- Backend finds the 5 most structurally similar merged PRs from the stored data
- Matching is done by the LLM — pass the task description + all PR summaries, ask it to pick and explain
- Show: what files were changed, what the review feedback was, how long it took to merge

This is pure LLM matching — no embeddings needed yet. Works fine within context window for most repos.

### 4. Maintainer Routing
Adds to the Architecture tab:

- A "who to ping" card per module/directory — inferred from PR review history
- Shows reviewer name, how often they review that area, avg response time
- Helps contributors know who to tag in their PR

### New DB column

```sql
ALTER TABLE repos ADD COLUMN contributor_map JSONB;
-- { "src/compiler": ["@gaearon", "@sebmarkbage"], "packages/react-dom": [...] }
```

Built from PR history during collection, stored once.

---

## Done = what v0.2 looks like

User picks an issue, sees: difficulty rating with reasoning, 3 similar merged PRs with what worked, which maintainer owns the relevant code, and an estimate of how long review typically takes for that area.

---

---

# v0.3 — Interactive Assistant

**Goal:** Turn the Q&A from stateless one-shots into a real back-and-forth conversation grounded in the repo. Make Beacon feel like asking a knowledgeable colleague who has read the whole repo.

---

## What changes

### 1. Conversation history
Store chat messages per repo session in a new table:

```sql
CREATE TABLE conversations (
  id         SERIAL PRIMARY KEY,
  repo_id    INT REFERENCES repos(id),
  session_id TEXT NOT NULL,         -- random ID stored in browser localStorage
  messages   JSONB DEFAULT '[]',    -- [{ role, content, created_at }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`session_id` lives in `localStorage` — no login required. Conversations are per-browser, per-repo.

### 2. Smarter context building
Instead of dumping all repo data into every prompt, build a focused context per question:

- Parse the question to figure out what kind of data is relevant (issue? file? contributor? PR?)
- Pull only that slice from the stored JSONB
- Inject conversation history (last 6 messages) for continuity

Still no vector DB — just a lightweight keyword match on the question to decide which JSONB fields to include.

### 3. Streaming responses
Backend streams the OpenRouter response token by token to the frontend using `Transfer-Encoding: chunked`. Frontend appends tokens as they arrive — feels instant, no spinner waiting for a full response.

### 4. Suggested follow-up questions
After each answer, the LLM suggests 2–3 follow-up questions as chips the user can tap. Makes the assistant feel guided and discoverable.

### 5. UI refresh
The chat box becomes a proper sidebar panel (or full-page chat view on mobile). Conversation history visible, scrollable, with timestamps.

---

## Done = what v0.3 looks like

User asks "which files would I touch to fix issue #432?" — Beacon answers with specific file paths, explains why, and suggests "Want to see similar PRs that touched these files?" as a follow-up. Next question picks up where the last left off.

---

---

# v0.4 — Contributor Intelligence

**Goal:** Make Beacon personal. Instead of generic repo analysis, give each contributor a tailored path: which issues suit them, what to learn first, how to ramp up.

---

## What changes

### 1. Contributor profile (no auth)
A simple onboarding form before analysis:

- What's your experience level? (new to OSS / comfortable with code / experienced contributor)
- What languages/areas do you know? (checkboxes)
- What's your goal? (fix a bug / add a feature / improve docs / learn the codebase)

Stored in `localStorage`. Sent along with every AI call to personalize the output.

### 2. Personalized issue recommendations
Issue ranker now factors in the contributor profile:

- A beginner who knows Python gets Python-touching issues ranked higher
- Someone who wants to learn gets issues with good learning surface, not just easy ones
- Someone experienced gets harder issues with more interesting scope

Same LLM call, just a richer prompt with the profile included.

### 3. Learning path
New tab: **"Your Path"**

Given the contributor profile + repo structure, the LLM generates:

1. What to read first (docs, key files)
2. What to understand before touching code (architecture concepts, key abstractions)
3. A suggested first issue — with an explanation of exactly why it suits them
4. What a good first PR looks like for this repo

Stored in `reports.analysis` under a `learning_path` key.

### 4. Implementation hints (per issue)
When a user opens an issue detail view, show:

- Which files they'll probably need to touch
- Which existing code to look at for reference
- What the typical review feedback has been on similar PRs
- A rough effort estimate (hours, not story points)

All LLM-generated, grounded in the stored PR and contributor data from v0.2.

### New DB column

```sql
ALTER TABLE reports ADD COLUMN learning_path JSONB;
-- { read_first: [...], understand_first: [...], suggested_issue: {...}, first_pr_tips: "..." }
```

---

## Done = what v0.4 looks like

A first-time contributor to `kubernetes/kubernetes` fills in "I know Go, I'm new to OSS, I want to fix a real bug" — Beacon shows them 3 specific issues ranked for their profile, a reading list of 4 files to understand first, and a plain-English explanation of what their first PR should look like based on how maintainers have reviewed similar ones.
