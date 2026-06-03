import { NextResponse } from "next/server";

import {
  getPortfolioPageSettingsByWishlistId,
  upsertPortfolioPageSettingsByWishlistId,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { portfolioPageSettingsSchema } from "@/lib/portfolio-page-settings";

export async function GET() {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.wishlist.update",
    });
    const settings = await getPortfolioPageSettingsByWishlistId(session.wishlistId);
    return NextResponse.json({ settings });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.wishlist.update",
    });
    const body = await request.json();
    const parsed = portfolioPageSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const settings = await upsertPortfolioPageSettingsByWishlistId({
      wishlistId: session.wishlistId,
      profileId: session.profileId,
      settings: parsed.data,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
