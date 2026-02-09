import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/pricing`, lastModified: now },
    { url: `${base}/faq`, lastModified: now },
    { url: `${base}/blog`, lastModified: now },
    { url: `${base}/legal/privacy`, lastModified: now },
    { url: `${base}/legal/terms`, lastModified: now },
  ];
}
