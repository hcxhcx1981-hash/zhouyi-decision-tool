"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BaziFoundationData,
  PillarsFoundationResult,
} from "@/lib/bazi/foundation-runtime-types";
import type { InterpretationProtocol } from "@/lib/bazi/interpretation-runtime-types";
import type { BaziCoreResult } from "@/lib/bazi/runtime-types";
import { createLatestRequestGate, settleLatestRequest } from "@/lib/bazi/bazi-page-contract";
import { loadBaziInterpretationBrowserData } from "@/lib/browser/bazi-interpretation-data";
import { formatFiveElement, formatYinYang } from "./bazi-foundation-presentation";
import {
  deriveBaziExplanationReport,
  type BaziExplanationReportViewModel,
  type InterpretationAvailability,
} from "./bazi-explanation-runtime-adapter";
import type { TenGodProtocolEntry } from "./bazi-safe-interpretation-presentation";

type InterpretationState =
  | { readonly status: "LOADING"; readonly resultIdentity: string }
  | {
      readonly status: "READY";
      readonly resultIdentity: string;
      readonly value: InterpretationProtocol;
    }
  | { readonly status: "ERROR"; readonly resultIdentity: string };

function RelationRuntimeCopy({ entry }: { entry: TenGodProtocolEntry | null }) {
  if (!entry) return null;
  if (entry.gate === "SAFE_SEMANTIC_GLOSS") {
    return <p>{entry.safeGloss.plainLanguage}</p>;
  }
  return <p>{entry.factOnly.allowed}</p>;
}

function SectionHeading({ number, title }: { number: number; title: string }) {
  return <h4>{number}. {title}</h4>;
}

