import { McpUseProvider, useCallTool, useWidget, type WidgetMetadata } from "mcp-use/react";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import "../styles.css";

const REEL_H = 36;
const REEL_STAGGER = 120;
const SPIN_MS = 1600;

const issueSchema = z.object({ number: z.number(), title: z.string(), state: z.string(), url: z.string(), author: z.string(), createdAt: z.string() });
const lbSchema = z.object({ rank: z.number(), login: z.string(), avatarUrl: z.string().optional(), closedCount: z.number() });
const propsSchema = z.object({
  repo: z.string(),
  state: z.string(),
  issues: z.array(issueSchema),
  winChancePercent: z.string().optional(),
  winChanceDecimal: z.number().optional(),
  leaderboard: z.array(lbSchema),
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
  description: "Repo dashboard: issues, leaderboard, slot machine",
  props: propsSchema,
  exposeAsTool: false,
  metadata: { invoking: "Loading...", invoked: "Loaded", csp: { resourceDomains: ["https://avatars.githubusercontent.com"] } },
};

type Props = z.infer<typeof propsSchema>;

const FRUIT_EMOJI: Record<string, string> = { apple: "🍎", banana: "🍌", cherry: "🍒", grape: "🍇", lemon: "🍋", orange: "🍊" };

function Reel({ symbols, final, idx, won }: { symbols: string[]; final: string; idx: number; won: boolean }) {
  const { strip, stop } = useMemo(() => {
    const s = symbols?.length ? symbols : ["apple", "orange", "banana"];
    const items: string[] = [];
    for (let i = 0; i < 6; i++) items.push(...s);
    const fi = s.indexOf(final);
    const stopIdx = fi >= 0 ? Math.min(4 * s.length + fi, items.length - 1) : 0;
    return { strip: items, stop: -stopIdx * REEL_H };
  }, [symbols, final]);

  return (
    <div className={`reel-box ${won ? "reel-won" : ""}`}>
      <div className="reel-strip" style={{ "--stop": `${stop}px`, animationDelay: `${idx * REEL_STAGGER}ms` } as React.CSSProperties}>
        {strip.map((f, i) => (
          <div key={i} className="reel-cell">{FRUIT_EMOJI[f] ?? f}</div>
        ))}
      </div>
    </div>
  );
}

export default function RepoDashboard() {
  const { props, isPending } = useWidget<Props>();
  const { callTool: recordSpin, isPending: isSpinning } = useCallTool("get-repo-dashboard");
  const [msgVis, setMsgVis] = useState(false);
  const [live, setLive] = useState<{ reels: string[]; won: boolean; key: number } | null>(null);

  const repo = props?.repo ?? "";
  const state = props?.state ?? "all";
  const githubUsername = props?.githubUsername;
  const maxSpins = props?.maxSpins ?? 0;
  const slotSymbols = props?.slotSymbols ?? ["apple", "banana", "cherry", "grape", "lemon", "orange"];
  const winChance = props?.winChanceDecimal ?? 0.05;

  const spinsUsed = maxSpins - (props?.spinsRemaining ?? maxSpins);
  const spinsLeft = Math.max(0, maxSpins - spinsUsed);
  const limitReached = maxSpins > 0 && spinsLeft <= 0;
  const lastSpin = live ?? (props?.slotReels?.length === 3 ? { reels: props.slotReels, won: props.slotWon ?? false } : null);
  const hasResult = Boolean(lastSpin?.reels?.length === 3);
  const canSpin = Boolean(repo && githubUsername && !limitReached && !isSpinning && !live);

  useEffect(() => {
    if (!hasResult) return;
    const t = setTimeout(() => setMsgVis(true), SPIN_MS + 2 * REEL_STAGGER);
    return () => clearTimeout(t);
  }, [hasResult]);

  const handleSpin = () => {
    if (!canSpin || !slotSymbols.length) return;
    const willWin = Math.random() < winChance;
    const fruit = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const reels = willWin ? [fruit, fruit, fruit] : Array.from({ length: 3 }, () => slotSymbols[Math.floor(Math.random() * slotSymbols.length)]);
    const won = reels[0] === reels[1] && reels[1] === reels[2];

    setLive({ reels, won, key: Date.now() });
    setMsgVis(false);

    setTimeout(() => {
      setMsgVis(true);
      recordSpin(
        { repo, githubUsername: githubUsername!, state: state as "open" | "closed" | "all", recordSpin: { reels, won } } as never,
        { onSuccess: () => setLive(null) }
      );
    }, SPIN_MS + 2 * REEL_STAGGER);
  };

  const issues = props?.issues ?? [];
  const leaderboard = props?.leaderboard ?? [];

  return (
    <McpUseProvider autoSize>
      <div className="gitlot">
        {isPending ? (
          <div className="grid">
            <div className="col"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
            <div className="col"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
            <div className="col"><div className="skeleton" /><div className="skeleton" /></div>
          </div>
        ) : (
          <div className="grid">
            <section className="col">
              <h3 className="heading">{repo}</h3>
              <p className="meta">{issues.length} {state}</p>
              <ul>
                {issues.slice(0, 5).map((i) => (
                  <li key={i.number}>
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="link">{i.state === "closed" ? "✓" : "○"} {i.title}</a>
                    <span className="num">#{i.number}</span>
                  </li>
                ))}
              </ul>
              {issues.length === 0 && <p className="empty">No issues</p>}
            </section>

            <section className="col">
              <h3 className="heading">Leaderboard</h3>
              <p className="meta">{props?.totalContributors ?? 0} contributors</p>
              <ol>
                {leaderboard.slice(0, 5).map((e) => (
                  <li key={e.login}>
                    <span className="rank">{e.rank}</span>
                    {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="ava" /> : <span className="ava" />}
                    <span className="login">{e.login}</span>
                    <span className="cnt">{e.closedCount}</span>
                  </li>
                ))}
              </ol>
              {leaderboard.length === 0 && <p className="empty">No data</p>}
            </section>

            <section className="col">
              <h3 className="heading">Slot</h3>
              {maxSpins > 0 && <p className="meta">{spinsLeft} · {props?.winChancePercent ?? "5%"}</p>}
              {props?.sessionWinRate && <p className="meta">{props.sessionWinRate}</p>}
              {hasResult && lastSpin && (
                <>
                  <div className="reels">
                    {lastSpin.reels.map((f, i) => (
                      <Reel key={live ? `${live.key}-${i}` : i} symbols={slotSymbols} final={f} idx={i} won={lastSpin.won} />
                    ))}
                  </div>
                  {msgVis && <p className={lastSpin.won ? "win" : "lose"}>{lastSpin.won ? "Win!" : "Try again"}</p>}
                </>
              )}
              <button type="button" onClick={handleSpin} disabled={!canSpin} className="btn-spin" aria-label="Spin">
                Spin
              </button>
              {!githubUsername && <p className="meta">Need username</p>}
            </section>
          </div>
        )}
      </div>
    </McpUseProvider>
  );
}
