import { ModuleCard } from "@/components/home/module-card";
import { siteConfig } from "@/config/site";
import { PRODUCT_MODULES } from "@/lib/product/modules";

export default function Home() {
  return (
    <main className="product-shell">
      <header className="product-hero">
        <p className="eyebrow">双模块 · 移动端 H5</p>
        <h1>{siteConfig.productName}</h1>
        <p>以确定性数据协议承载生辰资料与六爻问事，严格区分已实现能力和待冻结规则。</p>
      </header>

      <section className="module-grid" aria-label="产品模块">
        {PRODUCT_MODULES.map((module) => <ModuleCard key={module.id} {...module} />)}
      </section>

      <section className="home-status panel">
        <span className="module-status warning">当前开发状态</span>
        <h2>产品骨架已建立，规则按阶段冻结</h2>
        <ul>
          <li>八字：只开放出生资料录入，不生成四柱或运势。</li>
          <li>六爻：基础卦象、动爻、占变路由与乾坤屯原文可用。</li>
          <li>纳甲、世应、六亲、六神、用神、旺衰与结局均未实现。</li>
        </ul>
      </section>

      <section className="home-boundary panel">
        <h2>使用边界</h2>
        <p>本工具用于传统文化学习、规则化排盘与决策参考，不构成医疗、法律、投资或其他专业结论。</p>
      </section>
    </main>
  );
}
