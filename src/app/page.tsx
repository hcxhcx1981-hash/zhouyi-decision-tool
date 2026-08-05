import { DecisionWorkbench } from "@/components/decision-workbench";
import { loadFrozenHexagrams, loadRuntimeDivinationRules } from "@/lib/hexagram-data";

export default function Home() {
  return (
    <DecisionWorkbench
      hexagrams={loadFrozenHexagrams()}
      rules={loadRuntimeDivinationRules()}
    />
  );
}
