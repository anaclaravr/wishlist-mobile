import { NextResponse } from "next/server";
import { z } from "zod";

import { updateWishlistSettingsById } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { slugify } from "@/lib/tokens";

const updateWishlistSchema = z.object({
  title: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().max(120).optional(),
  ownerEmail: z.string().trim().max(180).optional(),
  ownerAvatarUrl: z.string().trim().max(250000).optional(),
  slug: z.string().trim().min(2).max(64),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.wishlist.update",
    });
    const body = await request.json();
    const parsed = updateWishlistSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const ownerEmail = parsed.data.ownerEmail?.trim() || null;
    const ownerAvatarUrl = parsed.data.ownerAvatarUrl?.trim() || null;

    if (ownerEmail && !z.string().email().safeParse(ownerEmail).success) {
      throw new PublicError("Informe um e-mail valido para o perfil.", 400);
    }

    if (ownerAvatarUrl && !ownerAvatarUrl.startsWith("data:image/")) {
      try {
        const url = new URL(ownerAvatarUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new PublicError("A foto do perfil deve usar URL http/https.", 400);
        }
      } catch {
        throw new PublicError("Informe uma URL valida para a foto do perfil.", 400);
      }
    }

    const wishlist = await updateWishlistSettingsById({
      wishlistId: session.wishlistId,
      title: parsed.data.title,
      ownerName: parsed.data.ownerName ?? null,
      ownerEmail,
      ownerAvatarUrl,
      slug: slugify(parsed.data.slug),
    });

    return NextResponse.json({ wishlist });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
