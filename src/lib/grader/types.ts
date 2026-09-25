export interface CaseCheck {
  ok: boolean;
  /** Plain-language description of what is being checked, shown behind a Hint button. */
  hint: string;
  /** What the value is, e.g. "b" or "numIslands(grid)". Absent for yes/no checks. */
  label?: string;
  actual?: string;
  expected?: string;
}

export interface TestCase {
  /** 0-based, shown as "Test #0". */
  index: number;
  ok: boolean;
  inputs: { name: string; value: string }[];
  checks: CaseCheck[];
  /** What the program printed while this case ran. */
  console?: string;
  /** The program crashed or timed out partway through this case. */
  incomplete?: boolean;
}

export interface Diagnostic {
  line: number;
  col: number;
  severity: "error" | "warning" | "note";
  message: string;
}

export type GradeStatus =
  | "passed"
  | "failed"
  | "compile_error"
  | "runtime_error"
  | "timeout"
  | "rejected"
  | "internal_error";

export interface GradeResult {
  status: GradeStatus;
  cases: TestCase[];
  /** Compiler output, only when compilation failed. */
  compileOutput?: string;
  /** Diagnostics located in the user's code, for editor squiggles. */
  diagnostics: Diagnostic[];
  /** Anything the program printed outside a test case. */
  stdout?: string;
  stderr?: string;
  message?: string;
  timeMs?: number;
}
