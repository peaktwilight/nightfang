export type { Runtime, RuntimeConfig, RuntimeContext, RuntimeResult, RuntimeType } from "./types.js";
export { ApiRuntime } from "./api.js";
export { ClaudeApiRuntime } from "./claude-api.js";
export { ProcessRuntime } from "./process.js";
export {
  RUNTIME_REGISTRY,
  pickRuntimeForStage,
  detectAvailableRuntimes,
  getRuntimeInfo,
} from "./registry.js";

import type { RuntimeConfig, Runtime } from "./types.js";
import { ApiRuntime } from "./api.js";
import { ProcessRuntime } from "./process.js";

export function createRuntime(config: RuntimeConfig): Runtime {
  switch (config.type) {
    case "api":
      return new ApiRuntime(config);
    case "claude":
    case "codex":
    case "gemini":
    case "opencode":
      return new ProcessRuntime(config);
  }
}
