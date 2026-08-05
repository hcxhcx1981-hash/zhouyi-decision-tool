import type { Metadata } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PRODUCT_NAME = "周易问事决策工具";
const SHORT_NAME = "周易问事工具";
const DESCRIPTION = "基于周易原文与占变规则的手机问事决策工具";

export interface SiteConfig {
  productName: string;
  shortName: string;
  title: string;
  description: string;
  siteUrl: string | null;
  shareTitle: string;
  shareDescription: string;
  shareImagePath: string | null;
  footerBrand: string;
  icpNumber: string | null;
  publicSecurityNumber: string | null;
}

export interface SiteEnvironment {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_ICP_NUMBER?: string;
  NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER?: string;
  NEXT_PUBLIC_SHARE_IMAGE_PATH?: string;
}

function optionalText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeSiteUrl(value: string | undefined): string | null {
  const normalized = optionalText(value);
  if (!normalized) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid https:// URL.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid https:// URL without credentials, query, or hash.");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname === "/" ? "" : pathname}`;
}

export function normalizeShareImagePath(value: string | undefined): string | null {
  const normalized = optionalText(value);
  if (!normalized) {
    return null;
  }

  if (
    !normalized.startsWith("/") ||
    normalized.includes("://") ||
    normalized.includes("..") ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    throw new Error("NEXT_PUBLIC_SHARE_IMAGE_PATH must be an absolute public path such as /share.png.");
  }

  return normalized;
}

export function createSiteConfig(
  environment: SiteEnvironment = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ICP_NUMBER: process.env.NEXT_PUBLIC_ICP_NUMBER,
    NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER: process.env.NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER,
    NEXT_PUBLIC_SHARE_IMAGE_PATH: process.env.NEXT_PUBLIC_SHARE_IMAGE_PATH,
  },
): SiteConfig {
  return {
    productName: PRODUCT_NAME,
    shortName: SHORT_NAME,
    title: PRODUCT_NAME,
    description: DESCRIPTION,
    siteUrl: normalizeSiteUrl(environment.NEXT_PUBLIC_SITE_URL),
    shareTitle: `${PRODUCT_NAME}｜依原文核准占变路径`,
    shareDescription: DESCRIPTION,
    shareImagePath: normalizeShareImagePath(environment.NEXT_PUBLIC_SHARE_IMAGE_PATH),
    footerBrand: SHORT_NAME,
    icpNumber: optionalText(environment.NEXT_PUBLIC_ICP_NUMBER),
    publicSecurityNumber: optionalText(environment.NEXT_PUBLIC_PUBLIC_SECURITY_NUMBER),
  };
}

export function publicShareImageExists(
  config: SiteConfig,
  projectRoot = process.cwd(),
): boolean {
  if (!config.shareImagePath) {
    return false;
  }

  const relativePath = config.shareImagePath.replace(/^\/+/, "");
  return existsSync(resolve(projectRoot, "public", relativePath));
}

export function createSiteMetadata(
  config: SiteConfig,
  includeShareImage = false,
): Metadata {
  const images = includeShareImage && config.shareImagePath ? [config.shareImagePath] : undefined;

  return {
    title: config.title,
    description: config.description,
    applicationName: config.shortName,
    ...(config.siteUrl
      ? {
          metadataBase: new URL(config.siteUrl),
          alternates: { canonical: config.siteUrl },
        }
      : {}),
    openGraph: {
      title: config.shareTitle,
      description: config.shareDescription,
      type: "website",
      locale: "zh_CN",
      ...(config.siteUrl ? { url: config.siteUrl } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: config.shareTitle,
      description: config.shareDescription,
      ...(images ? { images } : {}),
    },
    formatDetection: {
      telephone: false,
      email: false,
      address: false,
    },
  };
}

export const siteConfig = createSiteConfig();
