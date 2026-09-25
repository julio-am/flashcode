import { Fragment } from "react";

/** Prompts are plain text with `inline code`. */
export function Prompt({ text }: { text: string }) {
  return (
    <p className="text-[17px] leading-relaxed text-[var(--ink)]">
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded bg-[var(--chip)] px-1.5 py-0.5 font-mono [overflow-wrap:anywhere] text-[0.88em] text-[var(--code)]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
