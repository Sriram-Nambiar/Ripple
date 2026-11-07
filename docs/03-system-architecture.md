# 3. System Architecture

## Architecture principle

Keep the **analysis engine independent of Express and React**. The web application is one way to start an analysis and display its result. A future GitHub Action or GitHub App should be able to call the same analysis engine without duplicating parsing, graph, blast-radius, or scoring logic.

## High-level flow

```text
                         USER
                           |
                           v
                    REACT FRONTEND
                           |
                    POST PR URL
                           |
                           v
                     EXPRESS API
                           |
             validate URL / create analysis
                           |
                           v
                    POSTGRESQL + pg-boss
                           |
                    enqueue analysis job
                           |
                           v
                    BACKGROUND WORKER
                           |
               +-----------+-----------+
               |                       |
               v                       v
          GITHUB REST API           GIT CLI
       PR metadata + changed      checkout exact
          file information          head SHA
               |                       |
               +-----------+-----------+
                           |
                           v
                    ANALYSIS ENGINE
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
          ts-morph     Graphology     Risk logic
        parse/import    graph and      and impact
         resolution     traversal       summary
             |             |             |
             +-------------+-------------+
                           |
                           v
                   STRUCTURED RESULT
                           |
                           v
                     POSTGRESQL
                           |
                           v
                     EXPRESS API
                           |
                           v
                    REACT DASHBOARD
                    graph + heatmap
```

## Component responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| React frontend | Collect PR URL, poll analysis status, display summary and graph | Call GitHub with a secret token; clone repositories; calculate its own authoritative risk score |
| Express API | Validate requests, create/read analyses, return consistent responses | Perform long-running repository analysis inside the request handler |
| GitHub client | Retrieve PR metadata and changed-file metadata | Send credentials to the browser |
| Repository fetcher | Retrieve/checkout source at the exact head SHA into a temporary directory | Execute repository scripts or trust repository-provided commands |
| Analysis engine | Parse files, resolve imports, build graph, find affected files, score impact | Depend on Express request/response objects or React types |
| pg-boss worker | Run queued analyses and update lifecycle status | Become a second source of truth for application-level status |
| PostgreSQL | Persist repository/PR/analysis metadata and result JSON | Store secrets or entire repository contents unnecessarily |

## Suggested backend module boundaries

The exact existing folder structure takes precedence. If the backend has not been created yet, use a simple structure such as:

```text
backend/src/
  app.ts
  server.ts
  routes/
  controllers/
  services/
  jobs/
  integrations/
    github/
    git/
  analysis/
    parser/
    graph/
    blast-radius/
    scoring/
  db/
  middlewares/
  types/
```

Keep `analysis/` callable as ordinary TypeScript functions/services. It should receive explicit inputs such as a repository directory, changed-file metadata, and analysis options, and return a typed analysis result.

## Asynchronous job lifecycle

1. `POST /api/v1/analyses` validates the PR URL.
2. API creates an application `analyses` record with status `queued`.
3. API enqueues a pg-boss job containing the analysis ID and validated PR coordinates. Do not put GitHub tokens in job payloads.
4. Worker changes status to `running`, retrieves PR/source data, and runs analysis.
5. Worker stores result JSON and changes status to `completed`.
6. If an expected failure occurs, worker stores a safe error code/message and changes status to `failed`.
7. Frontend polls `GET /api/v1/analyses/:id` until a terminal status is reached.

The application's `analyses` table is the source of truth for the UI. pg-boss maintains its own internal job tables; the application record should store the pg-boss job ID only if useful for operations.

## Integration boundaries

- GitHub integration returns normalized PR metadata and changed-file records.
- Repository retrieval returns a local checkout path plus commit metadata.
- Analysis engine returns a graph, changed/affected file classifications, warnings, and risk breakdown.
- Persistence stores the result without requiring the analysis engine to know about HTTP.
- API returns a frontend-neutral graph schema. The React page converts it to React Flow nodes/edges.

## GitHub Action / GitHub App future path

A future webhook/Action integration should call the same analysis service and then post a PR comment with a score, summary, and dashboard URL. It is not part of the MVP and should not block the web workflow.
