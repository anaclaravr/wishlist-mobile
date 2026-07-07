import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME } from "@/lib/access";
import { getAccessSessionFromToken } from "@/lib/access-db";
import { getErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await getAccessSessionFromToken(sessionToken);

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const slug = request.nextUrl.searchParams.get("slug")?.trim();

    if (slug && slug !== session.wishlistSlug) {
      return NextResponse.json(
        { authenticated: false, error: "Sessao valida para outra wishlist." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      authenticated: true,
      role: session.role,
      permissions: session.permissions,
      wishlist: {
        id: session.wishlistId,
        slug: session.wishlistSlug,
        title: session.wishlistTitle,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
