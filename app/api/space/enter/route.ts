import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse, PublicError } from "@/lib/errors";
import { enterSpace, SPACE_SESSION_COOKIE, SPACE_SESSION_MAX_AGE } from "@/lib/spaces";

const enterSchema = z.object({
  name: z.string().max(200),
  pin: z.string().max(10),
});

export async function POST(request: Request) {
  try {
    const parsed = enterSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new PublicError("Informe nome e PIN.");
    }

    const { token, space } = await enterSpace(parsed.data.name, parsed.data.pin.trim());
    const response = NextResponse.json(space);

    response.cookies.set({
      name: SPACE_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SPACE_SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
