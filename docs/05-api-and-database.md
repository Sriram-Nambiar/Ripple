# 5. API and Database Contract

This document is the shared agreement between the Express backend and React frontend. If an endpoint or response shape changes, update this file and both sides together.

## 5.1 API conventions

- Base path: `/api/v1`
- Request/response body format: JSON
- Analysis creation is asynchronous.
- User-visible analysis statuses: `queued`, `running`, `completed`, `failed`
- Keep secrets and GitHub credentials on the server.
- Use one consistent error envelope.

## 5.2 Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/analyses` | Validate PR URL and enqueue an analysis |
| `GET` | `/api/v1/analyses/:analysisId` | Retrieve status and summary |
| `GET` | `/api/v1/analyses/:analysisId/graph` | Retrieve dependency graph |
| `GET` | `/api/v1/analyses/:analysisId/affected-files` | Retrieve changed/affected file list |
| `GET` | `/api/v1/health` | Basic service health check |

### Create an analysis

`POST /api/v1/analyses`

Request:

```json
{
  "pullRequestUrl": "https://github.com/owner/repo/pull/123"
}
```

Accepted response (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_123",
    "status": "queued"
  }
}
```

The server must validate that the URL is an allowed GitHub pull request URL and extract owner, repository, and PR number. Do not accept arbitrary clone URLs or arbitrary hosts from this field.

### Get analysis status and summary

`GET /api/v1/analyses/:analysisId`

While processing:

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_123",
    "status": "running",
    "repository": "owner/repo",
    "pullRequest": {
      "number": 123,
      "title": "Add user service"
    }
  }
}
```

When completed, include a summary:

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_123",
    "status": "completed",
    "repository": "owner/repo",
    "pullRequest": {
      "number": 123,
      "title": "Add user service",
      "url": "https://github.com/owner/repo/pull/123",
      "baseSha": "base-commit-sha",
      "headSha": "head-commit-sha"
    },
    "summary": {
      "riskScore": 67,
      "riskLevel": "High",
      "changedFileCount": 2,
      "directAffectedCount": 3,
      "indirectAffectedCount": 5,
      "warnings": []
    }
  }
}
```

If failed, return `status: "failed"` and a safe `error` object. Do not return stack traces or secrets.

### Get dependency graph

`GET /api/v1/analyses/:analysisId/graph`

Return a frontend-neutral representation. Do not store React Flow-specific fields as the canonical API contract.

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "src/services/user.service.ts",
        "filePath": "src/services/user.service.ts",
        "language": "typescript",
        "status": "changed"
      },
      {
        "id": "src/controllers/user.controller.ts",
        "filePath": "src/controllers/user.controller.ts",
        "language": "typescript",
        "status": "direct_affected"
      }
    ],
    "edges": [
      {
        "source": "src/controllers/user.controller.ts",
        "target": "src/services/user.service.ts",
        "importPath": "../services/user.service"
      }
    ]
  }
}
```

Allowed node statuses: `changed`, `direct_affected`, `indirect_affected`, `unaffected`. The edge direction remains importer-to-imported-file.

### Get affected files

`GET /api/v1/analyses/:analysisId/affected-files`

Return a list with at least:

- `filePath`
- `status` (`changed`, `direct_affected`, or `indirect_affected`)
- `impactDepth` (0 for changed files, 1 for direct dependents, 2+ for indirect dependents)
- `reasons` (brief explanation, e.g. `Imports src/services/user.service.ts`)
- PR file status where available (`added`, `modified`, `removed`, `renamed`)

### Health check

`GET /api/v1/health` returns a simple service status. Do not expose credentials, internal configuration, or infrastructure details.

## 5.3 Error response format

Use one shape consistently:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PULL_REQUEST_URL",
    "message": "Provide a valid GitHub pull request URL."
  }
}
```

Suggested status mapping:

| Situation | HTTP status |
|---|---:|
| Invalid request / URL | 400 |
| Analysis ID not found | 404 |
| Analysis accepted | 202 |
| Rate limit exceeded | 429 |
| GitHub or upstream service unavailable | 502 or 503 |
| Unexpected server error | 500 |

Keep `code` stable for frontend handling. Messages should be safe to show to users.

## 5.4 Database entities

The following is a small logical schema. Use the team's chosen SQL migration tooling and naming convention when implementing it.

### `repositories`

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `owner` | GitHub owner/org |
| `name` | Repository name |
| `full_name` | `owner/name` |
| `html_url` | Repository URL |
| `created_at` | Record creation time |

A unique constraint on `full_name` is appropriate for the MVP.

### `pull_requests`

| Field | Purpose |
|---|---|
| `id` | Primary key |
| `repository_id` | Foreign key to `repositories` |
| `pr_number` | GitHub PR number |
| `title` | PR title |
| `html_url` | PR URL |
| `base_sha` | Base commit SHA |
| `head_sha` | Head commit SHA |
| `created_at`, `updated_at` | Record timestamps |

Use a unique constraint on (`repository_id`, `pr_number`).

### `analyses`

| Field | Purpose |
|---|---|
| `id` | Public analysis identifier (opaque UUID/string) |
| `pull_request_id` | Foreign key to `pull_requests` |
| `status` | `queued`, `running`, `completed`, `failed` |
| `risk_score` | Nullable integer 0–100 |
| `risk_level` | Nullable label |
| `queue_job_id` | Optional pg-boss job identifier |
| `error_code` | Safe failure code, nullable |
| `error_message` | Safe user-facing failure message, nullable |
| `started_at`, `completed_at` | Lifecycle timestamps |
| `created_at` | Record creation time |

### `analysis_results`

| Field | Purpose |
|---|---|
| `analysis_id` | Primary/foreign key to `analyses` |
| `graph_data` | JSONB containing graph nodes and edges |
| `changed_files` | JSONB list from PR metadata, normalized for the UI |
| `affected_files` | JSONB list with classification, depth, and reasons |
| `risk_breakdown` | JSONB factor values used to calculate the score |
| `warnings` | JSONB list of incomplete-analysis/parser warnings |
| `created_at` | Record creation time |

pg-boss manages its own job tables. Do not recreate its queue schema. The application's `analyses.status` is the status returned to the frontend.

## 5.5 Persistence and data rules

- Store the exact `head_sha` used for an analysis so results are reproducible and explainable.
- Store graph/result data as JSONB for the hackathon MVP; do not store the full source repository in PostgreSQL.
- Keep graph/result object keys consistent with the API examples.
- Do not store GitHub access tokens in these tables or in pg-boss job payloads.
- Clean up temporary clones after processing, including on failure.
- A repeated analysis may create a new analysis record. Caching/deduplication is optional and not required for the MVP.
