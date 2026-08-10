import type { BaziBrowserPipelineResult } from "@/lib/bazi/bazi-browser-pipeline";
import { getBaziBlockingMessage } from "@/lib/bazi/bazi-result-messages";

interface Props {
  pipeline: BaziBrowserPipelineResult;
  onFoldChoice: (choice: "EARLIER" | "LATER") => void;
  busy: boolean;
}

export function BaziBlockedResult({ pipeline, onFoldChoice, busy }: Props) {
  const code = pipeline.result.coreResult.blockingCode;
  if (pipeline.result.coreResult.status !== "BLOCKED") return null;
  const message = getBaziBlockingMessage(code);
  const foldRequired = code === "AMBIGUOUS_LOCAL_TIME";

  return (
    <section className="blocked-result" role="alert" data-bazi-status="BLOCKED" data-blocking-code={code ?? "UNKNOWN"}>
      <span className="module-status blocked">本次未生成四柱</span>
      <h2>{message.title}</h2>
      <p>{message.detail}</p>
      {foldRequired ? (
        <div className="fold-actions" aria-label="夏令时重复时间选择">
          <button type="button" disabled={busy} onClick={() => onFoldChoice("EARLIER")}>较早一次</button>
          <button type="button" disabled={busy} onClick={() => onFoldChoice("LATER")}>较晚一次</button>
          {pipeline.result.timezoneAudit.utcCandidateStarts.length === 2 ? (
            <details><summary>查看两个 UTC 候选</summary><p>{pipeline.result.timezoneAudit.utcCandidateStarts.join(" / ")}</p></details>
          ) : null}
        </div>
      ) : null}
      <small>技术代码：{code ?? "UNKNOWN"}</small>
    </section>
  );
}
