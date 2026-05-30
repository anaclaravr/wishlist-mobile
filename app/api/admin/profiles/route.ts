import { NextResponse } from "next/server";
import { z } from "zod";

import type { AccessRole } from "@/lib/access";
import {
  ensureAccessProfilesForWishlistId,
  listAccessProfilesByWishlistId,
  regenerateAccessProfileKey,
  setAccessProfileActiveState,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const roleSchema = z.enum(["admin", "editor", "viewer"]);
const patchSchema = z.object({
  role: roleSchema,
  action: z.enum(["regenerate", "toggle"]),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.profiles.manage",
    });

    await ensureAccessProfilesForWishlistId(session.wishlistId);
    const profiles = await listAccessProfilesByWishlistId(session.wishlistId);

    return NextResponse.json({ profiles });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAccessSession({
      role: "admin",
      permission: "admin.profiles.manage",
    });
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const input = parsed.data;
    let profile;

    if (input.action === "regenerate") {
      profile = await regenerateAccessProfileKey({
        wishlistId: session.wishlistId,
        role: input.role as AccessRole,
      });
    } else {
      if (typeof input.isActive !== "boolean") {
        throw new PublicError("Informe se o perfil deve ficar ativo ou inativo.");
      }

      profile = await setAccessProfileActiveState({
        wishlistId: session.wishlistId,
        role: input.role as AccessRole,
        isActive: input.isActive,
      });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
