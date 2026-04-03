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

1. Go to frontend folder:
   - `cd frontend`
2. Install dependencies:
   - `npm install`
3. (Optional) Copy `frontend/.env.example` to `frontend/.env`.
4. Run frontend:
   - `npm run dev`

Frontend default URL: `http://localhost:5173`

Recruiter UI route: `http://localhost:5173/#/recruiter`

## API

### `POST /api/users/register`

```json
{
  "name": "Jane Dev",
  "email": "jane@example.com",
  "location": "Brooklyn",
  "projectSummary": {
    "languages": ["JavaScript", "TypeScript"],
    "frameworks": ["Node.js", "React"],
    "highlights": ["Built scalable APIs", "Implemented CI/CD"]
  }
}
```

### `POST /api/match`

```json
{
  "targetLocation": "Lower Manhattan",
  "missionDescription": "Need a full-stack JavaScript engineer with API performance optimization experience"
}
```

## Run both quickly

Terminal 1 (backend):
- `npm run dev`

Terminal 2 (frontend):
- `cd frontend`
- `npm run dev`
