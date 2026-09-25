import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { enabledProviders } from "@/lib/auth";
import { signedInUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashCode",
  description: "Quick active-recall drills for C++ syntax and core algorithms.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await signedInUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="h-[var(--header-h)] border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="flex h-full items-center px-4">
            <Link href="/" className="font-mono text-base font-semibold tracking-tight">
              flash<span className="text-[var(--accent)]">code</span>
            </Link>
            <span className="ml-3 text-sm text-[var(--muted)]">C++ recall drills</span>
            <div className="ml-auto">
              <AccountMenu
                user={user && { name: user.name ?? null, image: user.image ?? null }}
                canSignIn={enabledProviders().length > 0}
              />
            </div>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
