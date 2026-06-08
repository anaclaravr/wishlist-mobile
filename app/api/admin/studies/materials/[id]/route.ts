import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteStudyMaterial, updateStudyMaterial } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const materialSchema = z.object({
  type: z.enum(["link", "image", "file_reference", "reference"]),
  title: z.string().trim().min(1, "Informe o titulo do material.").max(180),
  url: z.string().trim().max(1200).nullable().optional(),
  description: z.string().trim().max(1200).optional(),
  metadata: z.string().trim().max(1200).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = materialSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const { id } = await context.params;
    const material = await updateStudyMaterial({
      id,
      wishlistId: session.wishlistId,
      type: parsed.data.type,
      title: parsed.data.title,
      url: parsed.data.url ?? null,
      description: parsed.data.description ?? "",
      metadata: parsed.data.metadata ?? "",
    });

    return NextResponse.json({ material });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const { id } = await context.params;
    await deleteStudyMaterial({ id, wishlistId: session.wishlistId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
