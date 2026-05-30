/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  ExternalLink,
  Flag,
  Heart,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { WishlistSidebar } from "@/components/wishlist-sidebar";
import { Drawer } from "@/components/ui/drawer";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import type {
  ItemRepurchaseState,
  PersonalItemSuggestion,
  Wishlist,
  WishlistData,
  WishlistItem,
  WishlistItemPriority,
} from "@/lib/db";
import { formatPrice, isRecent } from "@/lib/format";

type AdminData = Omit<WishlistData, "wishlist"> & {
  wishlist: Wishlist;
};

type AddItemResponse = {
  item?: WishlistItem;
  notifications?: {
    sent: number;
    skipped: number;
  };
  error?: string;
};

type ItemResponse = {
  item?: WishlistItem;
  error?: string;
};

type SuggestionsResponse = {
  suggestions?: PersonalItemSuggestion[];
  error?: string;
};

type ListFilter = "ativos" | "arquivados" | "todos";

const priorities: WishlistItemPriority[] = ["baixa", "media", "alta"];

const priorityLabels: Record<WishlistItemPriority, string> = {
  baixa: "Baixa",
  media: "Media",
  alta: "Alta",
};

const repurchaseLabels: Record<ItemRepurchaseState, string> = {
  nao_recompra: "Nao e recompra",
  precisa_recompra: "Precisa recompra",
  ainda_tem: "Ainda tem (sem urgencia)",
};

function getSourceLabel(purchaseUrl: string) {
  try {
    return new URL(purchaseUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Link externo";
  }
}

function formatCreatedLabel(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(createdAt));
}

