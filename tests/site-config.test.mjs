import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { SiteFooter } from "../src/components/site-footer.ts";
import {
  createSiteConfig,
  createSiteMetadata,
} from "../src/config/site.ts";

test("siteUrl 为空时返回 null", () => {
  assert.equal(createSiteConfig({ NEXT_PUBLIC_SITE_URL: "  " }).siteUrl, null);
});

test("https URL 正常", () => {
  assert.equal(
    createSiteConfig({ NEXT_PUBLIC_SITE_URL: "https://example.test/path" }).siteUrl,
    "https://example.test/path",
  );
});

test("URL 末尾斜杠被规范化", () => {
  assert.equal(
    createSiteConfig({ NEXT_PUBLIC_SITE_URL: "https://example.test/path///" }).siteUrl,
    "https://example.test/path",
  );
});

test("http URL 被拒绝", () => {
  assert.throws(
    () => createSiteConfig({ NEXT_PUBLIC_SITE_URL: "http://example.test" }),
    /https:\/\//,
  );
});

test("非法 URL 字符串被拒绝", () => {
  assert.throws(
    () => createSiteConfig({ NEXT_PUBLIC_SITE_URL: "not a url" }),
    /valid https:\/\/ URL/,
  );
});

test("未配置备案号时 Footer 不显示备案区域", () => {
  const config = createSiteConfig({});
  const html = renderToStaticMarkup(createElement(SiteFooter, { config }));
  assert.doesNotMatch(html, /data-site-filings/);
  assert.doesNotMatch(html, /备案待补充/);
});

test("配置站点 URL 后 metadata 使用同一 URL", () => {
  const config = createSiteConfig({ NEXT_PUBLIC_SITE_URL: "https://example.test/" });
  const metadata = createSiteMetadata(config);
  assert.equal(metadata.metadataBase?.toString(), "https://example.test/");
  assert.equal(metadata.alternates?.canonical, "https://example.test");
  assert.equal(metadata.openGraph?.url, "https://example.test");
});

test("未配置站点 URL 时不生成伪造 canonical", () => {
  const metadata = createSiteMetadata(createSiteConfig({}));
  assert.equal(metadata.metadataBase, undefined);
  assert.equal(metadata.alternates, undefined);
  assert.equal(metadata.openGraph?.url, undefined);
});
