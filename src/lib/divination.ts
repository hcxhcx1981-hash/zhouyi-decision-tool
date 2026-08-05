export type YaoValue = 6 | 7 | 8 | 9;
export type Polarity = 0 | 1;
export type HexagramSide = "original" | "changed";
export type TextSelector = "tuan_ci_bundle" | "line_text" | "special_line";
export type SelectionRole =
  | "primary"
  | "secondary"
  | "zhen_unranked"
  | "hui_unranked";

type PolarityName = "yin" | "yang";
type PositionSelector =
  | "higher_moving_position"
  | "lower_moving_position"
  | "lower_nonmoving_position"
  | "higher_nonmoving_position"
  | "only_nonmoving_position";
type BranchCondition = "yao_values_all_9" | "yao_values_all_6" | "otherwise";

export type DivinationErrorCode = "INVALID_LENGTH" | "INVALID_VALUE" | "INVALID_RULES";

export class DivinationInputError extends Error {
  readonly code: DivinationErrorCode;

  constructor(code: DivinationErrorCode, message: string) {
    super(message);
    this.name = "DivinationInputError";
    this.code = code;
  }
}

interface RuntimeYaoMapping {
  originalPolarity: PolarityName;
  changedPolarity: PolarityName;
  moving: boolean;
}

interface RuntimeTargetDefinition {
  hexagram: HexagramSide;
  selector: TextSelector;
  role: SelectionRole;
  positions?: "moving_positions";
  position?: PositionSelector;
  lineLabel?: "用九" | "用六";
}

interface RuntimeBranchDefinition {
  condition: BranchCondition;
  target: RuntimeTargetDefinition;
}

interface RuntimeSelectionRule {
  movingCount: number;
  ruleId: string;
  sourceInstruction: string;
  automaticDecision: boolean;
  blockingReason?: string;
  targets: RuntimeTargetDefinition[];
  branches: RuntimeBranchDefinition[];
  uncertainties: string[];
}

export interface RuntimeDivinationRules {
  version: string;
  allowedValues: YaoValue[];
  yaoMapping: Record<string, RuntimeYaoMapping>;
  selectionRules: RuntimeSelectionRule[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRules(message: string): never {
  throw new DivinationInputError("INVALID_RULES", `冻结规则无效：${message}`);
}

function requiredRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key];
  return isRecord(value) ? value : invalidRules(`${key} 必须是对象`);
}

function requiredString(parent: Record<string, unknown>, key: string): string {
  const value = parent[key];
  return typeof value === "string" ? value : invalidRules(`${key} 必须是字符串`);
}

function requiredBoolean(parent: Record<string, unknown>, key: string): boolean {
  const value = parent[key];
  return typeof value === "boolean" ? value : invalidRules(`${key} 必须是布尔值`);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : invalidRules(`${label} 值不受支持`);
}

function parseTarget(input: unknown): RuntimeTargetDefinition {
  if (!isRecord(input)) invalidRules("target 必须是对象");

  const target: RuntimeTargetDefinition = {
    hexagram: enumValue(input.hexagram, ["original", "changed"], "hexagram"),
    selector: enumValue(
      input.text_selector,
      ["tuan_ci_bundle", "line_text", "special_line"],
      "text_selector",
    ),
    role: enumValue(
      input.role,
      ["primary", "secondary", "zhen_unranked", "hui_unranked"],
      "role",
    ),
  };

  if (input.positions !== undefined) {
    target.positions = enumValue(input.positions, ["moving_positions"] as const, "positions");
  }
  if (input.position !== undefined) {
    target.position = enumValue(
      input.position,
      [
        "higher_moving_position",
        "lower_moving_position",
        "lower_nonmoving_position",
        "higher_nonmoving_position",
        "only_nonmoving_position",
      ] as const,
      "position",
    );
  }
  if (input.line_label !== undefined) {
    target.lineLabel = enumValue(input.line_label, ["用九", "用六"] as const, "line_label");
  }

  return target;
}

