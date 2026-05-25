"use client";

import { ArrowRight, Loader2, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

type CreateResponse = {
  adminUrl?: string;
  error?: string;
};

export function CreateWishlistForm() {
  const [title, setTitle] = useState("Minha wishlist");
  const [ownerName, setOwnerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/wishlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, ownerName }),
      });
      const data = (await response.json()) as CreateResponse;

      if (!response.ok || !data.adminUrl) {
        throw new Error(data.error ?? "Nao foi possivel criar a wishlist.");
      }

      window.location.assign(data.adminUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-soft sm:p-5"
    >
      <label className="block space-y-2">
        <span className="text-sm font-bold text-neutral-800">Nome da wishlist</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base font-semibold outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
          maxLength={90}
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-neutral-800">Seu nome</span>
        <div className="flex h-12 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 focus-within:border-teal-700 focus-within:ring-4 focus-within:ring-teal-700/10">
          <UserRound aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500" />
          <input
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
            maxLength={70}
            placeholder="Opcional"
          />
        </div>
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : (
          <ArrowRight aria-hidden="true" className="h-5 w-5" />
        )}
        Criar e abrir painel
      </button>
    </form>
  );
}
