import { NextRequest, NextResponse } from "next/server";

import { getFollowerByToken } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug")?.trim();
    const followToken = request.nextUrl.searchParams.get("token")?.trim();

    if (!slug || !followToken) {
      throw new PublicError("Link de acompanhamento invalido.", 400);
    }

    const follower = await getFollowerByToken({ slug, followToken });

    if (!follower) {
      throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
    }

    return NextResponse.json({
      follower: {
        id: follower.id,
        email: follower.email,
        followToken: follower.followToken,
      },
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
