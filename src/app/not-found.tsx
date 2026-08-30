import Link from "next/link";

import { buttonPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">404</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Page not found</h1>
      <p className="mt-3 text-muted">That link doesn&rsquo;t go anywhere any more.</p>
      <Link href="/" className={`${buttonPrimary} mt-6`}>
        Back home
      </Link>
    </div>
  );
}
