import { redirect } from "next/navigation";
import { SignInButtons } from "@/components/SignInButtons";
import { enabledProviders } from "@/lib/auth";
import { signedInUser } from "@/lib/session";

// Only same-site paths, so the page can't be used to bounce people elsewhere.
function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const next = safeNext((await searchParams).next);
  if (await signedInUser()) redirect(next);
  const providers = enabledProviders();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to FlashCode</h1>
        <p className="text-[var(--muted)]">
          Keep your review schedule across devices. Anything you practised as a guest in this browser comes with you.
        </p>
      </div>
      {providers.length > 0 ? (
        <SignInButtons providers={providers} next={next} />
      ) : (
        <p className="text-sm text-[var(--muted)]">
          No sign-in provider is configured. Set the GitHub or Google OAuth variables from <code>.env.example</code>.
        </p>
      )}
    </div>
  );
}
