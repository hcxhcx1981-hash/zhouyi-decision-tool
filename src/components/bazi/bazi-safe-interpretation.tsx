"use client";

import { useEffect, useRef, useState } from "react";
import type { PillarsFoundationResult } from "@/lib/bazi/foundation-runtime-types";
import { createLatestRequestGate, settleLatestRequest } from "@/lib/bazi/bazi-page-contract";
import { loadBaziInterpretationBrowserData } from "@/lib/browser/bazi-interpretation-data";
import { formatFiveElement } from "./bazi-foundation-presentation";
import {
  deriveBaziSafeInterpretation,
  type BaziSafeInterpretationViewModel,
  type SafePillarRelation,
} from "./bazi-safe-interpretation-presentation";

type InterpretationViewState =
  | { readonly status: "LOADING"; readonly resultIdentity: string }
  | { readonly status: "READY"; readonly resultIdentity: string; readonly value: BaziSafeInterpretationViewModel }
  | { readonly status: "ERROR"; readonly resultIdentity: string };

function PillarRelationCopy({ relation }: { relation: SafePillarRelation }) {
  if (relation.protocolEntry.gate === "SAFE_SEMANTIC_GLOSS") {
    return <p>{relation.protocolEntry.safeGloss.plainLanguage}</p>;
  }
  return (
    <>
      <p>当前仅展示结构关系，不提供传统主题解释。</p>
      <p>{relation.protocolEntry.factOnly.allowed}</p>
    </>
  );
}

