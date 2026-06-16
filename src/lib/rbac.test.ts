/**
 * Pure-logic tests for the RBAC + object-level access decisions. These functions
 * gate every read/write in the dashboard, so they're worth pinning down. Run:
 *
 *   npx tsx src/lib/rbac.test.ts
 *
 * (dsec-app has no test runner; this is a standalone, dependency-free script.)
 */

import {
  canAccess,
  canWrite,
  isAdmin,
  isOwner,
  levelsToArrays,
  levelFor,
  sanitizeModules,
  sanitizeWriteModules,
  scopeFor,
} from "./rbac";

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (cond) passed++;
  else failures.push(name);
}
function eq(name: string, a: unknown, b: unknown) {
  check(name, JSON.stringify(a) === JSON.stringify(b));
}

// --- canAccess: module read, admin = superuser ---
check("canAccess: has module", canAccess(["projects"], "projects") === true);
check("canAccess: lacks module", canAccess(["events"], "projects") === false);
check("canAccess: admin sees all", canAccess(["admin"], "projects") === true);
check("canAccess: null modules", canAccess(null, "projects") === false);
check("canAccess: empty modules", canAccess([], "projects") === false);

// --- canWrite: write ⊆ read, admin = superuser ---
check("canWrite: read+write granted", canWrite(["projects"], ["projects"], "projects") === true);
check("canWrite: read-only denied write", canWrite(["projects"], [], "projects") === false);
check("canWrite: admin writes all", canWrite(["admin"], [], "projects") === true);
check("canWrite: no read no write", canWrite(["events"], ["events"], "projects") === false);
check("canWrite: write without read denied", canWrite([], ["projects"], "projects") === false);

// --- isAdmin ---
check("isAdmin: admin", isAdmin(["admin"]) === true);
check("isAdmin: non-admin", isAdmin(["events", "projects"]) === false);
check("isAdmin: null", isAdmin(null) === false);

// --- levelFor / levelsToArrays round-trip + write ⊆ read invariant ---
eq("levelFor: write", levelFor(["projects"], ["projects"], "projects"), "write");
eq("levelFor: read", levelFor(["projects"], [], "projects"), "read");
eq("levelFor: none", levelFor(["events"], [], "projects"), "none");

const arrays = levelsToArrays({ projects: "write", events: "read", finance: "none" });
check("levelsToArrays: write→modules", arrays.modules.includes("projects"));
check("levelsToArrays: read→modules", arrays.modules.includes("events"));
check("levelsToArrays: none excluded", !arrays.modules.includes("finance"));
check("levelsToArrays: write→writeModules", arrays.writeModules.includes("projects"));
check("levelsToArrays: read not in writeModules", !arrays.writeModules.includes("events"));

// sanitize: a forged write key not granted read must be dropped (write ⊆ read).
eq("sanitizeWriteModules: write⊆read", sanitizeWriteModules(["events"], ["projects"]), []);
eq("sanitizeModules: drops junk", sanitizeModules(["events", "nope" as never]), ["events"]);

// --- isOwner: object ownership ---
check("isOwner: match", isOwner(5, 5) === true);
check("isOwner: mismatch", isOwner(5, 6) === false);
check("isOwner: null person owns nothing", isOwner(null, 5) === false);
check("isOwner: null owner not owned", isOwner(5, null) === false);
check("isOwner: both undefined", isOwner(undefined, undefined) === false);
check("isOwner: zero is a valid id", isOwner(0, 0) === true);

// --- scopeFor: additive scoped access ---
eq("scopeFor: module → full", scopeFor(true, false), "full");
eq("scopeFor: module + owns → full", scopeFor(true, true), "full");
eq("scopeFor: no module + owns → owned", scopeFor(false, true), "owned");
eq("scopeFor: no module, owns none → none", scopeFor(false, false), "none");

if (failures.length) {
  console.error(`\n❌ ${failures.length} FAILED:\n - ${failures.join("\n - ")}`);
  process.exit(1);
}
console.log(`✅ rbac: all ${passed} assertions passed`);
