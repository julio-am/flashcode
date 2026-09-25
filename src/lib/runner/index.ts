import { Judge0Runner, judge0ConfigFromEnv } from "./judge0";
import { LocalRunner } from "./local";
import { SandboxRunner, sandboxConfigFromEnv } from "./sandbox";
import type { Runner } from "./types";

let runner: Runner | null = null;

/**
 * FLASH_RUNNER picks where code runs: "sandbox" (production), "judge0", or
 * "local" (development only). Unset, it is "sandbox" when FLASH_SANDBOX_URL is
 * set, else "local" outside production.
 */
export function getRunner(): Runner {
  if (runner) return runner;
  const kind =
    process.env.FLASH_RUNNER ??
    (process.env.FLASH_SANDBOX_URL ? "sandbox" : process.env.NODE_ENV === "production" ? "" : "local");
  if (kind === "sandbox") {
    runner = new SandboxRunner(sandboxConfigFromEnv());
  } else if (kind === "judge0") {
    runner = new Judge0Runner(judge0ConfigFromEnv());
  } else if (kind === "local") {
    if (process.env.NODE_ENV === "production" && process.env.FLASH_ALLOW_LOCAL_RUNNER !== "1") {
      throw new Error("The local runner is not a sandbox and is disabled in production. Set FLASH_RUNNER=sandbox.");
    }
    runner = new LocalRunner();
  } else {
    throw new Error('Set FLASH_RUNNER to "sandbox" (or "judge0", or "local" for development).');
  }
  return runner;
}
