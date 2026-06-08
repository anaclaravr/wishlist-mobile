"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";

import { CommonButton } from "@/components/ui/button-system";
import type { StudyCourse } from "@/lib/access-db";

export function StudyCourseTitleEditor({ course, backHref }: { course: StudyCourse; backHref?: string }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const changed = cleanTitle !== course.title || cleanDescription !== (course.description || "");

  async function saveTitle(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!changed || saving) return;
    if (!cleanTitle) {
      setError("Informe o titulo do curso.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/studies/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          category: course.category,
          coverImageUrl: course.coverImageUrl,
          priority: course.priority,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Nao foi possivel salvar.");
      }

      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <form className="group min-w-0 flex-1" onSubmit={(event) => void saveTitle(event)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            aria-label="Nome do curso"
            className="ds-focus min-h-[42px] min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-0 py-1 font-semibold text-[#141a27] transition placeholder:text-[#9aa5ba] hover:border-[#dce3ef] hover:bg-white hover:px-3 focus:border-[#b9c6df] focus:bg-white focus:px-3 focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void saveTitle()}
          />

          {changed ? (
            <div className="flex shrink-0 items-center gap-2">
              <CommonButton
                type="button"
                variant="tertiary"
                className="h-9 px-2"
                disabled={saving}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setTitle(course.title);
                  setDescription(course.description || "");
                  setError(null);
                }}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
              </CommonButton>
              <CommonButton
                type="submit"
                variant="secondary"
                className="h-9 px-3"
                disabled={saving}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </CommonButton>
            </div>
          ) : null}
        </div>
        <textarea
          aria-label="Descricao do curso"
          className="ds-focus mt-1 block min-h-9 w-full resize-none rounded-[10px] border border-transparent bg-transparent px-0 py-1 text-sm font-normal leading-6 text-[#6c7489] transition placeholder:text-[#9aa5ba] hover:border-[#dce3ef] hover:bg-white hover:px-3 focus:border-[#b9c6df] focus:bg-white focus:px-3 focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => void saveTitle()}
          placeholder="Adicione uma descricao para este curso."
          rows={1}
        />
        {error ? <p className="mt-1 text-xs font-medium text-[#b4233b]">{error}</p> : null}
      </form>

      {backHref ? (
        <Link
          href={backHref}
          className="ds-focus inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-transparent px-3 text-sm font-medium text-[#4d5872] transition hover:bg-[#f2f5fb] hover:text-[#1a2539] focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Voltar
        </Link>
      ) : null}
    </div>
  );
}
