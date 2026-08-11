import type {
  BaziFoundationData,
  ChinesePillarInput,
  ElementRelation,
  FiveElement,
  FoundationEarthlyBranch,
  FoundationHeavenlyStem,
  FoundationPillarInput,
  FoundationPillarKind,
  FoundationPillarsInput,
  FoundationResult,
  HeavenlyStemId,
  PillarFoundationResult,
  PillarsFoundationResult,
  TenGodCanonical,
} from "./foundation-runtime-types.ts";

export const FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS = "NONE" as const;

function ok<T>(value: T): FoundationResult<T> {
  return { ok: true, value };
}

function unknownStem(input: string): FoundationResult<never> {
  return { ok: false, error: { code: "FOUNDATION_UNKNOWN_STEM", input } };
}

function unknownBranch(input: string): FoundationResult<never> {
  return { ok: false, error: { code: "FOUNDATION_UNKNOWN_BRANCH", input } };
}

function failIntegrity(): never {
  throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
}

export function getHeavenlyStemById(
  data: BaziFoundationData,
  stemId: string,
): FoundationResult<FoundationHeavenlyStem> {
  const matches = data.heavenlyStems.filter((stem) => stem.stemId === stemId);
  if (matches.length === 0) return unknownStem(stemId);
  if (matches.length !== 1) failIntegrity();
  return ok(matches[0]);
}

export function getHeavenlyStemByChinese(
  data: BaziFoundationData,
  chinese: string,
): FoundationResult<FoundationHeavenlyStem> {
  const matches = data.heavenlyStems.filter((stem) => stem.chinese === chinese);
  if (matches.length === 0) return unknownStem(chinese);
  if (matches.length !== 1) failIntegrity();
  return ok(matches[0]);
}

export function getEarthlyBranchById(
  data: BaziFoundationData,
  branchId: string,
): FoundationResult<FoundationEarthlyBranch> {
  const matches = data.earthlyBranches.filter((branch) => branch.branchId === branchId);
  if (matches.length === 0) return unknownBranch(branchId);
  if (matches.length !== 1) failIntegrity();
  return ok(matches[0]);
}

export function getEarthlyBranchByChinese(
  data: BaziFoundationData,
  chinese: string,
): FoundationResult<FoundationEarthlyBranch> {
  const matches = data.earthlyBranches.filter((branch) => branch.chinese === chinese);
  if (matches.length === 0) return unknownBranch(chinese);
  if (matches.length !== 1) failIntegrity();
  return ok(matches[0]);
}

export function getHiddenStemSet(
  data: BaziFoundationData,
  branchId: string,
): FoundationResult<readonly HeavenlyStemId[]> {
  const matches = data.hiddenStemSets.filter((entry) => entry.branchId === branchId);
  if (matches.length === 0) return unknownBranch(branchId);
  if (matches.length !== 1) failIntegrity();
  if (matches[0].orderSemantics !== FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS) {
    failIntegrity();
  }
  return ok(matches[0].hiddenStemSet);
}

export function resolveElementRelation(
  data: BaziFoundationData,
  dayElement: FiveElement,
  targetElement: FiveElement,
): ElementRelation {
  const matches: ElementRelation[] = [];
  if (dayElement === targetElement) {
    matches.push("SAME_ELEMENT");
  }
  if (
    data.fiveElementRelations.generates.some(
      (edge) => edge.from === dayElement && edge.to === targetElement,
    )
  ) {
    matches.push("DAY_GENERATES_TARGET");
  }
  if (
    data.fiveElementRelations.controls.some(
      (edge) => edge.from === dayElement && edge.to === targetElement,
    )
  ) {
    matches.push("DAY_CONTROLS_TARGET");
  }
  if (
    data.fiveElementRelations.controls.some(
      (edge) => edge.from === targetElement && edge.to === dayElement,
    )
  ) {
    matches.push("TARGET_CONTROLS_DAY");
  }
  if (
    data.fiveElementRelations.generates.some(
      (edge) => edge.from === targetElement && edge.to === dayElement,
    )
  ) {
    matches.push("TARGET_GENERATES_DAY");
  }
  if (matches.length !== 1) {
    failIntegrity();
  }
  return matches[0];
}

