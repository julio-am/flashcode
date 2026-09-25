import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";

// Problems live in /problems/<category>/<slug>/ as plain files so they can be
// reviewed and diffed like code. See problems/README.md for the format.

const CategoryFile = z.array(
  z.object({ id: z.string(), name: z.string(), blurb: z.string() }),
);
const ProblemFile = z.object({
  title: z.string(),
  prompt: z.string(),
  given: z.string().optional(),
});

export type Category = z.infer<typeof CategoryFile>[number];

export interface Problem {
  id: string; // "<category>/<slug>"
  category: string;
  title: string;
  prompt: string;
  given?: string;
  harness: string;
  solution: string;
  wrongs: { name: string; code: string }[];
}

/** What the browser is allowed to see before answering. */
export interface PublicProblem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  given?: string;
}

export const USER_CODE_MARKER = /^[ \t]*\/\/ @USER_CODE[ \t]*$/m;

interface Catalog {
  categories: Category[];
  problems: Map<string, Problem>;
}

let cached: Catalog | null = null;

export function problemsDir(): string {
  return process.env.FLASH_PROBLEMS_DIR ?? path.join(process.cwd(), "problems");
}

export function loadCatalog(dir = problemsDir()): Catalog {
  if (cached && dir === problemsDir()) return cached;
  const categories = CategoryFile.parse(
    YAML.parse(fs.readFileSync(path.join(dir, "categories.yaml"), "utf8")),
  );
  const problems = new Map<string, Problem>();
  for (const cat of categories) {
    const catDir = path.join(dir, cat.id);
    if (!fs.existsSync(catDir)) continue;
    for (const slug of fs.readdirSync(catDir).sort()) {
      const pDir = path.join(catDir, slug);
      if (!fs.statSync(pDir).isDirectory()) continue;
      const read = (f: string) => fs.readFileSync(path.join(pDir, f), "utf8");
      const meta = ProblemFile.parse(YAML.parse(read("problem.yaml")));
      const harness = read("harness.cpp");
      if (!USER_CODE_MARKER.test(harness)) {
        throw new Error(`${cat.id}/${slug}/harness.cpp has no "// @USER_CODE" line`);
      }
      const wrongs = fs
        .readdirSync(pDir)
        .filter((f) => /^wrong.*\.cpp$/.test(f))
        .sort()
        .map((f) => ({ name: f, code: read(f) }));
      problems.set(`${cat.id}/${slug}`, {
        id: `${cat.id}/${slug}`,
        category: cat.id,
        title: meta.title,
        prompt: meta.prompt.trim(),
        given: meta.given?.trimEnd(),
        harness,
        solution: read("solution.cpp"),
        wrongs,
      });
    }
  }
  const catalog = { categories, problems };
  if (dir === problemsDir()) cached = catalog;
  return catalog;
}

export function getProblem(id: string): Problem | undefined {
  return loadCatalog().problems.get(id);
}

export function toPublic(p: Problem): PublicProblem {
  return { id: p.id, category: p.category, title: p.title, prompt: p.prompt, given: p.given };
}