export function parseRuntimeDivinationRules(input: unknown): RuntimeDivinationRules {
  if (!isRecord(input)) invalidRules("根节点必须是对象");

  const inputContract = requiredRecord(input, "input_contract");
  const yaoValues = requiredRecord(inputContract, "yao_values");
  const allowedRaw = yaoValues.allowed_values;
  if (!Array.isArray(allowedRaw) || allowedRaw.some((value) => ![6, 7, 8, 9].includes(Number(value)))) {
    invalidRules("allowed_values 必须只包含 6/7/8/9");
  }
  const allowedValues = allowedRaw.map(Number) as YaoValue[];

  const mappingRaw = requiredRecord(input, "yao_mapping");
  const yaoMapping: Record<string, RuntimeYaoMapping> = {};
  for (const value of allowedValues) {
    const mapping = requiredRecord(mappingRaw, String(value));
    yaoMapping[String(value)] = {
      originalPolarity: enumValue(mapping.original_polarity, ["yin", "yang"], "original_polarity"),
      changedPolarity: enumValue(mapping.changed_polarity, ["yin", "yang"], "changed_polarity"),
      moving: requiredBoolean(mapping, "moving"),
    };
  }

  if (!Array.isArray(input.selection_rules)) invalidRules("selection_rules 必须是数组");
  const selectionRules = input.selection_rules.map((rawRule) => {
    if (!isRecord(rawRule)) invalidRules("selection_rule 必须是对象");
    if (!Number.isInteger(rawRule.moving_count)) invalidRules("moving_count 必须是整数");

    const targets = rawRule.targets === undefined
      ? []
      : Array.isArray(rawRule.targets)
        ? rawRule.targets.map(parseTarget)
        : invalidRules("targets 必须是数组");
    const branches = rawRule.branches === undefined
      ? []
      : Array.isArray(rawRule.branches)
        ? rawRule.branches.map((rawBranch): RuntimeBranchDefinition => {
            if (!isRecord(rawBranch)) invalidRules("branch 必须是对象");
            return {
              condition: enumValue(
                rawBranch.condition,
                ["yao_values_all_9", "yao_values_all_6", "otherwise"],
                "condition",
              ),
              target: parseTarget(rawBranch.target),
            };
          })
        : invalidRules("branches 必须是数组");
    const uncertainties = rawRule.uncertainties;
    if (!Array.isArray(uncertainties) || uncertainties.some((item) => typeof item !== "string")) {
      invalidRules("uncertainties 必须是字符串数组");
    }

    return {
      movingCount: rawRule.moving_count as number,
      ruleId: requiredString(rawRule, "rule_id"),
      sourceInstruction: requiredString(rawRule, "source_instruction"),
      automaticDecision: requiredBoolean(rawRule, "automatic_decision"),
      blockingReason:
        rawRule.blocking_reason === undefined
          ? undefined
          : requiredString(rawRule, "blocking_reason"),
      targets,
      branches,
      uncertainties: uncertainties as string[],
    };
  });

  const movingCounts = selectionRules.map((rule) => rule.movingCount);
  if (new Set(movingCounts).size !== movingCounts.length) {
    invalidRules("moving_count 不得重复");
  }

  return {
    version: requiredString(input, "version"),
    allowedValues,
    yaoMapping,
    selectionRules,
  };
}

export function assertYaoValues(
  values: readonly number[],
  rules: RuntimeDivinationRules,
): asserts values is YaoValue[] {
  if (values.length !== 6) {
    throw new DivinationInputError("INVALID_LENGTH", "必须输入六个爻值。");
  }

  if (values.some((value) => !rules.allowedValues.includes(value as YaoValue))) {
    throw new DivinationInputError("INVALID_VALUE", "爻值不符合冻结规则允许范围。");
  }
}

function polarityBit(polarity: PolarityName): Polarity {
  return polarity === "yang" ? 1 : 0;
}

function branchMatches(condition: BranchCondition, values: YaoValue[]): boolean {
  if (condition === "yao_values_all_9") return values.every((value) => value === 9);
  if (condition === "yao_values_all_6") return values.every((value) => value === 6);
  return true;
}

function positionsForTarget(
  target: RuntimeTargetDefinition,
  movingPositions: number[],
  nonmovingPositions: number[],
): Array<number | undefined> {
  if (target.positions === "moving_positions") return movingPositions;
  if (!target.position) return [undefined];

  const candidates = target.position.includes("nonmoving")
    ? nonmovingPositions
    : movingPositions;
  if (target.position.startsWith("higher_")) return [Math.max(...candidates)];
  if (target.position.startsWith("lower_")) return [Math.min(...candidates)];
  return [candidates[0]];
}

function resolveTarget(
  target: RuntimeTargetDefinition,
  movingPositions: number[],
  nonmovingPositions: number[],
): SelectionTarget[] {
  return positionsForTarget(target, movingPositions, nonmovingPositions).map((position) => ({
    hexagram: target.hexagram,
    selector: target.selector,
    role: target.role,
    ...(position === undefined ? {} : { position }),
    ...(target.lineLabel === undefined ? {} : { specialLine: target.lineLabel }),
  }));
}

export function calculateDivination(
  input: readonly number[],
  rules: RuntimeDivinationRules,
): DivinationResult {
  const values = [...input];
  assertYaoValues(values, rules);

  const mappings = values.map((value) => rules.yaoMapping[String(value)]);
  const originalBits = mappings.map((mapping) => polarityBit(mapping.originalPolarity));
  const changedBits = mappings.map((mapping) => polarityBit(mapping.changedPolarity));
  const movingPositions = mappings.flatMap((mapping, index) => mapping.moving ? [index + 1] : []);
  const nonmovingPositions = [1, 2, 3, 4, 5, 6].filter(
    (position) => !movingPositions.includes(position),
  );
  const movingCount = movingPositions.length;
  const selectedRule = rules.selectionRules.find((rule) => rule.movingCount === movingCount);
  if (!selectedRule) invalidRules(`缺少 ${movingCount} 动爻规则`);

  const branchTarget = selectedRule.branches.find((branch) => branchMatches(branch.condition, values));
  const definitions = branchTarget ? [branchTarget.target] : selectedRule.targets;
  if (definitions.length === 0) invalidRules(`${selectedRule.ruleId} 没有可执行目标`);

  return {
    values,
    originalBits,
    changedBits,
    originalKey: originalBits.join(""),
    changedKey: changedBits.join(""),
    movingPositions,
    movingCount,
    ruleId: selectedRule.ruleId,
    ruleInstruction: selectedRule.sourceInstruction,
    automaticDecision: selectedRule.automaticDecision,
    blocked: !selectedRule.automaticDecision || Boolean(selectedRule.blockingReason),
    blockingReason: selectedRule.blockingReason,
    targets: definitions.flatMap((target) =>
      resolveTarget(target, movingPositions, nonmovingPositions),
    ),
    uncertainties: selectedRule.uncertainties,
  };
}
