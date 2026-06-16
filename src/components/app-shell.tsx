"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons, type IconName } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn, initials } from "@/lib/format";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label: string; items: NavItem[] };

const STORAGE_KEY = "dsec-sidebar-collapsed";

// The collapsed preference lives in localStorage and is read as an external
// store (mirroring ThemeToggle) so there's no setState-in-effect and SSR/
// hydration match cleanly via the `false` server snapshot.
const collapseListeners = new Set<() => void>();

function subscribeCollapse(cb: () => void) {
  collapseListeners.add(cb);
  return () => collapseListeners.delete(cb);
}

function getCollapseSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCollapseServerSnapshot(): boolean {
  return false;
}

function setCollapsedStore(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* storage disabled — keep the in-page toggle working */
  }
  collapseListeners.forEach((cb) => cb());
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Which nav groups are collapsed is persisted as a JSON array of group labels.
// Read as an external store (same pattern as the sidebar collapse above) so the
// desktop sidebar and the mobile drawer stay in sync. The snapshot is the raw
// string — a stable primitive — and parsed into a Set per render via useMemo,
// which avoids the "new object every snapshot" infinite-loop trap.
const GROUPS_STORAGE_KEY = "dsec-sidebar-groups-collapsed";
const groupListeners = new Set<() => void>();

function subscribeGroups(cb: () => void) {
  groupListeners.add(cb);
  return () => groupListeners.delete(cb);
}

function getGroupsSnapshot(): string {
  try {
    return localStorage.getItem(GROUPS_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getGroupsServerSnapshot(): string {
  return "[]";
}

function parseCollapsedGroups(raw: string): Set<string> {
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function toggleGroupStore(label: string) {
  const next = parseCollapsedGroups(getGroupsSnapshot());
  if (next.has(label)) next.delete(label);
  else next.add(label);
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* storage disabled — toggle won't persist but UI still updates */
  }
  groupListeners.forEach((cb) => cb());
}

export function AppShell({
  groups,
  userName,
  userPhotoUrl,
  children,
}: {
  groups: NavGroup[];
  userName: string;
  userPhotoUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  function toggleCollapsed() {
    setCollapsedStore(!collapsed);
  }

  const closeMobile = () => setMobileOpen(false);

  // While the mobile nav drawer is open: lock body scroll, close on Escape, move
  // focus into the drawer, and restore it to the trigger on close. (Tab-trapping
  // is light here — links wrap naturally and the backdrop closes on tap.)
  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col p-3 transition-[width] duration-200 md:sticky md:top-0 md:flex md:h-dvh",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex items-center px-1 py-2", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="px-2">
              <div className="font-title text-sm font-semibold tracking-tight">DSEC</div>
              <div className="text-xs text-muted">Exec Dashboard</div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Icons.collapse className={cn("transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        <SidebarNav groups={groups} pathname={pathname} collapsed={collapsed} />

        <div className="mt-2 border-t border-border pt-2">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? userName : undefined}
          >
            <Avatar name={userName} photoUrl={userPhotoUrl} className="shrink-0" />
            {!collapsed && <div className="min-w-0 flex-1 truncate text-sm">{userName}</div>}
            {!collapsed && <ThemeToggle />}
          </div>
          <SettingsLink pathname={pathname} collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile top bar — sticky so the only nav trigger is always reachable. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-surface/60 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
        >
          <Icons.menu />
        </button>
        <span className="font-title text-sm font-semibold tracking-tight">DSEC</span>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="animate-fade-in absolute inset-0 bg-black/50"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-slide-in-left absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col border-r border-border bg-background p-3 shadow-xl"
          >
            <div className="flex items-center justify-between px-2 py-2">
              <div>
                <div className="font-title text-sm font-semibold tracking-tight">DSEC</div>
                <div className="text-xs text-muted">Exec Dashboard</div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
              >
                <Icons.close />
              </button>
            </div>
            <SidebarNav
              groups={groups}
              pathname={pathname}
              collapsed={false}
              onNavigate={closeMobile}
            />
            <div className="mt-2 border-t border-border pt-2">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <Avatar name={userName} photoUrl={userPhotoUrl} />
                <div className="min-w-0 flex-1 truncate text-sm">{userName}</div>
              </div>
              <SettingsLink pathname={pathname} collapsed={false} onNavigate={closeMobile} />
            </div>
          </aside>
        </div>
      )}

      {/* Inset content: a rounded "surface" card floating on the tinted page
          floor (md+), replacing the old hard divider between nav and content.
          On mobile it stays edge-to-edge under the top bar. */}
      <main className="min-w-0 flex-1 md:py-2 md:pr-2">
        <div className="md:h-full md:rounded-2xl md:bg-surface md:shadow-sm">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

// Sidebar avatar: shows the member's uploaded profile photo when present,
// otherwise their initials. The photo is a Supabase-hosted WebP, already sized
// and optimized upstream, so a plain <img> (no next/image remote config) is the
// right call here. If it ever fails to load we quietly fall back to initials.
function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;
  return (
    <div
      className={cn(
        "grid size-7 place-items-center overflow-hidden rounded-full bg-elevated text-xs text-muted",
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function SidebarNav({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const groupsRaw = useSyncExternalStore(
    subscribeGroups,
    getGroupsSnapshot,
    getGroupsServerSnapshot,
  );
  const collapsedGroups = useMemo(
    () => parseCollapsedGroups(groupsRaw),
    [groupsRaw],
  );

  return (
    <nav className="mt-2 flex flex-1 flex-col gap-0.5 overflow-y-auto">
      {groups.map((group, i) => {
        // A label-less group (the home item) renders its items with no header and
        // never folds. Group folding otherwise only applies to the expanded
        // sidebar — collapsed to icons there's no heading to click.
        const folded = !collapsed && !!group.label && collapsedGroups.has(group.label);
        return (
          <div key={group.label || "home"} className={cn(i > 0 && "mt-3")}>
            {collapsed ? (
              // No room for a label — a hairline rule keeps groups separated
              // (skipped for the first one).
              i > 0 && <div className="mx-2 mb-1 border-t border-border" />
            ) : group.label ? (
              <button
                type="button"
                onClick={() => toggleGroupStore(group.label)}
                aria-expanded={!folded}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted/70 transition-colors hover:text-foreground"
              >
                <span>{group.label}</span>
                <Icons.chevron
                  className={cn(
                    "size-3.5 transition-transform",
                    folded && "-rotate-90",
                  )}
                />
              </button>
            ) : null}
            {!folded && (
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = Icons[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-elevated text-foreground"
                          : "text-muted hover:bg-surface hover:text-foreground",
                      )}
                    >
                      <Icon className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SettingsLink({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, "/settings");
  return (
    <Link
      href="/settings"
      onClick={onNavigate}
      title={collapsed ? "Settings" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md py-2 text-sm transition-colors",
        collapsed ? "justify-center px-0" : "justify-start px-3",
        active
          ? "bg-elevated text-foreground"
          : "text-muted hover:bg-surface hover:text-foreground",
      )}
    >
      <Icons.settings className="shrink-0" />
      {!collapsed && "Settings"}
    </Link>
  );
}

