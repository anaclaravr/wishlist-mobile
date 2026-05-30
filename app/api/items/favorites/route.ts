import { NextRequest, NextResponse } from "next/server";

import { listProfileFavoriteItemIds } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { listWishlistFavoriteItemIds } from "@/lib/db";
import { getErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug")?.trim();
    const followToken = request.nextUrl.searchParams.get("token")?.trim();

    if (slug && followToken) {
      const favorites = await listWishlistFavoriteItemIds({ slug, followToken });
      return NextResponse.json({ favorites });
    }

    const session = await requireAccessSession({
      slug: slug || undefined,
      permission: "wishlist.favorites.manage",
    });
    const favorites = await listProfileFavoriteItemIds({
      wishlistId: session.wishlistId,
      profileId: session.profileId,
    });

    return NextResponse.json({ favorites });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
