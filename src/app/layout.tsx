import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashCode",
  description: "Quick active-recall drills for C++ syntax and core algorithms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="h-[var(--header-h)] border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="flex h-full items-center px-4">
            <Link href="/" className="font-mono text-base font-semibold tracking-tight">
              flash<span className="text-[var(--accent)]">code</span>
            </Link>
            <span className="ml-3 text-sm text-[var(--muted)]">C++ recall drills</span>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
