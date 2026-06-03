import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminTask, listAdminTasks } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const taskStatusSchema = z.enum(["pending", "in_progress", "done"]);
const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Informe o titulo da tarefa.").max(180),
  notes: z.string().trim().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  filter: z.enum(["all", "pending", "in_progress", "done"]).default("all"),
  q: z.string().trim().max(120).default(""),
});

export async function GET(request: Request) {
  try {
    await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Parametros invalidos.");
    }

    const result = await listAdminTasks({
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      filter: parsed.data.filter,
      query: parsed.data.q,
    });
    return NextResponse.json(result);
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const task = await createAdminTask({
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      status: parsed.data.status ?? "pending",
      priority: parsed.data.priority ?? null,
      category: parsed.data.category ?? "pessoal",
      tags: parsed.data.tags ?? [],
      dueAt: parsed.data.dueAt ?? null,
      createdByProfileId: session.profileId,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
