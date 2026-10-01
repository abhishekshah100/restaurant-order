# The Olive Table — QR ordering web app

Next.js (App Router) + React + TypeScript, exported as a fully static site (`/out`).
Design source of truth: `../the-olive-table-ui`.

> Full documentation (folder structure, data editing, deployment) arrives in Phase 5.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000 — see /styleguide
```

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server                                          |
| `npm run build`     | Static export to `out/`                             |
| `npm start`         | Serves `out/` on http://localhost:3000              |
| `npm run lint`      | ESLint (zero warnings allowed)                      |
| `npm run format`    | Prettier write                                      |
| `npm run typecheck` | TypeScript 7 (`tsc --noEmit`)                       |
| `npm test`          | Vitest unit tests                                   |
| `npm run test:e2e`  | Playwright smoke tests against `out/` (build first) |
