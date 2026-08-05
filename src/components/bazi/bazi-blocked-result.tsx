import type { BaziAnalysisResult } from "@/lib/bazi/types";

export function BaziBlockedResult({ result }: { result: BaziAnalysisResult }) {
  if (result.status !== "NOT_IMPLEMENTED" || !result.blockingReason) {
    return null;
  }

  return (
    <section className="blocked-result" role="status" data-bazi-status="NOT_IMPLEMENTED">
      <span className="module-status warning">NOT_IMPLEMENTED</span>
      <h2>本阶段不生成命盘</h2>
      <p>{result.blockingReason}</p>
    </section>
  );
}
