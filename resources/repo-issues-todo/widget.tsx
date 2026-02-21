import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react";
import React from "react";
import { z } from "zod";
import "../styles.css";

const issueSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  url: z.string(),
  author: z.string(),
  createdAt: z.string(),
});

const propsSchema = z.object({
  repo: z.string(),
  state: z.string(),
  issues: z.array(issueSchema),
  count: z.number(),
  winChancePercent: z.string().optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Display GitHub repo issues as a to-do list",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    invoking: "Fetching issues...",
    invoked: "Issues loaded",
  },
};

type Props = z.infer<typeof propsSchema>;

export default function RepoIssuesTodo() {
  const { props, isPending } = useWidget<Props>();

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="relative bg-surface-elevated border border-default rounded-3xl p-8">
          <h5 className="text-secondary mb-2">GitHub Issues</h5>
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

  const { repo, state, issues, winChancePercent } = props;

  return (
    <McpUseProvider autoSize>
      <div className="relative bg-surface-elevated border border-default rounded-3xl p-8">
        <h5 className="text-secondary mb-1">GitHub Issues</h5>
        <h2 className="heading-xl mb-2 font-semibold text-default">
          {repo}
        </h2>
        <div className="flex items-center justify-between gap-4 mb-6">
          <p className="text-sm text-secondary">
            {issues.length} {state} issue{issues.length !== 1 ? "s" : ""}
          </p>
          <span className="text-xs text-tertiary shrink-0">
            Next spin win chance:{" "}
            <span className="font-medium text-info">
              {winChancePercent ?? "—"}
            </span>
          </span>
        </div>

        <ul className="space-y-1">
          {issues.map((issue) => (
            <li key={issue.number}>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-primary-soft-hover transition-colors group"
              >
                {/* Plus / drag handle */}
                <span className="shrink-0 w-5 h-5 flex items-center justify-center text-tertiary text-lg leading-none">
                  +
                </span>
                {/* Vertical ellipsis (6-dot drag handle) */}
                <span
                  className="shrink-0 w-4 h-5 grid grid-cols-2 grid-rows-3 gap-px items-center justify-items-center text-tertiary text-[8px]"
                  aria-hidden
                >
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-current" />
                  ))}
                </span>
                {/* Square checkbox */}
                <span
                  className={`shrink-0 w-4 h-4 flex items-center justify-center rounded border text-xs ${
                    issue.state === "closed"
                      ? "bg-success border-success text-success-foreground"
                      : "border-secondary"
                  }`}
                  aria-hidden
                >
                  {issue.state === "closed" ? "✓" : ""}
                </span>
                {/* Issue title and meta — crossed out when closed */}
                <div
                  className={`flex-1 min-w-0 ${
                    issue.state === "closed" ? "line-through text-secondary" : ""
                  }`}
                >
                  <span
                    className={`block font-normal ${
                      issue.state === "closed" ? "" : "text-default"
                    }`}
                  >
                    {issue.title}
                  </span>
                  <span
                    className={`block text-xs mt-0.5 ${
                      issue.state === "closed" ? "" : "text-tertiary"
                    }`}
                  >
                    #{issue.number} · {issue.author}
                  </span>
                </div>
                {/* Ellipsis menu */}
                <span className="shrink-0 w-6 h-6 flex items-center justify-center text-tertiary text-lg">
                  ⋮
                </span>
              </a>
            </li>
          ))}
        </ul>

        {issues.length === 0 && (
          <p className="text-center text-secondary py-8">
            No {state} issues found.
          </p>
        )}
      </div>
    </McpUseProvider>
  );
}
