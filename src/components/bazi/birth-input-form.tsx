"use client";

import { type FormEvent, useState } from "react";
import { BaziBlockedResult } from "./bazi-blocked-result";
import {
  BAZI_BLOCKING_REASON,
  createBlockedBaziResult,
  INITIAL_BAZI_DRAFT,
  toBaziBirthInput,
  validateBaziBirthDraft,
  type BaziBirthDraft,
  type BaziValidationCode,
} from "@/lib/bazi/form";
import type { BaziAnalysisResult } from "@/lib/bazi/types";

const ERROR_MESSAGES: Record<BaziValidationCode, string> = {
  LUNAR_NOT_IMPLEMENTED: "农历转换规则尚未接入，本阶段不可提交。",
  BIRTH_DATE_REQUIRED: "请填写出生日期。",
  BIRTH_TIME_REQUIRED: "请填写出生时和分，或选择不知道准确时辰。",
  BIRTH_TIME_INVALID: "出生时间必须是有效的 0—23 时和 0—59 分。",
};

export function BirthInputForm() {
  const [draft, setDraft] = useState<BaziBirthDraft>(INITIAL_BAZI_DRAFT);
  const [errors, setErrors] = useState<BaziValidationCode[]>([]);
  const [result, setResult] = useState<BaziAnalysisResult | null>(null);

  function updateDraft(patch: Partial<BaziBirthDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors([]);
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateBaziBirthDraft(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0 || !toBaziBirthInput(draft)) {
      setResult(null);
      return;
    }
    setResult(createBlockedBaziResult());
  }

  const lunarBlocked = draft.calendarType === "lunar";
  const timeUnknown = draft.timePrecision === "unknown";

  return (
    <form className="bazi-form panel" onSubmit={submit} noValidate>
      <fieldset className="form-section">
        <legend>1. 历法类型</legend>
        <div className="segmented-options">
          <label><input type="radio" name="calendar" checked={draft.calendarType === "solar"} onChange={() => updateDraft({ calendarType: "solar" })} />公历</label>
          <label><input type="radio" name="calendar" checked={draft.calendarType === "lunar"} onChange={() => updateDraft({ calendarType: "lunar" })} />农历</label>
        </div>
        {lunarBlocked ? <p className="inline-warning" role="status">农历转换规则尚未接入，本阶段不可提交。</p> : null}
      </fieldset>

      <label className="field-stack">
        <span>2. 出生日期</span>
        <input type="date" value={draft.birthDate} onChange={(event) => updateDraft({ birthDate: event.target.value })} />
      </label>

      <fieldset className="form-section">
        <legend>3. 出生时间</legend>
        <div className="time-grid">
          <label><span>时</span><input aria-label="出生时" type="number" min="0" max="23" inputMode="numeric" disabled={timeUnknown} value={draft.birthHour} onChange={(event) => updateDraft({ birthHour: event.target.value })} /></label>
          <label><span>分</span><input aria-label="出生分" type="number" min="0" max="59" inputMode="numeric" disabled={timeUnknown} value={draft.birthMinute} onChange={(event) => updateDraft({ birthMinute: event.target.value })} /></label>
        </div>
        <label className="check-row"><input type="checkbox" checked={timeUnknown} onChange={(event) => updateDraft({ timePrecision: event.target.checked ? "unknown" : "exact", birthHour: event.target.checked ? "" : draft.birthHour, birthMinute: event.target.checked ? "" : draft.birthMinute })} />不知道准确时辰</label>
      </fieldset>

      <fieldset className="form-section">
        <legend>4. 性别</legend>
        <div className="segmented-options">
          <label><input type="radio" name="gender" checked={draft.gender === "male"} onChange={() => updateDraft({ gender: "male" })} />男</label>
          <label><input type="radio" name="gender" checked={draft.gender === "female"} onChange={() => updateDraft({ gender: "female" })} />女</label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>5. 出生地</legend>
        <div className="location-grid">
          <label className="field-stack"><span>国家或地区</span><input type="text" value={draft.countryOrRegion} onChange={(event) => updateDraft({ countryOrRegion: event.target.value })} /></label>
          <label className="field-stack"><span>城市</span><input type="text" value={draft.city} onChange={(event) => updateDraft({ city: event.target.value })} /></label>
        </div>
        <p className="field-note">出生地将在后续用于时区与真太阳时校准，本阶段暂不参与计算。</p>
      </fieldset>

      {errors.length ? <div className="form-error" role="alert">{errors.map((error) => <p key={error}>{ERROR_MESSAGES[error]}</p>)}</div> : null}
      <button className="calculate-button" type="submit" disabled={lunarBlocked}>生成基础命盘</button>
      <p className="form-boundary">{BAZI_BLOCKING_REASON}</p>
      {result ? <BaziBlockedResult result={result} /> : null}
    </form>
  );
}
