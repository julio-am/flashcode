export interface CheckResult {
  ok: boolean;
  name: string;
  detail?: string;
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
  checks: CheckResult[];
  /** Compiler output, only when compilation failed. */
  compileOutput?: string;
  /** Diagnostics located in the user's code, for editor squiggles. */
  diagnostics: Diagnostic[];
  /** Anything the user's code printed itself. */
  stdout?: string;
  stderr?: string;
  message?: string;
  timeMs?: number;
}
