import { z } from "zod";

export const taskPageSettingsSchema = z.object({
  columnLabels: z.object({
    pending: z.string().trim().min(1).max(40),
    inProgress: z.string().trim().min(1).max(40),
    done: z.string().trim().min(1).max(40),
  }),
  defaultPageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  showDueDate: z.boolean(),
  showTags: z.boolean(),
});

export type TaskPageSettings = z.infer<typeof taskPageSettingsSchema>;

export const DEFAULT_TASK_PAGE_SETTINGS: TaskPageSettings = {
  columnLabels: {
    pending: "Pendente",
    inProgress: "Em andamento",
    done: "Concluido",
  },
  defaultPageSize: 20,
  showDueDate: true,
  showTags: true,
};

export function normalizeTaskPageSettings(input: unknown): TaskPageSettings {
  const parsed = taskPageSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return DEFAULT_TASK_PAGE_SETTINGS;
  }
  return parsed.data;
}

