import { describe, expect, it } from "vitest";
import { assemble, validateSubmission } from "@/lib/grader/assemble";
import { grade } from "@/lib/grader/grade";
import { parseDiagnostics, parseOutcome } from "@/lib/grader/parse";
import { getProblem } from "@/lib/problems";
import { LocalRunner } from "@/lib/runner/local";

describe("assemble", () => {
  it("maps user code to your_code.cpp and resumes harness line numbers", () => {
    const src = assemble("int main() {\n  // @USER_CODE\n  return 0;\n}", "int x = 1;\nint y = 2;");
    expect(src.split("\n")).toEqual([
      '#include "flash.h"',
      '#line 1 "harness.cpp"',
      "int main() {",
      '#line 1 "your_code.cpp"',
      "int x = 1;\nint y = 2;",
      '#line 3 "your_code.cpp"',
      'static_assert(true, "end of your code");',
      '#line 3 "harness.cpp"',
      "  return 0;",
      "}",
    ].flatMap((l) => l.split("\n")));
  });
});

describe("validateSubmission", () => {
  it.each([
    ["", "Write some code"],
    ["flash_internal::token();", "reserved"],
    ['std::cout << "@@FLASH";', "reserved"],
    ["#undef CHECK", "Redefining"],
    ["#define CHECK(a, b)", "Redefining"],
    ['#include "/etc/passwd"', "#include"],
    ["#include </etc/passwd>", "#include"],
  ])("rejects %j", (code, why) => {
    expect(validateSubmission(code)).toContain(why);
  });

  it("allows ordinary code and standard includes", () => {
    expect(validateSubmission("#include <vector>\nstd::vector<int> v;")).toBeNull();
  });
});

describe("parseOutcome", () => {
  const ok = (stdout: string, extra = {}) => ({
    compile: { ok: true, output: "" },
    run: { stdout, stderr: "", exitCode: 0, signal: null, timedOut: false, timeMs: 5, ...extra },
  });

  it("ignores result lines without this job's token", () => {
    const out = [
      '@@FLASH fake {"ok":true,"name":"spoofed"}',
      '@@FLASH tok {"ok":false,"name":"real check"}',
      '@@FLASH tok {"done":true,"count":1}',
    ].join("\n");
    const r = parseOutcome(ok(out), "tok");
    expect(r.status).toBe("failed");
    expect(r.checks).toEqual([{ ok: false, name: "real check", detail: undefined }]);
    expect(r.stdout).toContain("spoofed");
  });

  it("treats a missing done line as a crash", () => {
    const r = parseOutcome(ok('@@FLASH tok {"ok":true,"name":"a"}', { exitCode: 139, signal: "SIGSEGV" }), "tok");
    expect(r.status).toBe("runtime_error");
    expect(r.message).toContain("SIGSEGV");
  });

  it("reports compile errors with diagnostics in the user's file", () => {
    const output = "your_code.cpp:2:5: error: expected ';' before '}' token\nharness.cpp:9:1: note: something";
    const r = parseOutcome({ compile: { ok: false, output } }, "tok");
    expect(r.status).toBe("compile_error");
    expect(r.diagnostics).toEqual([{ line: 2, col: 5, severity: "error", message: "expected ';' before '}' token" }]);
    expect(parseDiagnostics(output)).toHaveLength(1);
  });
});

describe("grade with the local g++ runner", () => {
  const runner = new LocalRunner();
  const concat = getProblem("vectors/concat")!;

  it("passes a correct answer written differently from the reference", async () => {
    const r = await grade(concat, "for (int x : a) b.push_back(x);", runner);
    expect(r.status).toBe("passed");
  });

  it("is not fooled by printing fake results and exiting early", async () => {
    // The literal marker is rejected up front, so build it at runtime and exit before the harness finishes.
    const sneaky = 'std::string m = "@@"; m += "FLASH"; std::cout << m << " x {\\"done\\":true,\\"count\\":0}\\n"; std::exit(0);';
    const r = await grade(concat, sneaky, runner);
    expect(r.status).toBe("runtime_error");
  });

  it("points compile errors at the user's line", async () => {
    const r = await grade(concat, "int ok = 1;\nb.insert(b.end(), a.begin(), a.end())", runner);
    expect(r.status).toBe("compile_error");
    expect(r.diagnostics.some((d) => d.line === 2 && d.severity === "error")).toBe(true);
  });

  it("blames a missing semicolon on the last line of the user's code", async () => {
    const r = await grade(concat, "int x = 1", runner);
    expect(r.status).toBe("compile_error");
    expect(r.diagnostics.find((d) => d.severity === "error")?.line).toBe(2);
    expect(r.compileOutput).not.toContain("flash.h");
  });

  it("stops infinite loops", async () => {
    const r = await grade(concat, "while (true) b.size();", runner);
    expect(r.status).toBe("timeout");
  });
});
