import type {
  HeavenlyStem,
  LiuyaoCastInput,
  LiuyaoChart,
  LiuyaoHexagramIdentity,
  SixRelative,
  SixSpirit,
  YaoPolarity,
} from "./types";

type Element = "木" | "火" | "土" | "金" | "水";
type Trigram = { name: string; element: Element; naJia: readonly [string, string, string, string, string, string] };

// Fixed conventional Na Jia and eight-palace tables. They only label a cast; no fortune interpretation is produced.
const TRIGRAMS: Record<string, Trigram> = {
  "111": { name: "乾", element: "金", naJia: ["甲子", "甲寅", "甲辰", "壬午", "壬申", "壬戌"] },
  "110": { name: "兑", element: "金", naJia: ["丁巳", "丁卯", "丁丑", "丁亥", "丁酉", "丁未"] },
  "101": { name: "离", element: "火", naJia: ["己卯", "己丑", "己亥", "己酉", "己未", "己巳"] },
  "100": { name: "震", element: "木", naJia: ["庚子", "庚寅", "庚辰", "庚午", "庚申", "庚戌"] },
  "011": { name: "巽", element: "木", naJia: ["辛丑", "辛亥", "辛酉", "辛未", "辛巳", "辛卯"] },
  "010": { name: "坎", element: "水", naJia: ["戊寅", "戊辰", "戊午", "戊申", "戊戌", "戊子"] },
  "001": { name: "艮", element: "土", naJia: ["丙辰", "丙午", "丙申", "丙戌", "丙子", "丙寅"] },
  "000": { name: "坤", element: "土", naJia: ["乙未", "乙巳", "乙卯", "癸丑", "癸亥", "癸酉"] },
};

const SHI_POSITIONS = [6, 1, 2, 3, 4, 5, 4, 3] as const;
const SIX_SPIRITS: readonly SixSpirit[] = ["青龙", "朱雀", "勾陈", "腾蛇", "白虎", "玄武"];
const SPIRIT_START: Record<HeavenlyStem, number> = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
const GENERATES: Record<Element, Element> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<Element, Element> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };

function flip(bits: string, positions: number[]): string {
  return bits.split("").map((bit, index) => positions.includes(index + 1) ? (bit === "1" ? "0" : "1") : bit).join("");
}

function palaceEntries(pure: string): string[] {
  const first = flip(pure, [1]);
  const second = flip(pure, [1, 2]);
  const third = flip(pure, [1, 2, 3]);
  const fourth = flip(third, [4]);
  const fifth = flip(fourth, [5]);
  const wandering = flip(fifth, [4]);
  const returning = flip(wandering, [1, 2, 3]);
  return [pure, first, second, third, fourth, fifth, wandering, returning];
}

function resolveIdentity(key: string): LiuyaoHexagramIdentity & { pattern: number } {
  const lower = TRIGRAMS[key.slice(0, 3)];
  const upper = TRIGRAMS[key.slice(3, 6)];
  if (!lower || !upper) throw new Error("六爻码必须由六个阴阳位组成。");
  for (const [pure, trigram] of Object.entries(TRIGRAMS)) {
    const pattern = palaceEntries(pure.repeat(2)).indexOf(key);
    if (pattern !== -1) {
      return { key, lowerTrigram: lower.name, upperTrigram: upper.name, palace: trigram.name, palaceElement: trigram.element, pattern };
    }
  }
  throw new Error("八宫卦归属无法确定。");
}

function sixRelative(lineElement: Element, palaceElement: Element): SixRelative {
  if (lineElement === palaceElement) return "兄弟";
  if (GENERATES[palaceElement] === lineElement) return "子孙";
  if (CONTROLS[palaceElement] === lineElement) return "妻财";
  if (CONTROLS[lineElement] === palaceElement) return "官鬼";
  return "父母";
}

function naJiaFor(key: string): readonly string[] {
  const lower = TRIGRAMS[key.slice(0, 3)];
  const upper = TRIGRAMS[key.slice(3, 6)];
  return [...lower.naJia.slice(0, 3), ...upper.naJia.slice(3, 6)];
}

function branchElement(naJia: string): Element {
  const branch = naJia.at(-1);
  if (branch && "寅卯".includes(branch)) return "木";
  if (branch && "巳午".includes(branch)) return "火";
  if (branch && "申酉".includes(branch)) return "金";
  if (branch && "亥子".includes(branch)) return "水";
  return "土";
}

/** Produces the Phase 1 chart with fixed rules only; it does not call AI or external services. */
export function buildLiuyaoChart(cast: LiuyaoCastInput): LiuyaoChart {
  const originalKey = cast.yaoValues.map((value) => value === 6 || value === 8 ? "0" : "1").join("");
  const changedKey = cast.yaoValues.map((value) => value === 6 ? "1" : value === 9 ? "0" : value === 8 ? "0" : "1").join("");
  const original = resolveIdentity(originalKey);
  const changed = resolveIdentity(changedKey);
  const shiPosition = SHI_POSITIONS[original.pattern];
  const yingPosition = ((shiPosition + 2) % 6) + 1;
  const naJia = naJiaFor(originalKey);
  const spiritStart = SPIRIT_START[cast.dayStem];

  return {
    input: { yaoValues: [...cast.yaoValues] as LiuyaoChart["input"]["yaoValues"], dayStem: cast.dayStem },
    originalHexagram: { ...original },
    changedHexagram: { ...changed },
    movingPositions: cast.yaoValues.flatMap((value, index) => value === 6 || value === 9 ? [index + 1] : []),
    shiPosition,
    yingPosition,
    lines: cast.yaoValues.map((yaoValue, index) => {
      const position = index + 1;
      const polarity: YaoPolarity = yaoValue === 6 || yaoValue === 8 ? "阴" : "阳";
      return {
        position,
        positionLabel: ["初爻", "二爻", "三爻", "四爻", "五爻", "上爻"][index],
        yaoValue,
        polarity,
        moving: yaoValue === 6 || yaoValue === 9,
        naJia: naJia[index],
        sixRelative: sixRelative(branchElement(naJia[index]), original.palaceElement),
        sixSpirit: SIX_SPIRITS[(spiritStart + index) % 6],
        shi: position === shiPosition,
        ying: position === yingPosition,
      };
    }),
    ruleLayer: "LIUYAO_PHASE1_DETERMINISTIC",
  };
}