export function AdminWishlistPanel({
  data,
  adminToken,
  publicPath,
}: {
  data: AdminData;
  adminToken: string;
  publicPath: string;
}) {
  const [items, setItems] = useState(data.items);
  const [name, setName] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(data.categories[0] ?? "Geral");
  const [priority, setPriority] = useState<WishlistItemPriority>("media");
  const [repurchaseState, setRepurchaseState] = useState<ItemRepurchaseState>("nao_recompra");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("ativos");
  const [query, setQuery] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isItemDrawerOpen, setIsItemDrawerOpen] = useState(false);
  const [collapsedItemIds, setCollapsedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingItemAction, setPendingItemAction] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PersonalItemSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set([...data.categories, ...items.map((item) => item.category), "Geral"]))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "pt-BR")),
    [data.categories, items],
  );
  const activeItems = items.filter((item) => !item.archivedAt);
  const archivedItems = items.filter((item) => Boolean(item.archivedAt));
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus =
        listFilter === "todos" ||
        (listFilter === "ativos" && !item.archivedAt) ||
        (listFilter === "arquivados" && Boolean(item.archivedAt));
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [items, listFilter, query]);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      setIsLoadingSuggestions(true);

      try {
        const response = await fetch(
          `/api/admin/suggestions?adminToken=${encodeURIComponent(adminToken)}`,
        );
        const result = (await response.json()) as SuggestionsResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(result.error ?? "Nao foi possivel carregar sugestoes.");
        }

        setSuggestions(result.suggestions ?? []);
      } catch (suggestionsError) {
        if (cancelled) {
          return;
        }

        setError(suggestionsError instanceof Error ? suggestionsError.message : "Erro inesperado.");
      } finally {
        if (!cancelled) {
          setIsLoadingSuggestions(false);
        }
      }
    }

    loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  function resetForm() {
    setName("");
    setPurchaseUrl("");
    setImageUrl("");
    setPrice("");
    setCategory(categories[0] ?? "Geral");
    setPriority("media");
    setRepurchaseState("nao_recompra");
    setEditingItemId(null);
  }

  function openCreateDrawer() {
    resetForm();
    setIsItemDrawerOpen(true);
    setError(null);
    setMessage(null);
  }

  async function copyPublicLink() {
    setError(null);

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      setMessage("Link publico copiado.");
    } catch {
      setError(`Nao foi possivel copiar. Link: ${publicPath}`);
    }
  }

  function startEditing(item: WishlistItem) {
    setEditingItemId(item.id);
    setName(item.name);
    setPurchaseUrl(item.purchaseUrl);
    setImageUrl(item.imageUrl ?? "");
    setPrice(
      (item.priceCents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
    setCategory(item.category);
    setPriority(item.priority);
    setRepurchaseState(item.repurchaseState);
    setIsItemDrawerOpen(true);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleItemCollapsed(itemId: string) {
    setCollapsedItemIds((currentItems) => {
      const nextItems = new Set(currentItems);
      if (nextItems.has(itemId)) {
        nextItems.delete(itemId);
      } else {
        nextItems.add(itemId);
      }
      return nextItems;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(editingItemId ? `/api/items/${editingItemId}` : "/api/items", {
        method: editingItemId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminToken,
          name,
          purchaseUrl,
          imageUrl,
          price,
          category,
          priority,
          repurchaseState,
        }),
      });
      const result = (await response.json()) as AddItemResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel salvar o item.");
      }

      if (editingItemId) {
        setItems((currentItems) =>
          currentItems.map((item) => (item.id === result.item?.id ? result.item : item)),
        );
        setMessage("Item atualizado.");
      } else {
        setItems((currentItems) => [result.item as WishlistItem, ...currentItems]);
        setMessage(
          result.notifications
            ? `Item adicionado. ${result.notifications.sent} alerta(s) enviado(s).`
            : "Item adicionado.",
        );
      }

      resetForm();
      setIsItemDrawerOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleArchive(item: WishlistItem) {
    const nextArchived = !item.archivedAt;
    const pendingKey = `archive:${item.id}`;
    setPendingItemAction(pendingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/items/${item.id}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminToken,
          archived: nextArchived,
        }),
      });
      const result = (await response.json()) as ItemResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel atualizar o item.");
      }

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === result.item?.id ? result.item : currentItem,
        ),
      );
      setMessage(nextArchived ? "Item arquivado." : "Item restaurado.");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Erro inesperado.");
    } finally {
      setPendingItemAction(null);
    }
  }

  async function deleteItem(item: WishlistItem) {
    if (!window.confirm(`Excluir "${item.name}" permanentemente?`)) {
      return;
    }

    const pendingKey = `delete:${item.id}`;
    setPendingItemAction(pendingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminToken,
        }),
      });
      const result = (await response.json()) as ItemResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel excluir o item.");
      }

      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
      setMessage("Item excluido.");

      if (editingItemId === item.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro inesperado.");
    } finally {
      setPendingItemAction(null);
    }
  }

  return (
    <main className="min-h-screen">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[272px_1fr]"
        }`}
      >
        <WishlistSidebar
          title={data.wishlist.ownerName || "Perfil da wishlist"}
          subtitle={data.wishlist.ownerEmail || "Sem e-mail configurado"}
          avatarUrl={data.wishlist.ownerAvatarUrl}
          wishlistHref={publicPath}
          adminHref={`/admin/${encodeURIComponent(adminToken)}`}
          activePage="admin"
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <section className="bg-[#f8f9fd]">
          <header className="border-b border-[#dee4ef] px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase text-[#7c8399]">Gestao da wishlist</p>
                <h2 className="mt-1 text-[30px] font-semibold text-[#141a27]">Itens</h2>
                <p className="mt-2 text-sm text-[#6c7489]">
                  {activeItems.length} ativo(s) · {archivedItems.length} arquivado(s) ·{" "}
                  {data.followersCount} acompanhando
                </p>
              </div>

              <div className="w-full space-y-2 xl:w-[560px]">
                <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-[#d6ddeb] bg-white px-3 text-[#5d6478] focus-within:border-[#99aacb]">
                  <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Buscar item</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nome ou categoria"
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[#131823] outline-none placeholder:text-[#9aa3b8]"
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <a
                    href={publicPath}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d7deec] bg-white px-3 text-sm font-medium text-[#171d2b] transition hover:border-[#b9c3d8]"
                  >
                    <LinkIcon aria-hidden="true" className="h-4 w-4" />
                    Abrir publico
                  </a>
                  <button
                    type="button"
                    onClick={copyPublicLink}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d7deec] bg-white px-3 text-sm font-medium text-[#171d2b] transition hover:border-[#b9c3d8]"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" />
                    Copiar link
                  </button>
                  <button
                    type="button"
                    onClick={openCreateDrawer}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#151b2a] px-3 text-sm font-medium text-white transition hover:bg-[#0f1421]"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Novo item
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <SegmentedTabs<ListFilter>
                value={listFilter}
                onChange={setListFilter}
                items={[
                  { id: "ativos", label: "Ativos", count: activeItems.length },
                  { id: "arquivados", label: "Arquivados", count: archivedItems.length },
                  { id: "todos", label: "Todos", count: items.length },
                ]}
              />
            </div>
          </header>

          <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
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

              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#ccd5e7] bg-white px-4 py-12 text-center text-sm font-medium text-[#747d93]">
                  Nenhum item encontrado com os filtros atuais.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isArchived = Boolean(item.archivedAt);
                  const pendingArchive = pendingItemAction === `archive:${item.id}`;
                  const pendingDelete = pendingItemAction === `delete:${item.id}`;
                  const isRecentItem = isRecent(item.createdAt);
                  const isCollapsed = collapsedItemIds.has(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`overflow-hidden rounded-[26px] border p-3 shadow-[0_14px_30px_rgba(30,39,57,0.1)] ${
                        isArchived ? "border-[#e7ebf4] bg-[#fdfdff] opacity-90" : "border-[#e8edf5] bg-white"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-[22px] bg-[#edf1f8]">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="aspect-[16/11] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[16/11] items-center justify-center text-[#596279]">
                            <ImageIcon aria-hidden="true" className="h-8 w-8" />
                          </div>
                        )}
                        {isRecentItem ? (
                          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#222a3a] shadow-sm">
                            <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                            Recente
                          </div>
                        ) : null}

                        <div className="absolute right-3 top-3 flex items-center gap-1">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4a5369] shadow-sm">
                            {isArchived ? (
                              <Archive aria-hidden="true" className="h-4 w-4" />
                            ) : item.acquiredAt ? (
                              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                            ) : (
                              <Heart aria-hidden="true" className="h-4 w-4" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleItemCollapsed(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4a5369] shadow-sm transition hover:text-[#1f2b46]"
                            aria-label={isCollapsed ? "Expandir card" : "Colapsar card"}
                            title={isCollapsed ? "Expandir card" : "Colapsar card"}
                          >
                            {isCollapsed ? (
                              <ChevronDown aria-hidden="true" className="h-4 w-4" />
                            ) : (
                              <ChevronUp aria-hidden="true" className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 px-2 pb-2 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[1rem] font-semibold leading-tight text-[#121723]">
                              {item.name}
                            </h3>
                            <p className="mt-1 truncate text-xs text-[#6c7489]">
                              {getSourceLabel(item.purchaseUrl)}
                            </p>
                          </div>
                          <p className="shrink-0 text-right text-[1.02rem] font-semibold leading-none text-[#101623]">
                            {formatPrice(item.priceCents, item.currency)}
                          </p>
                        </div>

                        <div
                          className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ${
                            isCollapsed ? "max-h-0 opacity-0" : "max-h-[560px] opacity-100"
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2f8] px-2.5 py-1 text-xs font-semibold text-[#59627b]">
                                <ImageIcon aria-hidden="true" className="size-3.5 shrink-0" />
                                {item.category}
                              </span>
                            </div>

                            {item.acquiredByEmail ? (
                              <p className="truncate text-xs text-[#6f7890]">Por {item.acquiredByEmail}</p>
                            ) : null}

                            <p className="inline-flex items-center gap-1 text-[11px] text-[#5e667c]">
                              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              {repurchaseLabels[item.repurchaseState]}
                            </p>

                            <div className="grid w-full grid-cols-[0.95fr_1.15fr_1.1fr] divide-x divide-[#dbe1ed]">
                              <div className="min-w-0 px-3 text-left">
                                <p className="flex items-center gap-1 text-[9px] font-medium uppercase text-[#8a93a8]">
                                  <Flag aria-hidden="true" className="h-3 w-3 shrink-0" />
                                  Prioridade
                                </p>
                                <p className="mt-1 text-xs font-medium text-[#323a4d]">
                                  {priorityLabels[item.priority]}
                                </p>
                              </div>
                              <div className="min-w-0 px-3 text-left">
                                <p className="flex items-center gap-1 text-[9px] font-medium uppercase text-[#8a93a8]">
                                  {isArchived ? (
                                    <Archive aria-hidden="true" className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <CheckCircle2
                                      aria-hidden="true"
                                      className={`h-3 w-3 shrink-0 ${
                                        item.acquiredAt ? "text-[#b77121]" : "text-[#2f6f50]"
                                      }`}
                                    />
                                  )}
                                  Status
                                </p>
                                <p className="mt-1 truncate text-xs font-medium text-[#323a4d]">
                                  {isArchived ? "Arquivado" : item.acquiredAt ? "Reservado" : "Disponivel"}
                                </p>
                              </div>
                              <div className="min-w-0 px-3 text-left">
                                <p className="flex items-center gap-1 text-[9px] font-medium uppercase text-[#8a93a8]">
                                  <CalendarDays aria-hidden="true" className="h-3 w-3 shrink-0" />
                                  Adicionado em
                                </p>
                                <p className="mt-1 whitespace-nowrap text-xs font-medium text-[#323a4d]">
                                  {formatCreatedLabel(item.createdAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <a
                                href={item.purchaseUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ced7e8] bg-white px-3 text-sm font-medium text-[#161c2a] transition hover:border-[#aebad2]"
                              >
                                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                                Abrir
                              </a>
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ced7e8] bg-white px-3 text-sm font-medium text-[#161c2a] transition hover:border-[#aebad2]"
                              >
                                <Edit3 aria-hidden="true" className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleArchive(item)}
                                disabled={pendingArchive}
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1b2235] px-3 text-sm font-medium text-white transition hover:bg-[#141b2d] disabled:opacity-60"
                              >
                                {pendingArchive ? (
                                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                                ) : isArchived ? (
                                  <ArchiveRestore aria-hidden="true" className="h-4 w-4" />
                                ) : (
                                  <Archive aria-hidden="true" className="h-4 w-4" />
                                )}
                                {isArchived ? "Restaurar" : "Arquivar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item)}
                                disabled={pendingDelete}
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#bb334b] px-3 text-sm font-medium text-white transition hover:bg-[#a32840] disabled:opacity-60"
                              >
                                {pendingDelete ? (
                                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                                )}
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <div className="self-start xl:sticky xl:top-6">
              <section className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
                <h3 className="text-[15px] font-semibold text-[#151b28]">Sugestoes publicas</h3>
                <p className="mt-1 text-xs text-[#6d768d]">
                  Itens pessoais marcados como publicos. Somente visualizacao.
                </p>

                {isLoadingSuggestions ? (
                  <div className="mt-3 inline-flex items-center gap-2 text-sm text-[#55607a]">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-[#d8dfed] px-3 py-4 text-sm text-[#6d768d]">
                    Nenhuma sugestao publica no momento.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {suggestions.map((suggestion) => (
                      <article
                        key={suggestion.id}
                        className="rounded-2xl border border-[#dbe1ed] bg-[#fbfcff] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#1a2131]">
                              {suggestion.name}
                            </p>
                            <p className="truncate text-xs text-[#6c7489]">
                              {getSourceLabel(suggestion.purchaseUrl)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-[#111827]">
                            {formatPrice(suggestion.priceCents, suggestion.currency)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#5f6880]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1f8] px-2 py-0.5">
                            {suggestion.category}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1f8] px-2 py-0.5">
                            {priorityLabels[suggestion.priority]}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#edf1f8] px-2 py-0.5">
                            {repurchaseLabels[suggestion.repurchaseState]}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-[11px] text-[#69728a]">
                          {formatCreatedLabel(suggestion.createdAt)} · Seguidor:{" "}
                          {suggestion.followerEmail ?? "anonimo"}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>

      <Drawer
        open={isItemDrawerOpen}
        onClose={() => {
          setIsItemDrawerOpen(false);
          resetForm();
        }}
        title={editingItemId ? "Editar item" : "Novo item"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#7a8298]">Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
              maxLength={120}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#7a8298]">Link de compra</span>
            <input
              value={purchaseUrl}
              onChange={(event) => setPurchaseUrl(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
              inputMode="url"
              placeholder="https://..."
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#7a8298]">Imagem do item</span>
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
              inputMode="url"
              placeholder="https://..."
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-[#7a8298]">Preco</span>
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                inputMode="decimal"
                placeholder="149,90"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-[#7a8298]">Categoria</span>
              <input
                list="wishlist-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                maxLength={60}
                required
              />
              <datalist id="wishlist-categories">
                {categories.map((itemCategory) => (
                  <option key={itemCategory} value={itemCategory} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[#7a8298]">Prioridade</span>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((itemPriority) => {
                const active = priority === itemPriority;

                return (
                  <button
                    key={itemPriority}
                    type="button"
                    onClick={() => setPriority(itemPriority)}
                    className={`h-10 rounded-xl border text-sm font-medium transition ${
                      active ? "border-[#1a2235] bg-[#1a2235] text-white" : "border-[#d1d9e9] bg-white text-[#4e576d]"
                    }`}
                  >
                    {priorityLabels[itemPriority]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[#7a8298]">Recompra</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "nao_recompra", label: "Nao e recompra" },
                  { value: "precisa_recompra", label: "Precisa agora" },
                  { value: "ainda_tem", label: "Ainda tem" },
                ] as Array<{ value: ItemRepurchaseState; label: string }>
              ).map((repurchaseOption) => {
                const active = repurchaseState === repurchaseOption.value;

                return (
                  <button
                    key={repurchaseOption.value}
                    type="button"
                    onClick={() => setRepurchaseState(repurchaseOption.value)}
                    className={`h-10 rounded-xl border text-xs font-medium transition ${
                      active ? "border-[#1a2235] bg-[#1a2235] text-white" : "border-[#d1d9e9] bg-white text-[#4e576d]"
                    }`}
                  >
                    {repurchaseOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#d8dfed] bg-[#f2f5fb]">
            {imageUrl.trim() ? (
              <img src={imageUrl} alt="" className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-[#7f879a]">
                <ImageIcon aria-hidden="true" className="h-8 w-8" />
                <span className="text-[11px] font-medium uppercase">Preview</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsItemDrawerOpen(false);
                resetForm();
              }}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#d3dbeb] text-sm font-medium text-[#4e576d]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#131a2b] px-4 text-sm font-medium text-white transition hover:bg-[#0e1525] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : editingItemId ? (
                <Save aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Plus aria-hidden="true" className="h-5 w-5" />
              )}
              {editingItemId ? "Salvar alteracoes" : "Adicionar item"}
            </button>
          </div>
        </form>
      </Drawer>
    </main>
  );
}
