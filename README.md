# AI Recruiter Platform (Backend + Frontend)

## 1) Backend Setup

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:
   - `npm install`
3. Run server:
   - `npm run dev`

### No API key mode

- You can run matching without an API key.
- If `OPENAI_API_KEY` is not set, backend uses a built-in local fallback matcher.
- You can also set `MOCK_LLM_RESPONSE` in `.env` to force deterministic mock results.

## 2) Frontend Setup (React + Tailwind)

1. Go to client folder:
   - `cd client`
2. Install dependencies:
   - `npm install`
3. Copy `client/.env.example` to `client/.env` (optional if backend is on `http://localhost:5000`).
4. Run frontend:
   - `npm run dev`

Frontend default URL: `http://localhost:5173`

## API

### `POST /api/users/register`

Body: name, email, location, **githubRepoUrl** (public `https://github.com/owner/repo`).

The server **fetches real repo metadata** from the **GitHub REST API** (languages, topics, description) — no LLM required for that. Set optional **`GITHUB_TOKEN`** in `.env` for better rate limits.

When **`OPENAI_API_KEY`** is set, an LLM enriches the summary; if the LLM fails, the GitHub API data still populates `languages` / topics.

Optional README-style fields (merged into stored context and project keywords):

- **`skills`** — string or array (e.g. `"Node.js, CI/CD"` or `["Node.js"]`)
- **`languages`** or **`userLanguages`** — declared languages
- **`projectNotes`** — short free-text about the project
- **`projectSummary`** — optional JSON object (or JSON string) merged with generated context, same shape as before:
```json
{
  "name": "Jane Dev",
  "email": "jane@example.com",
  "location": "Brooklyn",
  "githubRepoUrl": "https://github.com/facebook/react",
  "skills": ["API design", "performance"],
  "languages": ["JavaScript", "TypeScript"],
  "projectNotes": "Shipped production services and CI.",
  "projectSummary": {
    "languages": ["JavaScript", "TypeScript"],
    "frameworks": ["React"],
    "highlights": ["Built scalable APIs", "Implemented CI/CD"]
  }
}
```

Each submitted repo stores a **per-project difficulty** (1–10, from AI/context). The user’s **`totalDifficulty`** is the **sum** of those values across **GitHub-linked** projects (`Project.source === "github"`) and drives **leaderboard sort order**. Collaboration-only projects (`source === "collab"`) are **excluded** from that sum. The leaderboard shows **rank**, **total difficulty**, and project count.

### `POST /api/projects/submit`

Add another public repo for an **existing** user (same email as registration). Recomputes **`totalDifficulty`**.

```json
{
  "email": "jane@example.com",
  "githubRepoUrl": "https://github.com/nodejs/node"
}
```

### `POST /api/match`

Optional body field `keyword`: restricts candidates to users who are **creators** (`userId`) or **helpers** on a **`Project`** with **`source: "collab"`** whose **name**, **description**, or **keywords** match that substring (Mongo regex; not AI). GitHub repo projects (`source: "github"`) are not used for this filter.

```json
{
  "targetLocation": "Lower Manhattan",
  "missionDescription": "2d game or editor tooling; multiplayer a plus",
  "keyword": "react"
}
```

### `GET /api/leaderboard?limit=20`

Returns users sorted by **`totalDifficulty`** (sum of per-project difficulties, number). Each row includes **`rank`** (1 = top), **`totalDifficulty`**, **`projectCount`**, **`name`**, **`email`**, **`location`**.

### Collaboration projects (same `Project` schema, `source: "collab"`)

User-posted help-wanted entries are stored as **`Project`** documents with **`source: "collab"`**, **`name`** (title), **`description`**, **`keywords`**, **`helpers`**, and **`userId`** (creator). GitHub registrations use **`source: "github"`** (default) and a real **`githubRepoUrl`**.

#### `POST /api/collab-projects`

Creates a **`Project`** with **`source: "collab"`**. The creator must already be registered.

```json
{
  "creatorEmail": "jane@example.com",
  "title": "Open-source CLI tool",
  "description": "Need help with argument parsing and docs.",
  "keywords": "rust, cli, argparse"
}
```

#### `POST /api/collab-projects/:id/help`

Offer to help on a collab **`Project`**. **`helperEmail`** must be a registered user (not the creator).

```json
{
  "helperEmail": "bob@example.com"
}
```

### `GET /api/projects/search?q=react`

Non-AI search over **`Project`** rows with **`source: "collab"`** only: matches **name**, **description**, or **keywords**. Returns populated **`userId`** (creator) and **`helpers.userId`**. Does **not** return GitHub-linked projects.

## Run both quickly

Terminal 1 (backend):
- `npm run dev`

Terminal 2 (frontend):
- `cd client`
- `npm run dev`
