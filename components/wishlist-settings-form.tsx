"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";

import type { Wishlist } from "@/lib/db";
import { CommonButton } from "@/components/ui/button-system";

export function WishlistSettingsForm({ wishlist }: { wishlist: Wishlist }) {
  const [title, setTitle] = useState(wishlist.title);
  const [slug, setSlug] = useState(wishlist.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveWishlistSettings() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/wishlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug }),
      });
      const result = (await response.json()) as { wishlist?: Wishlist; error?: string };
      if (!response.ok || !result.wishlist) {
        throw new Error(result.error ?? "Nao foi possivel salvar as configuracoes.");
      }
      setTitle(result.wishlist.title);
      setSlug(result.wishlist.slug);
      setMessage("Configuracoes do workspace atualizadas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      {message ? (
        <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
          {error}
        </p>
      ) : null}

      <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Configuracoes da pagina Workspace</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Titulo</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[#7a8298]">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <CommonButton
            type="button"
            onClick={saveWishlistSettings}
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
