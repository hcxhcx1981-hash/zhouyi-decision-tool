import Link from "next/link";

export function ModuleHeader({
  moduleName,
  status,
  tone,
}: {
  moduleName: string;
  status: string;
  tone: "available" | "warning";
}) {
  return (
    <header className="module-header">
      <Link className="back-link" href="/" prefetch={false}>← 返回首页</Link>
      <div className="module-heading-row">
        <div>
          <p className="eyebrow">移动端模块</p>
          <h1>{moduleName}</h1>
        </div>
        <span className={`module-status ${tone}`}>{status}</span>
      </div>
    </header>
  );
}
