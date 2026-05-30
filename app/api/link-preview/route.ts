import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse, PublicError } from "@/lib/errors";

const linkPreviewSchema = z.object({
  url: z.string().trim().min(1, "Informe um link."),
});

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }

    return url;
  } catch {
    throw new PublicError("Informe um link valido com http ou https.");
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getMetaContent(html: string, name: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(
      `<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["'][^>]*>`,
      "i",
    ),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*itemprop=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*itemprop=["']${name}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function getDocumentTitle(html: string) {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);

  if (!match?.[1]) {
    return null;
  }

  return decodeHtml(match[1]);
}

function normalizeImageUrl(baseUrl: URL, candidate: string | null) {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizePrice(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/[^\d.,]/g, "").trim();

  if (!cleaned) {
    return null;
  }

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  let normalized = cleaned;

  if (commaIndex > dotIndex) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dotIndex > commaIndex) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(",", ".");
  }

  const valueNumber = Number(normalized);

  if (!Number.isFinite(valueNumber) || valueNumber <= 0) {
    return null;
  }

  return valueNumber.toFixed(2);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = linkPreviewSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const url = parseHttpUrl(parsed.data.url);

    let html = "";

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "wishlist-link-preview/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(12000),
      });

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

      if (!response.ok || !contentType.includes("text/html")) {
        return NextResponse.json({});
      }

      html = (await response.text()).slice(0, 350_000);
    } catch {
      return NextResponse.json({});
    }

    const name =
      getMetaContent(html, "og:title") ??
      getMetaContent(html, "twitter:title") ??
      getMetaContent(html, "title") ??
      getDocumentTitle(html);
    const imageUrl = normalizeImageUrl(
      url,
      getMetaContent(html, "og:image") ??
        getMetaContent(html, "twitter:image") ??
        getMetaContent(html, "image"),
    );
    const price =
      normalizePrice(getMetaContent(html, "product:price:amount")) ??
      normalizePrice(getMetaContent(html, "og:price:amount")) ??
      normalizePrice(getMetaContent(html, "price")) ??
      normalizePrice(getMetaContent(html, "price:amount"));

    return NextResponse.json({
      ...(name ? { name } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(price ? { price } : {}),
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
