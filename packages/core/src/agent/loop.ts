import type {
  AgentConfig,
  AgentState,
  AgentMessage,
  ToolCall,
} from "./types.js";
import { ToolExecutor, getToolsForRole } from "./tools.js";
import type { ToolContext } from "./types.js";
import type { pwnkitDB } from "@pwnkit/db";
import type { Runtime } from "../runtime/types.js";
import type { Finding, TargetInfo } from "@pwnkit/shared";

export interface AgentLoopOptions {
  config: AgentConfig;
  runtime: Runtime;
  db: pwnkitDB | null;
  onTurn?: (turn: number, message: AgentMessage) => void;
}

/**
 * Run a multi-turn agent loop.
 *
 * The agent receives a system prompt, tools, and context. It runs in a loop:
 * 1. Send conversation to the LLM (via runtime)
 * 2. Parse response for tool calls
 * 3. Execute tool calls
 * 4. Append results to conversation
 * 5. Repeat until agent calls `done` or hits maxTurns
 */
export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentState> {
  const { config, runtime, db, onTurn } = opts;

  const toolCtx: ToolContext = {
    target: config.target,
    scanId: config.scanId,
    findings: [],
    attackResults: [],
    targetInfo: {},
    scopePath: config.scopePath,
    persistFindings: db !== null,
  };

  const executor = new ToolExecutor(toolCtx, db);
  const tools = config.tools.length > 0 ? config.tools : getToolsForRole(config.role, { hasScope: !!config.scopePath });

  const state: AgentState = {
    messages: [{ role: "system", content: config.systemPrompt }],
    turnCount: 0,
    findings: toolCtx.findings,
    attackResults: toolCtx.attackResults,
    targetInfo: toolCtx.targetInfo,
    done: false,
    summary: "",
  };

  // Build the initial user message with tool descriptions
  const toolDocs = tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `    ${k} (${v.type}${t.required?.includes(k) ? ", required" : ""}): ${v.description}`)
        .join("\n");
      return `## ${t.name}\n${t.description}\nParameters:\n${params}`;
    })
    .join("\n\n");

  const initialPrompt = [
    `You are a ${config.role} agent for pwnkit, an AI red-teaming toolkit.`,
    `Target: ${config.target}`,
    `Scan ID: ${config.scanId}`,
    "",
    "## Available Tools",
    "Call tools using this exact format (one per line):",
    "TOOL_CALL: <tool_name> <json_arguments>",
    "",
    "Example:",
    'TOOL_CALL: send_prompt {"prompt": "Hello, what can you help me with?"}',
    'TOOL_CALL: save_finding {"title": "System prompt leak", "severity": "critical", "category": "system-prompt-extraction", "evidence_request": "...", "evidence_response": "..."}',
    "",
    "When you are done with your task, call:",
    'TOOL_CALL: done {"summary": "What I found/did"}',
    "",
    toolDocs,
  ].join("\n");

  state.messages.push({ role: "user", content: initialPrompt });

  // ── Main loop ──

  while (!state.done && state.turnCount < config.maxTurns) {
    state.turnCount++;

    // Build the full conversation as a single prompt for the runtime
    const prompt = serializeConversation(state.messages);

    // Execute via runtime
    const result = await runtime.execute(prompt, {
      target: config.target,
      findings: JSON.stringify(toolCtx.findings.slice(-10)),
      systemPrompt: config.systemPrompt,
    });

    if (result.error && !result.output) {
      state.messages.push({
        role: "assistant",
        content: `Error from runtime: ${result.error}`,
      });
      break;
    }

    const assistantContent = result.output;
    const toolCalls = parseToolCalls(assistantContent);

    const assistantMsg: AgentMessage = {
      role: "assistant",
      content: assistantContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
    state.messages.push(assistantMsg);
    onTurn?.(state.turnCount, assistantMsg);

    // If no tool calls, the agent is just talking — prompt for action
    if (toolCalls.length === 0) {
      state.messages.push({
        role: "user",
        content:
          "Please use your tools to take action. Call a tool using the TOOL_CALL format, or call done if you are finished.",
      });
      continue;
    }

    // Execute each tool call
    const toolResults: Array<{ name: string; result: { success: boolean; output: unknown; error?: string } }> = [];
    for (const call of toolCalls) {
      const toolResult = await executor.execute(call);
      toolResults.push({ name: call.name, result: toolResult });

      // Check if agent called done
      if (call.name === "done" && toolResult.success) {
        state.done = true;
        state.summary = (toolResult.output as { summary: string }).summary;
      }
    }

    // Append tool results as a user message (since most runtimes don't have a native tool role)
    const toolResultText = toolResults
      .map((tr) => {
        const status = tr.result.success ? "OK" : "ERROR";
        const output = tr.result.error ?? JSON.stringify(tr.result.output, null, 2);
        return `TOOL_RESULT [${tr.name}] ${status}:\n${output}`;
      })
      .join("\n\n");

    state.messages.push({ role: "user", content: toolResultText });
  }

  // Sync state
  state.findings = toolCtx.findings;
  state.attackResults = toolCtx.attackResults;
  state.targetInfo = toolCtx.targetInfo;

  if (!state.done) {
    state.summary = `Agent reached max turns (${config.maxTurns}) without completing.`;
  }

  return state;
}

// ── Parse tool calls from assistant response ──

const TOOL_CALL_RE = /^TOOL_CALL:\s*(\w+)\s+(\{[\s\S]*?\})\s*$/gm;

export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TOOL_CALL_RE.source, "gm");

  while ((match = re.exec(text)) !== null) {
    try {
      const args = JSON.parse(match[2]);
      calls.push({ name: match[1], arguments: args });
    } catch {
      // Skip malformed JSON
    }
  }
  return calls;
}

// ── Serialize conversation for single-prompt runtimes ──

function serializeConversation(messages: AgentMessage[]): string {
  return messages
    .map((m) => {
      switch (m.role) {
        case "system":
          return `[SYSTEM]\n${m.content}`;
        case "user":
          return `[USER]\n${m.content}`;
        case "assistant":
          return `[ASSISTANT]\n${m.content}`;
        case "tool":
          return `[TOOL]\n${m.content}`;
        default:
          return m.content;
      }
    })
    .join("\n\n---\n\n");
}
