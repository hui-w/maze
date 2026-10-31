# AGENTS.md

Guidance for AI coding assistants working in this repository.

## Testing
- `npm test` runs locally and costs no tokens; only its output does.
- Run it when changing logic (`src/maze.js`, `src/path.js`, `src/common.js`). Skip it for CSS or copy-only changes.
- Read only the summary line (e.g. `npm test 2>&1 | grep "ℹ fail"`). Open the full output or `test/maze.test.js` only when something fails.

## Release
- Bump the version with `npm version X.Y.Z --no-git-tag-version`, then `npm run build`.
- Never push unless the user explicitly asks.
