# 2. Requirements and MVP Scope

## Product workflow

1. User opens the web application.
2. User pastes a GitHub PR URL and submits it.
3. Backend validates the URL and creates an analysis record/job.
4. Background worker retrieves PR metadata and the repository snapshot.
5. Analysis engine extracts dependencies, builds the graph, finds affected files, and calculates risk.
6. Backend stores the result.
7. Frontend retrieves the result and displays the heatmap.

## Functional requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | Submit a PR URL | A valid GitHub PR URL is accepted; malformed or unsupported URLs return a clear validation error. |
| FR-02 | Retrieve PR details | The system records repository owner/name, PR number/title, base SHA, head SHA, and changed-file metadata when available. |
| FR-03 | Retrieve source | The worker analyses the exact PR head commit, not a moving branch name. |
| FR-04 | Parse source files | Supported TS/JS files are parsed and local static imports are extracted. Parse failures are captured as warnings rather than silently ignored. |
| FR-05 | Build dependency graph | Each included source file is represented by a node; a directed edge represents an importer-to-imported-file relationship. |
| FR-06 | Find affected files | For every changed file found in the graph, the system finds direct and transitive reverse dependents without looping on cycles. |
| FR-07 | Calculate risk | The system returns a 0–100 heuristic score, risk category, and factor breakdown. If analysis data is insufficient, it reports that limitation rather than presenting a misleading score. |
| FR-08 | Persist result | The analysis status and result survive an API request ending or page refresh. |
| FR-09 | Display dashboard | The UI shows PR details, changed files, affected files, risk summary, warnings, and graph. |
| FR-10 | Explain graph selection | Selecting a node displays its path, status, and why it is included in the impact result. |

## Non-functional requirements for the demo

- Analysis must run asynchronously so an HTTP request does not remain open while a repository is processed.
- The frontend must show queued/running/completed/failed states.
- Errors must be understandable and must not expose tokens, stack traces, or secrets.
- Repository processing must have time, size, and file-count limits appropriate to the demo host.
- The backend must not execute scripts or binaries from a cloned repository.
- The UI must distinguish changed files from potentially affected files.

## Explicitly out of scope for the 3-day MVP

- GitHub Action or GitHub App installation and automatic PR comments.
- Private repositories unless the team has time to implement server-side OAuth/App authentication safely.
- Python, Java, or other language parsers.
- Runtime call-graph analysis or proof of behavioral impact.
- Automatic code fixes, PR approvals, or merge blocking.
- Historical trend analytics, team accounts, billing, and enterprise multi-tenancy.
- Advanced repository-wide caching and incremental graph recomputation.

## MVP implementation priorities

### Must work for the demo

1. Public PR URL validation and metadata retrieval.
2. Source retrieval at the PR head SHA.
3. Static TS/JS import extraction and local module resolution.
4. Correct edge direction and reverse-dependent traversal.
5. Explainable baseline risk score.
6. Persisted analysis status/result.
7. Dashboard graph and affected-file details.

### Can be simplified if time is short

- Advanced graph layout and filtering.
- Large-repository performance optimisations.
- Sophisticated scoring weights.
- Full support for path aliases and unusual monorepo configurations.
- Detailed historical analysis.

## Suggested three-person ownership

Ownership is a starting point, not a wall. Agree on shared interfaces before parallel implementation.

| Workstream | Main responsibility | Must agree with |
|---|---|---|
| GitHub + backend integration | PR validation, GitHub API, repository retrieval, Express endpoints, job orchestration, persistence | Analysis and API contracts |
| Analysis engine | ts-morph parsing, import resolution, Graphology graph, blast-radius traversal, risk breakdown | Graph schema and result contract |
| Frontend | PR form, analysis progress, dashboard, graph visualization, file details | API response and graph schema |

## Integration checkpoints

- **Checkpoint 1:** Agree on API request/response types and graph node/edge format before separate frontend/backend work.
- **Checkpoint 2:** Analysis engine can process a small local fixture repository and return a deterministic result.
- **Checkpoint 3:** Backend can enqueue a job and expose its status/result.
- **Checkpoint 4:** Frontend can display a mocked result before live GitHub integration is complete.
- **Checkpoint 5:** Run one complete public-PR workflow on the deployed demo.
