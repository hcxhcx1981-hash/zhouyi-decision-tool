"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { BaziCoreResult } from "@/lib/bazi/runtime-types";
import type { FoundationBrowserLoadResult } from "@/lib/browser/bazi-foundation-data";
import { loadBaziFoundationBrowserData } from "@/lib/browser/bazi-foundation-data";
import type {
  PillarFoundationResult,
  PillarsFoundationResult,
  TenGodCanonical,
} from "@/lib/bazi/foundation-runtime-types";
import { createLatestRequestGate, settleLatestRequest } from "@/lib/bazi/bazi-page-contract";
import {
  buildBaziClipboardText,
  copyBaziChartText,
  type BaziChartDisplayInput,
  type BaziFoundationClipboardSummary,
  type BaziPillarTexts,
} from "./bazi-chart-presentation";
import {
  deriveReadyCoreFoundation,
  formatFiveElement,
  formatYinYang,
} from "./bazi-foundation-presentation";
import {
  FOUNDATION_CURRENTLY_DETERMINABLE,
  FOUNDATION_NOT_YET_DETERMINABLE,
  getTenGodDisplayCopy,
} from "./ten-god-display-copy";
import { BaziSafeInterpretation } from "./bazi-safe-interpretation";

type FoundationViewState =
  | { readonly status: "LOADING"; readonly resultIdentity: string }
  | { readonly status: "READY"; readonly resultIdentity: string; readonly value: PillarsFoundationResult }
  | { readonly status: "ERROR"; readonly resultIdentity: string };

type CopyStatus = "IDLE" | "COPIED" | "FAILED";

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;
const STEM_LABELS = ["年干", "月干", "日干", "时干"] as const;

function DayMasterOverview({ value }: { value: PillarsFoundationResult }) {
  const dayMaster = value.day.stem;
  const element = formatFiveElement(dayMaster.element);
  return (
    <section className="bazi-day-master-overview" aria-labelledby="bazi-day-master-title">
      <span>命盘第一参照</span>
      <h2 id="bazi-day-master-title">你的日主</h2>
      <strong>{dayMaster.chinese}{element}</strong>
      <small>{dayMaster.chinese} · {formatYinYang(dayMaster.yinYang)} · {element}</small>
    </section>
  );
}

function TenGodTerm({ tenGod }: { tenGod: TenGodCanonical }) {
  const copy = getTenGodDisplayCopy(tenGod);
  return (
    <details className="bazi-ten-god-term">
      <summary>{tenGod}：这是什么意思？</summary>
      <p><strong>标准定义</strong>{copy.standard}</p>
      <p><strong>白话解释</strong>{copy.plain}</p>
    </details>
  );
}

