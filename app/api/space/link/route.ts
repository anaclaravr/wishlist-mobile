import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse, PublicError } from "@/lib/errors";
import { parseHttpUrl, readProductDetails } from "@/lib/product-scraper";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  url: z.string().trim().min(1, "Informe um link.").max(2000),
});

export async function POST(request: Request) {
  try {
    const parsed = linkSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Informe um link.");
    }

    const raw = parsed.data.url;
    const url = parseHttpUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const details = await readProductDetails(url);

    return NextResponse.json(details ?? { failed: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
