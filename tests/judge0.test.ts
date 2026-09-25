import { describe, expect, it, vi } from "vitest";
import { Judge0Runner, judge0ConfigFromEnv, toOutcome } from "@/lib/runner/judge0";

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("Judge0Runner", () => {
  it("submits base64 source with the header inlined, then polls until done", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const responses = [
      { token: "abc" },
      { status: { id: 2, description: "Processing" } },
      { status: { id: 3, description: "Accepted" }, stdout: b64("hi\n"), stderr: null, compile_output: null, message: null, time: "0.012" },
    ];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(responses.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    const runner = new Judge0Runner(
      { url: "https://judge0-ce.p.rapidapi.com", apiKey: "k", apiKeyHeader: "X-RapidAPI-Key", languageId: 105, pollMs: 1 },
      fetchImpl,
    );
    const out = await runner.run({ source: '#include "flash.h"\nint main() {}', stdin: "tok\n" });

    const body = JSON.parse(String(calls[0].init!.body));
    const source = Buffer.from(body.source_code, "base64").toString();
    expect(source).toContain("#define CHECK(");
    expect(source).not.toContain('#include "flash.h"');
    expect(Buffer.from(body.stdin, "base64").toString()).toBe("tok\n");
    expect(body.language_id).toBe(105);
    expect(body.compiler_options).toContain("-std=c++23");
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers["X-RapidAPI-Key"]).toBe("k");
    expect(headers["X-RapidAPI-Host"]).toBe("judge0-ce.p.rapidapi.com");
    expect(calls).toHaveLength(3);
    expect(out.run).toMatchObject({ stdout: "hi\n", timedOut: false, timeMs: 12 });
  });

  it("maps compile errors, time limits and signals", () => {
    const base = { stdout: null, stderr: null, message: null, time: null };
    expect(toOutcome({ ...base, compile_output: b64("bad"), status: { id: 6, description: "Compilation Error" } })).toEqual({
      compile: { ok: false, output: "bad" },
    });
    expect(toOutcome({ ...base, compile_output: null, status: { id: 5, description: "Time Limit Exceeded" } }).run?.timedOut).toBe(true);
    expect(toOutcome({ ...base, compile_output: null, status: { id: 7, description: "Runtime Error (SIGSEGV)" } }).run?.signal).toBe("SIGSEGV");
  });

  it("reads config from the environment", () => {
    const cfg = judge0ConfigFromEnv({ JUDGE0_URL: "https://judge.example.com/", JUDGE0_API_KEY: "s", JUDGE0_LANGUAGE_ID: "105" } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({ url: "https://judge.example.com", apiKeyHeader: "X-Auth-Token", languageId: 105 });
    expect(() => judge0ConfigFromEnv({ JUDGE0_URL: "https://j.example.com" } as unknown as NodeJS.ProcessEnv)).toThrow(/LANGUAGE_ID/);
  });
});
