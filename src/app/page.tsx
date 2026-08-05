import { DecisionWorkbench } from "@/components/decision-workbench";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/config/site";
import { loadFrozenHexagrams, loadRuntimeDivinationRules } from "@/lib/hexagram-data";

export default function Home() {
  return (
    <>
      <DecisionWorkbench
        hexagrams={loadFrozenHexagrams()}
        productName={siteConfig.productName}
        rules={loadRuntimeDivinationRules()}
      />
      <SiteFooter config={siteConfig} />
    </>
  );
}
