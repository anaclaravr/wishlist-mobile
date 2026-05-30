import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_MAX_AGE_SECONDS,
} from "@/lib/access";
import {
  bootstrapAdminProfileByToken,
  createSessionForProfile,
  findAccessProfileByKey,
} from "@/lib/access-db";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { getRolePermissions } from "@/lib/rbac";

const loginSchema = z
  .object({
    slug: z.string().trim().min(1).optional(),
    key: z.string().trim().min(1).optional(),
    adminToken: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.key || value.adminToken), {
    message: "Informe uma chave de acesso valida.",
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.", 401);
    }

    const data = parsed.data;
    let profile;
    let wishlistSlug: string;
    let wishlistTitle: string;

    if (data.adminToken) {
      const bootstrap = await bootstrapAdminProfileByToken(data.adminToken);
      profile = bootstrap.profile;
      wishlistSlug = bootstrap.wishlist.slug;
      wishlistTitle = bootstrap.wishlist.title;
    } else {
      const keyMatch = await findAccessProfileByKey({
        key: data.key ?? "",
        slug: data.slug,
      });

      if (!keyMatch) {
        throw new PublicError("Chave de acesso invalida ou inativa.", 401);
      }

      profile = keyMatch.profile;
      wishlistSlug = keyMatch.wishlistSlug;
      wishlistTitle = keyMatch.wishlistTitle;
    }

    const session = await createSessionForProfile(profile);
    const response = NextResponse.json({
      authenticated: true,
      role: profile.role,
      permissions: getRolePermissions(profile.role),
      wishlist: {
        id: profile.wishlistId,
        slug: wishlistSlug,
        title: wishlistTitle,
      },
      expiresAt: session.expiresAt,
    });

    response.cookies.set({
      name: ACCESS_COOKIE_NAME,
      value: session.sessionToken,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: ACCESS_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
