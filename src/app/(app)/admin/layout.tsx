import { requireAdmin } from "@/lib/dal";

import { AdminNav } from "./admin-nav";

/** Gate the entire /admin subtree to admins (authoritative DB check). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
