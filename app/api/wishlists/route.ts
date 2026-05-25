import { NextResponse } from "next/server";
import { z } from "zod";

import { createWishlist } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const createWishlistSchema = z.object({
  title: z.string().trim().min(1, "Informe um nome para a wishlist.").max(90),
  ownerName: z.string().trim().max(70).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createWishlistSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const wishlist = await createWishlist(parsed.data);

    return NextResponse.json({
      wishlist,
      publicUrl: `/w/${wishlist.slug}`,
      adminUrl: `/admin/${wishlist.adminToken}`,
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
