export type RuntimeType = "api" | "claude" | "codex" | "gemini" | "opencode";

export interface RuntimeConfig {
  type: RuntimeType;
  timeout: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface RuntimeResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  error?: string;
}

export interface Runtime {
  readonly type: RuntimeType;
  execute(prompt: string, context?: RuntimeContext): Promise<RuntimeResult>;
  isAvailable(): Promise<boolean>;
}

export interface RuntimeContext {
  target?: string;
  findings?: string;
  templateId?: string;
  systemPrompt?: string;
}
