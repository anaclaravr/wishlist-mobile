import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse, PublicError } from "@/lib/errors";
import {
  extractProductDetails,
  fetchProductHtml,
  parseHttpUrl,
} from "@/lib/product-scraper";

const linkPreviewSchema = z.object({
  url: z.string().trim().min(1, "Informe um link."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = linkPreviewSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const url = parseHttpUrl(parsed.data.url);
    const page = await fetchProductHtml(url).catch(() => null);

    if (!page) {
      return NextResponse.json({});
    }

    const { title: name, image: imageUrl, price } = extractProductDetails(page.html, page.url);

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
