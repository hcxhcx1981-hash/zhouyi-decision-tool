"use client";

import { FormEvent, useState } from "react";
import {
  calculateDivination,
  type DivinationResult,
  type Polarity,
  type RuntimeDivinationRules,
  type SelectionRole,
  type SelectionTarget,
  type YaoValue,
} from "@/lib/divination";
import type { HexagramContent } from "@/lib/hexagram-data";

const POSITION_LABELS = ["初", "二", "三", "四", "五", "上"];
const YAO_NAMES: Record<YaoValue, string> = {
  6: "老阴 · 动",
  7: "少阳 · 静",
  8: "少阴 · 静",
  9: "老阳 · 动",
};
const ROLE_LABELS: Record<SelectionRole, string> = {
  primary: "主辞",
  secondary: "辅辞",
  zhen_unranked: "贞 · 未定主次",
  hui_unranked: "悔 · 未定主次",
};

interface DecisionWorkbenchProps {
  hexagrams: HexagramContent[];
  productName: string;
  rules: RuntimeDivinationRules;
}

function HexagramLines({ bits }: { bits: Polarity[] }) {
  return (
    <div className="hexagram-lines" aria-label="卦象（上爻在上，初爻在下）">
      {[...bits].reverse().map((bit, index) => (
        <div className="hexagram-line" key={`${bit}-${index}`}>
          {bit === 1 ? (
            <span className="yang-line" />
          ) : (
            <span className="yin-line">
              <i />
              <i />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function getHexagram(hexagrams: HexagramContent[], key: string) {
  return hexagrams.find((hexagram) => hexagram.key === key);
}

function hexagramTitle(hexagram: HexagramContent | undefined, key: string) {
  return hexagram
    ? `${hexagram.hexagram_id}. ${hexagram.name} · ${hexagram.lower_trigram}下${hexagram.upper_trigram}上`
    : `资料未接入 · 六爻码 ${key}`;
}

function SourceSelection({
  target,
  result,
  hexagrams,
}: {
  target: SelectionTarget;
  result: DivinationResult;
  hexagrams: HexagramContent[];
}) {
  const key = target.hexagram === "original" ? result.originalKey : result.changedKey;
  const hexagram = getHexagram(hexagrams, key);
  const side = target.hexagram === "original" ? "本卦" : "之卦";

  if (!hexagram) {
    return (
      <article className="source-card unavailable">
        <div className="source-heading">
          <span>{ROLE_LABELS[target.role]}</span>
          <strong>{side} · 未收录</strong>
        </div>
        <p>此六爻码不属于本轮仅接入的乾、坤、屯，系统不补写其余 61 卦原文。</p>
      </article>
    );
  }

  if (target.selector === "tuan_ci_bundle") {
    return (
      <article className="source-card">
        <div className="source-heading">
          <span>{ROLE_LABELS[target.role]}</span>
          <strong>{side} · {hexagram.name}</strong>
        </div>
        <div className="source-layer">
          <small>卦辞 · {hexagram.judgment.canonical_source_id}</small>
          <p>{hexagram.judgment.canonical_text}</p>
        </div>
        <div className="source-layer">
          <small>《彖传》 · {hexagram.tuan.canonical_source_id}</small>
          <p>{hexagram.tuan.canonical_text}</p>
        </div>
      </article>
    );
  }

  const line =
    target.selector === "special_line"
      ? hexagram.lines.find((item) => item.line_label === target.specialLine)
      : hexagram.lines.find((item) => item.line_order === target.position);

  return (
    <article className={`source-card${line ? "" : " unavailable"}`}>
      <div className="source-heading">
        <span>{ROLE_LABELS[target.role]}</span>
        <strong>{side} · {hexagram.name} · {line?.line_label ?? "资料缺口"}</strong>
      </div>
      {line ? (
        <>
          <div className="source-layer">
            <small>爻辞 · {line.canonical_source_id}</small>
            <p>{line.line_text_canonical}</p>
          </div>
          <div className="source-layer muted-layer">
            <small>《小象》</small>
            <p>{line.small_image_canonical}</p>
          </div>
        </>
      ) : (
        <p>冻结资料中没有找到这条辞，系统不会猜补。</p>
      )}
    </article>
  );
}

export function DecisionWorkbench({ hexagrams, productName, rules }: DecisionWorkbenchProps) {
  const [question, setQuestion] = useState("");
  const [values, setValues] = useState<YaoValue[]>([7, 7, 7, 7, 7, 7]);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [result, setResult] = useState<DivinationResult | null>(null);
  const [formError, setFormError] = useState("");

  function updateValue(index: number, value: YaoValue) {
    setValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      setFormError("请先写明具体问题、对象与时间范围。");
      return;
    }
    if (!orderConfirmed) {
      setFormError("请确认六爻按自下而上录入。");
      return;
    }

    setFormError("");
    setResult(calculateDivination(values, rules));
  }

  const original = result ? getHexagram(hexagrams, result.originalKey) : undefined;
  const changed = result ? getHexagram(hexagrams, result.changedKey) : undefined;

  return (
    <main className="workbench-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">MOBILE H5 · PHASE 1.1</p>
          <h1>{productName}</h1>
          <p className="hero-copy">写下所问，依次录入六爻，再核准本卦、之卦与取辞路径。</p>
        </div>
        <div className="protocol-chip">
          <span className="status-dot" />
          冻结规则 V{rules.version.replace(/\.0$/, "")} 已加载
        </div>
      </header>

      <section className="workspace-grid">
        <form className="input-panel panel" onSubmit={submit}>
          <div className="panel-title">
            <span>01</span>
            <div>
              <h2>明确所问</h2>
              <p>尽量写清对象、事项与时间范围。</p>
            </div>
          </div>

          <label className="question-field">
            <span>所问事项</span>
            <textarea
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setResult(null);
              }}
              placeholder="例：未来三个月是否应启动当前方案？已知约束是什么？"
              rows={4}
            />
          </label>

          <div className="subsection-heading">
            <span>02</span>
            <div>
              <h2>录入六爻</h2>
              <p>从初爻到上爻，自下而上输入 6 / 7 / 8 / 9。</p>
            </div>
          </div>

          <div className="yao-inputs">
            {values.map((value, index) => (
              <fieldset key={POSITION_LABELS[index]}>
                <legend>
                  <b>{index + 1}</b>
                  {POSITION_LABELS[index]}爻
                </legend>
                <div className="value-options">
                  {rules.allowedValues.map((option) => (
                    <button
                      type="button"
                      className={value === option ? "selected" : ""}
                      aria-pressed={value === option}
                      aria-label={`${POSITION_LABELS[index]}爻选择 ${option} ${YAO_NAMES[option]}`}
                      key={option}
                      onClick={() => updateValue(index, option)}
                    >
                      <strong>{option}</strong>
                      <small>{YAO_NAMES[option]}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <label className="confirm-row">
            <input
              type="checkbox"
              checked={orderConfirmed}
              onChange={(event) => setOrderConfirmed(event.target.checked)}
            />
            <span>我已确认：第 1 个值是初爻，第 6 个值是上爻。</span>
          </label>

          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="action-dock">
            <button className="calculate-button" type="submit">开始核准</button>
          </div>
        </form>
      </section>

      {result && (
        <section className="results" aria-live="polite">
          <div className="result-bar">
            <div>
              <span className="success-label">计算完成</span>
              <h2>事实计算与规则轨迹</h2>
            </div>
            <code>{result.ruleId}</code>
          </div>

          <div className="hexagram-grid">
            <article className="hexagram-card">
              <div><small>本卦</small><h3>{hexagramTitle(original, result.originalKey)}</h3></div>
              <HexagramLines bits={result.originalBits} />
            </article>
            <article className="hexagram-card">
              <div><small>之卦</small><h3>{hexagramTitle(changed, result.changedKey)}</h3></div>
              <HexagramLines bits={result.changedBits} />
            </article>
          </div>

          <div className="trace-grid">
            <article className="trace-card">
              <small>起卦记录 · 自下而上</small>
              <p className="number-sequence">{result.values.join(" · ")}</p>
            </article>
            <article className="trace-card">
              <small>动爻</small>
              <p>{result.movingCount === 0 ? "无动爻" : result.movingPositions.map((position) => `${POSITION_LABELS[position - 1]}爻`).join("、")}</p>
            </article>
            <article className="trace-card wide">
              <small>命中规则</small>
              <p>{result.ruleInstruction}</p>
            </article>
          </div>

          {result.blocked && (
            <div className="blocking-banner" role="status">
              <strong>三爻动：自动主次已阻断</strong>
              <p>{result.blockingReason}</p>
            </div>
          )}

          <div className="section-heading">
            <span>05</span><div><h2>原文与解释分层</h2><p>卦辞与《彖传》保持独立，不合并冒充“彖辞”。</p></div>
          </div>
          <div className="source-grid">
            {result.targets.map((target, index) => (
              <SourceSelection
                key={`${target.hexagram}-${target.selector}-${target.position ?? target.specialLine ?? index}`}
                target={target}
                result={result}
                hexagrams={hexagrams}
              />
            ))}
          </div>

          <div className="interpretation-grid">
            <article className="panel slim-panel">
              <small>信息不足</small>
              {result.uncertainties.length ? (
                <ul>{result.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <p>当前路由没有新增未解决项。</p>}
            </article>
            <article className="panel slim-panel">
              <small>注家解释 / 模型推断</small>
              <p>Phase 1 不自动融合注家观点，也不生成模型推断。</p>
            </article>
            <article className="panel slim-panel">
              <small>决策反思</small>
              <p>请自行记录机会、风险、成立条件与下一步可验证行动；不要把结果写成必然预言。</p>
            </article>
          </div>
        </section>
      )}

      <aside className="scope-panel panel">
        <div className="panel-title compact">
          <span>边界</span>
          <div><h2>资料范围与免责声明</h2></div>
        </div>
        <dl>
          <div><dt>输入</dt><dd>仅 6 / 7 / 8 / 9</dd></div>
          <div><dt>内容库</dt><dd>乾、坤、屯</dd></div>
          <div><dt>三爻动</dt><dd>主次硬阻断</dd></div>
          <div><dt>彖辞</dt><dd>卦辞 / 彖传分栏</dd></div>
        </dl>
        <div className="safety-note">
          <strong>决策安全</strong>
          <p>医疗、法律、投资与人身安全事项，不得仅依据占断行动；结果不构成必然预言。</p>
        </div>
      </aside>
    </main>
  );
}
