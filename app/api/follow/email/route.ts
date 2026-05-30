import { NextResponse } from "next/server";
import { z } from "zod";

import { setFollowerEmail } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";

const updateFollowerEmailSchema = z.object({
  slug: z.string().trim().min(1),
  followToken: z.string().trim().min(1),
  email: z.string().trim().email("Informe um e-mail valido."),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateFollowerEmailSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const follower = await setFollowerEmail(parsed.data);

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
