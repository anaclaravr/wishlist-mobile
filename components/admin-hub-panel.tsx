"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import type { AccessProfile } from "@/lib/access-db";
import type { Wishlist } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { WishlistSidebar } from "@/components/wishlist-sidebar";
import {
  CommonButton,
  IconButton,
} from "@/components/ui/button-system";

type AdminSuggestion = {
  id: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: "baixa" | "media" | "alta";
  repurchaseState: "nao_recompra" | "precisa_recompra" | "ainda_tem";
  visibility: "private" | "public";
  createdAt: string;
  updatedAt: string;
  sourceType: "profile" | "legacy";
  sourceLabel: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

export function AdminHubPanel({
  wishlist,
  followersCount,
  officialItemsCount,
  profiles: initialProfiles,
  suggestions: initialSuggestions,
}: {
  wishlist: Wishlist;
  followersCount: number;
  officialItemsCount: number;
  profiles: AccessProfile[];
  suggestions: AdminSuggestion[];
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [title, setTitle] = useState(wishlist.title);
  const [ownerName, setOwnerName] = useState(wishlist.ownerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState(wishlist.ownerEmail ?? "");
  const [ownerAvatarUrl, setOwnerAvatarUrl] = useState(wishlist.ownerAvatarUrl ?? "");
  const [slug, setSlug] = useState(wishlist.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const publicPath = useMemo(() => (wishlist.slug === slug ? "/" : `/w/${slug}`), [wishlist.slug, slug]);

  async function refreshProfiles() {
    const response = await fetch("/api/admin/profiles");
    const result = (await response.json()) as { profiles?: AccessProfile[]; error?: string };

    if (!response.ok || !result.profiles) {
      throw new Error(result.error ?? "Nao foi possivel carregar os perfis.");
    }

    setProfiles(result.profiles);
  }

  async function refreshSuggestions() {
    const response = await fetch("/api/admin/suggestions");
    const result = (await response.json()) as {
      suggestions?: AdminSuggestion[];
      error?: string;
    };

    if (!response.ok || !result.suggestions) {
      throw new Error(result.error ?? "Nao foi possivel carregar sugestoes.");
    }

    setSuggestions(result.suggestions);
  }

  async function copyAccessKey(accessKey: string) {
    try {
      await navigator.clipboard.writeText(accessKey);
      setMessage("Chave copiada.");
      setError(null);
    } catch {
      setError("Nao foi possivel copiar a chave.");
    }
  }

  async function regenerateProfileKey(role: AccessProfile["role"]) {
    setPendingAction(`regen:${role}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          action: "regenerate",
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel regenerar a chave.");
      }

      await refreshProfiles();
      setMessage(`Chave de ${role} regenerada.`);
    } catch (regenError) {
      setError(regenError instanceof Error ? regenError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleProfile(role: AccessProfile["role"], isActive: boolean) {
    setPendingAction(`toggle:${role}`);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role,
          action: "toggle",
          isActive,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel atualizar o perfil.");
      }

      await refreshProfiles();
      setMessage(`Perfil ${role} ${isActive ? "ativado" : "desativado"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function saveWishlistSettings() {
    setPendingAction("save-settings");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/wishlist", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          ownerName,
          ownerEmail,
          ownerAvatarUrl,
          slug,
        }),
      });
      const result = (await response.json()) as { wishlist?: Wishlist; error?: string };

      if (!response.ok || !result.wishlist) {
        throw new Error(result.error ?? "Nao foi possivel salvar as configuracoes.");
      }

      setTitle(result.wishlist.title);
      setOwnerName(result.wishlist.ownerName ?? "");
      setOwnerEmail(result.wishlist.ownerEmail ?? "");
      setOwnerAvatarUrl(result.wishlist.ownerAvatarUrl ?? "");
      setSlug(result.wishlist.slug);
      setMessage("Configuracoes da wishlist atualizadas.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="ds-app-shell min-h-screen">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[272px_1fr]"
        }`}
      >
        <WishlistSidebar
          title={ownerName || wishlist.ownerName || "Perfil da wishlist"}
          subtitle={ownerEmail || wishlist.ownerEmail || "Sem e-mail configurado"}
          avatarUrl={ownerAvatarUrl || wishlist.ownerAvatarUrl || null}
          wishlistHref={publicPath}
          adminHref="/admin"
          activePage="admin"
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <section className="ds-app-panel p-4 sm:p-6">
          <header className="mb-4">
            <p className="text-[11px] font-medium uppercase text-[#7c8399]">Governanca</p>
            <h2 className="mt-1 text-[30px] font-semibold text-[#141a27]">Admin Hub</h2>
            <p className="mt-2 text-sm text-[#6c7489]">
              {officialItemsCount} itens oficiais · {followersCount} seguidores legados
            </p>
          </header>

          {message ? (
            <p className="mb-3 rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
                <h3 className="text-[15px] font-semibold text-[#151b28]">Configuracoes da wishlist</h3>
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
                    <span className="text-[11px] font-medium text-[#7a8298]">Nome do perfil</span>
                    <input
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">E-mail do perfil</span>
                    <input
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                      placeholder="voce@exemplo.com"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-medium text-[#7a8298]">URL da foto do perfil</span>
                    <input
                      value={ownerAvatarUrl}
                      onChange={(event) => setOwnerAvatarUrl(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                      placeholder="https://..."
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
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
                    disabled={pendingAction === "save-settings"}
                    variant="primary"
                    usage="info"
                    showIconLeft
                    iconLeft={
                      pendingAction === "save-settings" ? (
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

              <article className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-[#151b28]">Perfis de acesso</h3>
                  <IconButton
                    type="button"
                    onClick={refreshProfiles}
                    size="sm"
                    variant="secondary"
                    title="Atualizar perfis"
                    aria-label="Atualizar perfis"
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </div>

                <div className="mt-3 space-y-2">
                  {profiles.map((profile) => (
                    <article
                      key={profile.id}
                      className="rounded-2xl border border-[#dbe1ed] bg-[#fbfcff] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium capitalize text-[#1a2131]">{profile.role}</p>
                          <p className="text-xs text-[#6c7489]">
                            Regenerada em {formatDate(profile.lastRegeneratedAt)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            profile.isActive
                              ? "bg-[#e8f8ef] text-[#2a6b4d]"
                              : "bg-[#fdeef1] text-[#983043]"
                          }`}
                        >
                          {profile.isActive ? (
                            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldX aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {profile.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      <p className="mt-2 truncate rounded-lg border border-[#e2e7f1] bg-white px-2 py-1 text-xs text-[#2c3447]">
                        {profile.accessKey}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <CommonButton
                          type="button"
                          onClick={() => copyAccessKey(profile.accessKey)}
                          variant="secondary"
                          usage="general"
                          showIconLeft
                          iconLeft={<Copy aria-hidden="true" className="h-4 w-4" />}
                        >
                          Copiar
                        </CommonButton>
                        <CommonButton
                          type="button"
                          onClick={() => regenerateProfileKey(profile.role)}
                          disabled={pendingAction === `regen:${profile.role}`}
                          variant="secondary"
                          usage="general"
                          showIconLeft
                          iconLeft={
                            pendingAction === `regen:${profile.role}` ? (
                              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                            ) : (
                              <KeyRound aria-hidden="true" className="h-4 w-4" />
                            )
                          }
                        >
                          Regenerar
                        </CommonButton>
                        {profile.role !== "admin" ? (
                          <CommonButton
                            type="button"
                            onClick={() => toggleProfile(profile.role, !profile.isActive)}
                            disabled={pendingAction === `toggle:${profile.role}`}
                            variant="secondary"
                            usage="general"
                            showIconLeft
                            iconLeft={
                              pendingAction === `toggle:${profile.role}` ? (
                                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check aria-hidden="true" className="h-4 w-4" />
                              )
                            }
                          >
                            {profile.isActive ? "Desativar" : "Ativar"}
                          </CommonButton>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            </section>

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
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
              <p className="mt-1 text-xs text-[#6d768d]">Visualizacao somente leitura.</p>

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
                        {formatDate(suggestion.createdAt)} · {suggestion.sourceLabel}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
