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
const SPIN_COMPLETE_DELAY = 2 * REEL_STAGGER + 2200;

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
    const stopIdx =
      fruitIdx >= 0 ? Math.min(4 * syms.length + fruitIdx, stripItems.length - 1) : 0;
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
          {
            "--reel-stop": `${stopOffset}px`,
            animationDelay: `${reelIndex * REEL_STAGGER}ms`,
          } as React.CSSProperties
        }
      >
        {strip.map((fruit, idx) => (
          <div
            key={idx}
            className="flex items-center justify-center shrink-0"
            style={{ height: REEL_HEIGHT, width: 96 }}
          >
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
  // Panel 1: Issues
  state: z.string(),
  issues: z.array(issueSchema),
  winChancePercent: z.string().optional(),
  // Panel 2: Leaderboard
  leaderboard: z.array(leaderboardEntrySchema),
  totalContributors: z.number(),
  // Panel 3: Slot machine (CTA or last spin)
  slotReels: z.array(z.string()).optional(),
  slotSymbols: z.array(z.string()).optional(),
  slotWon: z.boolean().optional(),
  slotSpinComplete: z.boolean().optional(),
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
  metadata: {
    invoking: "Loading dashboard...",
    invoked: "Dashboard loaded",
    csp: { resourceDomains: ["https://avatars.githubusercontent.com"] },
  },
};

type Props = z.infer<typeof propsSchema>;

const PANEL_WIDTH_PERCENT = 100; // each panel takes full width of scroll container

export default function RepoDashboard() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: spinSlot, isPending: isSpinning } = useCallTool("slot-machine-spin");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debug: log when props change
  useEffect(() => {
    if (isPending) {
      console.log("[repo-dashboard] Widget loading...");
    } else if (props) {
      console.log("[repo-dashboard] Props received", {
        repo: props.repo,
        githubUsername: props.githubUsername,
        spinsRemaining: props.spinsRemaining,
        maxSpins: props.maxSpins,
        spinLimitReached: props.spinLimitReached,
        canSpinLater: Boolean(props.repo && props.githubUsername && !props.spinLimitReached),
      });
    }
  }, [isPending, props]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slotMessageVisible, setSlotMessageVisible] = useState(false);
  const panelCount = 3;

  const hasSlotResult = !isPending && Boolean(props?.slotReels?.length === 3);
  useEffect(() => {
    if (!hasSlotResult) return;
    const t = setTimeout(() => setSlotMessageVisible(true), SPIN_COMPLETE_DELAY);
    return () => clearTimeout(t);
  }, [hasSlotResult]);

  const updateActiveIndex = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    const index = Math.round(scrollLeft / clientWidth);
    setActiveIndex(Math.min(index, panelCount - 1));
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

  const scrollToIndex = useCallback((index: number) => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({ left: index * width, behavior: "smooth" });
    setActiveIndex(index);
  }, []);

  const repo = props?.repo ?? "";
  const state = props?.state ?? "open";
  const issues = props?.issues ?? [];
  const winChancePercent = props?.winChancePercent;
  const leaderboard = props?.leaderboard ?? [];
  const totalContributors = props?.totalContributors ?? 0;
  const slotReels = props?.slotReels;
  const slotSymbols = props?.slotSymbols;
  const slotWon = props?.slotWon;
  const slotSpinComplete = props?.slotSpinComplete;
  const sessionWinRate = props?.sessionWinRate;
  const spinsRemaining = props?.spinsRemaining;
  const maxSpins = props?.maxSpins;
  const spinLimitReached = props?.spinLimitReached;
  const githubUsername = props?.githubUsername;

  const canSpin = Boolean(repo && githubUsername && !spinLimitReached && !isSpinning);

  const handlePullLever = () => {
    console.log("[repo-dashboard] Lever clicked", {
      canSpin,
      repo,
      githubUsername,
      spinLimitReached,
      isSpinning,
    });
    if (!canSpin) {
      console.log("[repo-dashboard] Lever blocked: canSpin=false");
      return;
    }
    console.log("[repo-dashboard] Calling slot-machine-spin with", { repo, githubUsername });
    spinSlot(
      { repo, githubUsername: githubUsername! } as Parameters<typeof spinSlot>[0],
      {
        onSuccess: (result) => console.log("[repo-dashboard] slot-machine-spin success", result),
        onError: (err) => console.error("[repo-dashboard] slot-machine-spin error", err),
        onSettled: () => console.log("[repo-dashboard] slot-machine-spin settled (success or error)"),
      }
    );
  };

  return (
    <McpUseProvider autoSize>
      <div className="relative bg-surface-elevated border border-default rounded-3xl overflow-hidden">
        {isPending ? (
          <>
            <div className="flex h-64">
              <div className="shrink-0 w-full p-8">
                <div className="h-6 w-48 rounded-md bg-default/10 animate-pulse mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-default/10 animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 py-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-default/20" />
              ))}
            </div>
          </>
        ) : (
          <>
        {/* Horizontal scroll container */}
        <div
          ref={scrollRef}
          className="dashboard-scroll flex overflow-x-auto snap-x snap-mandatory scroll-smooth"
        >
          {/* Panel 1: Issues */}
          <div
            className="shrink-0 w-full snap-center overflow-y-auto"
            style={{ minHeight: 280 }}
          >
            <div className="p-8">
              <h5 className="text-secondary mb-1">GitHub Issues</h5>
              <h2 className="heading-xl mb-2 font-semibold text-default">{repo}</h2>
              <div className="flex items-center justify-between gap-4 mb-6">
                <p className="text-sm text-secondary">
                  {issues.length} {state} issue{issues.length !== 1 ? "s" : ""}
                </p>
                {winChancePercent && (
                  <span className="text-xs text-tertiary shrink-0">
                    Next spin: <span className="font-medium text-info">{winChancePercent}</span>
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {issues.map((issue) => (
                  <li key={issue.number}>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-primary-soft-hover transition-colors"
                    >
                      <span className="shrink-0 w-4 h-4 flex items-center justify-center rounded border text-xs">
                        {issue.state === "closed" ? "✓" : ""}
                      </span>
                      <div
                        className={`flex-1 min-w-0 ${issue.state === "closed" ? "line-through text-secondary" : ""}`}
                      >
                        <span className="block font-normal text-default">{issue.title}</span>
                        <span className="block text-xs text-tertiary">#{issue.number} · {issue.author}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
              {issues.length === 0 && (
                <p className="text-center text-secondary py-8">No {state} issues found.</p>
              )}
            </div>
          </div>

          {/* Panel 2: Leaderboard */}
          <div className="shrink-0 w-full snap-center overflow-y-auto" style={{ minHeight: 280 }}>
            <div className="p-8">
              <h5 className="text-secondary mb-1">Issue Closers Leaderboard</h5>
              <h2 className="heading-xl mb-1 font-semibold text-default">{repo}</h2>
              <p className="text-sm text-secondary mb-6">
                Top by issues closed · {totalContributors} total
              </p>
              <ol className="space-y-2">
                {leaderboard.map((entry) => (
                  <li key={entry.login}>
                    <a
                      href={`https://github.com/${entry.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-subtle hover:bg-primary-soft-hover transition-colors"
                    >
                      <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-info/20 text-info font-bold text-sm">
                        {entry.rank}
                      </span>
                      {entry.avatarUrl ? (
                        <Image
                          src={entry.avatarUrl}
                          alt={entry.login}
                          className="w-8 h-8 rounded-full shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-default/20 shrink-0 flex items-center justify-center text-xs font-medium">
                          {entry.login[0]?.toUpperCase() ?? "?"}
                        </span>
                      )}
                      <span className="flex-1 font-medium text-default">{entry.login}</span>
                      <span className="shrink-0 text-secondary font-semibold">
                        {entry.closedCount} closed
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              {leaderboard.length === 0 && (
                <p className="text-center text-secondary py-8">No closed issues found.</p>
              )}
            </div>
          </div>

          {/* Panel 3: Slot machine */}
          <div className="shrink-0 w-full snap-center overflow-y-auto" style={{ minHeight: 280 }}>
            <div className="p-8">
              <h5 className="text-secondary mb-1">Slot Machine</h5>
              <h2 className="heading-xl mb-4 font-semibold text-default">{repo}</h2>
              {hasSlotResult || spinLimitReached ? (
                <>
                  <div className="flex flex-col items-center gap-2 mb-4">
                    {maxSpins != null && (
                      <p className="text-base font-semibold text-default text-center">
                        <span className="text-info">{spinsRemaining ?? maxSpins}</span>
                        <span className="text-secondary"> spins left</span>
                        <span className="text-tertiary"> · {spinsRemaining ?? maxSpins}/{maxSpins} total</span>
                        {spinLimitReached && (
                          <span className="block text-sm text-secondary mt-1">Close more issues to spin again</span>
                        )}
                      </p>
                    )}
                    {winChancePercent && (
                      <p className="text-sm text-tertiary text-center">
                        Next spin chance: <span className="font-medium text-info">{winChancePercent}</span>
                      </p>
                    )}
                    {sessionWinRate && (
                      <p className="text-xs text-tertiary text-center">
                        Win rate: <span className="font-medium">{sessionWinRate}</span>
                      </p>
                    )}
                  </div>
                  {hasSlotResult && slotReels && (
                    <div className="flex justify-center items-center gap-4 mb-4">
                      {slotReels.map((fruit, i) => (
                        <SpinningReel
                          key={i}
                          symbols={slotSymbols ?? []}
                          finalFruit={fruit}
                          reelIndex={i}
                          won={slotWon ?? false}
                        />
                      ))}
                    </div>
                  )}
                  {hasSlotResult && slotMessageVisible && slotSpinComplete && (
                    <p className={`text-center text-sm ${slotWon ? "text-success" : "text-secondary"}`}>
                      {slotWon
                        ? "Good job keep going."
                        : "Working harder, contribute more, next time u will win."}
                    </p>
                  )}
                  {canSpin && (
                    <div className="flex justify-center mt-4">
                      <div className="flex items-end gap-2">
                        <div className="slot-lever-base" />
                        <button
                          type="button"
                          onClick={handlePullLever}
                          disabled={!canSpin}
                          className="slot-lever"
                          aria-label="Pull lever to spin again"
                          title="Pull to spin again!"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-4 mb-6">
                    {maxSpins != null && (
                      <p className="text-base font-semibold text-center">
                        <span className="text-info">{spinsRemaining ?? maxSpins}</span>
                        <span className="text-secondary"> spins left</span>
                        <span className="text-tertiary"> ({spinsRemaining ?? maxSpins}/{maxSpins})</span>
                      </p>
                    )}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-end gap-2">
                        <div className="slot-lever-base" />
                        <button
                          type="button"
                          onClick={handlePullLever}
                          disabled={!canSpin}
                          className="slot-lever"
                          aria-label="Pull lever to spin"
                          title={canSpin ? "Pull to spin!" : spinLimitReached ? "No spins left" : !githubUsername ? "Provide your GitHub username" : "Spinning..."}
                        />
                      </div>
                      <p className="text-sm text-secondary text-center">
                        {githubUsername
                          ? "Pull the lever to spin! (1 spin per issue closed)"
                          : "GitHub username required to spin"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    {winChancePercent && (
                      <p className="text-center text-sm">
                        Next spin chance: <span className="font-semibold text-info">{winChancePercent}</span>
                      </p>
                    )}
                    {sessionWinRate && (
                      <p className="text-center text-sm text-secondary">
                        Win rate: <span className="font-medium">{sessionWinRate}</span>
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page indicator — filled dot = current page */}
        <div className="flex justify-center gap-3 py-4 border-t border-default bg-[#f5f5f5] dark:bg-[#1a1a1a]">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={`h-4 w-4 min-w-[16px] rounded-full transition-all duration-200 ${
                i === activeIndex ? "page-dot-active scale-110" : "page-dot-inactive"
              }`}
              aria-label={`Go to panel ${i + 1}`}
              aria-current={i === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
          </>
        )}
      </div>
    </McpUseProvider>
  );
}
