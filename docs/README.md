# Ripple Documentation

This folder contains the product and engineering decisions needed to build the hackathon MVP. It is intentionally small. Treat these documents as the team's shared working agreement, not as paperwork that must be expanded for its own sake.

## Document index

| File | Read when working on... |
|---|---|
| [01-project-overview.md](./01-project-overview.md) | Any task; understanding the product and its boundaries |
| [02-requirements.md](./02-requirements.md) | MVP scope, feature acceptance criteria, task planning |
| [03-system-architecture.md](./03-system-architecture.md) | Backend/frontend boundaries, worker flow, integrations |
| [04-dependency-analysis.md](./04-dependency-analysis.md) | Parsing, module resolution, graph construction, blast radius, scoring |
| [05-api-and-database.md](./05-api-and-database.md) | API implementation, frontend/backend integration, persistence |
| [06-frontend-specification.md](./06-frontend-specification.md) | React pages, dashboard, graph visualization, UI states |

The root-level [`AGENTS.md`](../AGENTS.md) contains concise instructions for coding agents.

## Suggested context by task

- **GitHub PR retrieval / repository cloning:** `AGENTS.md`, `01`, `02`, `03`, `05`
- **ts-morph parsing / Graphology / blast-radius logic:** `AGENTS.md`, `01`, `03`, `04`, `05`
- **Risk scoring:** `AGENTS.md`, `02`, `04`, `05`
- **Express endpoints / PostgreSQL / pg-boss:** `AGENTS.md`, `03`, `05`
- **React dashboard / graph UI:** `AGENTS.md`, `01`, `02`, `05`, `06`
- **End-to-end integration:** `AGENTS.md`, `02`, `03`, `04`, `05`, `06`

Agents should also inspect the relevant source code and tests. Documentation describes the intended contract; the repository shows the current implementation.

## Current MVP assumptions

These are deliberate defaults so the team can start implementation. Change them only after agreeing as a team, then update the affected document(s).

1. The demo accepts a GitHub Pull Request URL through a web app.
2. The first version supports public GitHub repositories and TypeScript/JavaScript source files.
3. GitHub API access and repository cloning happen on the backend. Credentials never reach the browser.
4. The worker analyses the PR head commit. The MVP uses changed-file metadata from GitHub and the head snapshot for the dependency graph. Deleted/renamed-file analysis has limitations described in `04-dependency-analysis.md`.
5. `ts-morph` extracts statically resolvable local imports; Graphology stores a directed file-level graph.
6. An edge `A -> B` means **file A imports file B**. To find files potentially affected by a change to B, traverse incoming edges from B.
7. The risk score is an explainable demo heuristic, not a calibrated prediction of bugs.
8. `pg-boss` runs analysis asynchronously using PostgreSQL. The application's `analyses` record is the source of truth for user-visible status.
9. React Flow is the default graph UI for the MVP. Keep the API graph data independent of React Flow-specific node/edge objects.

## Updating these docs

Update a document when a shared product requirement, algorithm, API contract, data shape, or architectural boundary changes. Do not update documentation for every small implementation detail. Keep examples consistent across documents.
