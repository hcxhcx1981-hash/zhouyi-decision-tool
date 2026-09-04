export type YaoValue = 6 | 7 | 8 | 9;
export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";
export type YaoPolarity = "阴" | "阳";
export type SixRelative = "兄弟" | "子孙" | "妻财" | "官鬼" | "父母";
export type SixSpirit = "青龙" | "朱雀" | "勾陈" | "腾蛇" | "白虎" | "玄武";

export interface LiuyaoQuestionInput {
  title: string;
  detail: string;
  timeRange: string;
}

export interface LiuyaoCastInput {
  question: LiuyaoQuestionInput;
  yaoValues: [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue];
  dayStem: HeavenlyStem;
}

export interface LiuyaoChartLine {
  position: number;
  positionLabel: string;
  yaoValue: YaoValue;
  polarity: YaoPolarity;
  moving: boolean;
  naJia: string;
  sixRelative: SixRelative;
  sixSpirit: SixSpirit;
  shi: boolean;
  ying: boolean;
}

export interface LiuyaoHexagramIdentity {
  key: string;
  lowerTrigram: string;
  upperTrigram: string;
  palace: string;
  palaceElement: "木" | "火" | "土" | "金" | "水";
}

/** A deterministic, non-interpretive Phase 1 rule output. */
export interface LiuyaoChart {
  input: { yaoValues: [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue]; dayStem: HeavenlyStem };
  originalHexagram: LiuyaoHexagramIdentity;
  changedHexagram: LiuyaoHexagramIdentity;
  movingPositions: number[];
  shiPosition: number;
  yingPosition: number;
  lines: LiuyaoChartLine[];
  ruleLayer: "LIUYAO_PHASE1_DETERMINISTIC";
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
