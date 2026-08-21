export type InterpretationGate =
  | "FACT_ONLY"
  | "SAFE_SEMANTIC_GLOSS"
  | "CONTEXT_REQUIRED"
  | "PROHIBITED_DIRECT_INFERENCE";

export type SafeGlossCanonicalTerm =
  | "日主"
  | "七杀"
  | "伤官"
  | "正官"
  | "正印"
  | "食神"
  | "正财";

export type FactOnlyCanonicalTerm = "比肩" | "劫财" | "偏财" | "偏印";

export interface SafeGloss {
  readonly semanticId: string;
  readonly canonicalTerm: SafeGlossCanonicalTerm;
  readonly standardExpression?: string;
  readonly plainLanguage: string;
  readonly allowedTopics: readonly string[];
  readonly gate: "SAFE_SEMANTIC_GLOSS";
  readonly sourceIds: readonly string[];
}

export interface FactOnlyTerm {
  readonly canonicalTerm: FactOnlyCanonicalTerm;
  readonly gate: "FACT_ONLY";
  readonly allowed: string;
  readonly safeGlossAvailable: false;
}

export interface CountPolicy {
  readonly policyId: "COUNT_ONLY_IS_NOT_INTERPRETATION";
  readonly gate: "FACT_ONLY";
  readonly allowedExample: string;
  readonly prohibitedModifiers: readonly string[];
  readonly appliesTo: "ALL_TEN_GODS";
}

export interface VisibleHiddenPolicy {
  readonly gate: "FACT_ONLY";
  readonly allowedStatements: readonly string[];
  readonly prohibitedInterpretations: readonly string[];
  readonly deferredGate: readonly string[];
  readonly caseI11: {
    readonly caseId: "CASE-I11";
    readonly status: "FACT_ONLY";
  };
}

export interface ProhibitedDirectInference {
  readonly text: string;
  readonly category: "DIRECT_LANGUAGE" | "SINGLE_TEN_GOD_LIFE_INFERENCE";
}

export interface InterpretationProtocol {
  readonly version: "0.1.0";
  readonly traditionScope: "ZIPING_BAZI";
  readonly frozenSha256: string;
  readonly manifestSha256: string;
  readonly safeGlosses: readonly SafeGloss[];
  readonly factOnlyTerms: readonly FactOnlyTerm[];
  readonly interpretationGates: Readonly<Record<InterpretationGate, string>>;
  readonly countPolicy: CountPolicy;
  readonly visibleHiddenPolicy: VisibleHiddenPolicy;
  readonly prohibitedDirectInferences: readonly ProhibitedDirectInference[];
  readonly contextRequiredTopics: readonly string[];
  readonly knownLimitations: readonly string[];
}
