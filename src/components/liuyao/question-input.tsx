import type { HeavenlyStem, LiuyaoQuestionInput } from "@/lib/liuyao/types";

const DAY_STEMS: HeavenlyStem[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

export function LiuyaoQuestionFields({
  value,
  onChange,
  dayStem,
  onDayStemChange,
}: {
  value: LiuyaoQuestionInput;
  onChange: (value: LiuyaoQuestionInput) => void;
  dayStem: HeavenlyStem | "";
  onDayStemChange: (value: HeavenlyStem | "") => void;
}) {
  return (
    <div className="question-grid">
      <label className="field-stack">
        <span>问题标题 *</span>
        <input
          type="text"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="例如：当前项目能否顺利签约？"
        />
      </label>
      <label className="field-stack">
        <span>详细问题（可选）</span>
        <textarea
          value={value.detail}
          onChange={(event) => onChange({ ...value, detail: event.target.value })}
          placeholder="请只问一件具体事情，并补充已知条件。"
          rows={3}
        />
      </label>
      <label className="field-stack">
        <span>时间范围 *</span>
        <input
          type="text"
          value={value.timeRange}
          onChange={(event) => onChange({ ...value, timeRange: event.target.value })}
          placeholder="例如：未来三个月"
        />
      </label>
      <label className="field-stack">
        <span>日干（六神定位）*</span>
        <select value={dayStem} onChange={(event) => onDayStemChange(event.target.value as HeavenlyStem | "")}>
          <option value="" disabled>请选择日干</option>
          {DAY_STEMS.map((stem) => <option key={stem} value={stem}>{stem}日</option>)}
        </select>
      </label>
      <p className="privacy-note">内容只在当前页面内用于本次核准，不上传、不联网，也不进入分享信息。</p>
    </div>
  );
}
