import { NextResponse } from "next/server";
import { z } from "zod";

import {
  markItemAcquiredByProfile,
  unmarkItemAcquiredByProfile,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { markItemAcquired, unmarkItemAcquired } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const acquireSchema = z.object({
  followToken: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = acquireSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Acompanhe o workspace antes de marcar como adquirido.", 401);
    }

    const { id } = await context.params;
    const item = parsed.data.followToken
      ? await markItemAcquired({
          itemId: id,
          followToken: parsed.data.followToken,
        })
      : await (async () => {
          const session = await requireAccessSession({
            permission: "wishlist.acquire.toggle",
          });

          return markItemAcquiredByProfile({
            itemId: id,
            wishlistId: session.wishlistId,
            profileId: session.profileId,
          });
        })();

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = acquireSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Acompanhamento nao encontrado para este workspace.", 401);
    }

    const { id } = await context.params;
    const item = parsed.data.followToken
      ? await unmarkItemAcquired({
          itemId: id,
          followToken: parsed.data.followToken,
        })
      : await (async () => {
          const session = await requireAccessSession({
            permission: "wishlist.acquire.toggle",
          });

          return unmarkItemAcquiredByProfile({
            itemId: id,
            wishlistId: session.wishlistId,
            profileId: session.profileId,
            role: session.role,
          });
        })();

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
