# AGENTS.md

Guidance for AI coding assistants working in this repository.

## Testing
- `npm test` runs locally and costs no tokens; only its output does.
- Run it when changing logic (`src/maze/`, `src/common.js`, `src/snake-plugin/`). Skip it for CSS or copy-only changes.
- Read only the summary line (e.g. `npm test 2>&1 | grep "ℹ fail"`). Open the full output or `test/maze.test.js` only when something fails.

## Release
- Bump the version with `npm version X.Y.Z --no-git-tag-version`, then `npm run build`.
- The default build is Maze-only. If the release should include Snake, run `npm run build:snake` afterward. Confirm the desired variant if unclear.
- Verify the build and commit the Maze release files. Never push unless the user explicitly asks.

## Deploy to QLike
- QLike is a separate repository at `../qlike` (`hui-w/qlike`, branch `main`). Fetch and check its status first; preserve unrelated changes and resolve any divergence before deploying.
- Deploy the same verified Maze `release/` files to both the QLike root (`https://qlike.com/`) and `maze/` (`https://qlike.com/maze/`):
  ```sh
  cp release/index.html release/app.min.js release/app.min.css ../qlike/
  cp release/static/favicon.ico release/static/logo.png ../qlike/static/
  cp release/index.html release/app.min.js release/app.min.css ../qlike/maze/
  cp release/static/favicon.ico release/static/logo.png ../qlike/maze/static/
  ```
- Check that both destinations match the release, then commit only the deployment files in QLike. Push `main` only when the user explicitly requests publication.
- After pushing, verify that both live pages reference the new asset version; allow time for deployment to propagate. If Snake is included, verify it is available at both locations.
