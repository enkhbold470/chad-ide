# Chad IDE — Tool Workflow

## Tools (2)

| Tool | Purpose |
|------|---------|
| **get-repo-dashboard** | One tool only. Shows issues + leaderboard + slot. When user pulls lever, widget calls same tool with `spin: true`. |
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

2. User pulls the lever
   → Client-side: widget picks outcome (Math.random < winChance), runs spinning animation
   → After animation: widget calls get-repo-dashboard with recordSpin to persist

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
