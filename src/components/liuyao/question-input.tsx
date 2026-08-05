import type { LiuyaoQuestionInput } from "@/lib/liuyao/types";

export function LiuyaoQuestionFields({
  value,
  onChange,
}: {
  value: LiuyaoQuestionInput;
  onChange: (value: LiuyaoQuestionInput) => void;
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
      <p className="privacy-note">内容只在当前页面内用于本次核准，不上传、不联网，也不进入分享信息。</p>
    </div>
  );
}
