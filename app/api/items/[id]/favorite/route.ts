import { NextResponse } from "next/server";
import { z } from "zod";

import {
  favoriteWishlistItemByProfile,
  unfavoriteWishlistItemByProfile,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { favoriteWishlistItem, unfavoriteWishlistItem } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const favoriteSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  followToken: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = favoriteSchema.safeParse(body);

    if (!parsed.success || (!parsed.data.followToken && !parsed.data.slug)) {
      throw new PublicError("Acompanhe a wishlist para favoritar.", 401);
    }

    const { id } = await context.params;
    if (parsed.data.followToken && parsed.data.slug) {
      await favoriteWishlistItem({
        slug: parsed.data.slug,
        followToken: parsed.data.followToken,
        itemId: id,
      });
    } else {
      const session = await requireAccessSession({
        permission: "wishlist.favorites.manage",
      });
      await favoriteWishlistItemByProfile({
        itemId: id,
        wishlistId: session.wishlistId,
        profileId: session.profileId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = favoriteSchema.safeParse(body);

    if (!parsed.success || (!parsed.data.followToken && !parsed.data.slug)) {
      throw new PublicError("Acompanhe a wishlist para remover favorito.", 401);
    }

    const { id } = await context.params;
    if (parsed.data.followToken && parsed.data.slug) {
      await unfavoriteWishlistItem({
        slug: parsed.data.slug,
        followToken: parsed.data.followToken,
        itemId: id,
      });
    } else {
      const session = await requireAccessSession({
        permission: "wishlist.favorites.manage",
      });
      await unfavoriteWishlistItemByProfile({
        itemId: id,
        wishlistId: session.wishlistId,
        profileId: session.profileId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
