import Link from "next/link";

import { cn } from "@/lib/format";
import type { BadgeVariant } from "@/lib/options";

// Shared keyboard-focus ring, applied to every button variant so focus is always
// visible and consistent (WCAG 2.4.7); :focus-visible keeps it off for mouse use.
// The brand pink doubles as the on-brand focus colour.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const buttonPrimary =
  `inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60 ${focusRing}`;
export const buttonSecondary =
  `inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-elevated ${focusRing}`;
export const buttonGhost =
  `inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition-colors hover:text-foreground ${focusRing}`;
export const buttonDanger =
  `inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-60 ${focusRing}`;

export type Crumb = { label: string; href?: string };

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>
      {children}
    </div>
  );
}

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-elevated text-muted",
  accent: "bg-accent/10 text-accent-text",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
      )}
    >
      {children}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted/40">/</span>}
          {c.href ? (
            <Link href={c.href} className="transition-colors hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground/80">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-8">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * Empty state. Beyond the message it can surface a muted `icon` and an `action`
 * (usually the section's "New …" CTA) so a first-run section teaches the
 * interface instead of reading as a dead end. Both are optional, so existing
 * `<EmptyState>message</EmptyState>` call sites are unaffected.
 */
export function EmptyState({
  children,
  icon,
  action,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      {icon && <div className="text-muted/40">{icon}</div>}
      <div className="max-w-sm text-sm text-muted">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="font-title text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted/70">{hint}</div>}
    </Card>
  );
}
