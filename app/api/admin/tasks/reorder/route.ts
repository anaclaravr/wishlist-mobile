import { NextResponse } from "next/server";
import { z } from "zod";

import { reorderAdminTask } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const reorderTaskSchema = z.object({
  taskId: z.string().uuid(),
  targetStatus: z.enum(["pending", "in_progress", "done"]),
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const body = await request.json();
    const parsed = reorderTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const task = await reorderAdminTask({
      taskId: parsed.data.taskId,
      targetStatus: parsed.data.targetStatus,
      beforeId: parsed.data.beforeId ?? null,
      afterId: parsed.data.afterId ?? null,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
