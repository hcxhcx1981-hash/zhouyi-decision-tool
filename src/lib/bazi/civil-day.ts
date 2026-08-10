import type { BaziPillar } from "./runtime-types";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { pillarAt } from "./sexagenary-cycle.ts";

export interface CivilDateParts {
  year: number;
  month: number;
  day: number;
}

export interface CivilDayCalculation {
  pillar: BaziPillar;
  algorithmAIndex: number;
  algorithmBIndex: number;
  algorithmsAgree: boolean;
}

export function isGregorianLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function monthLength(year: number, month: number): number {
  return [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function parseCivilDate(value: string): CivilDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) {
    return null;
  }
  return { year, month, day };
}

// Algorithm A: integer proleptic-Gregorian civil ordinal.
export function gregorianOrdinalA(date: CivilDateParts): number {
  const year = date.year - (date.month <= 2 ? 1 : 0);
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const shiftedMonth = date.month + (date.month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + date.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra;
}

// Algorithm B: independent integer Gregorian-to-Julian-Day-Number formula.
export function julianDayNumberB(date: CivilDateParts): number {
  const a = Math.floor((14 - date.month) / 12);
  const year = date.year + 4800 - a;
  const month = date.month + 12 * a - 3;
  return date.day + Math.floor((153 * month + 2) / 5) + 365 * year +
    Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) - 32045;
}

const epoch = parseCivilDate("1970-01-01")!;
const reference = parseCivilDate("1949-10-01")!;
const epochA = gregorianOrdinalA(epoch);
const epochB = julianDayNumberB(epoch);
const referenceA = gregorianOrdinalA(reference) - epochA;
const referenceB = julianDayNumberB(reference) - epochB;

export function calculateCivilDay(localDate: string): CivilDayCalculation | null {
  const date = parseCivilDate(localDate);
  if (!date) return null;
  const algorithmAIndex = gregorianOrdinalA(date) - epochA;
  const algorithmBIndex = julianDayNumberB(date) - epochB;
  return {
    pillar: pillarAt(algorithmAIndex - referenceA),
    algorithmAIndex,
    algorithmBIndex,
    algorithmsAgree: algorithmAIndex === algorithmBIndex && referenceA === referenceB,
  };
}
