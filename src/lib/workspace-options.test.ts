/**
 * Pure-logic tests for validPriority (COL-HUB-04). Run:
 *
 *   npx tsx src/lib/workspace-options.test.ts
 *
 * (dsec-hub has no test runner; this is a standalone, dependency-free script,
 * in the same style as src/lib/rbac.test.ts.)
 */

import { validPriority } from "./workspace-options";

const cases: [string, string | null | undefined][] = [
  ["Urgent", "Urgent"],
  ["Low", "Low"],
  ["__none__", null],
  ["", null],
  ["urgent", undefined], // case-sensitive on purpose
  ["A".repeat(200), undefined], // the varchar(16) overflow
];
for (const [input, expected] of cases) {
  const got = validPriority(input);
  if (got !== expected) {
    throw new Error(`validPriority(${JSON.stringify(input)}) = ${got}, want ${expected}`);
  }
}
console.log("ok");
