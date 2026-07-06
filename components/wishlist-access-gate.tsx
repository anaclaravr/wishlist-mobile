"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { CommonButton } from "@/components/ui/button-system";

export function WishlistAccessGate({
  slug,
  title = "Acesso restrito",
  description = "Informe sua chave para visualizar este workspace.",
}: {
  slug: string;
  title?: string;
  description?: string;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          key,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel autenticar agora.");
      }

      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
        <div className="w-full max-w-md rounded-[24px] border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eceff7] text-[#465270]">
            <KeyRound aria-hidden="true" className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-[#141a27]">{title}</h1>
          <p className="mt-2 text-sm text-[#666f85]">{description}</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8a92a7]">
                Chave de acesso
              </span>
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                placeholder="wk_viewer_..."
                autoComplete="off"
                required
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
                {error}
              </p>
            ) : null}

            <CommonButton
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              usage="info"
              showIconLeft
              iconLeft={isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              className="w-full"
            >
              Entrar
            </CommonButton>
          </form>
        </div>
      </div>
    </main>
  );
}
