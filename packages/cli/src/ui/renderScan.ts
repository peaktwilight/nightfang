import React, { useState, useEffect } from "react";
import { render } from "ink";
import { ScanUI } from "./ScanUI.js";
import { buildShareUrl } from "../utils.js";
import type { ScanEvent, ScanSummary, StageState, StageStatusKind, StageFinding } from "./ScanUI.js";

export type { ScanEvent, ScanSummary };

export type CommandMode = "audit" | "review" | "scan";

interface RenderScanOptions {
  version: string;
  target: string;
  depth: string;
  mode: CommandMode;
}

interface RenderScanResult {
  onEvent: (event: { type: string; stage?: string; message: string; data?: unknown }) => void;
  waitForExit: () => Promise<void>;
  setReport: (report: Record<string, unknown>) => void;
}

// Stage definitions per command mode
function getStages(mode: CommandMode): StageState[] {
  const base: StageState[] = [
    { id: "install", label: "Install", status: "pending", actions: [], findings: [] },
    { id: "npm-audit", label: "npm audit", status: "pending", actions: [], findings: [] },
    { id: "semgrep", label: "Semgrep", status: "pending", actions: [], findings: [] },
    { id: "ai-agent", label: "AI Agent", status: "pending", actions: [], findings: [] },
  ];

  if (mode === "scan") {
    return [
      { id: "discovery", label: "Discovery", status: "pending", actions: [], findings: [] },
      { id: "attack", label: "Attack", status: "pending", actions: [], findings: [] },
      { id: "verify", label: "Verify", status: "pending", actions: [], findings: [] },
      { id: "report", label: "Report", status: "pending", actions: [], findings: [] },
    ];
  }

  if (mode === "review") {
    return [
      { id: "semgrep", label: "Semgrep", status: "pending", actions: [], findings: [] },
      { id: "ai-agent", label: "AI Agent", status: "pending", actions: [], findings: [] },
    ];
  }

  return base; // audit
}

// Detect which UI stage an event belongs to
function detectStageId(event: { stage?: string; message?: string }, mode: CommandMode): string | undefined {
  const msg = (event.message ?? "").toLowerCase();

  // Message-based detection (most reliable since core reuses stage names)
  if (msg.includes("install")) return "install";
  if (msg.includes("npm audit")) return "npm-audit";
  if (msg.includes("semgrep")) return "semgrep";
  if (msg.includes("agent") || msg.includes("claude") || msg.includes("codex") ||
      msg.includes("agentic") || msg.includes("ai ")) return "ai-agent";
  if (msg.includes("complete") && (msg.includes("audit") || msg.includes("review"))) return "report";

  // For scan mode, map directly
  if (mode === "scan" && event.stage) {
    const map: Record<string, string> = {
      "discovery": "discovery", "attack": "attack", "verify": "verify", "report": "report",
    };
    if (map[event.stage]) return map[event.stage];
  }

  return event.stage;
}

export function renderScanUI(opts: RenderScanOptions): RenderScanResult {
  let stages = getStages(opts.mode);
  let summary: ScanSummary | null = null;
  let thinking: string | null = null;
  let rerender: (() => void) | null = null;

  // Wrapper component that bridges external state → React
  function App() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
      rerender = () => setTick((t) => t + 1);
      return () => { rerender = null; };
    }, []);

    return React.createElement(ScanUI, { stages, summary, thinking });
  }

  const instance = render(React.createElement(App));

  function updateStage(id: string, updater: (s: StageState) => StageState) {
    stages = stages.map((s) => (s.id === id ? updater(s) : s));
    rerender?.();
  }

  function onEvent(event: { type: string; stage?: string; message: string; data?: unknown }): void {
    const stageId = detectStageId(event, opts.mode);

    switch (event.type) {
      case "stage:start": {
        if (!stageId) break;
        const current = stages.find((s) => s.id === stageId);
        const msg = event.message ?? "";

        // Tool call on already-running stage
        if (current?.status === "running" && msg.includes(":") && (
          msg.startsWith("Read") || msg.startsWith("shell") || msg.startsWith("Bash") ||
          msg.startsWith("Write") || msg.startsWith("Grep") || msg.startsWith("Glob") ||
          /^[A-Z][a-z]+:/.test(msg)
        )) {
          updateStage(stageId, (s) => ({
            ...s,
            actions: [...s.actions, msg].slice(-6),
          }));
        } else {
          updateStage(stageId, (s) => ({
            ...s,
            status: "running",
            detail: msg,
            actions: [],
          }));
        }
        break;
      }

      case "stage:end":
        if (stageId) {
          updateStage(stageId, (s) => ({
            ...s,
            status: "done",
            detail: event.message ?? s.detail,
            duration: (event.data as any)?.durationMs ?? s.duration,
          }));
        }
        break;

      case "finding": {
        // Add finding to the currently running stage
        const runningStage = stages.find((s) => s.status === "running");
        if (runningStage) {
          updateStage(runningStage.id, (s) => ({
            ...s,
            findings: [...s.findings, {
              severity: (event.data as any)?.severity ?? "medium",
              title: event.message ?? "Finding",
            }],
          }));
        }
        break;
      }

      case "error":
        if (stageId) {
          updateStage(stageId, (s) => ({
            ...s,
            status: "error",
            error: event.message,
          }));
        }
        break;
    }

    // Show thinking text from assistant messages
    if (event.type === "thinking" && event.message) {
      thinking = event.message;
      rerender?.();
    }
  }

  function setReport(report: Record<string, unknown>): void {
    // Complete any remaining stages
    stages = stages.map((s) =>
      s.status === "pending" || s.status === "running"
        ? { ...s, status: "done" as StageStatusKind, detail: s.status === "pending" ? "skipped" : s.detail }
        : s
    );

    const rep = report as any;
    summary = {
      critical: rep.summary?.critical ?? 0,
      high: rep.summary?.high ?? 0,
      medium: rep.summary?.medium ?? 0,
      low: rep.summary?.low ?? 0,
      info: rep.summary?.info ?? 0,
      duration: rep.durationMs,
      shareUrl: buildShareUrl(rep),
    };
    rerender?.();
  }

  async function waitForExit(): Promise<void> {
    // Small delay so final render is visible
    await new Promise((r) => setTimeout(r, 100));
    instance.unmount();
    await instance.waitUntilExit();
  }

  return { onEvent, waitForExit, setReport };
}
