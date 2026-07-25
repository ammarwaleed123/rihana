import type { MetadataRoute } from "next";

/** The public site is indexable; the private zones and API never are. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rihana.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/portal", "/api", "/signin", "/invite"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
