import { ThemeToggle } from "@/components/theme-toggle";
import { SignInForm } from "./signin-form";

export default function SignInPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-title text-lg font-semibold tracking-tight">DSEC</div>
          <div className="text-sm text-muted">Exec Dashboard</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-5 text-sm font-medium text-muted">
            Sign in to continue
          </h1>
          <SignInForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Internal tool · DSEC committee only
        </p>
      </div>
    </main>
  );
}
