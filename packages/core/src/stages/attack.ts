import type {
  ScanContext,
  StageResult,
  AttackTemplate,
  AttackResult,
  AttackOutcome,
} from "@nightfang/shared";
import { DEPTH_CONFIG } from "@nightfang/shared";
import type { Runtime, RuntimeContext } from "../runtime/types.js";
import { sendPrompt, extractResponseText } from "../http.js";
import { buildDeepScanPrompt, buildMcpAuditPrompt } from "../prompts.js";

export interface AttackStageResult {
  results: AttackResult[];
  templatesRun: number;
  payloadsRun: number;
}

export async function runAttacks(
  ctx: ScanContext,
  templates: AttackTemplate[],
  runtime: Runtime
): Promise<StageResult<AttackStageResult>> {
  const start = Date.now();
  const results: AttackResult[] = [];
  const depthCfg = DEPTH_CONFIG[ctx.config.depth];

  // Limit templates based on depth
  const templatesToRun = templates.slice(0, depthCfg.maxTemplates);
  let payloadsRun = 0;

  for (const template of templatesToRun) {
    const payloads = template.payloads.slice(0, depthCfg.maxPayloadsPerTemplate);

    for (const payload of payloads) {
      payloadsRun++;
      try {
        const { responseText, latencyMs } = runtime.type === "api"
          ? await executeApiAttack(ctx, payload.prompt)
          : await executeProcessAttack(runtime, ctx, template, payload.prompt);

        const outcome = evaluateResponse(responseText, template);

        const result: AttackResult = {
          templateId: template.id,
          payloadId: payload.id,
          outcome,
          request: payload.prompt,
          response: responseText,
          latencyMs,
          timestamp: Date.now(),
        };

        results.push(result);
        ctx.attacks.push(result);
      } catch (err) {
        const result: AttackResult = {
          templateId: template.id,
          payloadId: payload.id,
          outcome: "error",
          request: payload.prompt,
          response: "",
          latencyMs: 0,
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        };
        results.push(result);
        ctx.attacks.push(result);
      }
    }
  }

  return {
    stage: "attack",
    success: true,
    data: {
      results,
      templatesRun: templatesToRun.length,
      payloadsRun,
    },
    durationMs: Date.now() - start,
  };
}

/** Execute attack via direct HTTP (API mode) */
async function executeApiAttack(
  ctx: ScanContext,
  prompt: string
): Promise<{ responseText: string; latencyMs: number }> {
  const res = await sendPrompt(ctx.config.target, prompt, {
    timeout: ctx.config.timeout,
  });
  return {
    responseText: extractResponseText(res.body),
    latencyMs: res.latencyMs,
  };
}

/** Execute attack via Claude Code / Codex subprocess */
async function executeProcessAttack(
  runtime: Runtime,
  ctx: ScanContext,
  template: AttackTemplate,
  prompt: string
): Promise<{ responseText: string; latencyMs: number }> {
  // For deep scan: wrap the payload in an agent prompt that gives
  // Claude Code context about the target and what to look for
  const agentPrompt = template.category === "tool-misuse"
    ? buildMcpAuditPrompt(ctx.config.target, template, prompt)
    : buildDeepScanPrompt(ctx.config.target, template, prompt);

  const runtimeCtx: RuntimeContext = {
    target: ctx.config.target,
    templateId: template.id,
    findings: ctx.findings.length > 0
      ? JSON.stringify(ctx.findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity })))
      : undefined,
  };

  const result = await runtime.execute(agentPrompt, runtimeCtx);

  if (result.error && !result.output) {
    throw new Error(`Runtime error: ${result.error}`);
  }

  return {
    responseText: result.output,
    latencyMs: result.durationMs,
  };
}

function evaluateResponse(
  response: string,
  template: AttackTemplate
): AttackOutcome {
  const { detection } = template;

  // Check for vulnerable patterns
  for (const pattern of detection.vulnerablePatterns) {
    try {
      const re = new RegExp(pattern, "i");
      if (re.test(response)) return "vulnerable";
    } catch {
      // Invalid regex, skip
    }
  }

  // Check for safe patterns
  if (detection.safePatterns) {
    for (const pattern of detection.safePatterns) {
      try {
        const re = new RegExp(pattern, "i");
        if (re.test(response)) return "safe";
      } catch {
        // Invalid regex, skip
      }
    }
  }

  return "inconclusive";
}
