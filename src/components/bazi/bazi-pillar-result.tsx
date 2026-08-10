import type { BaziBrowserPipelineResult } from "@/lib/bazi/bazi-browser-pipeline";
import { BOUNDARY_SENSITIVE_MESSAGE } from "@/lib/bazi/bazi-result-messages";

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;

export function BaziPillarResult({ pipeline }: { pipeline: BaziBrowserPipelineResult }) {
  const { coreResult } = pipeline.result;
  if (coreResult.status !== "READY") return null;
  const pillars = [coreResult.yearPillar, coreResult.monthPillar, coreResult.dayPillar, coreResult.hourPillar];
  const audit = coreResult.audit;

  return (
    <section className="bazi-result" aria-live="polite" data-bazi-status="READY">
      <div className="bazi-result-heading">
        <span className="module-status available">基础四柱排盘完成</span>
        <h2>{coreResult.completeness === "THREE_PILLARS_ONLY" ? "基础三柱" : "基础四柱"}</h2>
      </div>
      <div className="bazi-pillar-grid">
        {pillars.map((pillar, index) => (
          <article className={`bazi-pillar-card${pillar ? "" : " unknown"}`} key={PILLAR_LABELS[index]}>
            <span>{PILLAR_LABELS[index]}</span>
            {pillar ? <strong aria-label={`${PILLAR_LABELS[index]} ${pillar.text}`}><b>{pillar.stem}</b><b>{pillar.branch}</b></strong> : <strong>未知</strong>}
          </article>
        ))}
      </div>
      {coreResult.completeness === "THREE_PILLARS_ONLY" ? (
        <p className="bazi-result-note">当前仅生成三柱；未根据未知时辰猜测时柱。</p>
      ) : null}
      {coreResult.warnings.includes("BOUNDARY_SENSITIVE") ? (
        <p className="bazi-boundary-warning" role="status">{BOUNDARY_SENSITIVE_MESSAGE}</p>
      ) : null}
      <details className="bazi-audit-details">
        <summary>排盘依据</summary>
        <dl>
          <div><dt>历法规则</dt><dd>{audit.rulesVersion}</dd></div>
          <div><dt>节气数据</dt><dd>{audit.datasetVersion}</dd></div>
          <div><dt>IANA 时区</dt><dd>{pipeline.result.locationAudit.resolvedIanaTimezone ?? "未解析"}</dd></div>
          <div><dt>时区数据</dt><dd>{audit.timezoneDataVersion}</dd></div>
          <div><dt>地点状态</dt><dd>{pipeline.result.locationAudit.locationTimezoneStatus}</dd></div>
          <div><dt>已应用规则</dt><dd>{audit.appliedRuleIds.length} 条</dd></div>
        </dl>
        <p className="bazi-rule-ids">{audit.appliedRuleIds.join(" · ")}</p>
      </details>
    </section>
  );
}
