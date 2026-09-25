import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { flashHeader } from "@/lib/runner/flash-header";
import { SandboxRunner, sandboxConfigFromEnv } from "@/lib/runner/sandbox";

describe("SandboxRunner", () => {
  it("posts the source with the token and flash.h's hash, and returns the runner's outcome", async () => {
    const outcome = {
      compile: { ok: true, output: "" },
      run: { stdout: "hi\n", stderr: "", exitCode: 0, signal: null, timedOut: false, timeMs: 12 },
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(outcome), { status: 200 })) as unknown as typeof fetch;
    const runner = new SandboxRunner({ url: "http://runner.internal:8080", token: "secret" }, fetchImpl);

    expect(await runner.run({ source: '#include "flash.h"\nint main() {}', stdin: "tok\n" })).toEqual(outcome);

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://runner.internal:8080/run");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ source: '#include "flash.h"\nint main() {}', stdin: "tok\n" });
    expect(body.headerSha256).toBe(createHash("sha256").update(flashHeader()).digest("hex"));
  });

  it("surfaces runner errors, such as a stale flash.h", async () => {
    const fetchImpl = (async () => new Response('{"error":"flash.h differs"}', { status: 409 })) as unknown as typeof fetch;
    const runner = new SandboxRunner({ url: "http://r", token: "t" }, fetchImpl);
    await expect(runner.run({ source: "", stdin: "" })).rejects.toThrow(/409.*flash.h differs/);
  });

  it("reads config from the environment", () => {
    const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
    expect(sandboxConfigFromEnv(env({ FLASH_SANDBOX_URL: "http://r:8080/", FLASH_SANDBOX_TOKEN: "t" }))).toEqual({
      url: "http://r:8080",
      token: "t",
    });
    expect(() => sandboxConfigFromEnv(env({ FLASH_SANDBOX_URL: "http://r" }))).toThrow(/TOKEN/);
    expect(() => sandboxConfigFromEnv(env({}))).toThrow(/URL/);
  });
});
