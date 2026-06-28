import { redirect } from "next/navigation";
import { after } from "next/server";

import { AppShell, type NavGroup, type NavItem } from "@/components/app-shell";
import { canSeeArchive } from "@/lib/archive";
import { getCurrentUser } from "@/lib/dal";
import { canAccess } from "@/lib/rbac";
import { canSeeProjects } from "@/lib/scope";
import { buildThemeCss } from "@/lib/theme";
import { logAccess } from "@/lib/usage";
import { getMedia } from "@/lib/workspace-queries";

// Sidebar is organised into labelled groups. Items without a `module` are
// always available; the rest are gated per module. A group with no visible
// items (everything gated away) is dropped entirely below.
type NavSection = { label: string; items: (NavItem & { module?: string })[] };

const NAV: NavSection[] = [
  {
    // Label-less lead group: a single always-available home. (The separate
    // "Overview" landing was merged into the Dashboard.)
    label: "",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/events", label: "Events", icon: "events", module: "events" },
      { href: "/tasks", label: "Tasks", icon: "tasks", module: "tasks" },
      { href: "/projects", label: "Projects", icon: "projects", module: "projects" },
      { href: "/meetings", label: "Meetings", icon: "meetings", module: "meetings" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/members", label: "Members", icon: "members", module: "members" },
      { href: "/people", label: "People", icon: "people", module: "people" },
      { href: "/partners", label: "Partners", icon: "partners", module: "partners" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/sponsors", label: "Sponsors", icon: "sponsors", module: "sponsors" },
      { href: "/finance", label: "Finance", icon: "finance", module: "finance" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/docs", label: "Docs", icon: "documents", module: "documents" },
      { href: "/links", label: "Link Tree", icon: "link", module: "links" },
    ],
  },
  {
    // Cross-cutting recovery surface: every section's archived items in one
    // place. Gated as a whole (see the `/archive` special-case below) on having
    // any archivable module; the page itself only shows the types you can access.
    label: "Archive",
    items: [
      { href: "/archive", label: "Archive", icon: "archive" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Admin", icon: "admin", module: "admin" },
    ],
  },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/signin");

  // First-run gate: a member who hasn't finished onboarding can't reach the app
  // until they do. Authoritative (fresh DB read) so an admin "reset onboarding"
  // takes effect on the user's very next navigation. The wizard lives outside
  // this route group, so there's no redirect loop.
  if (!user.onboardingCompletedAt) redirect("/onboarding");

  // Best-effort usage heartbeat — records that this member accessed the app.
  // Scheduled with `after` so the Neon INSERT runs once the response has been
  // sent rather than blocking the render (it used to sit in the critical path).
  after(() => logAccess({ id: user.id, email: user.email }));

  const name = user.name ?? user.email;
  // Profile photo for the sidebar avatar: a member's headshot is stored as a
  // person-entity media asset (role "photo"). Only costs a query for users who
  // have a linked person record; falls back to initials in the shell otherwise.
  const photoUrl = user.personId
    ? ((await getMedia("person", user.personId)).find((m) => m.role === "photo")
        ?.webpUrl ?? null)
    : null;
  // Object-level access: a project lead without the Projects module still gets a
  // Projects nav entry (showing only their led projects). Only costs a query for
  // users who lack the module. See lib/scope.ts.
  const projectsVisible = await canSeeProjects(user);

  // Gate each item by module (or scoped ownership), then drop any empty group.
  const groups: NavGroup[] = NAV.map((section) => ({
    label: section.label,
    items: section.items
      .filter((n) => {
        if (n.href === "/archive") return canSeeArchive(user.modules);
        if (!n.module) return true;
        if (n.module === "projects") return projectsVisible;
        return canAccess(user.modules, n.module);
      })
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((section) => section.items.length > 0);

  // Per-user accent / background / font / weight override (empty string when on
  // the brand default).
  const themeCss = buildThemeCss({
    themeAccent: user.themeAccent,
    themeBackground: user.themeBackground,
    themeFontTitle: user.themeFontTitle,
    themeFontBody: user.themeFontBody,
    themeWeightTitle: user.themeWeightTitle,
    themeWeightBody: user.themeWeightBody,
  });

  return (
    <>
      {themeCss ? <style>{themeCss}</style> : null}
      <AppShell
        groups={groups}
        userName={name}
        userPhotoUrl={photoUrl}
        previewRoleName={user.previewRoleName}
      >
        {children}
      </AppShell>
    </>
  );
}
