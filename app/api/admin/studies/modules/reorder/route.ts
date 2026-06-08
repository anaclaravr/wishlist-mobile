import { NextResponse } from "next/server";
import { z } from "zod";

import { reorderStudyModule } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const reorderSchema = z.object({
  moduleId: z.string().uuid(),
  courseId: z.string().uuid(),
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

    const studyModule = await reorderStudyModule({
      wishlistId: session.wishlistId,
      moduleId: parsed.data.moduleId,
      courseId: parsed.data.courseId,
      beforeId: parsed.data.beforeId ?? null,
      afterId: parsed.data.afterId ?? null,
    });
    return NextResponse.json({ module: studyModule });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
