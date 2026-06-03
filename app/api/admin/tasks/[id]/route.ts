import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteAdminTask, updateAdminTask } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const taskStatusSchema = z.enum(["pending", "in_progress", "done"]);
const updateTaskSchema = z.object({
  title: z.string().trim().min(1, "Informe o titulo da tarefa.").max(180),
  notes: z.string().trim().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const { id } = await context.params;
    const task = await updateAdminTask({
      id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status ?? "pending",
      priority: parsed.data.priority ?? null,
      category: parsed.data.category ?? "pessoal",
      tags: parsed.data.tags ?? [],
      dueAt: parsed.data.dueAt ?? null,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const { id } = await context.params;
    await deleteAdminTask(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
