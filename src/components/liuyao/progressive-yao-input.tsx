"use client";

import { useState } from "react";
import {
  countCompletedYao,
  firstIncompleteYaoIndex,
  nextYaoIndexAfterSelection,
  YAO_POSITION_LABELS,
} from "@/lib/liuyao/input";
import type { PartialYaoValues, YaoValue } from "@/lib/liuyao/types";

const YAO_NAMES: Record<YaoValue, string> = {
  6: "老阴 · 动",
  7: "少阳 · 静",
  8: "少阴 · 静",
  9: "老阳 · 动",
};

const OPTIONS: YaoValue[] = [6, 7, 8, 9];

export function ProgressiveYaoInput({
  values,
  onChange,
}: {
  values: PartialYaoValues;
  onChange: (values: PartialYaoValues) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const completed = countCompletedYao(values);
  const firstIncomplete = firstIncompleteYaoIndex(values);
  const furthestEnabled = firstIncomplete === -1 ? 5 : firstIncomplete;

  function choose(value: YaoValue) {
    const nextValues: PartialYaoValues = [...values];
    nextValues[activeIndex] = value;
    onChange(nextValues);
    setActiveIndex(nextYaoIndexAfterSelection(activeIndex));
  }

  return (
    <div className="progressive-cast">
      <div className="cast-progress">
        <div><strong>六爻自下而上录入</strong><span>点击后自动进入下一爻，已完成爻可返回修改。</span></div>
        <b data-cast-progress={`${completed}/6`}>{completed} / 6</b>
      </div>

      <div className="yao-step-list" aria-label="逐爻进度">
        {YAO_POSITION_LABELS.map((label, index) => (
          <button
            type="button"
            key={label}
            className={`${index === activeIndex ? "active" : ""}${values[index] !== null ? " complete" : ""}`}
            disabled={index > furthestEnabled}
            onClick={() => setActiveIndex(index)}
            aria-label={`${label}${values[index] === null ? "未录入" : `已录入 ${values[index]}`}`}
          >
            <span>{index + 1}</span>
            <small>{label}</small>
            <strong>{values[index] ?? "—"}</strong>
          </button>
        ))}
      </div>

      <fieldset className="active-yao-step">
        <legend>{activeIndex + 1}. {YAO_POSITION_LABELS[activeIndex]}</legend>
        <div className="value-options">
          {OPTIONS.map((option) => (
            <button
              type="button"
              className={values[activeIndex] === option ? "selected" : ""}
              aria-pressed={values[activeIndex] === option}
              aria-label={`${YAO_POSITION_LABELS[activeIndex]}选择 ${option} ${YAO_NAMES[option]}`}
              key={option}
              onClick={() => choose(option)}
            >
              <strong>{option}</strong>
              <small>{YAO_NAMES[option]}</small>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
