"use client";

import { useState } from "react";
import type { Provider } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

const LABELS: Record<Provider, string> = { github: "Continue with GitHub", google: "Continue with Google" };

export function SignInButtons({ providers, next }: { providers: Provider[]; next: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);
    const { error } = await authClient.signIn.social({ provider, callbackURL: next });
    if (error) {
      setError(error.message ?? "Sign-in failed. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((p) => (
        <button key={p} onClick={() => signIn(p)} disabled={pending !== null} className="btn-primary justify-center">
          {pending === p ? "Redirecting…" : LABELS[p]}
        </button>
      ))}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
