"use client";

import { useState } from "react";
import type { GradeResult, TestCase } from "@/lib/grader/types";

const STATUS_TEXT: Record<GradeResult["status"], string> = {
  passed: "Accepted",
  failed: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  timeout: "Time limit exceeded",
  rejected: "Not submitted",
  internal_error: "Grader error",
};

/** LeetCode-style results: a row of numbered test cases, and the selected case's details. */
export function TestResults({ result }: { result: GradeResult }) {
  const { cases } = result;
  const firstBad = cases.findIndex((c) => !c.ok);
  const [selected, setSelected] = useState(firstBad >= 0 ? firstBad : 0);
  const good = result.status === "passed";
  const passedCount = cases.filter((c) => c.ok).length;
  const current = cases[selected];

  return (
    <section aria-live="polite" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={`text-lg font-semibold ${good ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{STATUS_TEXT[result.status]}</h2>
        {cases.length > 0 && (
          <span className="text-sm text-[var(--muted)]">
            {passedCount} / {cases.length} test cases passed
            {result.timeMs != null && ` · ${result.timeMs} ms`}
          </span>
        )}
      </div>
      {result.message && <p className="text-sm">{result.message}</p>}

      {cases.length > 0 && (
        <div role="tablist" aria-label="Test cases" className="flex flex-wrap gap-1.5">
          {cases.map((c) => (
            <button
              key={c.index}
              role="tab"
              aria-selected={c.index === selected}
              onClick={() => setSelected(c.index)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition ${
                c.index === selected
                  ? "border-[var(--ink)] bg-[var(--chip)] font-medium"
                  : "border-transparent hover:bg-[var(--chip)]"
              }`}
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${c.ok ? "bg-[var(--good)]" : "bg-[var(--bad)]"}`} />
              Test #{c.index}
              <span className="sr-only">{c.ok ? "passed" : "failed"}</span>
            </button>
          ))}
        </div>
      )}

      {current && <CaseDetail key={current.index} testCase={current} status={result.status} />}

      {result.compileOutput && <Block label="Compiler output" text={result.compileOutput} />}
      {result.stdout && <Block label="Stdout (outside any test case)" text={result.stdout} />}
      {result.stderr && <Block label="Stderr" text={result.stderr} />}
    </section>
  );
}

function CaseDetail({ testCase, status }: { testCase: TestCase; status: GradeResult["status"] }) {
  const [showHint, setShowHint] = useState(false);
  const valued = testCase.checks.filter((c) => c.label !== undefined);
  // Checks without values (for example "User needs a constructor ...") have
  // nothing else to show, so their text is the output.
  const bare = testCase.checks.filter((c) => c.label === undefined && !c.ok);
  const hints = testCase.checks.map((c) => c.hint).filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Input">
        {testCase.inputs.length ? (
          testCase.inputs.map((i) => <Value key={i.name} name={i.name} value={i.value} />)
        ) : (
          <Value value="(none: your code is checked as written)" muted />
        )}
      </Field>

      {valued.length > 0 && (
        <>
          <Field label="Output">
            {valued.map((c, k) => (
              <Value key={k} name={c.label} value={c.actual!} tone={c.ok ? undefined : "bad"} />
            ))}
          </Field>
          <Field label="Expected">
            {valued.map((c, k) => (
              <Value key={k} name={c.label} value={c.expected!} />
            ))}
          </Field>
        </>
      )}

      {bare.length > 0 && (
        <Field label="Failed">
          {bare.map((c, k) => (
            <Value key={k} value={c.hint} tone="bad" />
          ))}
        </Field>
      )}

      {testCase.incomplete && (
        <p className="text-sm text-[var(--bad)]">
          {status === "timeout" ? "This test hit the time limit before it finished." : "Your program stopped during this test."}
        </p>
      )}

      {testCase.console && <Block label="Stdout" text={testCase.console} />}

      {hints.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button onClick={() => setShowHint((s) => !s)} className="btn-quiet self-start px-2.5 py-1 text-xs" aria-expanded={showHint}>
            {showHint ? "Hide hint" : "Hint"}
          </button>
          {showHint && (
            <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
              {hints.map((h, k) => (
                <li key={k}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Value({ name, value, tone, muted }: { name?: string; value: string; tone?: "bad"; muted?: boolean }) {
  return (
    <div
      className={`rounded-md bg-[var(--chip)] px-3 py-1.5 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap ${
        tone === "bad" ? "text-[var(--bad)]" : muted ? "text-[var(--muted)]" : ""
      }`}
    >
      {name && <span className="text-[var(--muted)]">{name} = </span>}
      {value}
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
      <pre className="max-h-60 overflow-auto rounded-md bg-[var(--code-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--code-ink)]">
        {text}
      </pre>
    </div>
  );
}
