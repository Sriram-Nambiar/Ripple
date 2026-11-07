# AI Agent Instructions

## Project

Ripple analyses a GitHub Pull Request, builds a static dependency graph of repository source files, estimates the potential blast radius of changed files, and displays the result in a web dashboard.

Read `docs/01-project-overview.md` for the product summary. Use `docs/README.md` to find task-specific documentation.

## Working rules

1. Inspect the existing code before creating or changing files. Follow established patterns unless they conflict with an explicit project decision in `docs/`.
2. Load only the documentation relevant to the task. Do not read the entire `docs/` folder for every small change.
3. Keep the analysis engine independent of Express and the React application. It should accept repository/PR analysis inputs and return a structured result.
4. Follow `docs/04-dependency-analysis.md` for import resolution, graph direction, reverse traversal, limitations, and the MVP risk heuristic.
5. Follow `docs/05-api-and-database.md` for endpoint paths, statuses, request/response shapes, and persistence contracts. Do not silently change a shared contract.
6. Follow `docs/06-frontend-specification.md` for the dashboard flow and graph interactions.
7. Use TypeScript. Avoid `any` where practical, validate external input, handle errors explicitly, and avoid unnecessary dependencies or abstractions.
8. Never execute code, package scripts, build steps, or other commands from a cloned/untrusted repository. Inspect source files as data only.
9. Never expose GitHub tokens, database credentials, or other secrets to the browser or commit them to the repository.
10. Do not claim that static dependency analysis proves a change will break something. The product reports potential impact, not confirmed runtime failures or bugs.

## Before finishing a task

- Check that the implementation matches the relevant acceptance criteria.
- Run the narrowest relevant tests and type checks available.
- Report tests that were not run and why.
- Update the relevant documentation when a lasting contract, algorithm, schema, or architectural decision changes.
- Avoid unrelated refactors.
