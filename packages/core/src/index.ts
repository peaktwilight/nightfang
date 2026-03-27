export { scan } from "./scanner.js";
export type { ScanEvent, ScanListener, ScanEventType } from "./scanner.js";
export { agenticScan } from "./agentic-scanner.js";
export type { AgenticScanOptions } from "./agentic-scanner.js";
export { createScanContext, addFinding, addAttackResult, finalize } from "./context.js";
export { sendPrompt, extractResponseText } from "./http.js";
export { createRuntime, ApiRuntime, ProcessRuntime } from "./runtime/index.js";
export type { Runtime, RuntimeConfig, RuntimeContext, RuntimeResult, RuntimeType } from "./runtime/index.js";
export { buildDeepScanPrompt, buildMcpAuditPrompt, buildSourceAnalysisPrompt } from "./prompts.js";

// Agent system
export { runAgentLoop, ToolExecutor, getToolsForRole, TOOL_DEFINITIONS } from "./agent/index.js";
export { discoveryPrompt, attackPrompt, verifyPrompt, reportPrompt } from "./agent/prompts.js";
export type {
  AgentRole,
  AgentConfig,
  AgentState,
  AgentMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ToolContext,
  AgentLoopOptions,
} from "./agent/index.js";

// Database
export { NightfangDB } from "./db/index.js";
export type { DBScan, DBFinding, DBTarget, DBAttackResult } from "./db/index.js";