function ChartSummarySection({ value }: { value: BaziExplanationReportViewModel }) {
  return (
    <section
      className="bazi-safe-subsection"
      aria-labelledby="bazi-explanation-summary-title"
      data-section-id="A_BASIC_CHART_SUMMARY"
      data-section-status={value.sectionStatus.A_BASIC_CHART_SUMMARY}
    >
      <SectionHeading number={1} title="命盘摘要" />
      <div className="bazi-safe-relations" id="bazi-explanation-summary-title">
        {value.summary.pillars.map((pillar) => (
          <article className={pillar.text ? "" : "unknown"} key={pillar.kind}>
            <span>{pillar.label}</span>
            <strong>{pillar.text ?? "未知"}</strong>
            {pillar.text ? null : <p>时辰未知，不补全时柱。</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function DayMasterSection({ value }: { value: BaziExplanationReportViewModel }) {
  const gloss = value.dayMaster.gloss;
  return (
    <section
      className="bazi-safe-subsection"
      aria-labelledby="bazi-explanation-day-master-title"
      data-section-id="B_DAY_MASTER_GLOSS"
      data-section-status={value.sectionStatus.B_DAY_MASTER_GLOSS}
    >
      <SectionHeading number={2} title="日主说明" />
      <div className="bazi-safe-day-master" id="bazi-explanation-day-master-title">
        <div>
          <span>日主</span>
          <h4>{value.dayMaster.chinese}{formatFiveElement(value.dayMaster.element)}</h4>
        </div>
        <p>{formatYinYang(value.dayMaster.yinYang)} · {formatFiveElement(value.dayMaster.element)}</p>
        {gloss?.standardExpression ? <p>{gloss.standardExpression}</p> : null}
        {gloss ? <p>{gloss.plainLanguage}</p> : <p>正式 SAFE 说明当前不可用，日主事实仍保留。</p>}
      </div>
    </section>
  );
}

function TenGodStructureSection({ value }: { value: BaziExplanationReportViewModel }) {
  return (
    <section
      className="bazi-safe-subsection"
      aria-labelledby="bazi-explanation-ten-god-title"
      data-section-id="C_TEN_GOD_STRUCTURE_FACTS"
      data-section-status={value.sectionStatus.C_TEN_GOD_STRUCTURE_FACTS}
    >
      <SectionHeading number={3} title="十神关系说明" />
      <div className="bazi-safe-relations" id="bazi-explanation-ten-god-title">
        {value.tenGodStructure.relations.map((relation, index) => relation ? (
          <article key={relation.pillarKind} data-gate={relation.protocolEntry?.gate ?? "FACT_ONLY"}>
            <span>{relation.pillarLabel}</span>
            <strong>{relation.stemChinese} → {relation.tenGod}</strong>
            <RelationRuntimeCopy entry={relation.protocolEntry} />
          </article>
        ) : (
          <article className="unknown" key={`unknown-relation-${index}`}>
            <span>时柱</span>
            <strong>未知</strong>
            <p>不生成时柱关系。</p>
          </article>
        ))}
      </div>
      <dl className="bazi-hidden-facts">
        {value.tenGodStructure.hiddenRelations.map((relation, index) => relation ? (
          <div key={`${relation.pillarLabel}-${relation.branchChinese}`}>
            <dt>{relation.branchChinese}藏干成员</dt>
            <dd>{relation.members.map((member) => `${member.stemChinese} · ${member.tenGod}`).join("、")}</dd>
          </div>
        ) : (
          <div className="unknown" key={`unknown-hidden-relation-${index}`}>
            <dt>时柱</dt>
            <dd>未知，不生成藏干关系</dd>
          </div>
        ))}
      </dl>
      {value.tenGodStructure.countPolicyId ? (
        <>
          <ul className="bazi-count-facts">
            {value.tenGodStructure.counts.map((entry) => (
              <li key={entry.tenGod}>{entry.tenGod}关系出现 {entry.count} 次</li>
            ))}
          </ul>
          <p className="bazi-count-boundary">数量统计不等同于命理判断。</p>
        </>
      ) : <p className="bazi-safe-note">正式数量政策当前不可用，因此不展示数量。</p>}
    </section>
  );
}

function TraditionalObservationSection({ value }: { value: BaziExplanationReportViewModel }) {
  const available = value.sectionStatus.D_TRADITIONAL_OBSERVATION_ENTRY === "READY";
  return (
    <section
      className="bazi-safe-subsection"
      aria-labelledby="bazi-explanation-traditional-title"
      data-section-id="D_TRADITIONAL_OBSERVATION_ENTRY"
      data-section-status={value.sectionStatus.D_TRADITIONAL_OBSERVATION_ENTRY}
    >
      <SectionHeading number={4} title="传统观察入口" />
      <div className="bazi-safe-gloss-list" id="bazi-explanation-traditional-title">
        {available ? value.traditionalObservation.safeGlosses.map((gloss) => (
          <details key={gloss.semanticId} data-gate={gloss.gate}>
            <summary><span>{gloss.canonicalTerm}</span><small>SAFE</small></summary>
            {gloss.standardExpression ? <p>{gloss.standardExpression}</p> : null}
            <p>{gloss.plainLanguage}</p>
          </details>
        )) : null}
        {available ? value.traditionalObservation.factOnlyTerms.map((term) => (
          <div className="bazi-fact-only-term" data-gate={term.gate} key={term.canonicalTerm}>
            <header><strong>{term.canonicalTerm}</strong><small>FACT_ONLY</small></header>
            <p>{term.allowed}</p>
          </div>
        )) : null}
      </div>
      {available ? null : <p className="bazi-safe-note">正式 SAFE Runtime 当前不可用，本节不回退硬编码解释。</p>}
    </section>
  );
}

function StrengthFactSection({ value }: { value: BaziExplanationReportViewModel }) {
  const facts = value.strengthFact.facts;
  return (
    <section
      className="bazi-safe-subsection"
      aria-labelledby="bazi-explanation-strength-fact-title"
      data-section-id="E_STRENGTH_FACT_ENTRY"
      data-section-status={value.sectionStatus.E_STRENGTH_FACT_ENTRY}
      data-strength-status={value.strengthFact.status}
    >
      <SectionHeading number={5} title="旺衰事实入口" />
      {facts ? (
        <div id="bazi-explanation-strength-fact-title">
          <div className="bazi-safe-day-master">
            <div><span>月令载体</span><h4>{facts.month_order_fact.monthBranch}</h4></div>
            <p>{facts.month_order_fact.description}</p>
            <p>节气边界：{facts.month_order_fact.jieqiBoundaryUsed}</p>
          </div>
          <div className="bazi-safe-gloss-list">
            {facts.stem_root_presence.map((fact) => (
              <div className="bazi-fact-only-term" data-gate={fact.gate} key={fact.stemId}>
                <header><strong>{fact.stem}</strong><small>FACT_ONLY</small></header>
                <p>{fact.statement}</p>
                <p>匹配地支：{fact.matchedBranches.length > 0 ? fact.matchedBranches.join("、") : "未发现"}</p>
              </div>
            ))}
          </div>
          <details className="bazi-safe-policy-details">
            <summary>查看天干与藏干成员事实</summary>
            <ul>
              {facts.visible_stem_fact.map((fact) => <li key={`visible-${fact.stemId}`}>{fact.statement}</li>)}
              {facts.hidden_stem_presence_fact.map((fact) => <li key={`hidden-${fact.stemId}`}>{fact.statement}</li>)}
            </ul>
          </details>
          <details className="bazi-safe-policy-details">
            <summary>查看事实依赖</summary>
            <p>Foundation {facts.dependency_audit.foundation.version} · {facts.dependency_audit.completeness}</p>
            <p>月界 {facts.dependency_audit.monthBoundary.matchedBoundaryUtc}</p>
          </details>
          <p className="bazi-count-boundary">以上只表示可确定的结构事实，不生成个人结论。</p>
        </div>
      ) : (
        <p id="bazi-explanation-strength-fact-title" className="bazi-safe-note">事实入口当前不可用，不生成替代解释。</p>
      )}
    </section>
  );
}

function BoundarySection({ value }: { value: BaziExplanationReportViewModel }) {
  return (
    <section
      className="bazi-interpretation-boundary"
      aria-labelledby="bazi-explanation-boundary-title"
      data-section-id="F_CURRENT_LIMITATIONS"
      data-section-status={value.sectionStatus.F_CURRENT_LIMITATIONS}
    >
      <SectionHeading number={6} title="判断边界" />
      <div id="bazi-explanation-boundary-title">
        {value.boundary.contextStatement ? <p>{value.boundary.contextStatement}</p> : null}
        {value.boundary.runtimeStatement ? <p>{value.boundary.runtimeStatement}</p> : null}
        <p>{value.boundary.adapterStatement}</p>
      </div>
    </section>
  );
}

function ExplanationReport({ value }: { value: BaziExplanationReportViewModel }) {
  return (
    <section
      className="bazi-safe-interpretation bazi-explanation-report"
      id="bazi-explanation-report"
      aria-labelledby="bazi-explanation-report-title"
      data-explanation-report-status={value.reportStatus}
      data-explanation-protocol={value.protocolId}
      data-research-runtime-read={String(value.researchRuntimeRead)}
    >
      <header className="bazi-safe-heading">
        <div>
          <h3 id="bazi-explanation-report-title">基础命盘解读</h3>
          <span>Explanation Orchestration V{value.protocolVersion}</span>
        </div>
        <p>既有事实与正式 SAFE 说明按固定顺序编排。</p>
      </header>
      <ChartSummarySection value={value} />
      <DayMasterSection value={value} />
      <TenGodStructureSection value={value} />
      <TraditionalObservationSection value={value} />
      <StrengthFactSection value={value} />
      <BoundarySection value={value} />
    </section>
  );
}

export function BaziExplanationReport({
  coreResult,
  foundationData,
  foundation,
  resultIdentity,
}: {
  coreResult: BaziCoreResult;
  foundationData: BaziFoundationData;
  foundation: PillarsFoundationResult;
  resultIdentity: string;
}) {
  const [state, setState] = useState<InterpretationState>(() => ({
    status: "LOADING",
    resultIdentity,
  }));
  const requests = useRef(createLatestRequestGate());
  const visibleState: InterpretationState = state.resultIdentity === resultIdentity
    ? state
    : { status: "LOADING", resultIdentity };

  useEffect(() => {
    const gate = requests.current;
    const requestId = gate.begin();
    void settleLatestRequest(gate, requestId, loadBaziInterpretationBrowserData(), {
      onSuccess: (loaded) => setState({ status: "READY", resultIdentity, value: loaded.data }),
      onError: () => setState({ status: "ERROR", resultIdentity }),
      onFinally: () => {},
    });
    return () => gate.invalidate();
  }, [resultIdentity]);

  const availability = visibleState.status as InterpretationAvailability;
  const value = deriveBaziExplanationReport({
    coreResult,
    foundationData,
    foundation,
    interpretation: visibleState.status === "READY" ? visibleState.value : null,
    interpretationAvailability: availability,
  });
  if (!value) return null;

  return (
    <div
      data-explanation-status={visibleState.status}
      data-explanation-identity={resultIdentity}
    >
      {visibleState.status === "LOADING" ? <p className="bazi-interpretation-message" role="status">正在加载正式 SAFE 说明…</p> : null}
      {visibleState.status === "ERROR" ? <p className="bazi-interpretation-message" role="status">正式 SAFE 说明暂时不可用，事实章节仍可查看。</p> : null}
      <ExplanationReport value={value} />
    </div>
  );
}
