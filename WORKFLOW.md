# Chad IDE — Tool Workflow

## Tools (3)

| Tool | Purpose |
|------|---------|
| **get-repo-dashboard** | Main entry point. Shows issues + leaderboard + slot machine in one scrollable view. Requires repo + githubUsername. |
| **slot-machine-spin** | Action: spin the slots. Win chance from issues closed; spins = 1 per issue closed. |
| **search-tools** | Fruit search demo (unrelated to GitHub flow). |

---

## User Workflow

```
1. User: "Show me the dashboard for enkhbold470/chad-ide, I'm bigbrainw"
   → AI calls get-repo-dashboard(repo, githubUsername)
   → Dashboard loads: 3 horizontal panels
     • Panel 1: Open issues
     • Panel 2: Leaderboard (who closed the most)
     • Panel 3: Slot machine — spins left, win chance, PULL LEVER

2. User pulls the lever (or asks to spin)
   → Widget calls slot-machine-spin(repo, githubUsername) via useCallTool
   → Spin runs: reels, win/lose, session win rate updated
   → Same dashboard returns with new spin result

3. Repeat until spins run out
   → "Close more issues to spin again"
```

---

## What Each Panel Does

- **Issues**: Fetch from GitHub API, show as to-do list. Closed issues get strikethrough.
- **Leaderboard**: Who closed the most issues (from GitHub issue events). Cached 24h.
- **Slot**: Spins = issues you closed. Win chance = 5% base + bonus per issue. Lever triggers spin.

---

## Why One Dashboard?

All 3 panels share the same data (repo + githubUsername). One tool call fetches issues + leaderboard in parallel, then the widget shows everything. No need for separate tools for "just issues" or "just leaderboard"—the dashboard already does both.
