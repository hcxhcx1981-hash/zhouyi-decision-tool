import { BirthInputForm } from "@/components/bazi/birth-input-form";
import { ModuleHeader } from "@/components/module-header";

export default function BaziPage() {
  return (
    <main className="module-shell">
      <ModuleHeader moduleName="生辰八字" status="基础排盘可用" tone="available" />
      <section className="module-intro panel">
        <p>输入出生日期、时间和正式时区，可生成确定性四柱，并查看阴阳五行、藏干、十神结构与已冻结的基础传统主题说明。当前不提供旺衰、喜用神、大运或运势判断。</p>
      </section>
      <BirthInputForm />
    </main>
  );
}
