import { USER_CODE_MARKER } from "../problems";

export const USER_FILE = "your_code.cpp";
export const HARNESS_FILE = "harness.cpp";

/**
 * Splice the user's code into the harness at the "// @USER_CODE" line.
 * #line directives make compiler errors point at the user's own lines
 * (your_code.cpp:2) instead of a file they never saw.
 */
export function assemble(harness: string, userCode: string): string {
  const lines = harness.split("\n");
  const at = lines.findIndex((l) => USER_CODE_MARKER.test(l));
  if (at < 0) throw new Error("harness has no // @USER_CODE line");
  const code = userCode.replace(/\s+$/, "");
  return [
    '#include "flash.h"',
    `#line 1 "${HARNESS_FILE}"`,
    ...lines.slice(0, at),
    `#line 1 "${USER_FILE}"`,
    code,
    // A no-op declaration still attributed to the user's file, so a missing
    // ';' or '}' at the end of their code is reported in your_code.cpp
    // rather than deep inside the harness.
    `#line ${code.split("\n").length + 1} "${USER_FILE}"`,
    'static_assert(true, "end of your code");',
    `#line ${at + 2} "${HARNESS_FILE}"`,
    ...lines.slice(at + 1),
  ].join("\n");
}

export const MAX_CODE_LENGTH = 10_000;

/**
 * Cheap checks before anything is queued. The sandbox is the real defense;
 * these only stop obvious attempts to spoof the grader's output or read files.
 */
export function validateSubmission(code: string): string | null {
  if (!code.trim()) return "Write some code first.";
  if (code.length > MAX_CODE_LENGTH) return `Keep answers under ${MAX_CODE_LENGTH} characters.`;
  if (/flash_internal|@@FLASH/.test(code)) return "That identifier is reserved by the grader.";
  if (/^\s*#\s*undef\b/m.test(code) || /^\s*#\s*define\s+(CHECK|CHECK_EQ|FAIL|FLASH_DONE)\b/m.test(code)) {
    return "Redefining the grader's macros isn't allowed.";
  }
  for (const m of code.matchAll(/^\s*#\s*include\s*(.*)$/gm)) {
    if (!/^<[\w./+-]+>/.test(m[1]) || /\.\.|^<\//.test(m[1])) {
      return "Only standard #include <...> headers are allowed.";
    }
  }
  return null;
}