function FoundationPillarCard({
  pillar,
  index,
  dayStem,
}: {
  pillar: PillarFoundationResult | null;
  index: number;
  dayStem: string;
}) {
  if (!pillar) {
    return (
      <article className="bazi-foundation-pillar unknown">
        <header><span>{PILLAR_LABELS[index]}</span><strong>未知</strong></header>
        <p>出生时辰未知，因此时柱及其相关基础命理信息不进行推测。</p>
      </article>
    );
  }

  const tenGodCopy = getTenGodDisplayCopy(pillar.stem.tenGod);
  const terms = Array.from(new Set([
    pillar.stem.tenGod,
    ...pillar.branch.hiddenStems.map((stem) => stem.tenGod),
  ]));

  return (
    <article className="bazi-foundation-pillar">
      <header><span>{PILLAR_LABELS[index]}</span><strong>{pillar.stem.chinese}{pillar.branch.chinese}</strong></header>
      <div className="bazi-foundation-standard">
        <h4>标准命理</h4>
        <dl>
          <div>
            <dt>天干</dt>
            <dd>{pillar.stem.chinese} · {formatYinYang(pillar.stem.yinYang)} · {formatFiveElement(pillar.stem.element)} · {pillar.stem.tenGod}</dd>
          </div>
          <div>
            <dt>地支</dt>
            <dd>{pillar.branch.chinese} · {formatYinYang(pillar.branch.yinYang)} · {formatFiveElement(pillar.branch.element)}</dd>
          </div>
          <div>
            <dt>藏干</dt>
            <dd className="bazi-hidden-stem-chips">
              {pillar.branch.hiddenStems.map((stem) => <span key={stem.stemId}>{stem.chinese} · {stem.tenGod}</span>)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="bazi-foundation-plain">
        <h4>白话解释</h4>
        <p>这里的“{pillar.stem.tenGod}”表示：{STEM_LABELS[index]}{pillar.stem.chinese}与日主{dayStem}之间，{tenGodCopy.plain}</p>
        <p className="bazi-judgment-boundary">当前只能确认这种十神关系存在；它具体对应何种人生意义，需要后续经过验证的完整命局规则才能判断。</p>
      </div>
      <div className="bazi-ten-god-terms">{terms.map((tenGod) => <TenGodTerm tenGod={tenGod} key={tenGod} />)}</div>
    </article>
  );
}

function toClipboardSummary(value: PillarsFoundationResult): BaziFoundationClipboardSummary {
  const pillars = [value.year, value.month, value.day, value.hour] as const;
  return {
    dayMaster: {
      chinese: value.day.stem.chinese,
      yinYangLabel: formatYinYang(value.day.stem.yinYang),
      elementLabel: formatFiveElement(value.day.stem.element),
    },
    stemTenGods: pillars.map((pillar, index) => pillar ? {
      pillarLabel: STEM_LABELS[index],
      stemChinese: pillar.stem.chinese,
      tenGod: pillar.stem.tenGod,
    } : null),
  };
}

function FoundationExplanation({
  value,
  pillars,
  displayInput,
  copyStatus,
  onCopy,
}: {
  value: PillarsFoundationResult;
  pillars: BaziPillarTexts;
  displayInput: BaziChartDisplayInput;
  copyStatus: CopyStatus;
  onCopy: (text: string) => void;
}) {
  const foundationPillars = [value.year, value.month, value.day, value.hour] as const;
  const clipboardText = buildBaziClipboardText(pillars, displayInput, toClipboardSummary(value));
  return (
    <>
      <div className="bazi-explanation-cta-area">
        <a className="bazi-explanation-cta" href="#bazi-foundation-explanation">查看命盘说明</a>
        <p>先看白话说明；标准术语和技术依据仍完整保留。</p>
      </div>
      <section className="bazi-foundation-section" id="bazi-foundation-explanation" aria-labelledby="bazi-foundation-title">
        <div className="bazi-foundation-heading">
          <div><h3 id="bazi-foundation-title">基础命理结构</h3><span>标准命理 + 白话解释</span></div>
          <p>当前仅说明阴阳五行、藏干成员与十神关系，不代表旺衰、喜忌或吉凶判断。</p>
        </div>
        <div className="bazi-foundation-pillars">
          {foundationPillars.map((pillar, index) => (
            <FoundationPillarCard pillar={pillar} index={index} dayStem={value.day.stem.chinese} key={PILLAR_LABELS[index]} />
          ))}
        </div>
        <p className="bazi-foundation-order-note">藏干仅按成员展示，不区分主次。</p>
        <section className="bazi-foundation-capabilities" aria-label="你的命盘当前能看懂什么">
          <h3>你的命盘当前能看懂什么</h3>
          <div className="bazi-capability-boundary">
            <div><h4>当前已经能确定</h4><ul>{FOUNDATION_CURRENTLY_DETERMINABLE.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h4>现在还不能直接判断</h4><ul>{FOUNDATION_NOT_YET_DETERMINABLE.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
          <p>这些结论需要更多已经验证的传统命理规则，当前版本不会仅凭几个十神直接下结论。</p>
        </section>
        <details className="bazi-foundation-technical">
          <summary>查看基础命理技术依据</summary>
          <p>藏干技术语义：orderSemantics=NONE。</p>
        </details>
        <details className="bazi-copy-details">
          <summary>更多 / 分享 / 技术资料</summary>
          <button type="button" className="bazi-copy-button" onClick={() => onCopy(clipboardText)}>复制命盘资料</button>
          <p className={`bazi-copy-status ${copyStatus.toLowerCase()}`} aria-live="polite">
            {copyStatus === "COPIED" ? "已复制命盘资料。" : copyStatus === "FAILED" ? "复制失败，请手动选择命盘内容。" : "复制仅在点击后进行，不会保存出生资料。"}
          </p>
        </details>
      </section>
    </>
  );
}

export function BaziFoundationResult({
  coreResult,
  resultIdentity,
  pillars,
  displayInput,
  children,
}: {
  coreResult: BaziCoreResult;
  resultIdentity: string;
  pillars: BaziPillarTexts;
  displayInput: BaziChartDisplayInput;
  children: ReactNode;
}) {
  const [state, setState] = useState<FoundationViewState>(() => ({ status: "LOADING", resultIdentity }));
  const [copyState, setCopyState] = useState<{ readonly resultIdentity: string; readonly status: CopyStatus }>(() => ({ resultIdentity, status: "IDLE" }));
  const requests = useRef(createLatestRequestGate());
  const loadPromise = useRef<Promise<FoundationBrowserLoadResult> | null>(null);
  const visibleState: FoundationViewState = state.resultIdentity === resultIdentity ? state : { status: "LOADING", resultIdentity };
  const visibleCopyStatus = copyState.resultIdentity === resultIdentity ? copyState.status : "IDLE";

  useEffect(() => {
    const gate = requests.current;
    const requestId = gate.begin();
    loadPromise.current ??= loadBaziFoundationBrowserData();
    const task = loadPromise.current.then((loaded) => {
      const derived = deriveReadyCoreFoundation(loaded.data, coreResult);
      if (!derived?.ok) throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
      return derived.value;
    });
    void settleLatestRequest(gate, requestId, task, {
      onSuccess: (value) => setState({ status: "READY", resultIdentity, value }),
      onError: () => setState({ status: "ERROR", resultIdentity }),
      onFinally: () => {},
    });
    return () => gate.invalidate();
  }, [coreResult, resultIdentity]);

  async function copyChart(text: string) {
    const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard ?? null;
    const copied = await copyBaziChartText(text, clipboard);
    setCopyState({ resultIdentity, status: copied ? "COPIED" : "FAILED" });
  }

  return (
    <>
      <div data-foundation-status={visibleState.status} data-foundation-identity={resultIdentity}>
        {visibleState.status === "READY" ? <DayMasterOverview value={visibleState.value} /> : null}
        {visibleState.status === "LOADING" ? <p className="bazi-foundation-message" role="status">正在加载基础命理说明…</p> : null}
        {visibleState.status === "ERROR" ? <p className="bazi-foundation-message error" role="status">基础命理说明暂时无法加载，四柱排盘结果不受影响。</p> : null}
      </div>
      {children}
      {visibleState.status === "READY" ? (
        <>
          <FoundationExplanation
            value={visibleState.value}
            pillars={pillars}
            displayInput={displayInput}
            copyStatus={visibleCopyStatus}
            onCopy={(text) => void copyChart(text)}
          />
          <BaziSafeInterpretation foundation={visibleState.value} resultIdentity={resultIdentity} />
        </>
      ) : null}
    </>
  );
}
