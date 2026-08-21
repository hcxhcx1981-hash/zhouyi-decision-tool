export type BaziDisplayGender = "MALE" | "FEMALE";
export type BaziDisplayLocationMode = "REGISTERED_LOCATION" | "MANUAL_IANA";
export type BaziPillarTexts = readonly [string, string, string, string | null];

export interface BaziChartDisplayInput {
  localDate: string;
  localTime: string | null;
  timeKnown: boolean;
  gender: BaziDisplayGender;
  locationName: string | null;
  locationMode: BaziDisplayLocationMode;
  ianaTimezone: string | null;
}

export interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export interface BaziFoundationClipboardSummary {
  readonly dayMaster: {
    readonly chinese: string;
    readonly elementLabel: string;
  };
  readonly relationships: readonly ({
    readonly pillarLabel: "年柱" | "月柱" | "日柱" | "时柱";
    readonly tenGod: string;
    readonly isDayMaster: boolean;
  } | null)[];
  readonly traditionalObservations: readonly {
    readonly canonicalTerm: string;
    readonly plainLanguage: string;
  }[];
}

export const UNSUPPORTED_BAZI_CAPABILITIES = [
  "五行旺衰",
  "喜用神",
  "大运",
  "流年",
  "运势解读",
] as const;

export const BAZI_BROWSER_RUNTIME_VERSION = "0.1";

export function formatBaziOverview(pillars: BaziPillarTexts): string {
  return pillars.map((pillar) => pillar ?? "--").join("　");
}

export function formatBirthDisplay(input: Pick<BaziChartDisplayInput, "localDate" | "localTime" | "timeKnown">): string {
  return input.timeKnown && input.localTime ? `${input.localDate} ${input.localTime}` : `${input.localDate}（时辰未知）`;
}

export function formatLocationDisplay(input: Pick<BaziChartDisplayInput, "locationName" | "locationMode">): string {
  const name = input.locationName?.trim();
  if (input.locationMode === "REGISTERED_LOCATION") {
    return !name || name === "中国大陆" ? "中国大陆" : `中国大陆 · ${name}`;
  }
  return name || "未填写";
}

export function formatGenderDisplay(gender: BaziDisplayGender): string {
  return gender === "MALE" ? "男" : "女";
}

export function getConfirmedCapabilities(timeKnown: boolean): readonly string[] {
  return ["年柱", "月柱", "日柱", ...(timeKnown ? ["时柱"] : []), "正式 IANA 时区换算", "节气边界校验"];
}

export function buildBaziClipboardText(
  pillars: BaziPillarTexts,
  input: BaziChartDisplayInput,
  foundation: BaziFoundationClipboardSummary,
): string {
  const relationshipLines = foundation.relationships.map((entry) => {
    if (!entry) return "- 时柱：时辰未知，不生成关系";
    return entry.isDayMaster
      ? `- ${entry.pillarLabel}：日主自身`
      : `- ${entry.pillarLabel}：出现${entry.tenGod}关系`;
  });
  const observationLines = foundation.traditionalObservations.map(
    (entry) => `- ${entry.canonicalTerm}：${entry.plainLanguage}`,
  );
  return [
    "八字基础档案",
    "",
    `出生：${formatBirthDisplay(input)}`,
    `地点：${formatLocationDisplay(input)}`,
    "",
    "四柱：",
    formatBaziOverview(pillars),
    "",
    "日主：",
    `${foundation.dayMaster.chinese}${foundation.dayMaster.elementLabel}`,
    "",
    "命盘结构：",
    ...relationshipLines,
    "",
    "传统观察方向：",
    ...(observationLines.length > 0 ? observationLines : ["- 正式 SAFE 说明当前不可用"]),
    "",
    "当前版本：",
    "基础结构分析",
    "",
    "不包含：",
    "旺衰、喜用神、大运、流年等个人预测内容",
  ].join("\n");
}

export async function copyBaziChartText(text: string, clipboard: ClipboardWriter | null): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
