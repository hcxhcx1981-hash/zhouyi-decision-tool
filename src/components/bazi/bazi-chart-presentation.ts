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
    readonly yinYangLabel: string;
    readonly elementLabel: string;
  };
  readonly stemTenGods: readonly ({
    readonly pillarLabel: "年干" | "月干" | "日干" | "时干";
    readonly stemChinese: string;
    readonly tenGod: string;
  } | null)[];
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
  const labels = ["年柱", "月柱", "日柱", "时柱"] as const;
  const pillarLines = pillars.map((pillar, index) => `${labels[index]}：${pillar ?? "未知"}`);
  const tenGodLines = foundation.stemTenGods.map((entry) =>
    entry ? `${entry.pillarLabel}${entry.stemChinese}：${entry.tenGod}` : "时干：未知",
  );
  return [
    "八字基础命盘",
    `出生：${formatBirthDisplay(input)}`,
    `性别：${formatGenderDisplay(input.gender)}`,
    `地点：${formatLocationDisplay(input)}`,
    `时区：${input.ianaTimezone ?? "未解析"}`,
    "",
    "四柱：",
    ...pillarLines,
    "",
    "日主：",
    `${foundation.dayMaster.chinese} · ${foundation.dayMaster.yinYangLabel} · ${foundation.dayMaster.elementLabel}`,
    "",
    "十神：",
    ...tenGodLines,
    "",
    "基础说明：",
    "当前内容仅为基础命盘结构，不包含旺衰、喜用神、大运或运势判断。",
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
