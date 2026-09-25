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
        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
            <Link href="/" className="font-mono text-base font-semibold tracking-tight">
              flash<span className="text-[var(--accent)]">code</span>
            </Link>
            <span className="ml-3 text-sm text-[var(--muted)]">C++ recall drills</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
