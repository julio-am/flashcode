// Grades every problem's reference solution (must pass) and every wrong*.cpp
// (must not pass) through the configured runner. CI runs this so a broken
// harness never ships.
//
//   npm run verify                      # all problems, local g++
//   npm run verify -- vectors/concat    # only ids that start with this
import { grade } from "../src/lib/grader/grade";
import { loadCatalog } from "../src/lib/problems";
import { getRunner } from "../src/lib/runner";

async function main() {
  const filter = process.argv[2] ?? "";
  const runner = getRunner();
  const problems = [...loadCatalog().problems.values()].filter((p) => p.id.startsWith(filter));
  let failures = 0;
  const started = Date.now();

  for (const p of problems) {
    const results = [{ name: "solution.cpp", code: p.solution, shouldPass: true }]
      .concat(p.wrongs.map((w) => ({ ...w, shouldPass: false })));
    for (const r of results) {
      const g = await grade(p, r.code, runner);
      const ok = r.shouldPass ? g.status === "passed" : g.status !== "passed" && g.status !== "internal_error";
      const summary = `${g.status}${g.checks.length ? ` (${g.checks.filter((c) => c.ok).length}/${g.checks.length} checks)` : ""}`;
      console.log(`${ok ? "ok  " : "FAIL"} ${p.id} ${r.name}: ${summary}${g.timeMs != null ? ` ${g.timeMs}ms` : ""}`);
      if (!ok) {
        failures++;
        if (g.compileOutput) console.log(g.compileOutput.split("\n").slice(0, 20).join("\n"));
        if (g.message) console.log("  " + g.message);
        for (const c of g.checks.filter((c) => !c.ok)) console.log(`  x ${c.name}${c.detail ? `: ${c.detail}` : ""}`);
        if (g.stderr) console.log("  stderr: " + g.stderr.slice(0, 500));
      }
    }
  }
  console.log(`\n${problems.length} problems via ${runner.name} in ${((Date.now() - started) / 1000).toFixed(1)}s, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
