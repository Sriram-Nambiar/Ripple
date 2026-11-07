# 1. Project Overview

## What is Ripple?

Ripple is a web application that analyses a GitHub Pull Request, examines relationships between source files, estimates which files may be affected by the changes, and visualises the result as an interactive dependency heatmap.

The central product question is:

> When these files change in a pull request, which other files may be affected, and why?

In this project, **dependency** primarily means a source-code file importing or relying on another source-code file. It does not primarily mean installed npm packages such as Express, Multer, or React.

## Problem

A change to one source file can affect other parts of a repository. Reviewers may not know all the files that depend on the changed code, especially in an unfamiliar or large codebase. A normal changed-files list does not make those relationships easy to see.

## Proposed solution

A user pastes a GitHub PR URL. The backend retrieves PR information, inspects the repository at the PR head commit, extracts local TypeScript/JavaScript imports, builds a dependency graph, finds reverse dependents of changed files, calculates an indicative risk score, and returns data for the dashboard heatmap.

## Target users

- Developers reviewing pull requests.
- Tech leads assessing the scope of a change.
- Developers onboarding to an unfamiliar repository.

## MVP features

1. Submit a GitHub PR URL.
2. Retrieve PR metadata and changed-file information.
3. Clone or otherwise retrieve the repository at the PR head commit.
4. Parse supported source files with `ts-morph`.
5. Build a directed dependency graph with Graphology.
6. Find direct and transitive dependents of changed files.
7. Calculate and explain an indicative risk score.
8. Display changed and potentially affected files in an interactive graph/heatmap.

## Technology stack

| Layer | Technology | MVP responsibility |
|---|---|---|
| Frontend | React + TypeScript | PR submission and analysis dashboard |
| Styling | Tailwind CSS + shadcn/ui | UI components and layout |
| Graph UI | React Flow (default choice) | Interactive graph and file selection |
| Backend | Node.js + Express + TypeScript | HTTP API and orchestration |
| GitHub | GitHub REST API | PR metadata and changed-file list |
| Repository access | Git CLI | Retrieve source at the selected commit |
| Static analysis | ts-morph | Parse TS/JS and resolve local imports |
| Graph processing | Graphology | Store and traverse file dependency graph |
| Database | PostgreSQL + JSONB | Store analyses and graph/result data |
| Background jobs | pg-boss | Run analysis outside the request/response cycle |
| Deployment | Render | Host frontend, backend/worker, and PostgreSQL as configured |

## MVP boundaries and known limitations

- Initial language support is TypeScript and JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`).
- The MVP analyses static, resolvable imports. It does not execute code or trace runtime behavior.
- Dynamic imports, reflection, dependency injection, and runtime-loaded modules may not be fully captured.
- npm package dependency/version analysis is not the primary feature.
- The initial demo targets public GitHub repositories. Private repository support requires carefully configured server-side credentials and permissions.
- The initial graph is based on the PR head snapshot. Deleted files and some rename cases cannot be analysed as fully as a base-versus-head comparison.
- Risk is an explainable heuristic. It is not proof that a change will cause a bug.
- GitHub Action/GitHub App automation and automatic PR comments are future integration paths, not required for the web demo.

## Demo success criteria

A judge should be able to paste a supported public GitHub PR URL, start an analysis, see progress, and view:

- PR title and repository details.
- Changed files.
- Directly and indirectly affected files.
- A visible explanation of why a file is marked as affected.
- Overall risk level and score breakdown.
- An interactive dependency graph with a clear legend.
