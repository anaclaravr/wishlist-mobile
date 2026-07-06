"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { CommonButton } from "@/components/ui/button-system";

export function AdminBootstrapLogin({
  adminToken,
  wishlistTitle,
}: {
  adminToken: string;
  wishlistTitle: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleBootstrap() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminToken,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel entrar com este link.");
      }

      window.location.href = "/admin";
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    handleBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
        <div className="w-full max-w-lg rounded-[24px] border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#8a92a7]">Bootstrap</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#141a27]">Abrindo admin</h1>
          <p className="mt-2 text-sm text-[#666f85]">
            Validando acesso do workspace <strong>{wishlistTitle}</strong>.
          </p>

          {error ? (
            <p className="mt-4 rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
              {error}
            </p>
          ) : null}

          <CommonButton
            type="button"
            onClick={handleBootstrap}
            disabled={isSubmitting}
            variant="primary"
            usage="info"
            showIconLeft
            iconLeft={isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            className="mt-5"
          >
            Tentar novamente
          </CommonButton>
        </div>
      </div>
    </main>
  );
}