function SafeInterpretationSection({ value }: { value: BaziSafeInterpretationViewModel }) {
  const dayMasterStandard = value.dayMaster.gloss.standardExpression ?? value.dayMaster.gloss.plainLanguage;
  return (
    <section
      className="bazi-safe-interpretation"
      id="bazi-safe-interpretation"
      aria-labelledby="bazi-safe-interpretation-title"
      data-count-policy={value.countPolicy.policyId}
    >
      <header className="bazi-safe-heading">
        <div>
          <h3 id="bazi-safe-interpretation-title">基础命理说明</h3>
          <span>Frozen Interpretation Protocol V{value.protocolVersion}</span>
        </div>
        <p>{value.interpretationGates.SAFE_SEMANTIC_GLOSS}</p>
      </header>

      <section className="bazi-safe-day-master" aria-labelledby="bazi-safe-day-master-title">
        <div>
          <span>日主</span>
          <h4 id="bazi-safe-day-master-title">{value.dayMaster.chinese}{formatFiveElement(value.dayMaster.element)}</h4>
        </div>
        <p>{dayMasterStandard}</p>
        <p>{value.dayMaster.gloss.plainLanguage}</p>
      </section>

      <section className="bazi-safe-subsection" aria-labelledby="bazi-safe-relations-title">
        <h4 id="bazi-safe-relations-title">四柱结构关系</h4>
        <div className="bazi-safe-relations">
          {value.pillarRelations.map((relation, index) => relation ? (
            <article key={relation.pillarLabel} data-gate={relation.protocolEntry.gate}>
              <span>{relation.pillarLabel}</span>
              <strong>{relation.stemChinese} → {relation.tenGod}</strong>
              <PillarRelationCopy relation={relation} />
            </article>
          ) : (
            <article className="unknown" key={`unknown-${index}`}>
              <span>时干</span>
              <strong>未知</strong>
              <p>出生时辰未知，不生成时柱解释。</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bazi-safe-subsection" aria-labelledby="bazi-hidden-facts-title">
        <h4 id="bazi-hidden-facts-title">藏干事实</h4>
        <dl className="bazi-hidden-facts">
          {value.hiddenStemFacts.map((fact, index) => fact ? (
            <div key={`${fact.pillarLabel}-${fact.branchChinese}`}>
              <dt>{fact.branchChinese}</dt>
              <dd>{fact.stemChinese.join("、")}</dd>
            </div>
          ) : (
            <div className="unknown" key={`unknown-hidden-${index}`}>
              <dt>时柱</dt>
              <dd>未知，不生成藏干说明</dd>
            </div>
          ))}
        </dl>
        <p className="bazi-safe-note">仅展示藏干成员，不区分主次，也不作强弱比较。</p>
        <details className="bazi-safe-policy-details">
          <summary>查看天干与藏干显示规则</summary>
          <ul>{value.visibleHiddenPolicy.allowedStatements.map((statement) => <li key={statement}>{statement}</li>)}</ul>
        </details>
      </section>

      <section className="bazi-safe-subsection" aria-labelledby="bazi-safe-gloss-title">
        <h4 id="bazi-safe-gloss-title">已冻结术语说明</h4>
        <div className="bazi-safe-gloss-list">
          {value.safeGlosses.map((gloss) => (
            <details key={gloss.semanticId} data-gate={gloss.gate}>
              <summary><span>{gloss.canonicalTerm}</span><small>SAFE</small></summary>
              {gloss.standardExpression ? <p>{gloss.standardExpression}</p> : null}
              <p>{gloss.plainLanguage}</p>
            </details>
          ))}
          {value.factOnlyTerms.map((term) => (
            <div className="bazi-fact-only-term" data-gate={term.gate} key={term.canonicalTerm}>
              <header><strong>{term.canonicalTerm}</strong><small>FACT_ONLY</small></header>
              <p>当前仅展示结构关系，不提供传统主题解释。</p>
              <p>{term.allowed}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bazi-safe-subsection" aria-labelledby="bazi-count-title">
        <h4 id="bazi-count-title">十神关系数量</h4>
        <ul className="bazi-count-facts">
          {value.tenGodCounts.map((entry) => <li key={entry.tenGod}>{entry.tenGod}关系出现 {entry.count} 次</li>)}
        </ul>
        <p className="bazi-count-boundary">数量统计不等同于命理判断。</p>
        <details className="bazi-safe-policy-details">
          <summary>查看数量规则</summary>
          <p>{value.countPolicy.allowedExample}</p>
          <p>{value.interpretationGates.FACT_ONLY}</p>
        </details>
      </section>

      <section className="bazi-interpretation-boundary" aria-labelledby="bazi-interpretation-boundary-title">
        <h4 id="bazi-interpretation-boundary-title">判断边界</h4>
        <p>{value.interpretationGates.CONTEXT_REQUIRED}</p>
        <ul>{value.knownLimitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </section>
    </section>
  );
}

export function BaziSafeInterpretation({
  foundation,
  resultIdentity,
}: {
  foundation: PillarsFoundationResult;
  resultIdentity: string;
}) {
  const [state, setState] = useState<InterpretationViewState>(() => ({ status: "LOADING", resultIdentity }));
  const requests = useRef(createLatestRequestGate());
  const visibleState: InterpretationViewState = state.resultIdentity === resultIdentity
    ? state
    : { status: "LOADING", resultIdentity };

  useEffect(() => {
    const gate = requests.current;
    const requestId = gate.begin();
    const task = loadBaziInterpretationBrowserData().then((loaded) => {
      const value = deriveBaziSafeInterpretation(loaded.data, foundation);
      if (!value) throw new Error("INTERPRETATION_FOUNDATION_REQUIRED");
      return value;
    });
    void settleLatestRequest(gate, requestId, task, {
      onSuccess: (value) => setState({ status: "READY", resultIdentity, value }),
      onError: () => setState({ status: "ERROR", resultIdentity }),
      onFinally: () => {},
    });
    return () => gate.invalidate();
  }, [foundation, resultIdentity]);

  return (
    <div data-interpretation-status={visibleState.status} data-interpretation-identity={resultIdentity}>
      {visibleState.status === "LOADING" ? <p className="bazi-interpretation-message" role="status">正在加载基础命理解释…</p> : null}
      {visibleState.status === "ERROR" ? (
        <section className="bazi-interpretation-fallback" role="status">
          <h3>基础命理说明暂时不可用</h3>
          <p>基础四柱和命盘结构仍可查看，请稍后重试解释区域。</p>
        </section>
      ) : null}
      {visibleState.status === "READY" ? <SafeInterpretationSection value={visibleState.value} /> : null}
    </div>
  );
}
