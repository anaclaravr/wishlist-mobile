import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteStudyCourse, updateStudyCourse } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const courseSchema = z.object({
  title: z.string().trim().min(1, "Informe o titulo do curso.").max(160),
  description: z.string().trim().max(800).optional(),
  category: z.string().trim().max(80).optional(),
  coverImageUrl: z.string().trim().max(1000).optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = courseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const { id } = await context.params;
    const course = await updateStudyCourse({
      id,
      wishlistId: session.wishlistId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      category: parsed.data.category ?? "course",
      coverImageUrl: parsed.data.coverImageUrl ?? "",
      priority: parsed.data.priority ?? null,
    });

    return NextResponse.json({ course });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const { id } = await context.params;
    await deleteStudyCourse({ id, wishlistId: session.wishlistId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
