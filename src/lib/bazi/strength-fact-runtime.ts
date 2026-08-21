import type {
  FoundationHeavenlyStem,
  FoundationPillarKind,
  HeavenlyStemId,
  PillarFoundationResult,
} from "./foundation-runtime-types.ts";
import type {
  HiddenStemPresenceFact,
  StemRootPresenceFact,
  StrengthFactBlockedCode,
  StrengthFactRuntimeInput,
  StrengthFactRuntimeResult,
  StrengthFactProtocol,
  VisibleStemFact,
} from "./strength-fact-runtime-types.ts";

export const BAZI_STRENGTH_FACT_PROTOCOL: StrengthFactProtocol = Object.freeze({
  protocolId: "BAZI_STRENGTH_FACT_RUNTIME_V0_1_0",
  version: "0.1.0",
  traditionScope: "ZIPING_BAZI",
  gate: "FACT_ONLY",
  allowedOutputs: Object.freeze([
    "month_order_fact",
    "stem_root_presence",
    "visible_stem_fact",
    "hidden_stem_presence_fact",
    "dependency_audit",
  ] as const),
  prohibitedOutputs: Object.freeze([
    "STRENGTH_CLASSIFICATION",
    "STRENGTH_SCORE",
    "FAVORABLE_ELEMENT",
    "PATTERN_CLASSIFICATION",
    "LUCK_PREDICTION",
    "LIFE_INTERPRETATION",
  ] as const),
});

