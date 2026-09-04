export type YaoValue = 6 | 7 | 8 | 9;
export type HeavenlyStem = "甲" | "乙" | "丙" | "丁" | "戊" | "己" | "庚" | "辛" | "壬" | "癸";
export type YaoPolarity = "阴" | "阳";
export type SixRelative = "兄弟" | "子孙" | "妻财" | "官鬼" | "父母";
export type SixSpirit = "青龙" | "朱雀" | "勾陈" | "腾蛇" | "白虎" | "玄武";
export type EarthlyBranch = "子" | "丑" | "寅" | "卯" | "辰" | "巳" | "午" | "未" | "申" | "酉" | "戌" | "亥";
export type FiveElement = "木" | "火" | "土" | "金" | "水";
export type ElementRelation = "生我" | "我生" | "克我" | "我克" | "同类";
export type LiuyaoEvidenceTag = "得月" | "失月" | "得日" | "失日" | "月扶" | "月克" | "日扶" | "日克";
export type LiuyaoChangeTag = "回头生" | "回头克" | "进神" | "退神";
export type LiuyaoQuestionType = "求财" | "事业" | "合作" | "感情" | "考试" | "失物" | "其他";
export type LiuyaoUsefulGodCandidate = SixRelative | "世爻" | "应爻";

export interface LiuyaoQuestionInput {
  title: string;
  detail: string;
  timeRange: string;
  type: LiuyaoQuestionType;
}

export interface LiuyaoCastInput {
  question: LiuyaoQuestionInput;
  yaoValues: [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue];
  dayStem: HeavenlyStem;
  monthBranch: EarthlyBranch;
  dayBranch: EarthlyBranch;
}

export interface LiuyaoTemporalRelation {
  branch: EarthlyBranch;
  element: FiveElement;
  relation: ElementRelation;
  sameBranch: boolean;
  clash: boolean;
  harmony: boolean;
}

export interface LiuyaoLineEvidence {
  branch: EarthlyBranch;
  branchElement: FiveElement;
  month: LiuyaoTemporalRelation;
  day: LiuyaoTemporalRelation;
  tags: LiuyaoEvidenceTag[];
  threeHarmony: { branches: [EarthlyBranch, EarthlyBranch, EarthlyBranch]; element: Exclude<FiveElement, "土"> } | null;
  xunKong: { dayPillar: string; xun: string; emptyBranches: [EarthlyBranch, EarthlyBranch]; isEmpty: boolean };
}

export interface LiuyaoChangeEvidence {
  originalBranch: EarthlyBranch;
  changedBranch: EarthlyBranch;
  originalElement: FiveElement;
  changedElement: FiveElement;
  relationAfterChange: ElementRelation;
  tags: LiuyaoChangeTag[];
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
  evidence: LiuyaoLineEvidence;
  changeEvidence: LiuyaoChangeEvidence | null;
}

export interface LiuyaoHexagramIdentity {
  key: string;
  lowerTrigram: string;
  upperTrigram: string;
  palace: string;
  palaceElement: FiveElement;
}

/** A deterministic, non-interpretive Phase 2B rule output. */
export interface LiuyaoChart {
  input: {
    yaoValues: [YaoValue, YaoValue, YaoValue, YaoValue, YaoValue, YaoValue];
    dayStem: HeavenlyStem;
    monthBranch: EarthlyBranch;
    dayBranch: EarthlyBranch;
  };
  originalHexagram: LiuyaoHexagramIdentity;
  changedHexagram: LiuyaoHexagramIdentity;
  movingPositions: number[];
  shiPosition: number;
  yingPosition: number;
  questionEvidence: { type: LiuyaoQuestionType; usefulGodCandidates: LiuyaoUsefulGodCandidate[] };
  shiYingEvidence: {
    shiPosition: number; yingPosition: number; shiElement: FiveElement; yingElement: FiveElement;
    elementRelation: ElementRelation; clash: boolean; harmony: boolean;
  };
  xunKong: { dayPillar: string; xun: string; emptyBranches: [EarthlyBranch, EarthlyBranch] };
  lines: LiuyaoChartLine[];
  ruleLayer: "LIUYAO_PHASE2B_DETERMINISTIC";
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
