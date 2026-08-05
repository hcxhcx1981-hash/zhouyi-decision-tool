export type YaoValue = 6 | 7 | 8 | 9;

export interface LiuyaoQuestionInput {
  title: string;
  detail: string;
  timeRange: string;
}

export interface LiuyaoCastInput {
  question: LiuyaoQuestionInput;
  yaoValues: [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue];
}

export type PartialYaoValues = [
  YaoValue | null,
  YaoValue | null,
  YaoValue | null,
  YaoValue | null,
  YaoValue | null,
  YaoValue | null,
];

export type LiuyaoAdvancedStatus =
  | "NOT_IMPLEMENTED"
  | "BLOCKED_SOURCE_RULES_REQUIRED"
  | "READY";

export interface LiuyaoAdvancedReading {
  status: LiuyaoAdvancedStatus;
  naJia: null;
  shiYing: null;
  sixRelatives: null;
  sixSpirits: null;
  usefulGod: null;
  progressJudgment: null;
  obstacleJudgment: null;
  outcomeJudgment: null;
  blockingReason: string;
}
