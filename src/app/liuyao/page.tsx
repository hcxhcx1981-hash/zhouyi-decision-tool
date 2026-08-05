import { LiuyaoWorkbench } from "@/components/liuyao/liuyao-workbench";
import { ModuleHeader } from "@/components/module-header";
import { loadFrozenHexagrams, loadRuntimeDivinationRules } from "@/lib/hexagram-data";

export default function LiuyaoPage() {
  return (
    <main className="module-shell liuyao-shell">
      <ModuleHeader moduleName="六爻问事" status="基础卦象可用" tone="available" />
      <LiuyaoWorkbench
        hexagrams={loadFrozenHexagrams()}
        rules={loadRuntimeDivinationRules()}
      />
    </main>
  );
}
