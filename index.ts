import { MCPServer, error, object, text, widget } from "mcp-use/server";
import { z } from "zod";

const baseUrl = process.env.MCP_URL || "http://localhost:3000";
const server = new MCPServer({
  name: "my-widget-server",
  title: "my-widget-server", // display name
  version: "1.0.0",
  description: "MCP server with MCP Apps integration",
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

/**
 * TOOL THAT RETURNS A WIDGET
 * The `widget` config tells mcp-use which widget component to render.
 * The `widget()` helper in the handler passes props to that component.
 * Docs: https://mcp-use.com/docs/typescript/server/mcp-apps
 */

// Fruits data — color values are Tailwind bg-[] classes used by the carousel UI
const fruits = [
  { fruit: "mango", color: "bg-[#FBF1E1] dark:bg-[#FBF1E1]/10" },
  { fruit: "pineapple", color: "bg-[#f8f0d9] dark:bg-[#f8f0d9]/10" },
  { fruit: "cherries", color: "bg-[#E2EDDC] dark:bg-[#E2EDDC]/10" },
  { fruit: "coconut", color: "bg-[#fbedd3] dark:bg-[#fbedd3]/10" },
  { fruit: "apricot", color: "bg-[#fee6ca] dark:bg-[#fee6ca]/10" },
  { fruit: "blueberry", color: "bg-[#e0e6e6] dark:bg-[#e0e6e6]/10" },
  { fruit: "grapes", color: "bg-[#f4ebe2] dark:bg-[#f4ebe2]/10" },
  { fruit: "watermelon", color: "bg-[#e6eddb] dark:bg-[#e6eddb]/10" },
  { fruit: "orange", color: "bg-[#fdebdf] dark:bg-[#fdebdf]/10" },
  { fruit: "avocado", color: "bg-[#ecefda] dark:bg-[#ecefda]/10" },
  { fruit: "apple", color: "bg-[#F9E7E4] dark:bg-[#F9E7E4]/10" },
  { fruit: "pear", color: "bg-[#f1f1cf] dark:bg-[#f1f1cf]/10" },
  { fruit: "plum", color: "bg-[#ece5ec] dark:bg-[#ece5ec]/10" },
  { fruit: "banana", color: "bg-[#fdf0dd] dark:bg-[#fdf0dd]/10" },
  { fruit: "strawberry", color: "bg-[#f7e6df] dark:bg-[#f7e6df]/10" },
  { fruit: "lemon", color: "bg-[#feeecd] dark:bg-[#feeecd]/10" },
];

server.tool(
  {
    name: "search-tools",
    description: "Search for fruits and display the results in a visual widget",
    schema: z.object({
      query: z.string().optional().describe("Search query to filter fruits"),
    }),
    widget: {
      name: "product-search-result",
      invoking: "Searching...",
      invoked: "Results loaded",
    },
  },
  async ({ query }) => {
    const results = fruits.filter(
      (f) => !query || f.fruit.toLowerCase().includes(query.toLowerCase())
    );

    // let's emulate a delay to show the loading state
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return widget({
      props: { query: query ?? "", results },
      output: text(
        `Found ${results.length} fruits matching "${query ?? "all"}"`
      ),
    });
  }
);

/**
 * Slot machine tool — spin and win. Odds improve with issues closed in the repo.
 */
const SLOT_SYMBOLS = fruits.map((f) => f.fruit);
const BASE_WIN_CHANCE = 0.05; // 5% base chance for 3-of-a-kind
const MAX_CONTRIBUTION_BONUS = 0.25; // up to 25% bonus → 30% max win chance
const CONTRIBUTION_PER_ISSUE = 100; // each closed issue = 100 contribution points
const CONTRIBUTION_SCALE = 5000; // 50 issues closed ≈ max bonus

server.tool(
  {
    name: "slot-machine-spin",
    description:
      "Spin the slot machine. Winning chance is based on how many issues the user has closed in the repo. Provide repo and GitHub username to look up their count automatically.",
    schema: z.object({
      repo: z
        .string()
        .describe(
          "Repository in owner/repo format (e.g. facebook/react). Used to look up user's closed-issue count."
        ),
      githubUsername: z
        .string()
        .describe(
          "The GitHub username of the person spinning. Their closed-issue count in the repo determines win chance."
        ),
    }),
    widget: {
      name: "slot-machine-result",
      invoking: "Spinning...",
      invoked: "Spin complete",
    },
  },
  async ({ repo, githubUsername }) => {
    let issuesClosed = 0;
    try {
      const { closeCounts } = await fetchLeaderboardData(repo);
      const user = closeCounts.get(githubUsername);
      issuesClosed = user?.count ?? 0;
    } catch {
      // Fall back to base odds if leaderboard fetch fails
    }

    const contribution = issuesClosed * CONTRIBUTION_PER_ISSUE;
    const contributionBonus = Math.min(
      contribution / CONTRIBUTION_SCALE,
      MAX_CONTRIBUTION_BONUS
    );
    const winChance = BASE_WIN_CHANCE + contributionBonus;

    const willForceWin = Math.random() < winChance;
    const reel1: string =
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    const reel2 = willForceWin ? reel1 : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    const reel3 = willForceWin ? reel1 : SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];

    const won = reel1 === reel2 && reel2 === reel3;

    const imageUrl = (fruit: string) =>
      `${baseUrl.replace(/\/$/, "")}/fruits/${fruit}.png`;

    const reels = [reel1, reel2, reel3];
    const reelImages = [imageUrl(reel1), imageUrl(reel2), imageUrl(reel3)];
    const message = won
      ? `🎰 Jackpot! ${reel1} ${reel1} ${reel1} — You won!`
      : `🎰 ${reel1} | ${reel2} | ${reel3} — Try again!`;

    return widget({
      props: {
        reels,
        reelImages,
        symbols: SLOT_SYMBOLS,
        won,
        issuesClosed,
        winChanceUsed: winChance,
        message,
      },
      output: text(message),
    });
  }
);

/**
 * Fetch a public GitHub repo's issue list.
 */
server.tool(
  {
    name: "get-repo-issues",
    description:
      "Get the list of issues from a public GitHub repository. Use owner/repo format (e.g. facebook/react).",
    schema: z.object({
      repo: z
        .string()
        .describe(
          "Repository in owner/repo format (e.g. facebook/react, vercel/next.js)"
        ),
      state: z
        .enum(["open", "closed", "all"])
        .optional()
        .describe("Filter by issue state. Default: open"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max number of issues to return. Default: 30"),
      githubUsername: z
        .string()
        .optional()
        .describe(
          "GitHub username of the viewer. Used to show their next spin win chance (5% base + bonus per issue closed)."
        ),
    }),
    annotations: { openWorldHint: true },
    widget: {
      name: "repo-issues-todo",
      invoking: "Fetching issues...",
      invoked: "Issues loaded",
    },
  },
  async ({ repo, state = "open", limit = 30, githubUsername }) => {
    const normalized = repo.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    const [owner, name] = normalized.split("/");
    if (!owner || !name) {
      return error("Invalid repo format. Use owner/repo (e.g. facebook/react)");
    }

    try {
      const params = new URLSearchParams({
        state,
        per_page: String(Math.min(limit, 100)),
        page: "1",
      });
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "mcp-widget-server",
      };
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${name}/issues?${params}`,
        { headers }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return error(`Repository not found: ${repo}`);
        }
        if (res.status === 403) {
          return error(
            "GitHub API rate limit exceeded. Try again later or use a GitHub token."
          );
        }
        return error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as Array<{
        pull_request?: unknown;
        number: number;
        title: string;
        state: string;
        html_url: string;
        user?: { login: string };
        created_at: string;
      }>;
      const issues = data
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

      let issuesClosed = 0;
      if (githubUsername) {
        try {
          const { closeCounts } = await fetchLeaderboardData(repo);
          issuesClosed = closeCounts.get(githubUsername)?.count ?? 0;
        } catch {
          // Use base odds if leaderboard fetch fails
        }
      }

      const contribution = issuesClosed * CONTRIBUTION_PER_ISSUE;
      const contributionBonus = Math.min(
        contribution / CONTRIBUTION_SCALE,
        MAX_CONTRIBUTION_BONUS
      );
      const winChancePercent = (
        (BASE_WIN_CHANCE + contributionBonus) *
        100
      ).toFixed(1);

      return widget({
        props: {
          repo: normalized,
          state,
          issues,
          count: issues.length,
          winChancePercent: githubUsername ? `${winChancePercent}%` : undefined,
        },
        output: text(
          `Found ${issues.length} ${state} issues in ${normalized}`
        ),
      });
    } catch (err) {
      console.error("get-repo-issues failed:", err);
      return error(
        `Failed to fetch issues: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }
);

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
 * Leaderboard: who closed the most issues in a repo.
 * Uses GitHub issue events API (closed events).
 * Cached for 24h; re-fetches daily. Cumulative counts never reset.
 */
server.tool(
  {
    name: "get-repo-issues-leaderboard",
    description:
      "Get a leaderboard of who closed the most issues in a public GitHub repository. Uses owner/repo format.",
    schema: z.object({
      repo: z
        .string()
        .describe(
          "Repository in owner/repo format (e.g. facebook/react, enkhbold470/chad-ide)"
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe("Max number of top contributors to return. Default: 10"),
      pages: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe(
          "Number of event pages to fetch (100 events per page). More = more history. Default: 2"
        ),
    }),
    annotations: { openWorldHint: true },
    widget: {
      name: "repo-issues-leaderboard",
      invoking: "Fetching leaderboard...",
      invoked: "Leaderboard loaded",
    },
  },
  async ({ repo, limit = 10, pages = 3 }) => {
    try {
      const { repo: normalized, closeCounts } = await fetchLeaderboardData(
        repo,
        pages
      );

      const leaderboard = Array.from(closeCounts.entries())
        .map(([login, { count, avatarUrl }]) => ({
          rank: 0,
          login,
          avatarUrl: avatarUrl ?? undefined,
          closedCount: count,
        }))
        .sort((a, b) => b.closedCount - a.closedCount)
        .slice(0, limit)
        .map((row, i) => ({ ...row, rank: i + 1 }));

      const result = {
        repo: normalized,
        leaderboard,
        totalContributors: closeCounts.size,
      };

      return widget({
        props: result,
        output: text(
          `Leaderboard for ${normalized}: ${leaderboard
            .map((r) => `${r.rank}. ${r.login} (${r.closedCount})`)
            .join(", ")}`
        ),
      });
    } catch (err) {
      console.error("get-repo-issues-leaderboard failed:", err);
      return error(
        `Failed to fetch leaderboard: ${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }
);

server.listen().then(() => {
  console.log(`Server running`);
});
