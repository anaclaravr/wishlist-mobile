import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getErrorResponse } from "@/lib/errors";
import { endSession, SPACE_SESSION_COOKIE } from "@/lib/spaces";

export async function POST() {
  try {
    await endSession((await cookies()).get(SPACE_SESSION_COOKIE)?.value);
  } catch (error) {
    getErrorResponse(error);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SPACE_SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
