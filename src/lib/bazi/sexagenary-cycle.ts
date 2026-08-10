import type { BaziPillar } from "./runtime-types";

export const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export const SEXAGENARY_CYCLE: readonly BaziPillar[] = Object.freeze(
  Array.from({ length: 60 }, (_, cycleIndex) => {
    const stem = HEAVENLY_STEMS[cycleIndex % 10];
    const branch = EARTHLY_BRANCHES[cycleIndex % 12];
    return Object.freeze({ stem, branch, text: `${stem}${branch}`, cycleIndex });
  }),
);

export function pillarAt(index: number): BaziPillar {
  return SEXAGENARY_CYCLE[floorMod(index, 60)];
}

export function pillarFromStemBranch(stem: string, branch: string): BaziPillar {
  const result = SEXAGENARY_CYCLE.find(
    (pillar) => pillar.stem === stem && pillar.branch === branch,
  );
  if (!result) throw new Error("INVALID_STEM_BRANCH_PAIR");
  return result;
}

export function yearPillarForLichunYear(year: number): BaziPillar {
  return pillarAt(year - 1984);
}

export function monthPillarForYearStem(yearStem: string, monthBranch: string): BaziPillar {
  const yearStemIndex = HEAVENLY_STEMS.indexOf(yearStem as never);
  const branchIndex = EARTHLY_BRANCHES.indexOf(monthBranch as never);
  if (yearStemIndex < 0 || branchIndex < 0) throw new Error("INVALID_MONTH_INPUT");
  const yinIndex = EARTHLY_BRANCHES.indexOf("寅");
  const offset = floorMod(branchIndex - yinIndex, 12);
  const yinStemIndex = floorMod((yearStemIndex % 5) * 2 + 2, 10);
  return pillarFromStemBranch(
    HEAVENLY_STEMS[(yinStemIndex + offset) % 10],
    monthBranch,
  );
}

export function hourBranchIndex(localHour: number): number {
  if (!Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    throw new Error("INVALID_LOCAL_HOUR");
  }
  return Math.floor(((localHour + 1) % 24) / 2);
}

export function hourPillarForDayStem(dayStem: string, localHour: number): BaziPillar {
  const dayStemIndex = HEAVENLY_STEMS.indexOf(dayStem as never);
  if (dayStemIndex < 0) throw new Error("INVALID_DAY_STEM");
  const branchIndex = hourBranchIndex(localHour);
  const ziStemIndex = (dayStemIndex % 5) * 2;
  return pillarFromStemBranch(
    HEAVENLY_STEMS[(ziStemIndex + branchIndex) % 10],
    EARTHLY_BRANCHES[branchIndex],
  );
}
