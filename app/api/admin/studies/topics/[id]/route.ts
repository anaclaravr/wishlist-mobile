import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteStudyTopic, updateStudyTopic } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const noteBlockSchema = z.object({}).passthrough();
const topicSchema = z.object({
  moduleId: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Informe o titulo da aula.").max(180),
  notes: z.array(noteBlockSchema).optional(),
  status: z.enum(["not_started", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = topicSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const { id } = await context.params;
    const topic = await updateStudyTopic({
      id,
      wishlistId: session.wishlistId,
      moduleId: parsed.data.moduleId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? [],
      status: parsed.data.status ?? "not_started",
      priority: parsed.data.priority ?? null,
      dueAt: parsed.data.dueAt ?? null,
    });

    return NextResponse.json({ topic });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const { id } = await context.params;
    await deleteStudyTopic({ id, wishlistId: session.wishlistId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
