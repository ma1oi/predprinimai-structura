import type { MetadataRoute } from "next";
import { site } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    // Admin and UI-kit must remain crawlable so bots can read their noindex tags.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
