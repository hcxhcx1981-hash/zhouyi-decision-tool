import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import {
  createSiteMetadata,
  publicShareImageExists,
  siteConfig,
} from "@/config/site";
import "./globals.css";

export const metadata: Metadata = createSiteMetadata(
  siteConfig,
  publicShareImageExists(siteConfig),
);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09080c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <SiteFooter config={siteConfig} />
      </body>
    </html>
  );
}
