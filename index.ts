import { MCPServer, error, text, widget } from "mcp-use/server";
import { z } from "zod";

const baseUrl = process.env.MCP_URL || "http://localhost:3000";
const server = new MCPServer({
  name: "gitlot",
  title: "Gitlot",
  version: "1.0.0",
  description: "Gitlot — repo dashboard + slot machine. Close issues, get spins.",
  baseUrl, // Full base URL (e.g., https://myserver.com)
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com", // Can be customized later
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

/** Slot symbols — odds improve with issues closed. */
const SLOT_SYMBOLS = ["apple", "banana", "cherry", "grape", "lemon", "orange"];
const BASE_WIN_CHANCE = 0.05; // 5% base chance for 3-of-a-kind
const MAX_CONTRIBUTION_BONUS = 0.25; // up to 25% bonus → 30% max win chance
const CONTRIBUTION_PER_ISSUE = 100; // each closed issue = 100 contribution points
const CONTRIBUTION_SCALE = 5000; // 50 issues closed ≈ max bonus

/** Per-session spin cache: repo:username → last spin + win rate. Persists across tool calls in chat session. */
const spinSessionCache = new Map<
  string,
  { reels: string[]; won: boolean; winChancePercent: string; wins: number; spins: number }
>();

function getSpinSessionKey(repo: string, username: string) {
  const n = repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  return `${n}:${username}`;
}

/** Leaderboard cache: 24h TTL. Stores full closeCounts per repo. */
const leaderboardCache = new Map<
  string,
  { data: Map<string, { count: number; avatarUrl?: string }>; expires: number }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchLeaderboardData(repo: string, pages = 3): Promise<{
  repo: string;
  closeCounts: Map<string, { count: number; avatarUrl?: string }>;
}> {
  const normalized = repo
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\/$/, "");
  const [owner, name] = normalized.split("/");
  if (!owner || !name) {
    throw new Error("Invalid repo format. Use owner/repo (e.g. facebook/react)");
  }

  const cacheKey = `${normalized}:${pages}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { repo: normalized, closeCounts: cached.data };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "mcp-widget-server",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const closeCounts = new Map<string, { count: number; avatarUrl?: string }>();

  for (let page = 1; page <= pages; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${name}/issues/events?per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Repository not found: ${repo}`);
      if (res.status === 403)
        throw new Error(
          "GitHub API rate limit exceeded. Use GITHUB_TOKEN for higher limits."
        );
      throw new Error(`GitHub API error: ${res.status}`);
    }
    const events = (await res.json()) as Array<{
      event?: string;
      actor?: { login: string; avatar_url?: string };
    }>;
    for (const ev of events) {
      if (ev.event === "closed" && ev.actor?.login) {
        const login = ev.actor.login;
        const current = closeCounts.get(login) ?? {
          count: 0,
          avatarUrl: ev.actor.avatar_url,
        };
        closeCounts.set(login, {
          count: current.count + 1,
          avatarUrl: current.avatarUrl ?? ev.actor.avatar_url,
        });
      }
    }
    if (events.length < 100) break;
  }

  leaderboardCache.set(cacheKey, {
    data: new Map(closeCounts),
    expires: Date.now() + CACHE_TTL_MS,
  });
  return { repo: normalized, closeCounts };
}

/**
 * Combined dashboard: issues + leaderboard + slot machine. One tool only.
 * Spinning is client-side: user pulls lever, widget runs animation and picks outcome,
 * then calls with recordSpin to persist. Server never executes a spin.
 */
