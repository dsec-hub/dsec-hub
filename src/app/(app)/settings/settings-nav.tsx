"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/format";

type Item = { href: string; label: string };

export function SettingsNav({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <aside className="md:w-48 md:shrink-0">
      <div className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-muted/70">
        Settings
      </div>
      <nav className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-elevated text-foreground"
                  : "text-muted hover:bg-surface hover:text-foreground",
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
