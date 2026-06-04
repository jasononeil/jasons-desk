import { styleText } from "node:util";
import type { ProgressEvent } from "../api/open.ts";

const CLEAR_LINE = "\r\x1b[K";

export type ProgressRenderer = {
  emit: (event: ProgressEvent) => void;
  /** Writes a trailing newline if a step-start was emitted but never finished. */
  finalize: () => void;
};

/**
 * Renders progress events to a stream (typically stderr). On a TTY, step
 * labels and git progress share one rewriting line per step. Off a TTY,
 * each event becomes its own line and git-progress events are dropped.
 */
export function createProgressRenderer(
  stream: NodeJS.WriteStream,
): ProgressRenderer {
  const isTTY = !!stream.isTTY;
  let activeLabel: string | null = null;

  const arrow = isTTY ? styleText("cyan", "→") : "→";
  const check = isTTY ? styleText("green", "✓") : "✓";

  const finishActiveLine = () => {
    if (isTTY && activeLabel) stream.write("\n");
    activeLabel = null;
  };

  return {
    emit(event) {
      switch (event.kind) {
        case "step-start": {
          finishActiveLine();
          activeLabel = event.label;
          if (isTTY) {
            stream.write(`${arrow} ${event.label}`);
          } else {
            stream.write(`${arrow} ${event.label}\n`);
          }
          return;
        }
        case "git": {
          if (!isTTY || !activeLabel) return;
          const pct = `${event.progress}`.padStart(3);
          const detail = `${event.stage} ${pct}%`;
          stream.write(
            `${CLEAR_LINE}${arrow} ${activeLabel}  ${styleText("gray", detail)}`,
          );
          return;
        }
        case "step-done": {
          if (isTTY) {
            stream.write(`${CLEAR_LINE}${check} ${event.label}\n`);
          } else {
            stream.write(`${check} ${event.label}\n`);
          }
          activeLabel = null;
          return;
        }
        case "notice": {
          finishActiveLine();
          stream.write(`${event.message}\n`);
          return;
        }
      }
    },
    finalize() {
      finishActiveLine();
    },
  };
}
