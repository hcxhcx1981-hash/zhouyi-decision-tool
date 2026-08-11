export type HeavenlyStemId =
  | "JIA"
  | "YI"
  | "BING"
  | "DING"
  | "WU"
  | "JI"
  | "GENG"
  | "XIN"
  | "REN"
  | "GUI";

export type EarthlyBranchId =
  | "ZI"
  | "CHOU"
  | "YIN"
  | "MAO"
  | "CHEN"
  | "SI"
  | "WU"
  | "WEI"
  | "SHEN"
  | "YOU"
  | "XU"
  | "HAI";

export type YinYang = "YIN" | "YANG";

export type FiveElement = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";

export type ElementRelation =
  | "SAME_ELEMENT"
  | "DAY_GENERATES_TARGET"
  | "DAY_CONTROLS_TARGET"
  | "TARGET_CONTROLS_DAY"
  | "TARGET_GENERATES_DAY";

export type PolarityRelation = "SAME_POLARITY" | "DIFFERENT_POLARITY";

export type TenGodCanonical =
  | "比肩"
  | "劫财"
  | "食神"
  | "伤官"
  | "偏财"
  | "正财"
  | "七杀"
  | "正官"
  | "偏印"
  | "正印";

export type FoundationErrorCode =
  | "FOUNDATION_UNKNOWN_STEM"
  | "FOUNDATION_UNKNOWN_BRANCH";

export interface FoundationError {
  code: FoundationErrorCode;
  input: string;
}

export type FoundationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FoundationError };

export interface FoundationHeavenlyStem {
  readonly stemId: HeavenlyStemId;
  readonly chinese: string;
  readonly yinYang: YinYang;
  readonly element: FiveElement;
}

export interface FoundationEarthlyBranch {
  readonly branchId: EarthlyBranchId;
  readonly chinese: string;
  readonly yinYang: YinYang;
  readonly element: FiveElement;
}

export interface FoundationHiddenStemSet {
  readonly branchId: EarthlyBranchId;
  readonly hiddenStemSet: readonly HeavenlyStemId[];
  readonly orderSemantics: "NONE";
}

export interface FoundationElementEdge {
  readonly from: FiveElement;
  readonly to: FiveElement;
}

export type FoundationTenGodFormula = Readonly<
  Record<ElementRelation, Readonly<Record<PolarityRelation, TenGodCanonical>>>
>;

export interface BaziFoundationData {
  readonly datasetId: "BAZI_FOUNDATION_RULES_V0_2_0";
  readonly version: "0.2.0";
  readonly status: "FROZEN_RUNTIME_DATA";
  readonly traditionScope: "ZIPING_BAZI";
  readonly frozenSha256: string;
  readonly manifestSha256: string;
  readonly heavenlyStems: readonly FoundationHeavenlyStem[];
  readonly earthlyBranches: readonly FoundationEarthlyBranch[];
  readonly hiddenStemSets: readonly FoundationHiddenStemSet[];
  readonly fiveElementRelations: Readonly<{
    generates: readonly FoundationElementEdge[];
    controls: readonly FoundationElementEdge[];
  }>;
  readonly tenGodFormula: FoundationTenGodFormula;
  readonly tenGodCanonicalNames: readonly TenGodCanonical[];
}

export interface FoundationPillarInput {
  readonly stem: HeavenlyStemId;
  readonly branch: EarthlyBranchId;
}

export interface FoundationPillarsInput {
  readonly year: FoundationPillarInput;
  readonly month: FoundationPillarInput;
  readonly day: FoundationPillarInput;
  readonly hour: FoundationPillarInput | null;
}

export interface ChinesePillarInput {
  readonly stem: string;
  readonly branch: string;
}

export type FoundationPillarKind = "YEAR" | "MONTH" | "DAY" | "HOUR";

export interface PillarFoundationResult {
  readonly pillar: FoundationPillarKind;
  readonly stem: FoundationHeavenlyStem & { readonly tenGod: TenGodCanonical };
  readonly branch: FoundationEarthlyBranch & {
    readonly hiddenStems: readonly (FoundationHeavenlyStem & {
      readonly tenGod: TenGodCanonical;
    })[];
    readonly hiddenStemOrderSemantics: "NONE";
  };
}

export interface PillarsFoundationResult {
  readonly year: PillarFoundationResult;
  readonly month: PillarFoundationResult;
  readonly day: PillarFoundationResult;
  readonly hour: PillarFoundationResult | null;
}
