"use client";

import { useEffect, useRef, useState } from "react";
import type { BaziCoreResult } from "@/lib/bazi/runtime-types";
import type { FoundationBrowserLoadResult } from "@/lib/browser/bazi-foundation-data";
import { loadBaziFoundationBrowserData } from "@/lib/browser/bazi-foundation-data";
import type { PillarsFoundationResult } from "@/lib/bazi/foundation-runtime-types";
import {
  createLatestRequestGate,
  settleLatestRequest,
} from "@/lib/bazi/bazi-page-contract";
import {
  deriveReadyCoreFoundation,
  formatFiveElement,
  formatYinYang,
} from "./bazi-foundation-presentation";

type FoundationViewState =
  | { readonly status: "LOADING"; readonly resultIdentity: string }
  | { readonly status: "READY"; readonly resultIdentity: string; readonly value: PillarsFoundationResult; readonly loadedBytes: number }
  | { readonly status: "ERROR"; readonly resultIdentity: string };

const PILLAR_LABELS = ["年柱", "月柱", "日柱", "时柱"] as const;

function FoundationStructure({ value }: { value: PillarsFoundationResult }) {
  const pillars = [value.year, value.month, value.day, value.hour] as const;
  const dayMaster = value.day.stem;
  return (
    <>
      <div className="bazi-foundation-day-master">
        <span>日主</span>
        <strong>{dayMaster.chinese}</strong>
        <small>
          {dayMaster.chinese} · {formatYinYang(dayMaster.yinYang)} · {formatFiveElement(dayMaster.element)}
        </small>
      </div>
      <div className="bazi-foundation-pillars">
        {pillars.map((pillar, index) => (
          <article className={`bazi-foundation-pillar${pillar ? "" : " unknown"}`} key={PILLAR_LABELS[index]}>
            <header>
              <span>{PILLAR_LABELS[index]}</span>
              <strong>{pillar ? `${pillar.stem.chinese}${pillar.branch.chinese}` : "未知"}</strong>
            </header>
            {pillar ? (
              <dl>
                <div>
                  <dt>天干</dt>
                  <dd>
                    {pillar.stem.chinese} · {formatYinYang(pillar.stem.yinYang)} · {formatFiveElement(pillar.stem.element)} · {pillar.stem.tenGod}
                  </dd>
                </div>
                <div>
                  <dt>地支</dt>
                  <dd>
                    {pillar.branch.chinese} · {formatYinYang(pillar.branch.yinYang)} · {formatFiveElement(pillar.branch.element)}
                  </dd>
                </div>
                <div>
                  <dt>藏干</dt>
                  <dd className="bazi-hidden-stem-chips">
                    {pillar.branch.hiddenStems.map((stem) => (
                      <span key={stem.stemId}>{stem.chinese} · {stem.tenGod}</span>
                    ))}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>未根据未知时辰猜测十神或藏干。</p>
            )}
          </article>
        ))}
      </div>
      <p className="bazi-foundation-order-note">藏干成员并列展示，顺序语义：NONE。</p>
    </>
  );
}

export function BaziFoundationResult({
  coreResult,
  resultIdentity,
}: {
  coreResult: BaziCoreResult;
  resultIdentity: string;
}) {
  const [state, setState] = useState<FoundationViewState>(() => ({
    status: "LOADING",
    resultIdentity,
  }));
  const requests = useRef(createLatestRequestGate());
  const loadPromise = useRef<Promise<FoundationBrowserLoadResult> | null>(null);
  const visibleState: FoundationViewState =
    state.resultIdentity === resultIdentity
      ? state
      : { status: "LOADING", resultIdentity };

  useEffect(() => {
    const gate = requests.current;
    const requestId = gate.begin();
    loadPromise.current ??= loadBaziFoundationBrowserData();
    const task = loadPromise.current.then((loaded) => {
      const derived = deriveReadyCoreFoundation(loaded.data, coreResult);
      if (!derived?.ok) throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
      return { value: derived.value, loadedBytes: loaded.loadedBytes };
    });
    void settleLatestRequest(gate, requestId, task, {
      onSuccess: ({ value, loadedBytes }) => setState({ status: "READY", resultIdentity, value, loadedBytes }),
      onError: () => setState({ status: "ERROR", resultIdentity }),
      onFinally: () => {},
    });
    return () => gate.invalidate();
  }, [coreResult, resultIdentity]);

  return (
    <section
      className="bazi-foundation-section"
      aria-labelledby="bazi-foundation-title"
      data-foundation-status={visibleState.status}
      data-foundation-identity={resultIdentity}
    >
      <div className="bazi-foundation-heading">
        <div>
          <h3 id="bazi-foundation-title">基础命理结构</h3>
          <span>静态规则展示</span>
        </div>
        <p>当前仅展示阴阳五行、藏干成员与十神对应，不代表旺衰、喜忌或吉凶判断。</p>
      </div>
      {visibleState.status === "LOADING" ? <p className="bazi-foundation-message" role="status">正在加载基础命理信息…</p> : null}
      {visibleState.status === "ERROR" ? (
        <p className="bazi-foundation-message error" role="status">基础命理信息暂时无法加载，四柱排盘结果不受影响。</p>
      ) : null}
      {visibleState.status === "READY" ? <FoundationStructure value={visibleState.value} /> : null}
    </section>
  );
}
