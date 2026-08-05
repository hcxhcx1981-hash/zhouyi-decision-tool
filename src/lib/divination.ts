export const ALLOWED_YAO_VALUES = [6, 7, 8, 9] as const;

export type YaoValue = (typeof ALLOWED_YAO_VALUES)[number];
export type Polarity = 0 | 1;
export type HexagramSide = "original" | "changed";
export type TextSelector = "tuan_ci_bundle" | "line_text" | "special_line";
export type SelectionRole =
  | "primary"
  | "secondary"
  | "zhen_unranked"
  | "hui_unranked";

export type DivinationErrorCode = "INVALID_LENGTH" | "INVALID_VALUE";

export class DivinationInputError extends Error {
  readonly code: DivinationErrorCode;

  constructor(code: DivinationErrorCode, message: string) {
    super(message);
    this.name = "DivinationInputError";
    this.code = code;
  }
}

export interface SelectionTarget {
  hexagram: HexagramSide;
  selector: TextSelector;
  role: SelectionRole;
  position?: number;
  specialLine?: "用九" | "用六";
}

export interface DivinationResult {
  values: YaoValue[];
  originalBits: Polarity[];
  changedBits: Polarity[];
  originalKey: string;
  changedKey: string;
  movingPositions: number[];
  movingCount: number;
  ruleId: string;
  ruleInstruction: string;
  automaticDecision: boolean;
  blocked: boolean;
  blockingReason?: string;
  targets: SelectionTarget[];
  uncertainties: string[];
}

const ORIGINAL_POLARITY: Record<YaoValue, Polarity> = {
  6: 0,
  7: 1,
  8: 0,
  9: 1,
};

const CHANGED_POLARITY: Record<YaoValue, Polarity> = {
  6: 1,
  7: 1,
  8: 0,
  9: 0,
};

export function assertYaoValues(values: readonly number[]): asserts values is YaoValue[] {
  if (values.length !== 6) {
    throw new DivinationInputError("INVALID_LENGTH", "必须输入六个爻值。");
  }

  if (values.some((value) => !ALLOWED_YAO_VALUES.includes(value as YaoValue))) {
    throw new DivinationInputError("INVALID_VALUE", "爻值只允许 6、7、8、9。");
  }
}

export function calculateDivination(input: readonly number[]): DivinationResult {
  const values = [...input];
  assertYaoValues(values);

  const originalBits = values.map((value) => ORIGINAL_POLARITY[value]);
  const changedBits = values.map((value) => CHANGED_POLARITY[value]);
  const movingPositions = values.flatMap((value, index) =>
    value === 6 || value === 9 ? [index + 1] : [],
  );
  const movingCount = movingPositions.length;
  const base = {
    values,
    originalBits,
    changedBits,
    originalKey: originalBits.join(""),
    changedKey: changedBits.join(""),
    movingPositions,
    movingCount,
  };

  switch (movingCount) {
    case 0:
      return {
        ...base,
        ruleId: "M0_ORIGINAL_TUANCI",
        ruleInstruction: "占本卦彖辞，内卦为贞，外卦为悔。",
        automaticDecision: true,
        blocked: false,
        targets: [{ hexagram: "original", selector: "tuan_ci_bundle", role: "primary" }],
        uncertainties: ["贞悔详细释义未解决", "彖辞文本范围未解决"],
      };
    case 1:
      return {
        ...base,
        ruleId: "M1_ORIGINAL_MOVING_LINE",
        ruleInstruction: "以本卦变爻辞占。",
        automaticDecision: true,
        blocked: false,
        targets: [
          {
            hexagram: "original",
            selector: "line_text",
            role: "primary",
            position: movingPositions[0],
          },
        ],
        uncertainties: [],
      };
    case 2: {
      const [lower, higher] = movingPositions;
      return {
        ...base,
        ruleId: "M2_TWO_ORIGINAL_MOVING_LINES",
        ruleInstruction: "以本卦二变爻辞占，以上爻为主。",
        automaticDecision: true,
        blocked: false,
        targets: [
          { hexagram: "original", selector: "line_text", role: "primary", position: higher },
          { hexagram: "original", selector: "line_text", role: "secondary", position: lower },
        ],
        uncertainties: ["“为主”仅表示优先展示，不设置虚构权重"],
      };
    }
    case 3:
      return {
        ...base,
        ruleId: "M3_ORIGINAL_AND_CHANGED_TUANCI",
        ruleInstruction: "占本卦及之卦彖辞；本卦为贞，之卦为悔。",
        automaticDecision: false,
        blocked: true,
        blockingReason: "主次待图版核准：禁止自动确定主贞或主悔，也不生成唯一主断。",
        targets: [
          { hexagram: "original", selector: "tuan_ci_bundle", role: "zhen_unranked" },
          { hexagram: "changed", selector: "tuan_ci_bundle", role: "hui_unranked" },
        ],
        uncertainties: ["三爻变前十/后十图版映射未核准", "彖辞文本范围未解决"],
      };
    case 4: {
      const nonmoving = [1, 2, 3, 4, 5, 6].filter(
        (position) => !movingPositions.includes(position),
      );
      return {
        ...base,
        ruleId: "M4_TWO_UNCHANGED_LINES_IN_CHANGED",
        ruleInstruction: "以之卦二不变爻占，以下爻为主。",
        automaticDecision: true,
        blocked: false,
        targets: [
          { hexagram: "changed", selector: "line_text", role: "primary", position: nonmoving[0] },
          { hexagram: "changed", selector: "line_text", role: "secondary", position: nonmoving[1] },
        ],
        uncertainties: ["“为主”仅表示优先展示，不设置虚构权重"],
      };
    }
    case 5: {
      const onlyNonmoving = [1, 2, 3, 4, 5, 6].find(
        (position) => !movingPositions.includes(position),
      );
      return {
        ...base,
        ruleId: "M5_ONE_UNCHANGED_LINE_IN_CHANGED",
        ruleInstruction: "以之卦不变爻占。",
        automaticDecision: true,
        blocked: false,
        targets: [
          {
            hexagram: "changed",
            selector: "line_text",
            role: "primary",
            position: onlyNonmoving,
          },
        ],
        uncertainties: [],
      };
    }
    case 6:
      if (values.every((value) => value === 9)) {
        return {
          ...base,
          ruleId: "M6_ALL_MOVING",
          ruleInstruction: "乾卦六爻皆动，取用九。",
          automaticDecision: true,
          blocked: false,
          targets: [
            {
              hexagram: "original",
              selector: "special_line",
              specialLine: "用九",
              role: "primary",
            },
          ],
          uncertainties: [],
        };
      }
      if (values.every((value) => value === 6)) {
        return {
          ...base,
          ruleId: "M6_ALL_MOVING",
          ruleInstruction: "坤卦六爻皆动，取用六。",
          automaticDecision: true,
          blocked: false,
          targets: [
            {
              hexagram: "original",
              selector: "special_line",
              specialLine: "用六",
              role: "primary",
            },
          ],
          uncertainties: [],
        };
      }
      return {
        ...base,
        ruleId: "M6_ALL_MOVING",
        ruleInstruction: "六爻皆动且非纯乾纯坤，取之卦彖辞层。",
        automaticDecision: true,
        blocked: false,
        targets: [{ hexagram: "changed", selector: "tuan_ci_bundle", role: "primary" }],
        uncertainties: ["之卦彖辞的精确文本范围未解决"],
      };
    default:
      throw new Error("无法到达的动爻数量");
  }
}