server.tool(
  {
    name: "get-repo-dashboard",
    description:
      "Get a combined dashboard for a GitHub repo: issues, leaderboard, and slot machine info. Scroll horizontally between panels. Dots show which panel you're viewing.",
    schema: z.object({
      repo: z
        .string()
        .describe("Repository in owner/repo format (e.g. enkhbold470/chad-ide)"),
      githubUsername: z
        .string()
        .describe("GitHub username (required). Needed for slot machine, win chance, and spins."),
      state: z.enum(["open", "closed", "all"]).optional().describe("Issue filter. Default: all (show both open and closed from repo)."),
      limit: z.number().min(1).max(100).optional().describe("Max issues. Default: 30"),
      recordSpin: z.object({
        reels: z.array(z.string()).length(3),
        won: z.boolean(),
      }).optional().describe("Client sends spin outcome after user pulls lever. Server records it and returns updated dashboard."),
    }),
    annotations: { openWorldHint: true },
    widget: {
      name: "repo-dashboard",
      invoking: "Loading dashboard...",
      invoked: "Dashboard loaded",
    },
  },
  async ({ repo, githubUsername, state = "all", limit = 30, recordSpin }) => {
    const normalized = repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    const [owner, name] = normalized.split("/");
    if (!owner || !name) {
      return error("Invalid repo format. Use owner/repo (e.g. facebook/react)");
    }

    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "mcp-widget-server",
      };
      const token = process.env.GITHUB_TOKEN;
      if (token) headers.Authorization = `Bearer ${token}`;

      const [issuesRes, { closeCounts }] = await Promise.all([
        fetch(
          `https://api.github.com/repos/${owner}/${name}/issues?state=${state}&per_page=${Math.min(limit, 100)}&page=1`,
          { headers }
        ),
        fetchLeaderboardData(repo),
      ]);

      if (!issuesRes.ok) {
        if (issuesRes.status === 404) return error(`Repository not found: ${repo}`);
        if (issuesRes.status === 403)
          return error("GitHub API rate limit exceeded. Use GITHUB_TOKEN for higher limits.");
        return error(`GitHub API error: ${issuesRes.status} ${issuesRes.statusText}`);
      }

      const issuesData = (await issuesRes.json()) as Array<{
        pull_request?: unknown;
        number: number;
        title: string;
        state: string;
        html_url: string;
        user?: { login: string };
        created_at: string;
      }>;
      const issues = issuesData
        .filter((item) => !item.pull_request)
        .slice(0, limit)
        .map((item) => ({
          number: item.number,
          title: item.title,
          state: item.state,
          url: item.html_url,
          author: item.user?.login ?? "unknown",
          createdAt: item.created_at,
        }));

      const leaderboard = Array.from(closeCounts.entries())
        .map(([login, { count, avatarUrl }]) => ({
          rank: 0,
          login,
          avatarUrl: avatarUrl ?? undefined,
          closedCount: count,
        }))
        .sort((a, b) => b.closedCount - a.closedCount)
        .slice(0, 10)
        .map((row, i) => ({ ...row, rank: i + 1 }));

      let winChancePercent: string | undefined;
      let winChanceDecimal: number | undefined;
      const issuesClosed = githubUsername ? closeCounts.get(githubUsername)?.count ?? 0 : 0;
      if (githubUsername) {
        const contribution = issuesClosed * CONTRIBUTION_PER_ISSUE;
        const bonus = Math.min(contribution / CONTRIBUTION_SCALE, MAX_CONTRIBUTION_BONUS);
        winChanceDecimal = BASE_WIN_CHANCE + bonus;
        winChancePercent = `${(winChanceDecimal * 100).toFixed(1)}%`;
      }

      const sessionKey = githubUsername ? getSpinSessionKey(normalized, githubUsername) : null;
      let cachedSpin = sessionKey ? spinSessionCache.get(sessionKey) : null;
      const maxSpins = issuesClosed;

      // Record client-side spin outcome (no server-side spin execution)
      if (recordSpin && githubUsername && sessionKey) {
        const spinsUsed = cachedSpin?.spins ?? 0;
        if (spinsUsed < maxSpins) {
          const existing = spinSessionCache.get(sessionKey);
          const wins = (existing?.wins ?? 0) + (recordSpin.won ? 1 : 0);
          const spins = (existing?.spins ?? 0) + 1;
          cachedSpin = {
            reels: recordSpin.reels,
            won: recordSpin.won,
            winChancePercent: winChancePercent ?? "5%",
            wins,
            spins,
          };
          spinSessionCache.set(sessionKey, cachedSpin);
        }
      }

      const spinsRemaining = cachedSpin ? Math.max(0, maxSpins - cachedSpin.spins) : maxSpins;
      const sessionWinRate = cachedSpin
        ? `${cachedSpin.wins}/${cachedSpin.spins} (${((cachedSpin.wins / cachedSpin.spins) * 100).toFixed(0)}%)`
        : undefined;

      const spinOutput = recordSpin && cachedSpin?.reels?.length === 3
        ? (cachedSpin.won
          ? `🎰 Jackpot! ${cachedSpin.reels[0]} ${cachedSpin.reels[1]} ${cachedSpin.reels[2]} — You won!`
          : `🎰 ${cachedSpin.reels[0]} | ${cachedSpin.reels[1]} | ${cachedSpin.reels[2]} — Try again!`)
        : null;

      return widget({
        props: {
          repo: normalized,
          state,
          issues,
          winChancePercent,
          leaderboard,
          totalContributors: closeCounts.size,
          ...(githubUsername && { spinsRemaining, maxSpins, spinLimitReached: spinsRemaining <= 0, winChanceDecimal }),
          ...(githubUsername && { githubUsername }),
          ...(cachedSpin && {
            slotReels: cachedSpin.reels,
            slotSymbols: SLOT_SYMBOLS,
            slotWon: cachedSpin.won,
            slotSpinComplete: true,
            sessionWinRate,
          }),
        },
        output: text(
          spinOutput ?? `Dashboard for ${normalized}: ${issues.length} issues, ${closeCounts.size} contributors`
        ),
      });
    } catch (err) {
      console.error("get-repo-dashboard failed:", err);
      return error(
        `Failed to load dashboard: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
);

server.listen().then(() => {
  console.log(`Server running`);
});
