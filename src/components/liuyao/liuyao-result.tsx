import type {
  DivinationResult,
  Polarity,
  SelectionRole,
  SelectionTarget,
} from "@/lib/divination";
import type { HexagramContent } from "@/lib/hexagram-data";
import { YAO_POSITION_LABELS } from "@/lib/liuyao/input";
import type { LiuyaoAdvancedReading } from "@/lib/liuyao/types";

const ROLE_LABELS: Record<SelectionRole, string> = {
  primary: "主辞",
  secondary: "辅辞",
  zhen_unranked: "贞 · 未定主次",
  hui_unranked: "悔 · 未定主次",
};

function HexagramLines({ bits }: { bits: Polarity[] }) {
  return (
    <div className="hexagram-lines" aria-label="卦象（上爻在上，初爻在下）">
      {[...bits].reverse().map((bit, index) => (
        <div className="hexagram-line" key={`${bit}-${index}`}>
          {bit === 1 ? <span className="yang-line" /> : <span className="yin-line"><i /><i /></span>}
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
        <div className="source-heading"><span>{ROLE_LABELS[target.role]}</span><strong>{side} · 未收录</strong></div>
        <p>此六爻码不属于本轮仅接入的乾、坤、屯，系统不补写其余 61 卦原文。</p>
      </article>
    );
  }

  if (target.selector === "tuan_ci_bundle") {
    return (
      <article className="source-card">
        <div className="source-heading"><span>{ROLE_LABELS[target.role]}</span><strong>{side} · {hexagram.name}</strong></div>
        <div className="source-layer"><small>卦辞 · {hexagram.judgment.canonical_source_id}</small><p>{hexagram.judgment.canonical_text}</p></div>
        <div className="source-layer"><small>《彖传》 · {hexagram.tuan.canonical_source_id}</small><p>{hexagram.tuan.canonical_text}</p></div>
      </article>
    );
  }

  const line = target.selector === "special_line"
    ? hexagram.lines.find((item) => item.line_label === target.specialLine)
    : hexagram.lines.find((item) => item.line_order === target.position);

  return (
    <article className={`source-card${line ? "" : " unavailable"}`}>
      <div className="source-heading"><span>{ROLE_LABELS[target.role]}</span><strong>{side} · {hexagram.name} · {line?.line_label ?? "资料缺口"}</strong></div>
      {line ? (
        <>
          <div className="source-layer"><small>爻辞 · {line.canonical_source_id}</small><p>{line.line_text_canonical}</p></div>
          <div className="source-layer muted-layer"><small>《小象》</small><p>{line.small_image_canonical}</p></div>
        </>
      ) : <p>冻结资料中没有找到这条辞，系统不会猜补。</p>}
    </article>
  );
}

export function LiuyaoResult({
  result,
  hexagrams,
  advancedReading,
}: {
  result: DivinationResult;
  hexagrams: HexagramContent[];
  advancedReading: LiuyaoAdvancedReading;
}) {
  const original = getHexagram(hexagrams, result.originalKey);
  const changed = getHexagram(hexagrams, result.changedKey);

  return (
    <section className="results" aria-live="polite">
      <div className="result-bar">
        <div><span className="success-label">计算完成</span><h2>事实计算与规则轨迹</h2></div>
        <code>{result.ruleId}</code>
      </div>

      <div className="hexagram-grid">
        <article className="hexagram-card"><div><small>本卦</small><h3>{hexagramTitle(original, result.originalKey)}</h3></div><HexagramLines bits={result.originalBits} /></article>
        <article className="hexagram-card"><div><small>之卦</small><h3>{hexagramTitle(changed, result.changedKey)}</h3></div><HexagramLines bits={result.changedBits} /></article>
      </div>

      <div className="trace-grid">
        <article className="trace-card"><small>起卦记录 · 自下而上</small><p className="number-sequence">{result.values.join(" · ")}</p></article>
        <article className="trace-card"><small>动爻</small><p>{result.movingCount === 0 ? "无动爻" : result.movingPositions.map((position) => YAO_POSITION_LABELS[position - 1]).join("、")}</p></article>
        <article className="trace-card wide"><small>命中规则</small><p>{result.ruleInstruction}</p></article>
      </div>

      {result.blocked ? <div className="blocking-banner" role="status"><strong>三爻动：自动主次已阻断</strong><p>{result.blockingReason}</p></div> : null}

      <div className="section-heading"><span>证据</span><div><h2>原文与解释分层</h2><p>卦辞与《彖传》保持独立，不合并冒充“彖辞”。</p></div></div>
      <div className="source-grid">
        {result.targets.map((target, index) => (
          <SourceSelection key={`${target.hexagram}-${target.selector}-${target.position ?? target.specialLine ?? index}`} target={target} result={result} hexagrams={hexagrams} />
        ))}
      </div>

      <div className="interpretation-grid">
        <article className="panel slim-panel"><small>信息不足</small>{result.uncertainties.length ? <ul>{result.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul> : <p>当前路由没有新增未解决项。</p>}</article>
        <article className="panel slim-panel"><small>注家解释 / 模型推断</small><p>本阶段不自动融合注家观点，也不生成模型推断。</p></article>
        <article className="panel slim-panel"><small>决策反思</small><p>请自行记录机会、风险、成立条件与下一步可验证行动；不要把结果写成必然预言。</p></article>
      </div>

      <section className="advanced-boundary" data-advanced-status={advancedReading.status}>
        <span className="module-status warning">规则待冻结</span>
        <h2>纳甲判断规则尚未接入</h2>
        <p>{advancedReading.blockingReason}</p>
        <p>当前不会生成用神、旺衰、进展、阻碍或结局文本。</p>
      </section>
    </section>
  );
}
