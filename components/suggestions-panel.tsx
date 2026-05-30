"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import { IconButton } from "@/components/ui/button-system";
import { formatAdminDate, type AdminSuggestion } from "@/components/admin-shared";

export function SuggestionsPanel({ suggestions: initialSuggestions }: { suggestions: AdminSuggestion[] }) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshSuggestions() {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/suggestions");
      const result = (await response.json()) as { suggestions?: AdminSuggestion[]; error?: string };
      if (!response.ok || !result.suggestions) {
        throw new Error(result.error ?? "Nao foi possivel carregar sugestoes.");
      }
      setSuggestions(result.suggestions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <aside className="self-start rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[#151b28]">Sugestoes publicas</h3>
        <IconButton
          type="button"
          onClick={refreshSuggestions}
          size="sm"
          variant="secondary"
          title="Atualizar sugestoes"
          aria-label="Atualizar sugestoes"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          )}
        </IconButton>
      </div>
      <p className="mt-1 text-xs text-[#6d768d]">Visualizacao somente leitura.</p>
      {error ? <p className="mt-2 text-xs text-[#9a3042]">{error}</p> : null}

      {suggestions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#d8dfed] px-3 py-4 text-sm text-[#6d768d]">
          Nenhuma sugestao publica no momento.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {suggestions.map((suggestion) => (
            <article
              key={`${suggestion.sourceType}:${suggestion.id}`}
              className="rounded-2xl border border-[#dbe1ed] bg-[#fbfcff] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1a2131]">{suggestion.name}</p>
                  <p className="truncate text-xs text-[#6c7489]">{suggestion.category}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[#111827]">
                  {formatPrice(suggestion.priceCents, suggestion.currency)}
                </p>
              </div>
              <p className="mt-1 truncate text-[11px] text-[#69728a]">
                {formatAdminDate(suggestion.createdAt)} · {suggestion.sourceLabel}
              </p>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
