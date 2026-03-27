import type {
  ScanConfig,
  ScanContext,
  TargetInfo,
  Finding,
  AttackResult,
} from "@nightfang/shared";

export function createScanContext(config: ScanConfig): ScanContext {
  return {
    config,
    target: {
      url: config.target,
      type: "unknown",
    },
    findings: [],
    attacks: [],
    warnings: [],
    startedAt: Date.now(),
  };
}

export function addFinding(ctx: ScanContext, finding: Finding): void {
  ctx.findings.push(finding);
}

export function addAttackResult(ctx: ScanContext, result: AttackResult): void {
  ctx.attacks.push(result);
}

export function updateTarget(ctx: ScanContext, info: Partial<TargetInfo>): void {
  ctx.target = { ...ctx.target, ...info };
}

export function finalize(ctx: ScanContext): ScanContext {
  ctx.completedAt = Date.now();
  return ctx;
}
