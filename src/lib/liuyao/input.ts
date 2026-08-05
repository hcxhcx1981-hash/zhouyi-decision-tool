import type {
  LiuyaoAdvancedReading,
  LiuyaoCastInput,
  LiuyaoQuestionInput,
  PartialYaoValues,
  YaoValue,
} from "./types";

export const YAO_POSITION_LABELS = ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"] as const;

export type LiuyaoValidationCode =
  | "QUESTION_TITLE_REQUIRED"
  | "TIME_RANGE_REQUIRED"
  | "YAO_VALUES_INCOMPLETE";

export function createEmptyYaoValues(): PartialYaoValues {
  return [null, null, null, null, null, null];
}

export function countCompletedYao(values: PartialYaoValues): number {
  return values.filter((value) => value !== null).length;
}

export function firstIncompleteYaoIndex(values: PartialYaoValues): number {
  return values.findIndex((value) => value === null);
}

export function nextYaoIndexAfterSelection(currentIndex: number): number {
  return Math.min(currentIndex + 1, 5);
}

export function isCompleteYaoValues(
  values: PartialYaoValues,
): values is LiuyaoCastInput["yaoValues"] {
  return values.every((value): value is YaoValue => value !== null);
}

export function validateLiuyaoCastDraft(
  question: LiuyaoQuestionInput,
  values: PartialYaoValues,
): LiuyaoValidationCode[] {
  const errors: LiuyaoValidationCode[] = [];
  if (!question.title.trim()) {
    errors.push("QUESTION_TITLE_REQUIRED");
  }
  if (!question.timeRange.trim()) {
    errors.push("TIME_RANGE_REQUIRED");
  }
  if (!isCompleteYaoValues(values)) {
    errors.push("YAO_VALUES_INCOMPLETE");
  }
  return errors;
}

export function toLiuyaoCastInput(
  question: LiuyaoQuestionInput,
  values: PartialYaoValues,
): LiuyaoCastInput | null {
  if (validateLiuyaoCastDraft(question, values).length > 0 || !isCompleteYaoValues(values)) {
    return null;
  }

  return {
    question: {
      title: question.title.trim(),
      detail: question.detail.trim(),
      timeRange: question.timeRange.trim(),
    },
    yaoValues: [...values],
  };
}

export function createBlockedAdvancedReading(): LiuyaoAdvancedReading {
  return {
    status: "BLOCKED_SOURCE_RULES_REQUIRED",
    naJia: null,
    shiYing: null,
    sixRelatives: null,
    sixSpirits: null,
    usefulGod: null,
    progressJudgment: null,
    obstacleJudgment: null,
    outcomeJudgment: null,
    blockingReason: "纳甲、世应、六亲、六神、用神、旺衰与进展结局规则尚未接入。",
  };
}

export function getEvidenceAvailability(
  hexagramKey: string,
  availableKeys: readonly string[],
): "AVAILABLE" | "NOT_INCLUDED" {
  return availableKeys.includes(hexagramKey) ? "AVAILABLE" : "NOT_INCLUDED";
}
