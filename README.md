# Ripple

Ripple is a pull-request impact analysis platform for engineering teams. It inspects a GitHub pull request, resolves static local code dependencies, identifies files that may be affected by the change, and presents the result in a clear, explainable dashboard.

The tool is designed to improve merge safety and review confidence by making impact and blast radius visible before code is approved or shipped.

## Project purpose

Ripple answers a practical engineering question:

> When a pull request changes a file, which other files could be affected, and why?

It is intended to support maintainers, reviewers, and engineers in understanding the likely cost and risk of a change before merge.

## Documentation

The project documentation is in [docs/](./docs/README.md). It includes:

- product overview,
- requirements,
- architecture,
- dependency analysis,
- API and database contracts,
- and frontend specification.

## Production-grade approach

Ripple is designed to be more than a demo. The project assumes:

- explicit requirements and acceptance criteria,
- clear API and persistence contracts,
- asynchronous analysis jobs,
- explainable scoring and warnings,
- production-safe handling of secrets and partial analysis,
- and maintainable documentation for the full system lifecycle.

## Core Analysis Engine (Part 2)

The core static analysis engine is implemented in [`src/domain/analysis`](./src/domain/analysis):

- **AST Parsing (Tree-sitter)**: parses JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`) and TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`), extracting static imports and exports while ignoring unsupported files.
- **Module Resolution**: resolves relative imports, extension-less paths, TypeScript ESM `.js` -> `.ts` mappings, and directory index files (`index.ts`, `index.js`).
- **Dependency Graph**: builds a directed file-level graph using Graphology where directed edges represent `importer -> imported` relationships.
- **Blast-Radius Traversal**: executes reverse graph traversal (BFS) from changed files to classify direct (`depth = 1`) and indirect (`depth >= 2`) dependents without counting changed files as affected files.
- **Heuristic Risk Scoring**: produces an explainable, multi-factor risk score (0-100) and risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) with detailed factor breakdown and rationale.
- **Structured Dashboard Output (Person 3 Hand-off)**: outputs structured file classifications, risk scores, edge mappings, and user-facing warnings for unresolved imports or unsupported files.

### Usage

```ts
import { analyzeRepository } from './src/index.js';

const result = await analyzeRepository({
  repositoryFiles: [
    { path: 'auth.js', content: 'export function authenticate() {}' },
    { path: 'users.js', content: 'import { authenticate } from "./auth.js";' },
    { path: 'orders.js', content: 'import { authenticate } from "./auth.js";' },
    { path: 'profile.js', content: 'import { getUser } from "./users.js";' },
    { path: 'checkout.js', content: 'import { createOrder } from "./orders.js";' }
  ],
  changedFiles: ['auth.js']
});

console.log(result.riskScore); // 0-100
console.log(result.riskLevel); // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
console.log(result.files);     // files with type, status, riskScore, depth, reasons
console.log(result.dependencies); // [{ source: 'users.js', target: 'auth.js' }, ...]
console.log(result.reasons);   // explainable rationale strings
```

### Development & Validation

```bash
# Typecheck
npm run typecheck

# Run test suite
npm run test

# Build
npm run build
```

## Status

The Core Analysis Engine (Part 2) is complete, tested, and ready for integration with the background worker and Person 3 dashboard.
