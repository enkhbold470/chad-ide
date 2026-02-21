import {
  Image,
  McpUseProvider,
  useWidget,
  type WidgetMetadata,
} from "mcp-use/react";
import React, { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import "../styles.css";

const REEL_HEIGHT = 96; // h-24 = 96px
const REEL_STAGGER = 250; // ms between each reel
const SPIN_DURATION = 2200; // ms - must match CSS
const SPIN_COMPLETE_DELAY = 2 * REEL_STAGGER + SPIN_DURATION; // last reel lands

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
    const cycleCount = 6;
    const stripItems: string[] = [];
    for (let c = 0; c < cycleCount; c++) {
      stripItems.push(...syms);
    }
    const fruitIdx = syms.indexOf(finalFruit);
    const stopIdx =
      fruitIdx >= 0
        ? Math.min(4 * syms.length + fruitIdx, stripItems.length - 1)
        : 0;
    return {
      strip: stripItems,
      stopOffset: -stopIdx * REEL_HEIGHT,
    };
  }, [symbols, finalFruit]);

  const animationDelay = reelIndex * REEL_STAGGER;

  return (
    <div
      className={`slot-reel-container relative w-24 h-24 rounded-xl border overflow-hidden ${
        won ? "border-success bg-success/10" : "border-subtle bg-surface"
      }`}
    >
      <div
        className="slot-reel-strip spinning absolute left-0 top-0 flex flex-col"
        style={
          {
            "--reel-stop": `${stopOffset}px`,
            animationDelay: `${animationDelay}ms`,
          } as React.CSSProperties
        }
      >
        {strip.map((fruit, idx) => (
          <div
            key={idx}
            className="slot-reel-item flex items-center justify-center shrink-0"
            style={{ height: REEL_HEIGHT, width: 96 }}
          >
            <Image
              src={`/fruits/${fruit}.png`}
              alt={fruit}
              className="w-20 h-20 object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const propsSchema = z.object({
  reels: z.array(z.string()),
  reelImages: z.array(z.string()),
  symbols: z.array(z.string()),
  won: z.boolean(),
  issuesClosed: z.number(),
  winChanceUsed: z.number(),
  message: z.string(),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Display slot machine spin result with fruit reel images",
  props: propsSchema,
  exposeAsTool: false,
  metadata: {
    invoking: "Spinning...",
    invoked: "Spin complete",
  },
};

type Props = z.infer<typeof propsSchema>;

export default function SlotMachineResult() {
  const { props, isPending } = useWidget<Props>();
  const [spinComplete, setSpinComplete] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSpinComplete(true), SPIN_COMPLETE_DELAY);
    return () => clearTimeout(t);
  }, []);

  if (isPending) {
    return (
      <McpUseProvider autoSize>
        <div className="relative bg-surface-elevated border border-default rounded-3xl p-8">
          <h5 className="text-secondary mb-4">Slot Machine</h5>
          <div className="flex justify-center gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-24 h-24 rounded-xl bg-surface animate-pulse"
              />
            ))}
          </div>
          <p className="text-secondary text-center mt-4">Spinning reels...</p>
        </div>
      </McpUseProvider>
    );
  }

  const reels = props?.reels ?? [];
  const symbols = props?.symbols ?? [];
  const won = props?.won ?? false;

  if (!reels.length) {
    return (
      <McpUseProvider autoSize>
        <div className="relative bg-surface-elevated border border-default rounded-3xl p-8 text-center text-secondary">
          No results
        </div>
      </McpUseProvider>
    );
  }

  return (
    <McpUseProvider autoSize>
      <div
        className={`relative bg-surface-elevated border rounded-3xl p-8 ${
          won ? "border-success/50" : "border-default"
        }`}
      >
        <p className="text-xs text-tertiary text-center mb-3">
          Next spin win chance:{" "}
          <span className="font-medium text-info">
            {(props.winChanceUsed * 100).toFixed(1)}%
          </span>
        </p>
        {/* Reels */}
        <div className="flex justify-center items-center gap-4 mb-4">
          {reels.map((fruit, i) => (
            <SpinningReel
              key={i}
              symbols={symbols}
              finalFruit={fruit}
              reelIndex={i}
              won={won}
            />
          ))}
        </div>
        {spinComplete && (
          <p
            className={`text-center text-sm ${
              won ? "text-success" : "text-secondary"
            }`}
          >
            {won
              ? "Good job keep going."
              : "Working harder, contribute more, next time u will win."}
          </p>
        )}
      </div>
    </McpUseProvider>
  );
}
