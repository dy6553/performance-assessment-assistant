import test from "node:test";
import assert from "node:assert/strict";

import { resolveCareerLinkUsage } from "../src/features/assessment/career-link-policy.ts";

test("per-assignment O overrides an account default of OFF", () => {
  assert.equal(resolveCareerLinkUsage(true, false), true);
});

test("per-assignment X overrides an account default of ON", () => {
  assert.equal(resolveCareerLinkUsage(false, true), false);
});

test("legacy null selection falls back to the account default", () => {
  assert.equal(resolveCareerLinkUsage(null, true), true);
  assert.equal(resolveCareerLinkUsage(null, false), false);
});
