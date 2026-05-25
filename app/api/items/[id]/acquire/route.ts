import { NextResponse } from "next/server";
import { z } from "zod";

import { markItemAcquired } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const acquireSchema = z.object({
  followToken: z.string().trim().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = acquireSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Acompanhe a wishlist antes de marcar como adquirido.", 401);
    }

    const { id } = await context.params;
    const item = await markItemAcquired({
      itemId: id,
      followToken: parsed.data.followToken,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
