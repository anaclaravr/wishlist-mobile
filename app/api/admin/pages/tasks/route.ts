import { NextResponse } from "next/server";

import { getTaskPageSettingsByWishlistId, upsertTaskPageSettingsByWishlistId } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { taskPageSettingsSchema } from "@/lib/task-page-settings";

export async function GET() {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.wishlist.update",
    });
    const settings = await getTaskPageSettingsByWishlistId(session.wishlistId);
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
    const parsed = taskPageSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const settings = await upsertTaskPageSettingsByWishlistId({
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

