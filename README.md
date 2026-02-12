# BJJ Position Flowchart App

A lightweight browser app for mapping BJJ decision trees by position and objective.

## What changed
- Top dropdown navigation for **Position** and **Flow** (Attacks / Escapes)
- Each Position + Flow pair has its **own unique chart**
- Switching dropdowns moves you between separate charts
- Includes templates for:
  - Mount -> Attacks
  - Mount -> Escapes
- Other combinations start with a simple starter node

## Features
- Drag and connect nodes
- Blue nodes = your actions/start points
- Gray nodes = opponent responses
- Inspector to edit labels, node type, and coaching notes
- References section to store video URLs per chart with thumbnail previews
- Builder/User mode toggle for editing vs clean read-only viewing
- Auto-layout
- Save/load workspace to browser storage
- Export/import JSON
- Random path drill generator
- Bundled workspace file at `data/workspace.json` (ships with deploy)
- Optional JS fallback file at `data/workspace.js` for direct `file://` open

## Run
Open `/Users/timpowe/Documents/FlowChart/index.html` in any modern browser.

No install or build step is required.

## Bundled Data for Deploy
- On startup, the app loads in this order:
1. Bundled data (`data/workspace.js` if present, otherwise `data/workspace.json`)
2. Browser local storage (`Save to Browser` data), if bundled data is not available
3. Built-in template fallback

- To ship your exact charts with the app:
1. Export your workspace/chart JSON from the app
2. Replace `/Users/timpowe/Documents/FlowChart/data/workspace.json` with that exported data (workspace format with `charts`)
3. Regenerate `/Users/timpowe/Documents/FlowChart/data/workspace.js` from the same JSON:
   - `printf 'window.BUNDLED_WORKSPACE = ' > data/workspace.js && cat data/workspace.json >> data/workspace.js && printf ';\\n' >> data/workspace.js`
3. Redeploy
