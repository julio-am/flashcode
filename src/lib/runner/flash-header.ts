import fs from "node:fs";
import path from "node:path";

export function flashHeaderPath(): string {
  return process.env.FLASH_HEADER ?? path.join(process.cwd(), "grader", "flash.h");
}

export function flashHeader(): string {
  return fs.readFileSync(flashHeaderPath(), "utf8");
}

/** For runners that take a single file: paste the header in place of the #include. */
export function inlineFlashHeader(source: string): string {
  const header = flashHeader().replace(/^#pragma once\s*$/m, "");
  return source.replace(/^#include "flash\.h"$/m, () => header);
}
