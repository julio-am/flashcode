"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GradeResult } from "@/lib/grader/types";
import type { PublicProblem } from "@/lib/problems";
import { CodeEditor } from "./CodeEditor";
import { Prompt } from "./Prompt";

interface NextResponse {
  problem: PublicProblem;
  reason: "due" | "new" | "ahead";
  stats: { due: number; new: number; total: number };
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" }
  | { kind: "grading" }
  | { kind: "graded"; result: GradeResult };

const REASON_LABEL = { due: "Review", new: "New", ahead: "Practice ahead" } as const;
const CATEGORY_LABEL: Record<string, string> = {
  vectors: "Vector operations",
  init: "Initialization syntax",
  algorithms: "Algorithms",
};

export function Drill({ category }: { category?: string }) {
  const [current, setCurrent] = useState<NextResponse | null>(null);
  const [presentationId, setPresentationId] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [solution, setSolution] = useState<string | null>(null);
  const startedAt = useRef(0);
  const requestSeq = useRef(0);

  const loadNext = useCallback(
    async (exclude?: string) => {
      const seq = ++requestSeq.current;
      setPhase({ kind: "loading" });
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (exclude) qs.set("exclude", exclude);
      const res = await fetch(`/api/next?${qs}`);
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      if (!res.ok) {
        setPhase({ kind: "error", message: (await res.json().catch(() => null))?.error ?? "Couldn't load a problem." });
        return;
      }
      const data = (await res.json()) as NextResponse;
      if (seq !== requestSeq.current) return;
      setCurrent(data);
      setPresentationId(crypto.randomUUID());
      setCode("");
      setSolution(null);
      startedAt.current = Date.now();
      setPhase({ kind: "ready" });
    },
    [category],
  );

  useEffect(() => {
    // Fetching the first problem on mount is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNext();
  }, [loadNext]);

  const passed = phase.kind === "graded" && phase.result.status === "passed";

  const submit = useCallback(async () => {
    if (!current || phase.kind === "grading" || phase.kind === "loading") return;
    if (passed) return loadNext(current.problem.id);
    setPhase({ kind: "grading" });
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemId: current.problem.id,
        presentationId,
        code,
        elapsedMs: Date.now() - startedAt.current,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhase({ kind: "graded", result: { status: "rejected", checks: [], diagnostics: [], message: body.error ?? "Submission failed." } });
      return;
    }
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 400));
      const poll = await fetch(`/api/attempts/${body.attemptId}`);
      if (!poll.ok) continue;
      const a = (await poll.json()) as { status: string; result: GradeResult | null };
      if (a.result) {
        setPhase({ kind: "graded", result: a.result });
        return;
      }
    }
    setPhase({
      kind: "graded",
      result: { status: "internal_error", checks: [], diagnostics: [], message: "Grading is taking too long. Is the worker running?" },
    });
  }, [current, phase.kind, passed, presentationId, code, loadNext]);

  // Ctrl/Cmd+Enter works anywhere on the page, not only inside the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      void submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const reveal = async () => {
    if (!current) return;
    const res = await fetch("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: current.problem.id, presentationId }),
    });
    if (res.ok) setSolution((await res.json()).solution);
  };

  if (phase.kind === "error") {
    return <p className="text-[var(--bad)]">{phase.message}</p>;
  }
  if (!current) return <p className="text-[var(--muted)]">Loading a problem…</p>;
  const { problem, reason, stats } = current;

  return (
    <div className="flex flex-col gap-5" data-problem-id={problem.id}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-[var(--chip)] px-2.5 py-0.5 text-[var(--muted)]">{CATEGORY_LABEL[problem.category] ?? problem.category}</span>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[var(--accent)]">{REASON_LABEL[reason]}</span>
        <span className="ml-auto text-[var(--muted)]">
          {stats.due} due · {stats.new} new · {stats.total} total
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{problem.title}</h1>
        <Prompt text={problem.prompt} />
      </div>

      {problem.given && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Already in scope</span>
          <CodeEditor key={`given-${problem.id}`} value={problem.given} readOnly ariaLabel="Code already in scope" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Your code</span>
        <CodeEditor
          value={code}
          onChange={setCode}
          onSubmit={submit}
          autoFocus
          diagnostics={phase.kind === "graded" ? phase.result.diagnostics : undefined}
          placeholderText="Type your answer from memory"
          ariaLabel="Your answer"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {passed ? (
          <button onClick={() => loadNext(problem.id)} className="btn-primary">
            Next problem <kbd>⌘/Ctrl ↵</kbd>
          </button>
        ) : (
          <button onClick={submit} disabled={phase.kind === "grading" || phase.kind === "loading"} className="btn-primary">
            {phase.kind === "grading" ? "Grading…" : "Submit"} <kbd>⌘/Ctrl ↵</kbd>
          </button>
        )}
        {!solution && (
          <button onClick={reveal} className="btn-quiet">
            Show solution
          </button>
        )}
        {!passed && (
          <button onClick={() => loadNext(problem.id)} className="btn-quiet">
            Skip
          </button>
        )}
        <Link href="/" className="ml-auto text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          Change category
        </Link>
      </div>

      {phase.kind === "graded" && <ResultPanel result={phase.result} />}

      {solution && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Reference solution</span>
          <CodeEditor key={`sol-${presentationId}`} value={solution} readOnly ariaLabel="Reference solution" />
          <p className="text-sm text-[var(--muted)]">Peeking before a graded answer counts as a miss, so this one comes back sooner.</p>
        </div>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<GradeResult["status"], string> = {
  passed: "Passed",
  failed: "Not quite",
  compile_error: "Doesn't compile",
  runtime_error: "Crashed",
  timeout: "Too slow",
  rejected: "Not submitted",
  internal_error: "Grader error",
};

function ResultPanel({ result }: { result: GradeResult }) {
  const good = result.status === "passed";
  return (
    <section
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-lg border p-4 ${good ? "border-[var(--good)] bg-[var(--good-soft)]" : "border-[var(--bad)] bg-[var(--bad-soft)]"}`}
    >
      <div className="flex items-baseline gap-3">
        <h2 className={`text-lg font-semibold ${good ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{STATUS_TEXT[result.status]}</h2>
        {result.checks.length > 0 && (
          <span className="text-sm text-[var(--muted)]">
            {result.checks.filter((c) => c.ok).length} of {result.checks.length} checks
          </span>
        )}
      </div>
      {result.message && <p className="text-sm">{result.message}</p>}
      {result.checks.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {result.checks.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className={c.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}>{c.ok ? "✓" : "✗"}</span>
              <span>
                {c.name}
                {c.detail && <span className="block font-mono text-xs text-[var(--muted)]">{c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.compileOutput && <Output label="Compiler output" text={result.compileOutput} />}
      {result.stdout && <Output label="Your program printed" text={result.stdout} />}
      {result.stderr && <Output label="stderr" text={result.stderr} />}
    </section>
  );
}

function Output({ label, text }: { label: string; text: string }) {
  return (
    <details open className="text-sm">
      <summary className="cursor-pointer text-[var(--muted)]">{label}</summary>
      <pre className="mt-1.5 max-h-72 overflow-auto rounded bg-[var(--code-bg)] p-3 font-mono text-xs leading-relaxed text-[var(--code-ink)]">{text}</pre>
    </details>
  );
}
