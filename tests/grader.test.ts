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
      '@@FLASH tok {"case":"begin","inputs":[]}',
      '@@FLASH fake {"ok":true,"hint":"spoofed"}',
      '@@FLASH tok {"ok":false,"hint":"real check"}',
      '@@FLASH tok {"case":"end"}',
      '@@FLASH tok {"done":true,"count":1}',
    ].join("\n");
    const r = parseOutcome(ok(out), "tok");
    expect(r.status).toBe("failed");
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0].checks).toEqual([{ ok: false, hint: "real check" }]);
    expect(r.cases[0].console).toContain("spoofed");
  });

  it("groups checks into numbered cases with inputs, values and console output", () => {
    const out = [
      "before any case",
      '@@FLASH tok {"case":"begin","inputs":[{"name":"a","value":"{1, 2}"}]}',
      "debug: a has 2",
      "",
      '@@FLASH tok {"ok":true,"hint":"h1","label":"b","actual":"{1, 2}","expected":"{1, 2}"}',
      '@@FLASH tok {"case":"end"}',
      '@@FLASH tok {"case":"begin","inputs":[]}',
      '@@FLASH tok {"ok":false,"hint":"h2","label":"b","actual":"{}","expected":"{3}"}',
      '@@FLASH tok {"case":"end"}',
      '@@FLASH tok {"done":true,"count":2}',
    ].join("\n");
    const r = parseOutcome(ok(out), "tok");
    expect(r.status).toBe("failed");
    expect(r.stdout).toBe("before any case");
    expect(r.cases.map((c) => [c.index, c.ok])).toEqual([[0, true], [1, false]]);
    expect(r.cases[0]).toMatchObject({ inputs: [{ name: "a", value: "{1, 2}" }], console: "debug: a has 2" });
    expect(r.cases[1].checks[0]).toEqual({ ok: false, hint: "h2", label: "b", actual: "{}", expected: "{3}" });
  });

  it("treats a missing done line as a crash and marks the open case incomplete", () => {
    const out = '@@FLASH tok {"case":"begin","inputs":[]}\nabout to crash';
    const r = parseOutcome(ok(out, { exitCode: 139, signal: "SIGSEGV" }), "tok");
    expect(r.status).toBe("runtime_error");
    expect(r.message).toContain("SIGSEGV");
    expect(r.cases[0]).toMatchObject({ ok: false, incomplete: true, console: "about to crash" });
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

  it("puts what the user prints into the test case that was running", async () => {
    const r = await grade(concat, 'std::cout << "size " << b.size() << "\\n";\nb.insert(b.end(), a.begin(), a.end());', runner);
    expect(r.status).toBe("passed");
    expect(r.cases.map((c) => c.console)).toEqual(["size 3", "size 2", "size 0"]);
    expect(r.cases[0].inputs).toEqual([
      { name: "a", value: "{1, 2, 3}" },
      { name: "b", value: "{4, 5, 6}" },
    ]);
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
