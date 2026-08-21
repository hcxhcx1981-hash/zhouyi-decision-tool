import type {
  FiveElement,
  PillarFoundationResult,
  PillarsFoundationResult,
  TenGodCanonical,
} from "../../lib/bazi/foundation-runtime-types.ts";
import type {
  CountPolicy,
  FactOnlyTerm,
  InterpretationGate,
  InterpretationProtocol,
  SafeGloss,
  VisibleHiddenPolicy,
} from "../../lib/bazi/interpretation-runtime-types.ts";

const PILLAR_LABELS = ["年干", "月干", "日干", "时干"] as const;

export type TenGodProtocolEntry =
  | { readonly gate: "SAFE_SEMANTIC_GLOSS"; readonly safeGloss: SafeGloss }
  | { readonly gate: "FACT_ONLY"; readonly factOnly: FactOnlyTerm };

export interface SafePillarRelation {
  readonly pillarLabel: (typeof PILLAR_LABELS)[number];
  readonly stemChinese: string;
  readonly tenGod: TenGodCanonical;
  readonly protocolEntry: TenGodProtocolEntry;
}

export interface HiddenStemFact {
  readonly pillarLabel: (typeof PILLAR_LABELS)[number];
  readonly branchChinese: string;
  readonly stemChinese: readonly string[];
}

export interface TenGodCountFact {
  readonly tenGod: TenGodCanonical;
  readonly count: number;
}

export interface BaziSafeInterpretationViewModel {
  readonly protocolVersion: InterpretationProtocol["version"];
  readonly dayMaster: {
    readonly chinese: string;
    readonly element: FiveElement;
    readonly gloss: SafeGloss;
  };
  readonly pillarRelations: readonly (SafePillarRelation | null)[];
  readonly hiddenStemFacts: readonly (HiddenStemFact | null)[];
  readonly safeGlosses: readonly SafeGloss[];
  readonly factOnlyTerms: readonly FactOnlyTerm[];
  readonly tenGodCounts: readonly TenGodCountFact[];
  readonly countPolicy: CountPolicy;
  readonly visibleHiddenPolicy: VisibleHiddenPolicy;
  readonly interpretationGates: Readonly<Record<InterpretationGate, string>>;
  readonly knownLimitations: readonly string[];
}

function protocolEntryFor(
  protocol: InterpretationProtocol,
  tenGod: TenGodCanonical,
): TenGodProtocolEntry {
  const safeGloss = protocol.safeGlosses.find((entry) => entry.canonicalTerm === tenGod);
  if (safeGloss) return { gate: "SAFE_SEMANTIC_GLOSS", safeGloss };
  const factOnly = protocol.factOnlyTerms.find((entry) => entry.canonicalTerm === tenGod);
  if (factOnly) return { gate: "FACT_ONLY", factOnly };
  throw new Error("INTERPRETATION_TERM_NOT_COVERED");
}

function pillarRelation(
  protocol: InterpretationProtocol,
  pillar: PillarFoundationResult | null,
  index: number,
): SafePillarRelation | null {
  if (!pillar) return null;
  return {
    pillarLabel: PILLAR_LABELS[index],
    stemChinese: pillar.stem.chinese,
    tenGod: pillar.stem.tenGod,
    protocolEntry: protocolEntryFor(protocol, pillar.stem.tenGod),
  };
}

function hiddenStemFact(
  pillar: PillarFoundationResult | null,
  index: number,
): HiddenStemFact | null {
  if (!pillar) return null;
  if (pillar.branch.hiddenStemOrderSemantics !== "NONE") {
    throw new Error("HIDDEN_STEM_ORDER_SEMANTICS_MISMATCH");
  }
  return {
    pillarLabel: PILLAR_LABELS[index],
    branchChinese: pillar.branch.chinese,
    stemChinese: pillar.branch.hiddenStems.map((stem) => stem.chinese),
  };
}

function countTenGods(pillars: readonly (PillarFoundationResult | null)[]): TenGodCountFact[] {
  const counts = new Map<TenGodCanonical, number>();
  for (const pillar of pillars) {
    if (!pillar) continue;
    counts.set(pillar.stem.tenGod, (counts.get(pillar.stem.tenGod) ?? 0) + 1);
    for (const hiddenStem of pillar.branch.hiddenStems) {
      counts.set(hiddenStem.tenGod, (counts.get(hiddenStem.tenGod) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([tenGod, count]) => ({ tenGod, count }));
}

export function deriveBaziSafeInterpretation(
  protocol: InterpretationProtocol,
  foundation: PillarsFoundationResult | null,
): BaziSafeInterpretationViewModel | null {
  if (!foundation) return null;
  const dayMasterGloss = protocol.safeGlosses.find((entry) => entry.canonicalTerm === "日主");
  if (!dayMasterGloss) throw new Error("DAY_MASTER_SAFE_GLOSS_MISSING");
  const pillars = [foundation.year, foundation.month, foundation.day, foundation.hour] as const;
  return {
    protocolVersion: protocol.version,
    dayMaster: {
      chinese: foundation.day.stem.chinese,
      element: foundation.day.stem.element,
      gloss: dayMasterGloss,
    },
    pillarRelations: pillars.map((pillar, index) => pillarRelation(protocol, pillar, index)),
    hiddenStemFacts: pillars.map((pillar, index) => hiddenStemFact(pillar, index)),
    safeGlosses: protocol.safeGlosses,
    factOnlyTerms: protocol.factOnlyTerms,
    tenGodCounts: countTenGods(pillars),
    countPolicy: protocol.countPolicy,
    visibleHiddenPolicy: protocol.visibleHiddenPolicy,
    interpretationGates: protocol.interpretationGates,
    knownLimitations: protocol.knownLimitations,
  };
}
