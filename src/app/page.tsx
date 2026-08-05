import { DecisionWorkbench } from "@/components/decision-workbench";
import { loadFrozenHexagrams, loadProtocolVersion } from "@/lib/hexagram-data";

export default function Home() {
  return <DecisionWorkbench hexagrams={loadFrozenHexagrams()} protocolVersion={loadProtocolVersion()} />;
}
