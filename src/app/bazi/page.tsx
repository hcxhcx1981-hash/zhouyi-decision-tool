import { BirthInputForm } from "@/components/bazi/birth-input-form";
import { ModuleHeader } from "@/components/module-header";

export default function BaziPage() {
  return (
    <main className="module-shell">
      <ModuleHeader moduleName="生辰八字" status="规则准备中" tone="warning" />
      <section className="module-intro panel">
        <p>当前仅开放出生资料录入，四柱排盘与运势规则尚未完成。</p>
      </section>
      <BirthInputForm />
    </main>
  );
}
