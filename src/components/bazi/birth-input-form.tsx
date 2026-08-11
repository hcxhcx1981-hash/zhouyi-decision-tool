"use client";

import { type FormEvent, useRef, useState } from "react";
import { BaziBlockedResult } from "./bazi-blocked-result";
import { BaziPillarResult } from "./bazi-pillar-result";
import {
  defaultBrowserFetch,
  loadVerifiedIanaZoneIds,
  runBaziBrowserPipeline,
  type BaziBrowserPipelineResult,
} from "@/lib/bazi/bazi-browser-pipeline";
import {
  beginBaziPageSubmission,
  createLatestRequestGate,
  EMPTY_BAZI_PAGE_RESOLUTION,
  resetBaziPageResolution,
  settleLatestRequest,
  type BaziPageDraft,
  type BaziPageResolutionState,
  type ResolvedBaziPageSubmission,
} from "@/lib/bazi/bazi-page-contract";

type LocationMode = "REGISTERED_LOCATION" | "MANUAL_IANA";

interface FormDraft {
  birthDate: string;
  birthTime: string;
  timeKnown: boolean;
  gender: "MALE" | "FEMALE";
  locationMode: LocationMode;
  displayLocationName: string;
  manualIanaTimezone: string;
}

const INITIAL_DRAFT: FormDraft = {
  birthDate: "",
  birthTime: "",
  timeKnown: true,
  gender: "MALE",
  locationMode: "REGISTERED_LOCATION",
  displayLocationName: "",
  manualIanaTimezone: "",
};

function validate(draft: FormDraft): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate)) errors.push("请填写有效的公历出生日期。");
  if (draft.timeKnown && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.birthTime)) errors.push("请填写精确到分钟的出生时间。");
  if (draft.locationMode === "MANUAL_IANA" && !draft.displayLocationName.trim()) errors.push("请填写出生地名称。");
  if (draft.locationMode === "MANUAL_IANA" && !draft.manualIanaTimezone) errors.push("请从正式目录选择 IANA 时区。");
  return errors;
}

function toPageDraft(draft: FormDraft, resolution: ResolvedBaziPageSubmission): BaziPageDraft {
  return {
    calendarType: "GREGORIAN",
    localDate: draft.birthDate,
    localTime: draft.timeKnown ? draft.birthTime : null,
    timeKnown: draft.timeKnown,
    gender: draft.gender,
    locationName: draft.locationMode === "REGISTERED_LOCATION" ? draft.displayLocationName.trim() || "中国大陆" : draft.displayLocationName.trim(),
    selectionMode: draft.locationMode,
    registeredLocationId: draft.locationMode === "REGISTERED_LOCATION" ? "CN-MAINLAND" : null,
    manualIanaTimezone: draft.locationMode === "MANUAL_IANA" ? draft.manualIanaTimezone : null,
    foldChoice: resolution.foldChoice,
    referenceInstantUtc: resolution.referenceInstantUtc,
  };
}

