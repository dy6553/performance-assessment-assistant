import test from "node:test";
import assert from "node:assert/strict";

import { resolveCareerLinkUsage } from "../src/features/assessment/career-link-policy.ts";

test("per-assignment O overrides an account default of OFF", () => {
  assert.equal(resolveCareerLinkUsage(true, false), true);
});

test("per-assignment X overrides an account default of ON", () => {
  assert.equal(resolveCareerLinkUsage(false, true), false);
});

test("an unselected assignment never enables career linking from an account default", () => {
  assert.equal(resolveCareerLinkUsage(null, true), false);
  assert.equal(resolveCareerLinkUsage(null, false), false);
  assert.equal(resolveCareerLinkUsage(undefined, true), false);
});
