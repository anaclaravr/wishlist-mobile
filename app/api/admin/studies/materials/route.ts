import { NextResponse } from "next/server";
import { z } from "zod";

import { createStudyMaterial } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const materialSchema = z.object({
  moduleId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  type: z.enum(["link", "image", "file_reference", "reference"]),
  title: z.string().trim().min(1, "Informe o titulo do material.").max(180),
  url: z.string().trim().max(1200).nullable().optional(),
  description: z.string().trim().max(1200).optional(),
  metadata: z.string().trim().max(1200).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = materialSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const material = await createStudyMaterial({
      wishlistId: session.wishlistId,
      moduleId: parsed.data.moduleId ?? null,
      topicId: parsed.data.topicId ?? null,
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
