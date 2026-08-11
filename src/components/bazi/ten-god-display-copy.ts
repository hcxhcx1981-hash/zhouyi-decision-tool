import type {
  ElementRelation,
  PolarityRelation,
  TenGodCanonical,
} from "../../lib/bazi/foundation-runtime-types.ts";

export const DISPLAY_EXPLANATION_ONLY = true as const;

export interface TenGodDisplayCopy {
  readonly elementRelation: ElementRelation;
  readonly polarityRelation: PolarityRelation;
  readonly standard: string;
  readonly plain: string;
}

export const TEN_GOD_DISPLAY_COPY: Readonly<Record<TenGodCanonical, TenGodDisplayCopy>> = {
  比肩: {
    elementRelation: "SAME_ELEMENT",
    polarityRelation: "SAME_POLARITY",
    standard: "同五行 + 阴阳同性。",
    plain: "和日主属于同一种五行、阴阳属性也相同的一类关系。",
  },
  劫财: {
    elementRelation: "SAME_ELEMENT",
    polarityRelation: "DIFFERENT_POLARITY",
    standard: "同五行 + 阴阳异性。",
    plain: "和日主属于同一种五行，但阴阳属性不同的一类关系。",
  },
  食神: {
    elementRelation: "DAY_GENERATES_TARGET",
    polarityRelation: "SAME_POLARITY",
    standard: "日主生目标 + 阴阳同性。",
    plain: "目标天干属于日主所生，并且阴阳属性相同的一类关系。",
  },
  伤官: {
    elementRelation: "DAY_GENERATES_TARGET",
    polarityRelation: "DIFFERENT_POLARITY",
    standard: "日主生目标 + 阴阳异性。",
    plain: "目标天干属于日主所生，但阴阳属性不同的一类关系。",
  },
  偏财: {
    elementRelation: "DAY_CONTROLS_TARGET",
    polarityRelation: "SAME_POLARITY",
    standard: "日主克目标 + 阴阳同性。",
    plain: "目标天干属于日主所克，并且阴阳属性相同的一类关系。",
  },
  正财: {
    elementRelation: "DAY_CONTROLS_TARGET",
    polarityRelation: "DIFFERENT_POLARITY",
    standard: "日主克目标 + 阴阳异性。",
    plain: "目标天干属于日主所克，但阴阳属性不同的一类关系。",
  },
  七杀: {
    elementRelation: "TARGET_CONTROLS_DAY",
    polarityRelation: "SAME_POLARITY",
    standard: "目标克日主 + 阴阳同性。",
    plain: "目标天干对日主形成相克关系，并且双方阴阳属性相同。",
  },
  正官: {
    elementRelation: "TARGET_CONTROLS_DAY",
    polarityRelation: "DIFFERENT_POLARITY",
    standard: "目标克日主 + 阴阳异性。",
    plain: "目标天干对日主形成相克关系，但双方阴阳属性不同。",
  },
  偏印: {
    elementRelation: "TARGET_GENERATES_DAY",
    polarityRelation: "SAME_POLARITY",
    standard: "目标生日主 + 阴阳同性。",
    plain: "目标天干对日主形成相生关系，并且双方阴阳属性相同。",
  },
  正印: {
    elementRelation: "TARGET_GENERATES_DAY",
    polarityRelation: "DIFFERENT_POLARITY",
    standard: "目标生日主 + 阴阳异性。",
    plain: "目标天干对日主形成相生关系，但双方阴阳属性不同。",
  },
};

export const FOUNDATION_CURRENTLY_DETERMINABLE = [
  "你的日主是什么",
  "四柱是什么",
  "每个天干的阴阳五行",
  "每个地支的阴阳五行",
  "每个地支藏哪些天干",
  "各天干及藏干相对日主的十神关系",
] as const;

export const FOUNDATION_NOT_YET_DETERMINABLE = [
  "日主强弱",
  "命局旺衰",
  "喜用神",
  "格局",
  "大运",
  "流年",
  "财运",
  "事业",
  "感情",
  "吉凶",
] as const;

export function getTenGodDisplayCopy(tenGod: TenGodCanonical): TenGodDisplayCopy {
  return TEN_GOD_DISPLAY_COPY[tenGod];
}
