# 4. Dependency Analysis

This document defines the core logic of Ripple. Keep the graph direction, import-resolution rules, traversal, and result format consistent across all contributors.

## 4.1 What “dependency” means here

For this project, a dependency is primarily a **relationship between source files/modules**.

Example:

```ts
// user.controller.ts
import { getUser } from "../services/user.service";
```

`user.controller.ts` depends on `user.service.ts`.

This is different from an installed package dependency such as `npm install express`. Package dependency/version analysis is not the main MVP feature.

## 4.2 Input and output

**Inputs**

- Repository checkout at the PR head commit.
- Changed-file metadata from the GitHub PR API (path, status, additions/deletions where available).
- Repository TypeScript configuration where available.

**Outputs**

- Directed file dependency graph.
- Changed files that could be matched to graph nodes.
- Directly affected files.
- Indirectly affected files and their dependency depth.
- Warnings for unresolved imports, unsupported files, or incomplete analysis.
- Explainable overall risk score and factor breakdown.

## 4.3 Supported source files and exclusions

MVP-supported extensions:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`

Exclude generated/vendor/build content such as:

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.git/`
- `.next/`
- Other clearly generated or vendored directories agreed by the team

Do not silently skip a file because parsing fails. Record a warning with the relative file path. Apply a maximum file count and repository size/time limit so one repository cannot exhaust the demo service.

## 4.4 Import extraction and resolution

Use `ts-morph` to parse supported files and extract static imports/re-exports that resolve to local repository files.

MVP should attempt to resolve:

- Relative imports (`../services/user.service`).
- Directory index files where TypeScript module resolution supports them.
- Common JS/TS file extensions.
- `tsconfig.json` path aliases when practical and when the relevant config can be loaded safely as configuration data.

Ignore external package imports such as `express`, `react`, and `multer` for the file-level repository graph.

If a local-looking import cannot be resolved, record it as an unresolved-import warning. Do not invent an edge to a guessed file.

Dynamic imports and runtime-generated module paths may not be resolved by the MVP. Document this limitation in the result warnings when detected or when known.

## 4.5 Graph model and edge direction

- **Node:** one source file, identified by a normalized repository-relative path.
- **Edge:** one file importing another local file.
- **Direction:** `importer -> imported file`.

Example:

```text
user.routes.ts  -> user.controller.ts
user.controller.ts -> user.service.ts
user.service.ts -> user.model.ts
```

A graph node should have at least:

```ts
interface DependencyNode {
  id: string;                 // normalized relative file path
  filePath: string;
  language: "typescript" | "javascript";
}
```

An edge should have at least:

```ts
interface DependencyEdge {
  source: string;             // importing file
  target: string;             // imported file
  importPath: string;         // original module specifier
}
```

If the same file imports the same target more than once, the MVP may consolidate it to one edge. Do not create separate graph nodes for npm packages.

## 4.6 Blast-radius traversal

Because edges point from importer to dependency, affected dependents are found by traversing **incoming edges** from each changed node.

Example:

```text
user.routes.ts
      |
      v
user.controller.ts
      |
      v
user.service.ts
      |
      v
user.model.ts  <-- changed
```

If `user.model.ts` changes, the potentially affected files are:

- Direct dependent: `user.service.ts`
- Indirect dependent: `user.controller.ts`
- Indirect dependent: `user.routes.ts`

Implement a breadth-first or depth-first traversal over incoming edges. Maintain a visited set so circular dependencies cannot cause infinite loops. Record the minimum traversal distance from any changed node as the impact depth.

Classification:

- `changed`: file reported as changed by the PR.
- `direct_affected`: one reverse-dependency hop from a changed file.
- `indirect_affected`: two or more reverse-dependency hops away.
- `unaffected`: in the graph but not reached by reverse traversal.

If a changed file is not present in the head graph (for example, a deleted file), retain it in the changed-file list and attach a warning. Do not silently drop it or pretend its impact was fully analysed.

## 4.7 MVP risk-scoring heuristic

The score estimates potential change impact. It does **not** predict bugs, prove breakage, or replace human code review.

Use this transparent starting formula, then tune it only if the team agrees:

```text
blastRadiusPoints = min(40, (5 * directAffectedCount) + (2 * indirectAffectedCount))
depthPoints       = min(20, 5 * maxImpactDepth)
changeSizePoints  = min(20, 5 * ceil(totalAdditionsAndDeletions / 50))
criticalityPoints = 0, 10, or 20

riskScore = min(100,
  blastRadiusPoints + depthPoints + changeSizePoints + criticalityPoints
)
```

Criticality is a simple path-based heuristic for the MVP, not semantic understanding:

- `0`: no configured sensitive-path match.
- `10`: a changed path matches a medium-criticality pattern configured by the team (for example, configuration, routing, or database schema/migrations).
- `20`: a changed path matches a high-criticality pattern (for example, authentication, authorization, permissions, payment, or security modules).

Use the highest matching criticality among the changed files. Keep the path patterns in one central configuration so they are not duplicated across modules.

Risk labels:

| Score | Label |
|---:|---|
| 0–24 | Low |
| 25–49 | Medium |
| 50–74 | High |
| 75–100 | Critical |

Return the individual factor values so the UI can explain the score. If parsing failed broadly, the changed files could not be matched, or the graph is clearly incomplete, return an incomplete-analysis warning and avoid presenting the score as trustworthy. A score should never be shown without its limitations and factor breakdown.

## 4.8 Head snapshot and PR file statuses

For the MVP, build the graph from the exact PR **head commit** and use the GitHub PR files endpoint for the changed-file list.

- Added/modified files can usually be matched to nodes in the head graph.
- Renamed files may include both `filename` and `previous_filename`; show the rename in the changed-file metadata and analyse the new path in the head snapshot when possible.
- Deleted files do not exist in the head snapshot. Show them as deleted/changed, but mark their dependency impact as incomplete.
- Changes to import statements are reflected in the head graph. A full before/after comparison would be a future improvement.

Do not describe this as complete base-versus-head semantic analysis.

## 4.9 Minimum correctness tests

Create a tiny fixture repository with a known graph and test:

1. Relative import creates an edge in the correct direction.
2. A changed dependency identifies its direct importer.
3. Reverse traversal identifies transitive importers.
4. An unrelated file remains unaffected.
5. A circular dependency terminates and does not duplicate results.
6. External package imports do not become repository nodes.
7. An unresolved local import creates a warning.
8. A deleted changed file is retained in output with an incomplete-analysis warning.
9. Risk score is deterministic for the same inputs and stays between 0 and 100.
