import type {
  BaziFoundationData,
  EarthlyBranchId,
  FiveElement,
  FoundationPillarKind,
  HeavenlyStemId,
  PillarsFoundationResult,
} from "./foundation-runtime-types.ts";
import type { BaziCompleteness, BaziCoreResult } from "./runtime-types.ts";

export type StrengthFactGate = "FACT_ONLY";

export type StrengthFactOutputName =
  | "month_order_fact"
  | "stem_root_presence"
  | "visible_stem_fact"
  | "hidden_stem_presence_fact"
  | "dependency_audit";

export type StrengthFactBlockedCode =
  | "STRENGTH_FACT_CORE_NOT_READY"
  | "STRENGTH_FACT_DEPENDENCY_MISMATCH"
  | "STRENGTH_FACT_FOUNDATION_INTEGRITY_ERROR"
  | "STRENGTH_FACT_MONTH_BOUNDARY_MISSING";

export interface StrengthFactProtocol {
  readonly protocolId: "BAZI_STRENGTH_FACT_RUNTIME_V0_1_0";
  readonly version: "0.1.0";
  readonly traditionScope: "ZIPING_BAZI";
  readonly gate: StrengthFactGate;
  readonly allowedOutputs: readonly StrengthFactOutputName[];
  readonly prohibitedOutputs: readonly [
    "STRENGTH_CLASSIFICATION",
    "STRENGTH_SCORE",
    "FAVORABLE_ELEMENT",
    "PATTERN_CLASSIFICATION",
    "LUCK_PREDICTION",
    "LIFE_INTERPRETATION",
  ];
}

export interface MonthOrderFact {
  readonly gate: StrengthFactGate;
  readonly monthBranch: string;
  readonly monthBranchId: EarthlyBranchId;
  readonly monthOrderName: string;
  readonly jieqiBoundaryUsed: string;
  readonly description: string;
}

export interface StemRootPresenceFact {
  readonly gate: StrengthFactGate;
  readonly stem: string;
  readonly stemId: HeavenlyStemId;
  readonly element: FiveElement;
  readonly rootPresent: boolean;
  readonly matchedBranches: readonly string[];
  readonly statement: string;
}

export interface VisibleStemFact {
  readonly gate: StrengthFactGate;
  readonly stem: string;
  readonly stemId: HeavenlyStemId;
  readonly element: FiveElement;
  readonly positions: readonly FoundationPillarKind[];
  readonly occurrenceCount: number;
  readonly statement: string;
}

export interface HiddenStemPresenceFact {
  readonly gate: StrengthFactGate;
  readonly stem: string;
  readonly stemId: HeavenlyStemId;
  readonly element: FiveElement;
  readonly matchedBranches: readonly string[];
  readonly occurrenceCount: number;
  readonly statement: string;
}

export interface StrengthDependencyAudit {
  readonly gate: StrengthFactGate;
  readonly completeness: BaziCompleteness;
  readonly knownPillars: 3 | 4;
  readonly foundation: {
    readonly datasetId: "BAZI_FOUNDATION_RULES_V0_2_0";
    readonly version: "0.2.0";
    readonly frozenSha256: string;
    readonly hiddenStemOrderSemantics: "NONE";
  };
  readonly monthBoundary: {
    readonly rulesProtocolId: string;
    readonly rulesVersion: string;
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly matchedBoundaryUtc: string;
  };
  readonly timezone: {
    readonly resolverId: string;
    readonly dataVersion: string;
  };
  readonly researchRuntimeRead: false;
  readonly safeInterpretationRead: false;
}

export interface StrengthFactOutput {
  readonly month_order_fact: MonthOrderFact;
  readonly stem_root_presence: readonly StemRootPresenceFact[];
  readonly visible_stem_fact: readonly VisibleStemFact[];
  readonly hidden_stem_presence_fact: readonly HiddenStemPresenceFact[];
  readonly dependency_audit: StrengthDependencyAudit;
}

export interface StrengthFactRuntimeInput {
  readonly foundationData: Pick<
    BaziFoundationData,
    "datasetId" | "version" | "status" | "traditionScope" | "frozenSha256"
  >;
  readonly foundation: PillarsFoundationResult;
  readonly coreResult: BaziCoreResult;
}

export type StrengthFactRuntimeResult =
  | {
      readonly status: "READY";
      readonly protocol: StrengthFactProtocol;
      readonly facts: StrengthFactOutput;
    }
  | {
      readonly status: "BLOCKED";
      readonly protocol: StrengthFactProtocol;
      readonly blockingCode: StrengthFactBlockedCode;
    };
