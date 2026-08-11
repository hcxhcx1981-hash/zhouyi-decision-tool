"use client";
import type { BaziBrowserPipelineResult } from "@/lib/bazi/bazi-browser-pipeline";
import type { BaziPageDraft } from "@/lib/bazi/bazi-page-contract";
import { BOUNDARY_SENSITIVE_MESSAGE } from "@/lib/bazi/bazi-result-messages";
import { BaziFoundationResult } from "./bazi-foundation-result";
import {
  BAZI_BROWSER_RUNTIME_VERSION,
  formatBaziOverview,
  formatBirthDisplay,
  formatGenderDisplay,
  formatLocationDisplay,
  type BaziChartDisplayInput,
  type BaziPillarTexts,
} from "./bazi-chart-presentation";

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;

export function BaziPillarResult({ pipeline, submittedDraft }: { pipeline: BaziBrowserPipelineResult; submittedDraft: BaziPageDraft }) {
  const { coreResult } = pipeline.result;
  if (coreResult.status !== "READY") return null;
  const { yearPillar, monthPillar, dayPillar, hourPillar } = coreResult;
  if (!yearPillar || !monthPillar || !dayPillar) return null;
  const pillarObjects = [yearPillar, monthPillar, dayPillar, hourPillar];
  const pillars: BaziPillarTexts = [yearPillar.text, monthPillar.text, dayPillar.text, hourPillar?.text ?? null];
  const audit = coreResult.audit;
  const foundationIdentity = JSON.stringify([
    submittedDraft.localDate,
    submittedDraft.localTime,
    submittedDraft.timeKnown,
    submittedDraft.selectionMode,
    submittedDraft.registeredLocationId,
    submittedDraft.manualIanaTimezone,
    ...pillars,
  ]);
  const displayInput: BaziChartDisplayInput = {
    localDate: submittedDraft.localDate,
    localTime: submittedDraft.localTime,
    timeKnown: submittedDraft.timeKnown,
    gender: submittedDraft.gender,
    locationName: submittedDraft.locationName,
    locationMode: submittedDraft.selectionMode,
    ianaTimezone: pipeline.result.locationAudit.resolvedIanaTimezone,
  };

  return (
    <section className="bazi-result" aria-live="polite" data-bazi-status="READY">
      <div className="bazi-result-heading">
        <span className="module-status available">基础四柱排盘完成</span>
        <h2>基础四柱</h2>
      </div>
      <BaziFoundationResult
        coreResult={coreResult}
        resultIdentity={foundationIdentity}
        pillars={pillars}
        displayInput={displayInput}
      >
        <section className="bazi-standard-chart" aria-labelledby="bazi-standard-chart-title">
          <div className="bazi-standard-chart-heading">
            <h3 id="bazi-standard-chart-title">标准命盘</h3>
            <span>年柱 · 月柱 · 日柱 · 时柱</span>
          </div>
          <div className="bazi-overview" aria-label={`八字 ${formatBaziOverview(pillars)}`}>
            <span>八字</span>
            <strong>{formatBaziOverview(pillars)}</strong>
            {coreResult.completeness === "THREE_PILLARS_ONLY" ? <small>三柱已确定，时柱未知。</small> : null}
          </div>
          <div className="bazi-pillar-grid">
            {pillarObjects.map((pillar, index) => (
              <article className={`bazi-pillar-card${pillar ? "" : " unknown"}${index === 2 ? " day-pillar" : ""}`} key={PILLAR_LABELS[index]}>
                <span>{PILLAR_LABELS[index]}</span>
                {pillar ? <strong aria-label={`${PILLAR_LABELS[index]} ${pillar.text}`}><b>{pillar.stem}</b><b>{pillar.branch}</b></strong> : <strong>未知</strong>}
                {index === 2 && pillar ? <small>日主：{pillar.stem}</small> : null}
              </article>
            ))}
          </div>
          {coreResult.completeness === "THREE_PILLARS_ONLY" ? (
            <p className="bazi-result-note">当前仅生成三柱；未根据未知时辰猜测时柱。</p>
          ) : null}
          {coreResult.warnings.includes("BOUNDARY_SENSITIVE") ? (
            <p className="bazi-boundary-warning" role="status">{BOUNDARY_SENSITIVE_MESSAGE}</p>
          ) : null}
        </section>
      </BaziFoundationResult>
      <section className="bazi-summary-section" aria-labelledby="bazi-summary-title">
        <h3 id="bazi-summary-title">排盘资料</h3>
        <dl className="bazi-summary-list">
          <div><dt>出生</dt><dd>{formatBirthDisplay(displayInput)}</dd></div>
          <div><dt>未知时辰</dt><dd>{displayInput.timeKnown ? "否" : "是"}</dd></div>
          <div><dt>性别</dt><dd>{formatGenderDisplay(displayInput.gender)}</dd></div>
          <div><dt>地点</dt><dd>{formatLocationDisplay(displayInput)}</dd></div>
          <div><dt>时区</dt><dd>{displayInput.ianaTimezone ?? "未解析"}</dd></div>
        </dl>
      </section>
      <details className="bazi-audit-details">
        <summary>排盘依据</summary>
        <dl>
          <div><dt>历法</dt><dd>公历</dd></div>
          <div><dt>时区</dt><dd>{displayInput.ianaTimezone ?? "未解析"}</dd></div>
          <div><dt>历法规则</dt><dd>{audit.rulesVersion}</dd></div>
          <div><dt>节气数据</dt><dd>{audit.datasetVersion}</dd></div>
          <div><dt>时区数据</dt><dd>{audit.timezoneDataVersion}</dd></div>
        </dl>
        <details className="bazi-technical-audit">
          <summary>查看技术审计</summary>
          <dl>
            <div><dt>地点时区状态</dt><dd>{pipeline.result.locationAudit.locationTimezoneStatus}</dd></div>
            <div><dt>地点选择模式</dt><dd>{pipeline.result.locationAudit.locationSelectionMode}</dd></div>
            <div><dt>节气 dataset</dt><dd>{audit.datasetVersion}</dd></div>
            <div><dt>地点 dataset</dt><dd>{pipeline.result.locationAudit.locationRegistryVersion}</dd></div>
            <div><dt>浏览器 runtime</dt><dd>{BAZI_BROWSER_RUNTIME_VERSION}</dd></div>
            <div><dt>已应用规则</dt><dd>{audit.appliedRuleIds.length} 条</dd></div>
          </dl>
          <p className="bazi-rule-ids">{audit.appliedRuleIds.join(" · ")}</p>
        </details>
      </details>
    </section>
  );
}
