"use client";

import { type FormEvent, useState } from "react";
import { calculateDivination, type DivinationResult, type RuntimeDivinationRules } from "@/lib/divination";
import type { HexagramContent } from "@/lib/hexagram-data";
import {
  countCompletedYao,
  createBlockedAdvancedReading,
  createEmptyYaoValues,
  isCompleteYaoValues,
  toLiuyaoCastInput,
  validateLiuyaoCastDraft,
  type LiuyaoValidationCode,
} from "@/lib/liuyao/input";
import type { LiuyaoQuestionInput, PartialYaoValues } from "@/lib/liuyao/types";
import { LiuyaoQuestionFields } from "./question-input";
import { ProgressiveYaoInput } from "./progressive-yao-input";
import { LiuyaoResult } from "./liuyao-result";

const INITIAL_QUESTION: LiuyaoQuestionInput = { title: "", detail: "", timeRange: "" };

const ERROR_MESSAGES: Record<LiuyaoValidationCode, string> = {
  QUESTION_TITLE_REQUIRED: "请填写问题标题，一次只问一件具体事情。",
  TIME_RANGE_REQUIRED: "请填写问题的时间范围。",
  YAO_VALUES_INCOMPLETE: "请从初爻到上爻完成六次逐爻录入。",
};

export function LiuyaoWorkbench({
  hexagrams,
  rules,
}: {
  hexagrams: HexagramContent[];
  rules: RuntimeDivinationRules;
}) {
  const [question, setQuestion] = useState<LiuyaoQuestionInput>(INITIAL_QUESTION);
  const [values, setValues] = useState<PartialYaoValues>(createEmptyYaoValues);
  const [errors, setErrors] = useState<LiuyaoValidationCode[]>([]);
  const [result, setResult] = useState<DivinationResult | null>(null);

  function updateQuestion(nextQuestion: LiuyaoQuestionInput) {
    setQuestion(nextQuestion);
    setErrors([]);
    setResult(null);
  }

  function updateValues(nextValues: PartialYaoValues) {
    setValues(nextValues);
    setErrors([]);
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLiuyaoCastDraft(question, values);
    setErrors(nextErrors);
    const cast = toLiuyaoCastInput(question, values);
    if (!cast || !isCompleteYaoValues(values)) {
      setResult(null);
      return;
    }
    setResult(calculateDivination(cast.yaoValues, rules));
  }

  const completed = countCompletedYao(values);

  return (
    <>
      <form className="input-panel panel liuyao-form" onSubmit={submit} noValidate>
        <div className="panel-title"><span>01</span><div><h2>明确所问</h2><p>请只问一件具体事情，例如：这个项目未来三个月能否顺利签约？</p></div></div>
        <LiuyaoQuestionFields value={question} onChange={updateQuestion} />

        <div className="subsection-heading"><span>02</span><div><h2>六次逐爻录入</h2><p>不随机、不模拟铜钱，不使用时间或 AI 代选。</p></div></div>
        <ProgressiveYaoInput values={values} onChange={updateValues} />

        {errors.length ? <div className="form-error" role="alert">{errors.map((error) => <p key={error}>{ERROR_MESSAGES[error]}</p>)}</div> : null}
        <div className="action-dock">
          <button className="calculate-button" type="submit" disabled={completed < 6}>核准卦象与取辞</button>
        </div>
      </form>

      {result ? <LiuyaoResult result={result} hexagrams={hexagrams} advancedReading={createBlockedAdvancedReading()} /> : null}

      <aside className="scope-panel panel">
        <div className="panel-title compact"><span>边界</span><div><h2>当前能力与免责声明</h2></div></div>
        <dl>
          <div><dt>已开放</dt><dd>卦象计算 / 原文取辞</dd></div>
          <div><dt>内容库</dt><dd>乾、坤、屯</dd></div>
          <div><dt>三爻动</dt><dd>主次硬阻断</dd></div>
          <div><dt>待实现</dt><dd>纳甲 / 用神 / 结局</dd></div>
        </dl>
        <div className="safety-note"><strong>决策安全</strong><p>当前仅开放卦象计算与周易原文取辞，纳甲、用神、进展和结局判断尚未完成。医疗、法律、投资与人身安全事项不得仅依据本工具行动。</p></div>
      </aside>
    </>
  );
}
