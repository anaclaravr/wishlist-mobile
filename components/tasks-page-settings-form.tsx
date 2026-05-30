"use client";

import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";

import { CommonButton } from "@/components/ui/button-system";
import type { TaskPageSettings } from "@/lib/task-page-settings";

export function TasksPageSettingsForm({ initialSettings }: { initialSettings: TaskPageSettings }) {
  const [settings, setSettings] = useState<TaskPageSettings>(initialSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveSettings() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/pages/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = (await response.json()) as { settings?: TaskPageSettings; error?: string };
      if (!response.ok || !result.settings) {
        throw new Error(result.error ?? "Nao foi possivel salvar configuracoes de Tasks.");
      }
      setSettings(result.settings);
      setMessage("Configuracoes de Tasks atualizadas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      {message ? (
        <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">{error}</p>
      ) : null}

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Configuracoes da pagina Tasks</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Label pendente</span>
            <input
              value={settings.columnLabels.pending}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  columnLabels: { ...current.columnLabels, pending: event.target.value },
                }))
              }
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Label em andamento</span>
            <input
              value={settings.columnLabels.inProgress}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  columnLabels: { ...current.columnLabels, inProgress: event.target.value },
                }))
              }
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Label concluido</span>
            <input
              value={settings.columnLabels.done}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  columnLabels: { ...current.columnLabels, done: event.target.value },
                }))
              }
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Paginacao padrao</span>
            <select
              value={String(settings.defaultPageSize)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  defaultPageSize: Number(event.target.value) as 10 | 20 | 50,
                }))
              }
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-[#d1d9e9] px-3 py-2.5">
            <input
              type="checkbox"
              checked={settings.showDueDate}
              onChange={(event) => setSettings((current) => ({ ...current, showDueDate: event.target.checked }))}
              className="h-4 w-4 rounded border-[#c8d2e8]"
            />
            <span className="text-sm text-[#384259]">Exibir due date</span>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-[#d1d9e9] px-3 py-2.5">
            <input
              type="checkbox"
              checked={settings.showTags}
              onChange={(event) => setSettings((current) => ({ ...current, showTags: event.target.checked }))}
              className="h-4 w-4 rounded border-[#c8d2e8]"
            />
            <span className="text-sm text-[#384259]">Exibir tags</span>
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Link href="/tasks" className="text-sm text-[#4c58bc] underline-offset-2 hover:underline">
            Abrir area operacional de Tasks
          </Link>
          <CommonButton
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            variant="primary"
            usage="info"
            showIconLeft
            iconLeft={
              isSaving ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )
            }
          >
            Salvar configuracoes
          </CommonButton>
        </div>
      </article>
    </section>
  );
}
