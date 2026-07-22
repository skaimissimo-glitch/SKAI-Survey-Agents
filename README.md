# Survey Agent Dashboard

Local dashboard to rank paid survey and task opportunities across multiple sites.

## What this does

- Tracks opportunities by site
- Scores opportunities using reward, time, approval odds, payout speed, and friction
- Lets you tune scoring weights in the Agent Controls panel
- Supports `Time / Money First` or `Balanced Score` rank modes
- Builds a next-best queue with one top opportunity per site
- Shows a Website Name Leaderboard with the best survey per site
- Includes an Auto Scout button that scans public pages for payout/time opportunities
- Shows the top opportunity per site
- Stores data in browser local storage
- Includes a manual WireGuard preflight confirmation checkbox

## What this does not do

- It does not automate survey form filling or account actions
- It does not modify your network settings or control WireGuard

## Run locally

1. Open the repository folder in VS Code.
2. Run a simple static server from this folder.

PowerShell example:

```powershell
python -m http.server 8080
```

3. Open `http://localhost:8080` in your browser.

## Scoring model

The ranking score combines these factors:

- Hourly rate from reward and minutes
- Approval odds
- Payout speed
- Friction penalty

Current weighted formula in `app.js`:

`score = hourlyRate * 0.55 + (approval/100) * 30 + (payout/5) * 10 - (friction/5) * 8`

You can change these weights from the dashboard without editing code.

## Auto Scout notes

- Auto Scout scans publicly accessible page content only.
- Login-protected dashboards usually cannot be scanned from a local static app.
- Extracted opportunities are heuristic and should be reviewed before acting.
- If no public listing is available, the app inserts a baseline estimate row so ranking can still proceed.
