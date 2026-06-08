import { NextResponse } from "next/server";
import { z } from "zod";

import { createStudyModule } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const moduleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o titulo do modulo.").max(160),
  description: z.string().trim().max(800).optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = moduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const studyModule = await createStudyModule({
      wishlistId: session.wishlistId,
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      priority: parsed.data.priority ?? null,
      createdByProfileId: session.profileId,
    });

    return NextResponse.json({ module: studyModule });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
