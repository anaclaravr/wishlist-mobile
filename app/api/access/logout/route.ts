import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME } from "@/lib/access";
import { deleteAccessSession } from "@/lib/access-db";
import { getErrorResponse } from "@/lib/errors";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

    if (sessionToken) {
      await deleteAccessSession(sessionToken);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ACCESS_COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
