import { MCPServer, object, text, widget } from "mcp-use/server";
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
 * Slot machine tool — spin and win. Odds improve with total contribution.
 */
const SLOT_SYMBOLS = fruits.map((f) => f.fruit);
const BASE_WIN_CHANCE = 0.08; // 8% base chance for 3-of-a-kind
const MAX_CONTRIBUTION_BONUS = 0.22; // up to 22% bonus → 30% max win chance
const CONTRIBUTION_SCALE = 5000; // contribution / 5000 = bonus (capped)

server.tool(
  {
    name: "slot-machine-spin",
    description:
      "Spin the slot machine. Returns 3 reel symbols. Winning chance (3 matching symbols) increases with total contribution.",
    schema: z.object({
      totalContribution: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Total contribution score for the person. Higher values improve win odds. Omit for base odds."
        ),
    }),
    widget: {
      name: "slot-machine-result",
      invoking: "Spinning...",
      invoked: "Spin complete",
    },
  },
  async ({ totalContribution = 0 }) => {
    const contributionBonus = Math.min(
      totalContribution / CONTRIBUTION_SCALE,
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
        totalContribution,
        winChanceUsed: winChance,
        message,
      },
      output: text(message),
    });
  }
);

server.tool(
  {
    name: "get-fruit-details",
    description: "Get detailed information about a specific fruit",
    schema: z.object({
      fruit: z.string().describe("The fruit name"),
    }),
    outputSchema: z.object({
      fruit: z.string(),
      color: z.string(),
      facts: z.array(z.string()),
    }),
  },
  async ({ fruit }) => {
    const found = fruits.find(
      (f) => f.fruit?.toLowerCase() === fruit?.toLowerCase()
    );
    return object({
      fruit: found?.fruit ?? fruit,
      color: found?.color ?? "unknown",
      facts: [
        `${fruit} is a delicious fruit`,
        `Color: ${found?.color ?? "unknown"}`,
      ],
    });
  }
);

server.listen().then(() => {
  console.log(`Server running`);
});
