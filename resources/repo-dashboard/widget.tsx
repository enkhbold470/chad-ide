import {
  Image,
  McpUseProvider,
  useCallTool,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import "../styles.css";

const REEL_HEIGHT = 96;
const REEL_STAGGER = 250;
const SPIN_DURATION = 2 * REEL_STAGGER + 2200;
const STORAGE_KEY = (repo: string, user: string) => `chad-ide:${repo}:${user}`;

type SpinState = { spinsUsed: number; lastSpin: { reels: string[]; won: boolean } };
const loadSpinState = (key: string): SpinState | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SpinState) : null;
  } catch {
    return null;
  }
};
const saveSpinState = (key: string, state: SpinState) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {}
};

function SpinningReel({
  symbols,
  finalFruit,
  reelIndex,
  won,
}: {
  symbols: string[];
  finalFruit: string;
  reelIndex: number;
  won: boolean;
}) {
  const { strip, stopOffset } = useMemo(() => {
    const syms = symbols?.length ? symbols : ["apple", "orange", "banana"];
    const stripItems: string[] = [];
    for (let c = 0; c < 6; c++) stripItems.push(...syms);
    const fruitIdx = syms.indexOf(finalFruit);
    const stopIdx = fruitIdx >= 0 ? Math.min(4 * syms.length + fruitIdx, stripItems.length - 1) : 0;
    return { strip: stripItems, stopOffset: -stopIdx * REEL_HEIGHT };
  }, [symbols, finalFruit]);

  return (
    <div
      className={`relative w-24 h-24 rounded-xl border overflow-hidden ${
        won ? "border-success bg-success/10" : "border-subtle bg-surface"
      }`}
    >
      <div
        className="slot-reel-strip spinning absolute left-0 top-0 flex flex-col"
        style={
          { "--reel-stop": `${stopOffset}px`, animationDelay: `${reelIndex * REEL_STAGGER}ms` } as React.CSSProperties
        }
      >
        {strip.map((fruit, idx) => (
          <div key={idx} className="flex items-center justify-center shrink-0" style={{ height: REEL_HEIGHT, width: 96 }}>
            <Image src={`/fruits/${fruit}.png`} alt={fruit} className="w-20 h-20 object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
}

const issueSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  url: z.string(),
  author: z.string(),
  createdAt: z.string(),
});
const leaderboardEntrySchema = z.object({
  rank: z.number(),
  login: z.string(),
  avatarUrl: z.string().optional(),
  closedCount: z.number(),
});
const propsSchema = z.object({
  repo: z.string(),
  state: z.string(),
  issues: z.array(issueSchema),
  winChancePercent: z.string().optional(),
  winChanceDecimal: z.number().optional(),
  leaderboard: z.array(leaderboardEntrySchema),
  totalContributors: z.number(),
  slotReels: z.array(z.string()).optional(),
  slotSymbols: z.array(z.string()).optional(),
  slotWon: z.boolean().optional(),
  sessionWinRate: z.string().optional(),
  spinsRemaining: z.number().optional(),
  maxSpins: z.number().optional(),
  spinLimitReached: z.boolean().optional(),
  githubUsername: z.string().optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Repo dashboard: issues, leaderboard, and slot machine in one scrollable view",
  props: propsSchema,
  exposeAsTool: false,
  metadata: { invoking: "Loading dashboard...", invoked: "Dashboard loaded", csp: { resourceDomains: ["https://avatars.githubusercontent.com"] } },
};

type Props = z.infer<typeof propsSchema>;

export default function RepoDashboard() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: recordSpin, isPending: isSpinning } = useCallTool("get-repo-dashboard");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slotMessageVisible, setSlotMessageVisible] = useState(false);
  const [liveSpin, setLiveSpin] = useState<{ reels: string[]; won: boolean; key: number } | null>(null);

  const repo = props?.repo ?? "";
  const state = props?.state ?? "all";
  const githubUsername = props?.githubUsername;
  const maxSpins = props?.maxSpins ?? 0;
  const slotSymbols = props?.slotSymbols ?? ["apple", "orange", "banana", "cherries", "lemon"];
  const winChanceDecimal = props?.winChanceDecimal ?? 0.05;

  const storageKey = repo && githubUsername ? STORAGE_KEY(repo, githubUsername) : "";
  const stored = storageKey ? loadSpinState(storageKey) : null;
  const spinsUsed = stored?.spinsUsed ?? (maxSpins - (props?.spinsRemaining ?? maxSpins));
  const spinsRemaining = Math.max(0, maxSpins - spinsUsed);
  const spinLimitReached = maxSpins > 0 && spinsRemaining <= 0;
  const lastSpin = liveSpin ?? stored?.lastSpin ?? (props?.slotReels?.length === 3 ? { reels: props.slotReels, won: props.slotWon ?? false } : null);
  const hasResult = Boolean(lastSpin?.reels?.length === 3);
  const canSpin = Boolean(repo && githubUsername && !spinLimitReached && !isSpinning && !liveSpin);

  useEffect(() => {
    if (!hasResult) return;
    const t = setTimeout(() => setSlotMessageVisible(true), SPIN_DURATION);
    return () => clearTimeout(t);
  }, [hasResult]);

  const updateActiveIndex = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setActiveIndex(Math.min(Math.round(scrollLeft / clientWidth), 2));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateActiveIndex();
    el.addEventListener("scroll", updateActiveIndex);
    window.addEventListener("resize", updateActiveIndex);
    return () => {
      el.removeEventListener("scroll", updateActiveIndex);
      window.removeEventListener("resize", updateActiveIndex);
    };
  }, [updateActiveIndex]);

  const scrollToIndex = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.clientWidth ?? 0), behavior: "smooth" });
    setActiveIndex(i);
  }, []);

  const handlePullLever = () => {
    if (!canSpin || !slotSymbols.length) return;
    const willWin = Math.random() < winChanceDecimal;
    const fruit = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const reels = willWin ? [fruit, fruit, fruit] : Array.from({ length: 3 }, () => slotSymbols[Math.floor(Math.random() * slotSymbols.length)]);
    const won = reels[0] === reels[1] && reels[1] === reels[2];

    setLiveSpin({ reels, won, key: Date.now() });
    setSlotMessageVisible(false);

    setTimeout(() => {
      setSlotMessageVisible(true);
      recordSpin(
        { repo, githubUsername: githubUsername!, state: state as "open" | "closed" | "all", recordSpin: { reels, won } } as never,
        {
          onSuccess: () => {
            if (storageKey) saveSpinState(storageKey, { spinsUsed: spinsUsed + 1, lastSpin: { reels, won } });
            setLiveSpin(null);
          },
        }
      );
    }, SPIN_DURATION);
  };

  const issues = props?.issues ?? [];
  const leaderboard = props?.leaderboard ?? [];
  const SpinPanel = (
    <div className="flex flex-col items-center gap-2 mb-4">
      {maxSpins > 0 && (
        <p className="text-base font-semibold text-center">
          <span className="text-info">{spinsRemaining}</span>
          <span className="text-secondary"> spins left</span>
          <span className="text-tertiary"> · {spinsRemaining}/{maxSpins}</span>
          {spinLimitReached && <span className="block text-sm text-secondary mt-1">Close more issues to spin again</span>}
        </p>
      )}
      {props?.winChancePercent && <p className="text-sm text-tertiary">Next spin: <span className="font-medium text-info">{props.winChancePercent}</span></p>}
      {props?.sessionWinRate && <p className="text-xs text-tertiary">Win rate: {props.sessionWinRate}</p>}
    </div>
  );

  return (
    <McpUseProvider autoSize>
      <div className="relative bg-surface-elevated border border-default rounded-3xl overflow-hidden">
        {isPending ? (
          <div className="flex h-64">
            <div className="shrink-0 w-full p-8">
              <div className="h-6 w-48 rounded-md bg-default/10 animate-pulse mb-4" />
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 rounded-lg bg-default/10 animate-pulse mt-3" />)}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="dashboard-scroll flex overflow-x-auto snap-x snap-mandatory scroll-smooth">
              <div className="shrink-0 w-full snap-center overflow-y-auto" style={{ minHeight: 280 }}>
                <div className="p-8">
                  <h5 className="text-secondary mb-1">GitHub Issues</h5>
                  <h2 className="heading-xl mb-2 font-semibold text-default">{repo}</h2>
                  <p className="text-sm text-secondary mb-6">{issues.length} {state} issue{issues.length !== 1 ? "s" : ""}</p>
                  <ul className="space-y-1">
                    {issues.map((issue) => (
                      <li key={issue.number}>
                        <a href={issue.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-primary-soft-hover transition-colors">
                          <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded border text-xs">{issue.state === "closed" ? "✓" : ""}</span>
                          <div className={`flex-1 min-w-0 ${issue.state === "closed" ? "line-through text-secondary" : ""}`}>
                            <span className="block font-normal text-default">{issue.title}</span>
                            <span className="block text-xs text-tertiary">#{issue.number} · {issue.author}</span>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                  {issues.length === 0 && <p className="text-center text-secondary py-8">No {state} issues found.</p>}
                </div>
              </div>

              <div className="shrink-0 w-full snap-center overflow-y-auto" style={{ minHeight: 280 }}>
                <div className="p-8">
                  <h5 className="text-secondary mb-1">Issue Closers Leaderboard</h5>
                  <h2 className="heading-xl mb-1 font-semibold text-default">{repo}</h2>
                  <p className="text-sm text-secondary mb-6">Top by issues closed · {props?.totalContributors ?? 0} total</p>
                  <ol className="space-y-2">
                    {leaderboard.map((entry) => (
                      <li key={entry.login}>
                        <a href={`https://github.com/${entry.login}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-subtle hover:bg-primary-soft-hover transition-colors">
                          <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-info/20 text-info font-bold text-sm">{entry.rank}</span>
                          {entry.avatarUrl ? <Image src={entry.avatarUrl} alt={entry.login} className="w-8 h-8 rounded-full shrink-0" /> : <span className="w-8 h-8 rounded-full bg-default/20 shrink-0 flex items-center justify-center text-xs font-medium">{entry.login[0]?.toUpperCase() ?? "?"}</span>}
                          <span className="flex-1 font-medium text-default">{entry.login}</span>
                          <span className="shrink-0 text-secondary font-semibold">{entry.closedCount} closed</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  {leaderboard.length === 0 && <p className="text-center text-secondary py-8">No closed issues found.</p>}
                </div>
              </div>

              <div className="shrink-0 w-full snap-center overflow-y-auto" style={{ minHeight: 280 }}>
                <div className="p-8">
                  <h5 className="text-secondary mb-1">Slot Machine</h5>
                  <h2 className="heading-xl mb-4 font-semibold text-default">{repo}</h2>
                  {SpinPanel}
                  {hasResult && lastSpin && (
                    <>
                      <div className="flex justify-center items-center gap-4 mb-4">
                        {lastSpin.reels.map((fruit, i) => (
                          <SpinningReel key={liveSpin ? `${liveSpin.key}-${i}` : i} symbols={slotSymbols} finalFruit={fruit} reelIndex={i} won={lastSpin.won} />
                        ))}
                      </div>
                      {slotMessageVisible && <p className={`text-center text-sm ${lastSpin.won ? "text-success" : "text-secondary"}`}>{lastSpin.won ? "Good job keep going." : "Working harder, contribute more, next time u will win."}</p>}
                    </>
                  )}
                  <div className="flex justify-center mt-4">
                    <div className="flex items-end gap-2">
                      <div className="slot-lever-base" />
                      <button type="button" onClick={handlePullLever} disabled={!canSpin} className="slot-lever" aria-label={canSpin ? "Pull lever" : "No spins left"} title={canSpin ? "Pull to spin!" : "No spins left"} />
                    </div>
                  </div>
                  {!githubUsername && <p className="text-sm text-secondary text-center mt-2">GitHub username required to spin</p>}
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 py-4 border-t border-default bg-[#f5f5f5] dark:bg-[#1a1a1a]">
              {[0, 1, 2].map((i) => (
                <button key={i} type="button" onClick={() => scrollToIndex(i)} className={`h-4 w-4 min-w-[16px] rounded-full transition-all ${i === activeIndex ? "page-dot-active scale-110" : "page-dot-inactive"}`} aria-label={`Panel ${i + 1}`} aria-current={i === activeIndex ? "true" : undefined} />
              ))}
            </div>
          </>
        )}
      </div>
    </McpUseProvider>
  );
}
