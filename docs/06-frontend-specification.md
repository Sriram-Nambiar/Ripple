# 6. Frontend Specification

## Goal

The frontend should make the answer to this question clear within a few seconds:

> Which files changed, which other files may be affected, and why?

Keep the interface focused on the PR analysis. Avoid adding unrelated repository-management features to the hackathon MVP.

## Main user flow

```text
Landing / PR input
        |
        v
Submit GitHub PR URL
        |
        v
Analysis progress state
        |
        v
Analysis dashboard
   +----+--------------------+
   |                         |
   v                         v
Risk / PR summary       Dependency heatmap
                             |
                             v
                       Select a file
                             |
                             v
                       File details
                    + impact explanation
```

## Pages and major components

| Component | Responsibility |
|---|---|
| `PRInput` | Accept and submit a GitHub PR URL; show validation errors |
| `AnalysisProgress` | Show queued/running state and a simple progress message |
| `PRSummary` | Show repository, PR number/title, and commit information |
| `RiskSummary` | Show score, risk level, and factor breakdown |
| `DependencyGraph` | Render the graph and highlight file classifications |
| `GraphLegend` | Explain changed/affected/unaffected visual states |
| `FileDetailsPanel` | Show selected path, status, impact depth, and reasons |
| `AffectedFilesList` | List changed and potentially affected files |
| `WarningsPanel` | Show parsing gaps, unresolved imports, and incomplete analysis |

## Dashboard information hierarchy

1. **PR header:** repository, PR number, title, and link to GitHub.
2. **Risk summary:** risk score/label and the factors contributing to it.
3. **Impact counts:** changed files, direct dependents, and indirect dependents.
4. **Dependency graph:** primary visualisation.
5. **File details:** explanation for the selected graph node.
6. **Warnings:** what the analysis could not resolve or fully inspect.

## Graph behavior

React Flow is the default MVP choice. Keep the backend graph schema independent of React Flow so the rendering library can be changed without changing the analysis engine or API.

Expected behavior:

- Each node represents one source file.
- Each directed edge goes from the importing file to the imported file.
- Changed files are visually distinct from affected files.
- Directly affected and indirectly affected files use different visual states.
- Unaffected nodes are muted but remain available for context.
- Selecting a node opens its details in a side panel or equivalent area.
- The details panel explains the relationship that caused the file to be classified as affected.
- Provide basic zoom, pan, fit-to-view, and graph controls supported by the chosen library.

Suggested legend:

| Status | Suggested visual treatment |
|---|---|
| Changed | Red |
| Directly affected | Orange |
| Indirectly affected | Yellow |
| Unaffected | Neutral grey |

Use accessible text labels/icons in addition to color; color must not be the only way to distinguish status.

## Loading, empty, and error states

- **Initial:** explain that the user can paste a GitHub PR URL.
- **Submitting:** disable duplicate submission and show that the request is being validated.
- **Queued/running:** show analysis status and a message that repository inspection may take time. Poll the status endpoint at a modest interval; stop polling on `completed` or `failed` and clean up polling when the component unmounts.
- **Completed:** display the dashboard.
- **Failed:** show a safe error message and allow the user to submit another PR.
- **No graph nodes:** explain that no supported/resolvable source files were found; do not render a misleading empty heatmap.
- **Partial analysis:** show warnings clearly and label the result as incomplete.
- **Large graph:** show a helpful loading/limit message or a filtered view rather than freezing the page.

## Frontend/backend contract

Use `docs/05-api-and-database.md` as the source of truth for API paths and data shapes.

- The frontend submits only the PR URL.
- The frontend receives an analysis ID and polls the status endpoint.
- Once complete, it requests graph and affected-file data.
- The frontend may transform API graph nodes/edges into React Flow objects, but must not change the meaning or direction of edges.
- The frontend displays the backend's risk score and factor breakdown; it must not independently recalculate the authoritative score.

## MVP design constraints

- Prioritize desktop layout because the graph is the main demo surface; ensure the PR input and summary remain usable on smaller screens.
- Use Tailwind CSS and shadcn/ui consistently.
- Reuse components for badges, cards, lists, and panels.
- Make the risk explanation and affected-file reasons easy to find. A visually impressive graph without an explanation is not sufficient.
