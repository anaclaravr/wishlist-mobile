import { NextResponse } from "next/server";
import { z } from "zod";

import { followWishlist } from "@/lib/db";
import { sendFollowerWelcomeEmail } from "@/lib/email";
import { getErrorResponse, PublicError } from "@/lib/errors";

const followSchema = z.object({
  slug: z.string().trim().min(1),
  email: z.string().trim().email("Informe um e-mail valido.").optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = followSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const result = await followWishlist(parsed.data);
    const email = await sendFollowerWelcomeEmail(result);

    return NextResponse.json({
      follower: {
        id: result.follower.id,
        email: result.follower.email,
        followToken: result.follower.followToken,
      },
      email,
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
