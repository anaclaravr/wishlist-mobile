import { NextResponse } from "next/server";
import { z } from "zod";

import { createStudyPendingItem } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const pendingSchema = z.object({
  moduleId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Informe o titulo da pendencia.").max(180),
  status: z.enum(["pending", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  syncToTasks: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.studies.manage" });
    const parsed = pendingSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const pendingItem = await createStudyPendingItem({
      wishlistId: session.wishlistId,
      moduleId: parsed.data.moduleId ?? null,
      topicId: parsed.data.topicId ?? null,
      title: parsed.data.title,
      status: parsed.data.status ?? "pending",
      priority: parsed.data.priority ?? null,
      dueAt: parsed.data.dueAt ?? null,
      syncToTasks: Boolean(parsed.data.syncToTasks),
      createdByProfileId: session.profileId,
    });

    return NextResponse.json({ pendingItem });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
