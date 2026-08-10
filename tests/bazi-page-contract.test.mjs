import assert from "node:assert/strict";
import test from "node:test";

import {
  beginBaziPageSubmission,
  resetBaziPageResolution,
  toRawBaziDeterministicInput,
} from "../src/lib/bazi/bazi-page-contract.ts";

function draft(overrides = {}) {
  return {
    calendarType: "GREGORIAN",
    localDate: "2024-01-15",
    localTime: "08:30",
    timeKnown: true,
    gender: "FEMALE",
    locationName: "仅显示",
    selectionMode: "REGISTERED_LOCATION",
    registeredLocationId: "CN-MAINLAND",
    manualIanaTimezone: null,
    foldChoice: null,
    referenceInstantUtc: "2026-08-07T12:00:00.000Z",
    ...overrides,
  };
}

test("Gregorian、registered location 与显式 reference 映射到确定性输入", () => {
  const input = toRawBaziDeterministicInput(draft());
  assert.equal(input.calendarType, "GREGORIAN");
  assert.equal(input.locationSelection.locationId, "CN-MAINLAND");
  assert.equal(input.locationSelection.claimedIanaTimezone, null);
  assert.equal(input.referenceInstantUtc, "2026-08-07T12:00:00.000Z");
});

test("未知时辰严格映射为 null，不默认午时", () => {
  const input = toRawBaziDeterministicInput(draft({ timeKnown: false, localTime: "12:00" }));
  assert.equal(input.localTime, null);
  assert.equal(input.timeKnown, false);
});

test("manual IANA 只使用显式正式选项", () => {
  const input = toRawBaziDeterministicInput(draft({
    selectionMode: "MANUAL_IANA",
    registeredLocationId: null,
    manualIanaTimezone: "America/New_York",
  }));
  assert.equal(input.locationSelection.locationId, null);
  assert.equal(input.locationSelection.claimedIanaTimezone, "America/New_York");
});

test("一次提交只调用一次注入 clock；fold 重试复用 reference", () => {
  let calls = 0;
  const clock = () => { calls += 1; return "2026-08-07T12:00:00.000Z"; };
  const first = beginBaziPageSubmission(resetBaziPageResolution(), clock);
  const fold = beginBaziPageSubmission({ ...first, foldChoice: "EARLIER" }, clock);
  assert.equal(calls, 1);
  assert.equal(first.referenceInstantUtc, "2026-08-07T12:00:00Z");
  assert.equal(fold.referenceInstantUtc, first.referenceInstantUtc);
  assert.equal(fold.foldChoice, "EARLIER");
});

test("修改出生输入时清除旧 fold 和 reference", () => {
  assert.deepEqual(resetBaziPageResolution(), { foldChoice: null, referenceInstantUtc: null });
});
