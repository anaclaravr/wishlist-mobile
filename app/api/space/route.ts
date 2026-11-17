import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getErrorResponse, PublicError } from "@/lib/errors";
import { getSpaceBySession, saveSpaceData, SPACE_SESSION_COOKIE } from "@/lib/spaces";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

const dataSchema = z.object({
  items: z.array(z.unknown()).max(2000),
  books: z.array(z.unknown()).max(2000),
  logs: z.array(z.unknown()).max(50000),
  rgoal: z.record(z.unknown()).nullable(),
});

async function sessionToken() {
  return (await cookies()).get(SPACE_SESSION_COOKIE)?.value;
}

export async function GET() {
  try {
    const space = await getSpaceBySession(await sessionToken());

    if (!space) {
      return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(space, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function PUT(request: Request) {
  try {
    const raw = await request.text();

    if (raw.length > MAX_BODY_BYTES) {
      throw new PublicError("Seu espaço ficou grande demais para salvar.", 413);
    }

    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }

    const parsed = dataSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Dados inválidos.");
    }

    await saveSpaceData(await sessionToken(), parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
