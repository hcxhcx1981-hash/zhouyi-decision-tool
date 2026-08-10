import type {
  BaziAnalysisResult,
  BaziBirthInput,
  CalendarType,
  Gender,
  TimePrecision,
} from "./types";

export const BAZI_BLOCKING_REASON =
  "确定性四柱规则与运行链已完成内部冻结，当前页面尚未接入正式排盘流程，不生成四柱和运势结论。";

export interface BaziBirthDraft {
  calendarType: CalendarType;
  birthDate: string;
  birthHour: string;
  birthMinute: string;
  timePrecision: TimePrecision;
  gender: Gender;
  countryOrRegion: string;
  city: string;
}

export type BaziValidationCode =
  | "LUNAR_NOT_IMPLEMENTED"
  | "BIRTH_DATE_REQUIRED"
  | "BIRTH_TIME_REQUIRED"
  | "BIRTH_TIME_INVALID";

export const INITIAL_BAZI_DRAFT: BaziBirthDraft = {
  calendarType: "solar",
  birthDate: "",
  birthHour: "",
  birthMinute: "",
  timePrecision: "exact",
  gender: "male",
  countryOrRegion: "",
  city: "",
};

export function validateBaziBirthDraft(draft: BaziBirthDraft): BaziValidationCode[] {
  const errors: BaziValidationCode[] = [];

  if (draft.calendarType === "lunar") {
    errors.push("LUNAR_NOT_IMPLEMENTED");
  }
  if (!draft.birthDate) {
    errors.push("BIRTH_DATE_REQUIRED");
  }
  if (draft.timePrecision === "exact") {
    if (draft.birthHour === "" || draft.birthMinute === "") {
      errors.push("BIRTH_TIME_REQUIRED");
    } else {
      const hour = Number(draft.birthHour);
      const minute = Number(draft.birthMinute);
      if (
        !Number.isInteger(hour) ||
        !Number.isInteger(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
      ) {
        errors.push("BIRTH_TIME_INVALID");
      }
    }
  }

  return errors;
}

export function toBaziBirthInput(draft: BaziBirthDraft): BaziBirthInput | null {
  if (validateBaziBirthDraft(draft).length > 0) {
    return null;
  }

  const birthTime =
    draft.timePrecision === "unknown"
      ? null
      : `${draft.birthHour.padStart(2, "0")}:${draft.birthMinute.padStart(2, "0")}`;

  return {
    calendarType: draft.calendarType,
    birthDate: draft.birthDate,
    birthTime,
    timePrecision: draft.timePrecision,
    gender: draft.gender,
    location: {
      countryOrRegion: draft.countryOrRegion.trim(),
      city: draft.city.trim(),
    },
  };
}

export function createBlockedBaziResult(): BaziAnalysisResult {
  return {
    status: "NOT_IMPLEMENTED",
    chart: null,
    blockingReason: BAZI_BLOCKING_REASON,
  };
}
