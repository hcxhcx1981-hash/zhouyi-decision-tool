import type {
  BaziFoundationData,
  FiveElement,
  FoundationPillarKind,
  PillarsFoundationResult,
  TenGodCanonical,
  YinYang,
} from "../../lib/bazi/foundation-runtime-types.ts";
import type {
  InterpretationProtocol,
  SafeGloss,
} from "../../lib/bazi/interpretation-runtime-types.ts";
import type { BaziCoreResult } from "../../lib/bazi/runtime-types.ts";
import type { StrengthFactOutput } from "../../lib/bazi/strength-fact-runtime-types.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { deriveBaziStrengthFacts } from "../../lib/bazi/strength-fact-runtime.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { deriveBaziSafeInterpretation, type TenGodProtocolEntry } from "./bazi-safe-interpretation-presentation.ts";

export const BAZI_EXPLANATION_PROTOCOL_ID =
  "BAZI_EXPLANATION_ORCHESTRATION_PROTOCOL_V0_1_0" as const;
export const BAZI_EXPLANATION_PROTOCOL_VERSION = "0.1.0" as const;

export const BAZI_EXPLANATION_SECTION_IDS = [
  "A_BASIC_CHART_SUMMARY",
  "B_DAY_MASTER_GLOSS",
  "C_TEN_GOD_STRUCTURE_FACTS",
  "D_TRADITIONAL_OBSERVATION_ENTRY",
  "E_STRENGTH_FACT_ENTRY",
  "F_CURRENT_LIMITATIONS",
] as const;

export type ExplanationSectionId = (typeof BAZI_EXPLANATION_SECTION_IDS)[number];
export type ExplanationSectionStatus = "READY" | "PARTIAL" | "UNAVAILABLE" | "BLOCKED";
export type InterpretationAvailability = "LOADING" | "READY" | "ERROR";

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;
const PILLAR_KINDS = ["YEAR", "MONTH", "DAY", "HOUR"] as const;

interface ExplanationPillarSummary {
  readonly label: (typeof PILLAR_LABELS)[number];
  readonly kind: FoundationPillarKind;
  readonly text: string | null;
}

interface ExplanationTenGodRelation {
  readonly pillarLabel: (typeof PILLAR_LABELS)[number];
  readonly pillarKind: FoundationPillarKind;
  readonly stemChinese: string;
  readonly tenGod: TenGodCanonical;
  readonly protocolEntry: TenGodProtocolEntry | null;
}

interface ExplanationHiddenRelation {
  readonly pillarLabel: (typeof PILLAR_LABELS)[number];
  readonly branchChinese: string;
  readonly members: readonly {
    readonly stemChinese: string;
    readonly tenGod: TenGodCanonical;
  }[];
}

export interface BaziExplanationReportViewModel {
  readonly protocolId: typeof BAZI_EXPLANATION_PROTOCOL_ID;
  readonly protocolVersion: typeof BAZI_EXPLANATION_PROTOCOL_VERSION;
  readonly reportStatus: "READY" | "PARTIAL";
  readonly sectionOrder: readonly ExplanationSectionId[];
  readonly sectionStatus: Readonly<Record<ExplanationSectionId, ExplanationSectionStatus>>;
  readonly summary: {
    readonly completeness: BaziCoreResult["completeness"];
    readonly pillars: readonly ExplanationPillarSummary[];
  };
  readonly dayMaster: {
    readonly chinese: string;
    readonly yinYang: YinYang;
    readonly element: FiveElement;
    readonly gloss: SafeGloss | null;
  };
  readonly tenGodStructure: {
    readonly relations: readonly (ExplanationTenGodRelation | null)[];
    readonly hiddenRelations: readonly (ExplanationHiddenRelation | null)[];
    readonly counts: readonly { readonly tenGod: TenGodCanonical; readonly count: number }[];
    readonly countPolicyId: "COUNT_ONLY_IS_NOT_INTERPRETATION" | null;
  };
  readonly traditionalObservation: {
    readonly safeGlosses: readonly InterpretationProtocol["safeGlosses"][number][];
    readonly factOnlyTerms: readonly InterpretationProtocol["factOnlyTerms"][number][];
  };
  readonly strengthFact: {
    readonly status: "READY" | "BLOCKED";
    readonly facts: StrengthFactOutput | null;
    readonly blockingCode: string | null;
  };
  readonly boundary: {
    readonly contextStatement: string | null;
    readonly runtimeStatement: string | null;
    readonly adapterStatement: string;
  };
  readonly sourceAudit: readonly {
    readonly sourceId: "BAZI_CHART_RUNTIME" | "FOUNDATION_FROZEN_RUNTIME" | "SAFE_INTERPRETATION_RUNTIME" | "STRENGTH_FACT_RUNTIME";
    readonly status: "READY" | "LOADING" | "ERROR" | "BLOCKED";
    readonly versionOrDataset: string;
  }[];
  readonly researchRuntimeRead: false;
}

export interface BaziExplanationRuntimeAdapterInput {
  readonly coreResult: BaziCoreResult;
  readonly foundationData: BaziFoundationData;
  readonly foundation: PillarsFoundationResult;
  readonly interpretation: InterpretationProtocol | null;
  readonly interpretationAvailability: InterpretationAvailability;
}

function foundationPillars(foundation: PillarsFoundationResult) {
  return [foundation.year, foundation.month, foundation.day, foundation.hour] as const;
}

