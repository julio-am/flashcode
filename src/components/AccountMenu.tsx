"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({ user, canSignIn }: { user: { name: string | null; image: string | null } | null; canSignIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return canSignIn ? (
      <Link href="/signin" className="btn-quiet">
        Sign in
      </Link>
    ) : null;
  }

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      {user.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
      )}
      <span className="hidden text-[var(--muted)] sm:inline">{user.name}</span>
      <button onClick={signOut} disabled={busy} className="btn-quiet">
        Sign out
      </button>
    </div>
  );
}