export function deriveTenGod(
  data: BaziFoundationData,
  dayStemId: string,
  targetStemId: string,
): FoundationResult<TenGodCanonical> {
  const dayStem = getHeavenlyStemById(data, dayStemId);
  if (!dayStem.ok) {
    return dayStem;
  }
  const targetStem = getHeavenlyStemById(data, targetStemId);
  if (!targetStem.ok) {
    return targetStem;
  }
  const relation = resolveElementRelation(data, dayStem.value.element, targetStem.value.element);
  const polarity =
    dayStem.value.yinYang === targetStem.value.yinYang
      ? "SAME_POLARITY"
      : "DIFFERENT_POLARITY";
  const tenGod = data.tenGodFormula[relation]?.[polarity];
  if (!tenGod || !data.tenGodCanonicalNames.includes(tenGod)) {
    failIntegrity();
  }
  return ok(tenGod);
}

export function foundationPillarFromChinese(
  data: BaziFoundationData,
  pillar: ChinesePillarInput,
): FoundationResult<FoundationPillarInput> {
  const stem = getHeavenlyStemByChinese(data, pillar.stem);
  if (!stem.ok) {
    return stem;
  }
  const branch = getEarthlyBranchByChinese(data, pillar.branch);
  if (!branch.ok) {
    return branch;
  }
  return ok({ stem: stem.value.stemId, branch: branch.value.branchId });
}

function derivePillar(
  data: BaziFoundationData,
  dayStemId: HeavenlyStemId,
  pillar: FoundationPillarInput,
  kind: FoundationPillarKind,
): FoundationResult<PillarFoundationResult> {
  const stem = getHeavenlyStemById(data, pillar.stem);
  if (!stem.ok) {
    return stem;
  }
  const branch = getEarthlyBranchById(data, pillar.branch);
  if (!branch.ok) {
    return branch;
  }
  const stemTenGod = deriveTenGod(data, dayStemId, stem.value.stemId);
  if (!stemTenGod.ok) {
    return stemTenGod;
  }
  const hiddenSet = getHiddenStemSet(data, branch.value.branchId);
  if (!hiddenSet.ok) {
    return hiddenSet;
  }
  const hiddenStems = hiddenSet.value.map((hiddenStemId) => {
    const hiddenStem = getHeavenlyStemById(data, hiddenStemId);
    const hiddenTenGod = deriveTenGod(data, dayStemId, hiddenStemId);
    if (!hiddenStem.ok || !hiddenTenGod.ok) {
      failIntegrity();
    }
    return { ...hiddenStem.value, tenGod: hiddenTenGod.value };
  });
  return ok({
    pillar: kind,
    stem: { ...stem.value, tenGod: stemTenGod.value },
    branch: {
      ...branch.value,
      hiddenStems,
      hiddenStemOrderSemantics: FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS,
    },
  });
}

export function derivePillarsFoundation(
  data: BaziFoundationData,
  pillars: FoundationPillarsInput,
): FoundationResult<PillarsFoundationResult> {
  const year = derivePillar(data, pillars.day.stem, pillars.year, "YEAR");
  if (!year.ok) return year;
  const month = derivePillar(data, pillars.day.stem, pillars.month, "MONTH");
  if (!month.ok) return month;
  const day = derivePillar(data, pillars.day.stem, pillars.day, "DAY");
  if (!day.ok) return day;
  const hour = pillars.hour
    ? derivePillar(data, pillars.day.stem, pillars.hour, "HOUR")
    : ok(null);
  if (!hour.ok) return hour;
  return ok({ year: year.value, month: month.value, day: day.value, hour: hour.value });
}
