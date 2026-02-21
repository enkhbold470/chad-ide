import {
  Image,
  McpUseProvider,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React from "react";
import { z } from "zod";
import "../styles.css";

const leaderboardEntrySchema = z.object({
  rank: z.number(),
  login: z.string(),
  avatarUrl: z.string().optional(),
  closedCount: z.number(),
});

const propsSchema = z.object({
  repo: z.string(),
  leaderboard: z.array(leaderboardEntrySchema),
  totalContributors: z.number(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Display issue closer leaderboard for a GitHub repo",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    invoking: "Fetching leaderboard...",
    invoked: "Leaderboard loaded",
    csp: { resourceDomains: ["https://avatars.githubusercontent.com"] },
  },
};

type Props = z.infer<typeof propsSchema>;

export default function RepoIssuesLeaderboard() {
  const { props, isPending } = useWidget<Props>();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="relative bg-surface-elevated border border-default rounded-3xl p-8">
          <h5 className="text-secondary mb-2">Issue Closers Leaderboard</h5>
          <div className="h-6 w-48 rounded-md bg-default/10 animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-default/10 animate-pulse"
              />
            ))}
          </div>
        </div>
      </McpUseProvider>
    );
  }

  const { repo, leaderboard, totalContributors } = props;

  return (
    <McpUseProvider autoSize>
      <div className="relative bg-surface-elevated border border-default rounded-3xl p-8">
        <h5 className="text-secondary mb-1">Issue Closers Leaderboard</h5>
        <h2 className="heading-xl mb-1 font-semibold text-default">{repo}</h2>
        <p className="text-sm text-secondary mb-6">
          Top contributors by issues closed · {totalContributors} total
        </p>

        <ol className="space-y-2">
          {leaderboard.map((entry) => (
            <li key={entry.login}>
              <a
                href={`https://github.com/${entry.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-subtle hover:bg-primary-soft-hover hover:border-default transition-colors group"
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
                <span className="flex-1 font-medium text-default group-hover:text-info">
                  {entry.login}
                </span>
                <span className="shrink-0 text-secondary font-semibold">
                  {entry.closedCount} closed
                </span>
              </a>
            </li>
          ))}
        </ol>

        {leaderboard.length === 0 && (
          <p className="text-center text-secondary py-8">
            No closed issues found in recent activity.
          </p>
        )}
      </div>
    </McpUseProvider>
  );
}
