import { createElement } from "react";

interface SiteFooterConfig {
  footerBrand: string;
  icpNumber: string | null;
  publicSecurityNumber: string | null;
}

export function SiteFooter({ config }: { config: SiteFooterConfig }) {
  const filings = [config.icpNumber, config.publicSecurityNumber].filter(
    (value): value is string => Boolean(value),
  );

  return createElement(
    "footer",
    { className: "site-footer", "aria-label": "站点信息" },
    createElement("strong", null, config.footerBrand),
    filings.length
      ? createElement(
          "div",
          { className: "site-filings", "data-site-filings": "true" },
          filings.map((filing) => createElement("span", { key: filing }, filing)),
        )
      : null,
  );
}
