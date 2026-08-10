import { BirthInputForm } from "@/components/bazi/birth-input-form";
import { ModuleHeader } from "@/components/module-header";

export default function BaziPage() {
  return (
    <main className="module-shell">
      <ModuleHeader moduleName="生辰八字" status="基础排盘可用" tone="available" />
      <section className="module-intro panel">
        <p>输入出生日期、时间和正式时区，可生成确定性年、月、日、时四柱。当前不提供五行、十神、大运或运势解读。</p>
      </section>
      <BirthInputForm />
    </main>
  );
}
