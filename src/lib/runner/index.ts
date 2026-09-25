import { Judge0Runner, judge0ConfigFromEnv } from "./judge0";
import { LocalRunner } from "./local";
import type { Runner } from "./types";

let runner: Runner | null = null;

/** FLASH_RUNNER picks where code runs: "local" (dev only) or "judge0". */
export function getRunner(): Runner {
  if (runner) return runner;
  const kind = process.env.FLASH_RUNNER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  if (kind === "judge0") {
    runner = new Judge0Runner(judge0ConfigFromEnv());
  } else if (kind === "local") {
    if (process.env.NODE_ENV === "production" && process.env.FLASH_ALLOW_LOCAL_RUNNER !== "1") {
      throw new Error("The local runner is not a sandbox and is disabled in production. Set FLASH_RUNNER=judge0.");
    }
    runner = new LocalRunner();
  } else {
    throw new Error('Set FLASH_RUNNER to "judge0" (or "local" for development).');
  }
  return runner;
}
