import { NextResponse } from "next/server";
import { z } from "zod";

import { toggleAdminTaskStatus } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { getErrorResponse, PublicError } from "@/lib/errors";

const toggleSchema = z.object({
  status: z.enum(["pending", "in_progress", "done"]).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAccessSession({ role: "admin", permission: "admin.tasks.manage" });
    const body = await request.json().catch(() => ({}));
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }
    const { id } = await context.params;
    const task = await toggleAdminTaskStatus(id, parsed.data.status);
    return NextResponse.json({ task });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
