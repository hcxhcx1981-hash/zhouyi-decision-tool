export type CalendarType = "solar" | "lunar";
export type Gender = "male" | "female";
export type TimePrecision = "exact" | "unknown";

export interface BirthLocationInput {
  countryOrRegion: string;
  city: string;
}

export interface BaziBirthInput {
  calendarType: CalendarType;
  birthDate: string;
  birthTime: string | null;
  timePrecision: TimePrecision;
  gender: Gender;
  location: BirthLocationInput;
}

export interface HeavenlyStemBranch {
  stem: string;
  branch: string;
}

export interface BaziChart {
  yearPillar: HeavenlyStemBranch;
  monthPillar: HeavenlyStemBranch;
  dayPillar: HeavenlyStemBranch;
  hourPillar: HeavenlyStemBranch | null;
}

export interface BaziAnalysisResult {
  status: "NOT_IMPLEMENTED" | "READY";
  chart: BaziChart | null;
  blockingReason: string | null;
}