function presentTenGods(foundation: PillarsFoundationResult): ReadonlySet<TenGodCanonical> {
  const present = new Set<TenGodCanonical>();
  for (const pillar of foundationPillars(foundation)) {
    if (!pillar) continue;
    present.add(pillar.stem.tenGod);
    for (const hiddenStem of pillar.branch.hiddenStems) present.add(hiddenStem.tenGod);
  }
  return present;
}

export function deriveBaziExplanationReport(
  input: BaziExplanationRuntimeAdapterInput,
): BaziExplanationReportViewModel | null {
  if (input.coreResult.status !== "READY") return null;
  const { yearPillar, monthPillar, dayPillar, hourPillar } = input.coreResult;
  if (!yearPillar || !monthPillar || !dayPillar) return null;

  const safeView = input.interpretation
    ? deriveBaziSafeInterpretation(input.interpretation, input.foundation)
    : null;
  const strengthResult = deriveBaziStrengthFacts({
    foundationData: input.foundationData,
    foundation: input.foundation,
    coreResult: input.coreResult,
  });
  const pillars = foundationPillars(input.foundation);
  const corePillars = [yearPillar, monthPillar, dayPillar, hourPillar] as const;
  const present = presentTenGods(input.foundation);
  const interpretationReady = input.interpretationAvailability === "READY" && safeView !== null;
  const strengthReady = strengthResult.status === "READY";

  const relations = pillars.map((pillar, index) => {
    if (!pillar) return null;
    return {
      pillarLabel: PILLAR_LABELS[index],
      pillarKind: PILLAR_KINDS[index],
      stemChinese: pillar.stem.chinese,
      tenGod: pillar.stem.tenGod,
      protocolEntry: safeView?.pillarRelations[index]?.protocolEntry ?? null,
    };
  });
  const hiddenRelations = pillars.map((pillar, index) => {
    if (!pillar) return null;
    return {
      pillarLabel: PILLAR_LABELS[index],
      branchChinese: pillar.branch.chinese,
      members: pillar.branch.hiddenStems.map((stem) => ({
        stemChinese: stem.chinese,
        tenGod: stem.tenGod,
      })),
    };
  });

  return {
    protocolId: BAZI_EXPLANATION_PROTOCOL_ID,
    protocolVersion: BAZI_EXPLANATION_PROTOCOL_VERSION,
    reportStatus: interpretationReady && strengthReady ? "READY" : "PARTIAL",
    sectionOrder: BAZI_EXPLANATION_SECTION_IDS,
    sectionStatus: {
      A_BASIC_CHART_SUMMARY: "READY",
      B_DAY_MASTER_GLOSS: interpretationReady ? "READY" : "PARTIAL",
      C_TEN_GOD_STRUCTURE_FACTS: interpretationReady ? "READY" : "PARTIAL",
      D_TRADITIONAL_OBSERVATION_ENTRY: interpretationReady ? "READY" : "UNAVAILABLE",
      E_STRENGTH_FACT_ENTRY: strengthReady ? "READY" : "BLOCKED",
      F_CURRENT_LIMITATIONS: "READY",
    },
    summary: {
      completeness: input.coreResult.completeness,
      pillars: corePillars.map((pillar, index) => ({
        label: PILLAR_LABELS[index],
        kind: PILLAR_KINDS[index],
        text: pillar?.text ?? null,
      })),
    },
    dayMaster: {
      chinese: input.foundation.day.stem.chinese,
      yinYang: input.foundation.day.stem.yinYang,
      element: input.foundation.day.stem.element,
      gloss: safeView?.dayMaster.gloss ?? null,
    },
    tenGodStructure: {
      relations,
      hiddenRelations,
      counts: safeView?.tenGodCounts ?? [],
      countPolicyId: safeView?.countPolicy.policyId ?? null,
    },
    traditionalObservation: {
      safeGlosses: safeView
        ? safeView.safeGlosses.filter(
            (entry) => entry.canonicalTerm !== "日主" && present.has(entry.canonicalTerm),
          )
        : [],
      factOnlyTerms: safeView
        ? safeView.factOnlyTerms.filter((entry) => present.has(entry.canonicalTerm))
        : [],
    },
    strengthFact: strengthReady
      ? { status: "READY", facts: strengthResult.facts, blockingCode: null }
      : { status: "BLOCKED", facts: null, blockingCode: strengthResult.blockingCode },
    boundary: {
      contextStatement: input.interpretation?.interpretationGates.CONTEXT_REQUIRED ?? null,
      runtimeStatement:
        input.interpretation?.knownLimitations.find(
          (statement) => statement === "不是个人命理解读。",
        ) ?? null,
      adapterStatement: "本报告只编排可追溯的结构事实与正式 SAFE 说明，不合成个人判断。",
    },
    sourceAudit: [
      {
        sourceId: "BAZI_CHART_RUNTIME",
        status: "READY",
        versionOrDataset: input.coreResult.audit.rulesVersion,
      },
      {
        sourceId: "FOUNDATION_FROZEN_RUNTIME",
        status: "READY",
        versionOrDataset: input.foundationData.version,
      },
      {
        sourceId: "SAFE_INTERPRETATION_RUNTIME",
        status: input.interpretationAvailability,
        versionOrDataset: input.interpretation?.version ?? "unavailable",
      },
      {
        sourceId: "STRENGTH_FACT_RUNTIME",
        status: strengthReady ? "READY" : "BLOCKED",
        versionOrDataset: strengthResult.protocol.version,
      },
    ],
    researchRuntimeRead: false,
  };
}
