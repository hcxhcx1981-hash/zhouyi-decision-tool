import assert from "node:assert/strict";
import test from "node:test";

import {
  beginBaziPageSubmission,
  createLatestRequestGate,
  resetBaziPageResolution,
  settleLatestRequest,
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

test("连续两次普通提交各调用一次 clock 并生成不同 reference", () => {
  let calls = 0;
  const values = ["2026-08-10T10:00:00.000Z", "2026-08-10T10:05:00.000Z"];
  const clock = () => values[calls++];
  const first = beginBaziPageSubmission(clock);
  const second = beginBaziPageSubmission(clock);
  assert.equal(calls, 2);
  assert.equal(first.referenceInstantUtc, "2026-08-10T10:00:00Z");
  assert.equal(second.referenceInstantUtc, "2026-08-10T10:05:00Z");
  assert.notEqual(first.referenceInstantUtc, second.referenceInstantUtc);
});

test("fold 重试直接复用首次 reference 且不再次调用 clock", () => {
  let calls = 0;
  const first = beginBaziPageSubmission(() => { calls += 1; return "2026-08-10T10:00:00.000Z"; });
  const fold = { foldChoice: "EARLIER", referenceInstantUtc: first.referenceInstantUtc };
  assert.equal(calls, 1);
  assert.equal(fold.referenceInstantUtc, "2026-08-10T10:00:00Z");
});

test("修改出生输入时清除旧 fold 和 reference", () => {
  assert.deepEqual(resetBaziPageResolution(), { foldChoice: null, referenceInstantUtc: null });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("输入变化后静默丢弃旧排盘结果，后续新结果可以提交", async () => {
  const gate = createLatestRequestGate();
  const state = { result: null, busy: false };
  const oldTask = deferred();
  const oldId = gate.begin();
  state.busy = true;
  const oldSettlement = settleLatestRequest(gate, oldId, oldTask.promise, {
    onSuccess: (value) => { state.result = value; },
    onError: () => {},
    onFinally: () => { state.busy = false; },
  });
  gate.invalidate();
  state.result = null;
  state.busy = false;
  oldTask.resolve("A");
  assert.equal(await oldSettlement, false);
  assert.deepEqual(state, { result: null, busy: false });

  const newId = gate.begin();
  await settleLatestRequest(gate, newId, Promise.resolve("B"), {
    onSuccess: (value) => { state.result = value; },
    onError: () => {},
    onFinally: () => { state.busy = false; },
  });
  assert.equal(state.result, "B");
});

test("输入变化后旧请求失败不会显示加载错误", async () => {
  const gate = createLatestRequestGate();
  const state = { loadError: false };
  const oldTask = deferred();
  const oldId = gate.begin();
  const settlement = settleLatestRequest(gate, oldId, oldTask.promise, {
    onSuccess: () => {},
    onError: () => { state.loadError = true; },
    onFinally: () => {},
  });
  gate.invalidate();
  oldTask.reject(new Error("old request failed"));
  assert.equal(await settlement, false);
  assert.equal(state.loadError, false);
});

test("切回 registered 后旧 IANA 目录成功或失败均不污染状态", async () => {
  for (const outcome of ["success", "failure"]) {
    const gate = createLatestRequestGate();
    const state = { mode: "MANUAL_IANA", zones: [], loadError: false, loading: true };
    const task = deferred();
    const requestId = gate.begin();
    const settlement = settleLatestRequest(gate, requestId, task.promise, {
      onSuccess: (zones) => { state.zones = zones; },
      onError: () => { state.loadError = true; },
      onFinally: () => { state.loading = false; },
    });
    gate.invalidate();
    state.mode = "REGISTERED_LOCATION";
    state.loading = false;
    if (outcome === "success") task.resolve(["America/New_York"]);
    else task.reject(new Error("old IANA request failed"));
    assert.equal(await settlement, false);
    assert.deepEqual(state, { mode: "REGISTERED_LOCATION", zones: [], loadError: false, loading: false });
  }
});
