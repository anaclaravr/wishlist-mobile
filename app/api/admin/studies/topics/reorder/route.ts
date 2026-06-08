import { NextResponse } from "next/server";
import { z } from "zod";

import { reorderStudyTopic } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const reorderSchema = z.object({
  topicId: z.string().uuid(),
  moduleId: z.string().uuid(),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = reorderSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const topic = await reorderStudyTopic({
      wishlistId: session.wishlistId,
      topicId: parsed.data.topicId,
      moduleId: parsed.data.moduleId,
      beforeId: parsed.data.beforeId ?? null,
      afterId: parsed.data.afterId ?? null,
    });
    return NextResponse.json({ topic });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
