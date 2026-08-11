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

export function buildBaziClipboardText(pillars: BaziPillarTexts, input: BaziChartDisplayInput): string {
  const labels = ["年柱", "月柱", "日柱", "时柱"] as const;
  const pillarLines = pillars.map((pillar, index) => `${labels[index]}：${pillar ?? "未知"}`);
  return [
    "基础四柱",
    ...pillarLines,
    "",
    `出生：${formatBirthDisplay(input)}`,
    `地点：${formatLocationDisplay(input)}`,
    `时区：${input.ianaTimezone ?? "未解析"}`,
    "",
    "复制内容仅含基础四柱；不含旺衰、喜用神、大运或运势解读。",
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