const PILLAR_LABELS: Readonly<Record<FoundationPillarKind, string>> = Object.freeze({
  YEAR: "年干",
  MONTH: "月干",
  DAY: "日干",
  HOUR: "时干",
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function blocked(blockingCode: StrengthFactBlockedCode): StrengthFactRuntimeResult {
  return Object.freeze({
    status: "BLOCKED",
    protocol: BAZI_STRENGTH_FACT_PROTOCOL,
    blockingCode,
  });
}

function orderedPillars(input: StrengthFactRuntimeInput): readonly PillarFoundationResult[] {
  const pillars = [input.foundation.year, input.foundation.month, input.foundation.day];
  if (input.foundation.hour) pillars.push(input.foundation.hour);
  return pillars;
}

function dependenciesMatch(input: StrengthFactRuntimeInput): boolean {
  const { coreResult, foundation } = input;
  if (!coreResult.yearPillar || !coreResult.monthPillar || !coreResult.dayPillar) return false;
  const pairs = [
    [foundation.year, coreResult.yearPillar],
    [foundation.month, coreResult.monthPillar],
    [foundation.day, coreResult.dayPillar],
  ] as const;
  if (
    pairs.some(
      ([fact, core]) => fact.stem.chinese !== core.stem || fact.branch.chinese !== core.branch,
    )
  ) {
    return false;
  }
  if (coreResult.completeness === "FOUR_PILLARS") {
    return Boolean(
      foundation.hour &&
        coreResult.hourPillar &&
        foundation.hour.stem.chinese === coreResult.hourPillar.stem &&
        foundation.hour.branch.chinese === coreResult.hourPillar.branch,
    );
  }
  return coreResult.completeness === "THREE_PILLARS_ONLY" && !foundation.hour && !coreResult.hourPillar;
}

function visibleStemFacts(pillars: readonly PillarFoundationResult[]): readonly VisibleStemFact[] {
  const grouped = new Map<
    HeavenlyStemId,
    { stem: FoundationHeavenlyStem; positions: FoundationPillarKind[] }
  >();
  for (const pillar of pillars) {
    const current = grouped.get(pillar.stem.stemId);
    if (current) current.positions.push(pillar.pillar);
    else grouped.set(pillar.stem.stemId, { stem: pillar.stem, positions: [pillar.pillar] });
  }
  return [...grouped.values()].map(({ stem, positions }) => ({
    gate: "FACT_ONLY",
    stem: stem.chinese,
    stemId: stem.stemId,
    element: stem.element,
    positions,
    occurrenceCount: positions.length,
    statement: `${stem.chinese}出现在${positions.map((position) => PILLAR_LABELS[position]).join("、")}位置。`,
  }));
}

function hiddenStemFacts(
  pillars: readonly PillarFoundationResult[],
): readonly HiddenStemPresenceFact[] {
  const grouped = new Map<
    HeavenlyStemId,
    { stem: FoundationHeavenlyStem; matchedBranches: string[] }
  >();
  for (const pillar of pillars) {
    for (const hiddenStem of pillar.branch.hiddenStems) {
      const current = grouped.get(hiddenStem.stemId);
      if (current) current.matchedBranches.push(pillar.branch.chinese);
      else {
        grouped.set(hiddenStem.stemId, {
          stem: hiddenStem,
          matchedBranches: [pillar.branch.chinese],
        });
      }
    }
  }
  return [...grouped.values()].map(({ stem, matchedBranches }) => ({
    gate: "FACT_ONLY",
    stem: stem.chinese,
    stemId: stem.stemId,
    element: stem.element,
    matchedBranches,
    occurrenceCount: matchedBranches.length,
    statement: `${stem.chinese}存在于地支藏干成员集合：${matchedBranches.join("、")}。`,
  }));
}

export function stemRootPresence(
  pillars: readonly PillarFoundationResult[],
  stem: FoundationHeavenlyStem,
): StemRootPresenceFact {
  const matchedBranches = pillars
    .filter((pillar) =>
      pillar.branch.hiddenStems.some((hiddenStem) => hiddenStem.stemId === stem.stemId),
    )
    .map((pillar) => pillar.branch.chinese);
  return deepFreeze({
    gate: "FACT_ONLY",
    stem: stem.chinese,
    stemId: stem.stemId,
    element: stem.element,
    rootPresent: matchedBranches.length > 0,
    matchedBranches,
    statement:
      matchedBranches.length > 0
        ? `${stem.chinese}在地支藏干成员集合中存在对应成员。`
        : `${stem.chinese}在已知地支藏干成员集合中未发现对应成员。`,
  });
}

export function deriveBaziStrengthFacts(
  input: StrengthFactRuntimeInput,
): StrengthFactRuntimeResult {
  if (
    input.foundationData.datasetId !== "BAZI_FOUNDATION_RULES_V0_2_0" ||
    input.foundationData.version !== "0.2.0" ||
    input.foundationData.status !== "FROZEN_RUNTIME_DATA" ||
    input.foundationData.traditionScope !== "ZIPING_BAZI" ||
    !input.foundationData.frozenSha256 ||
    orderedPillars(input).some(
      (pillar) => pillar.branch.hiddenStemOrderSemantics !== "NONE",
    )
  ) {
    return blocked("STRENGTH_FACT_FOUNDATION_INTEGRITY_ERROR");
  }
  if (input.coreResult.status !== "READY") {
    return blocked("STRENGTH_FACT_CORE_NOT_READY");
  }
  if (!dependenciesMatch(input)) {
    return blocked("STRENGTH_FACT_DEPENDENCY_MISMATCH");
  }
  const matchedBoundary = input.coreResult.audit.matchedMonthBoundary;
  if (!matchedBoundary) {
    return blocked("STRENGTH_FACT_MONTH_BOUNDARY_MISSING");
  }

  const pillars = orderedPillars(input);
  const visible = visibleStemFacts(pillars);
  const hidden = hiddenStemFacts(pillars);
  const facts = {
    month_order_fact: {
      gate: "FACT_ONLY",
      monthBranch: input.foundation.month.branch.chinese,
      monthBranchId: input.foundation.month.branch.branchId,
      monthOrderName: `${input.foundation.month.branch.chinese}月`,
      jieqiBoundaryUsed: matchedBoundary,
      description:
        "传统子平体系中，月令通常指月支所承载的节气月份位置，用于后续分析参考。",
    },
    stem_root_presence: visible.map((entry) => {
      const pillar = pillars.find((candidate) => candidate.stem.stemId === entry.stemId);
      if (!pillar) throw new Error("STRENGTH_FACT_INTERNAL_INTEGRITY_ERROR");
      return stemRootPresence(pillars, pillar.stem);
    }),
    visible_stem_fact: visible,
    hidden_stem_presence_fact: hidden,
    dependency_audit: {
      gate: "FACT_ONLY",
      completeness: input.coreResult.completeness,
      knownPillars: input.coreResult.completeness === "FOUR_PILLARS" ? 4 : 3,
      foundation: {
        datasetId: input.foundationData.datasetId,
        version: input.foundationData.version,
        frozenSha256: input.foundationData.frozenSha256,
        hiddenStemOrderSemantics: "NONE",
      },
      monthBoundary: {
        rulesProtocolId: input.coreResult.audit.rulesProtocolId,
        rulesVersion: input.coreResult.audit.rulesVersion,
        datasetId: input.coreResult.audit.datasetId,
        datasetVersion: input.coreResult.audit.datasetVersion,
        matchedBoundaryUtc: matchedBoundary,
      },
      timezone: {
        resolverId: input.coreResult.audit.timezoneResolverId,
        dataVersion: input.coreResult.audit.timezoneDataVersion,
      },
      researchRuntimeRead: false,
      safeInterpretationRead: false,
    },
  } as const;
  return deepFreeze({
    status: "READY",
    protocol: BAZI_STRENGTH_FACT_PROTOCOL,
    facts,
  });
}
