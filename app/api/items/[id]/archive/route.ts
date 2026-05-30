import { NextResponse } from "next/server";
import { z } from "zod";

import { getWishlistAdminTokenById } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { archiveWishlistItem } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const archiveItemSchema = z.object({
  adminToken: z.string().trim().min(1).optional(),
  archived: z.boolean(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = archiveItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }
    const adminToken =
      parsed.data.adminToken ??
      (await (async () => {
        const session = await requireAccessSession({
          role: "admin",
          permission: "wishlist.official.archive",
        });

        return getWishlistAdminTokenById(session.wishlistId);
      })());

    const { id } = await context.params;
    const item = await archiveWishlistItem({
      adminToken,
      itemId: id,
      archived: parsed.data.archived,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
