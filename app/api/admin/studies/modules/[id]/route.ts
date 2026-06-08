import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteStudyModule, updateStudyModule } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const moduleSchema = z.object({
  courseId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Informe o titulo do modulo.").max(160),
  description: z.string().trim().max(800).optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = moduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const { id } = await context.params;
    const studyModule = await updateStudyModule({
      id,
      wishlistId: session.wishlistId,
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      priority: parsed.data.priority ?? null,
    });

    return NextResponse.json({ module: studyModule });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const { id } = await context.params;
    await deleteStudyModule({ id, wishlistId: session.wishlistId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
