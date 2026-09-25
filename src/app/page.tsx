import Link from "next/link";
import { loadCatalog } from "@/lib/problems";

export default function Home() {
  const { categories, problems } = loadCatalog();
  const counts = new Map<string, number>();
  for (const p of problems.values()) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">What do you want to drill?</h1>
        <p className="text-[var(--muted)]">
          Short prompts, typed from memory, graded by tests. Misses come back sooner; easy ones fade out.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CategoryCard href="/drill" title="Everything" blurb="Mix all categories." count={problems.size} />
        {categories.map((c) => (
          <CategoryCard key={c.id} href={`/drill?category=${c.id}`} title={c.name} blurb={c.blurb} count={counts.get(c.id) ?? 0} />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ href, title, blurb, count }: { href: string; title: string; blurb: string; count: number }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-[var(--muted)]">{count} problems</span>
      </span>
      <span className="text-sm text-[var(--muted)]">{blurb}</span>
    </Link>
  );
}
