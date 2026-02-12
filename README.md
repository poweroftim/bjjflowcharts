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
- Export full workspace JSON (all charts)
- Export/import JSON
- Random path drill generator
- Bundled workspace file at `data/workspace.json` (ships with deploy)

## Run
Open `/Users/timpowe/Documents/FlowChart/index.html` in any modern browser.

No install or build step is required.

## Bundled Data for Deploy
- On startup, the app loads in this order:
1. Bundled data (`data/workspace.json`)
2. Browser local storage (`Save to Browser` data), if bundled data is not available
3. Built-in template fallback

- To ship your exact charts with the app:
1. In app, click `Export Workspace JSON` (this includes all charts)
2. Replace `/Users/timpowe/Documents/FlowChart/data/workspace.json` with that exported data (workspace format with `charts`)
3. Redeploy including the entire `data/` folder

## Quick Verify
- In the app, check the Transcript Build status box:
  - `Startup source: bundled workspace file.` means bundled data loaded
  - If not, click `Load Bundled Data` in the Data section