export function BirthInputForm({ clock = () => new Date().toISOString() }: { clock?: () => string }) {
  const [draft, setDraft] = useState<FormDraft>(INITIAL_DRAFT);
  const [resolution, setResolution] = useState<BaziPageResolutionState>(EMPTY_BAZI_PAGE_RESOLUTION);
  const [errors, setErrors] = useState<string[]>([]);
  const [pipeline, setPipeline] = useState<BaziBrowserPipelineResult | null>(null);
  const [submittedDraft, setSubmittedDraft] = useState<BaziPageDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [ianaZones, setIanaZones] = useState<readonly string[]>([]);
  const [ianaLoading, setIanaLoading] = useState(false);
  const pipelineRequests = useRef(createLatestRequestGate());
  const ianaRequests = useRef(createLatestRequestGate());

  function updateDraft(patch: Partial<FormDraft>) {
    pipelineRequests.current.invalidate();
    setDraft((current) => ({ ...current, ...patch }));
    setErrors([]);
    setPipeline(null);
    setSubmittedDraft(null);
    setLoadError(false);
    setBusy(false);
    setResolution(resetBaziPageResolution());
  }

  async function selectLocationMode(mode: LocationMode) {
    ianaRequests.current.invalidate();
    setIanaLoading(false);
    updateDraft({ locationMode: mode, manualIanaTimezone: "" });
    if (mode === "MANUAL_IANA" && ianaZones.length === 0 && !ianaLoading) {
      const requestId = ianaRequests.current.begin();
      setIanaLoading(true);
      await settleLatestRequest(
        ianaRequests.current,
        requestId,
        loadVerifiedIanaZoneIds(defaultBrowserFetch),
        {
          onSuccess: setIanaZones,
          onError: () => setLoadError(true),
          onFinally: () => setIanaLoading(false),
        },
      );
    }
  }

  async function execute(nextResolution: ResolvedBaziPageSubmission) {
    const requestId = pipelineRequests.current.begin();
    setBusy(true);
    setLoadError(false);
    const pageDraft = toPageDraft(draft, nextResolution);
    await settleLatestRequest(
      pipelineRequests.current,
      requestId,
      runBaziBrowserPipeline(pageDraft, {
        fetchImpl: defaultBrowserFetch,
        referenceInstantUtc: nextResolution.referenceInstantUtc,
      }),
      {
        onSuccess: (next) => {
          setPipeline(next);
          setSubmittedDraft(pageDraft);
          setResolution(nextResolution);
        },
        onError: (error) => {
          if (process.env.NODE_ENV === "development") console.error("Bazi browser pipeline failed", error);
          setPipeline(null);
          setSubmittedDraft(null);
          setLoadError(true);
        },
        onFinally: () => setBusy(false),
      },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    await execute(beginBaziPageSubmission(clock));
  }

  async function chooseFold(foldChoice: "EARLIER" | "LATER") {
    if (!resolution.referenceInstantUtc) return;
    await execute({ foldChoice, referenceInstantUtc: resolution.referenceInstantUtc });
  }

  return (
    <form className="bazi-form panel" onSubmit={submit} noValidate>
      <fieldset className="form-section">
        <legend>1. 历法</legend>
        <div className="segmented-options">
          <label><input type="radio" name="calendar" checked readOnly />公历</label>
          <label className="disabled-option"><input type="radio" name="calendar" disabled />农历（暂未支持）</label>
        </div>
      </fieldset>

      <label className="field-stack"><span>2. 出生日期</span><input aria-label="出生日期" type="date" required value={draft.birthDate} onChange={(event) => updateDraft({ birthDate: event.target.value })} /></label>

      <fieldset className="form-section">
        <legend>3. 出生时间</legend>
        <label className="field-stack"><span>当地民用时间</span><input aria-label="出生时间" type="time" step="60" disabled={!draft.timeKnown} required={draft.timeKnown} value={draft.birthTime} onChange={(event) => updateDraft({ birthTime: event.target.value })} /></label>
        <label className="check-row"><input type="checkbox" checked={!draft.timeKnown} onChange={(event) => updateDraft({ timeKnown: !event.target.checked, birthTime: event.target.checked ? "" : draft.birthTime })} />不知道准确时辰</label>
      </fieldset>

      <fieldset className="form-section">
        <legend>4. 性别</legend>
        <div className="segmented-options">
          <label><input type="radio" name="gender" checked={draft.gender === "MALE"} onChange={() => updateDraft({ gender: "MALE" })} />男</label>
          <label><input type="radio" name="gender" checked={draft.gender === "FEMALE"} onChange={() => updateDraft({ gender: "FEMALE" })} />女</label>
        </div>
        <p className="field-note">性别为后续模块预留，不参与当前基础四柱计算。</p>
      </fieldset>

      <fieldset className="form-section">
        <legend>5. 出生地 / 时区</legend>
        <div className="segmented-options location-mode-options">
          <label><input type="radio" name="location-mode" checked={draft.locationMode === "REGISTERED_LOCATION"} onChange={() => void selectLocationMode("REGISTERED_LOCATION")} />中国大陆（北京时间）</label>
          <label><input type="radio" name="location-mode" checked={draft.locationMode === "MANUAL_IANA"} onChange={() => void selectLocationMode("MANUAL_IANA")} />其他地区 / IANA</label>
        </div>
        <label className="field-stack"><span>{draft.locationMode === "REGISTERED_LOCATION" ? "出生城市/地区（选填，仅显示）" : "出生地名称"}</span><input aria-label="出生地名称" type="text" autoComplete="off" value={draft.displayLocationName} onChange={(event) => updateDraft({ displayLocationName: event.target.value })} /></label>
        {draft.locationMode === "MANUAL_IANA" ? (
          <label className="field-stack"><span>IANA 时区</span><select aria-label="IANA 时区" disabled={ianaLoading || ianaZones.length === 0} required value={draft.manualIanaTimezone} onChange={(event) => updateDraft({ manualIanaTimezone: event.target.value })}><option value="">{ianaLoading ? "正在加载正式时区目录…" : "请选择 IANA 时区"}</option>{ianaZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></label>
        ) : null}
        <p className="field-note">城市名称仅用于显示；当前基础排盘按所选正式时区计算，不使用真太阳时。</p>
      </fieldset>

      {errors.length > 0 ? <div className="form-error" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      {loadError ? <div className="form-error" role="alert"><p>排盘数据加载失败，请重新尝试。</p></div> : null}
      <button className="calculate-button" type="submit" disabled={busy}>{busy ? "正在排盘…" : pipeline ? "重新排盘" : "生成基础命盘"}</button>
      <p className="form-boundary">基础命理结构仅展示静态规则；不提供旺衰、喜用神、大运或运势解读。</p>
      {pipeline?.result.coreResult.status === "READY" && submittedDraft ? <BaziPillarResult pipeline={pipeline} submittedDraft={submittedDraft} /> : null}
      {pipeline?.result.coreResult.status === "BLOCKED" ? <BaziBlockedResult pipeline={pipeline} busy={busy} onFoldChoice={(choice) => void chooseFold(choice)} /> : null}
    </form>
  );
}
