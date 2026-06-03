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
  Layers3,
  Link as LinkIcon,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { WishlistSidebar } from "@/components/wishlist-sidebar";
import { Chip } from "@/components/ui/chip";
import { Drawer, DrawerFieldRow, DrawerSection } from "@/components/ui/drawer";
import { EditableLinkButtonField } from "@/components/ui/editable-link-button-field";
import { Tabs } from "@/components/ui/tabs";
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

type LinkPreviewResponse = {
  name?: string;
  imageUrl?: string;
  price?: string;
  error?: string;
};

type LinkPreviewState = {
  isLoading: boolean;
  error: string | null;
};

type AutoFillField = "name" | "imageUrl" | "price";
type AutoFillTouchedFields = Record<AutoFillField, boolean>;

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

function createAutoFillTouchedFields(): AutoFillTouchedFields {
  return {
    name: false,
    imageUrl: false,
    price: false,
  };
}

function parseHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function shouldApplyPreviewField(
  field: AutoFillField,
  currentValue: string,
  touchedFields: AutoFillTouchedFields,
  autoFilledValues: Partial<Record<AutoFillField, string>>,
) {
  return (
    !touchedFields[field] &&
    (!currentValue.trim() || currentValue === (autoFilledValues[field] ?? ""))
  );
}

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

function propertyLabel(icon: ReactNode, label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[#7a8398]">{icon}</span>
      <span>{label}</span>
    </span>
  );
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
  const [linkPreview, setLinkPreview] = useState<LinkPreviewState>({
    isLoading: false,
    error: null,
  });
  const autoFillTouchedFieldsRef = useRef<AutoFillTouchedFields>(createAutoFillTouchedFields());
  const autoFilledValuesRef = useRef<Partial<Record<AutoFillField, string>>>({});
  const purchaseUrlEditedRef = useRef(false);

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
    autoFillTouchedFieldsRef.current = createAutoFillTouchedFields();
    autoFilledValuesRef.current = {};
    purchaseUrlEditedRef.current = false;
    setLinkPreview({ isLoading: false, error: null });
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
    autoFillTouchedFieldsRef.current = createAutoFillTouchedFields();
    autoFilledValuesRef.current = {};
    purchaseUrlEditedRef.current = false;
    setLinkPreview({ isLoading: false, error: null });
    setIsItemDrawerOpen(true);
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markAutoFillFieldTouched(field: AutoFillField) {
    autoFillTouchedFieldsRef.current = {
      ...autoFillTouchedFieldsRef.current,
      [field]: true,
    };
  }

  function handlePurchaseUrlChange(value: string) {
    purchaseUrlEditedRef.current = true;
    setPurchaseUrl(value);
  }

  function applyLinkPreview(result: LinkPreviewResponse) {
    setName((currentName) => {
      if (!result.name) {
        return currentName;
      }

      if (
        !shouldApplyPreviewField(
          "name",
          currentName,
          autoFillTouchedFieldsRef.current,
          autoFilledValuesRef.current,
        )
      ) {
        return currentName;
      }

      autoFilledValuesRef.current = {
        ...autoFilledValuesRef.current,
        name: result.name,
      };
      return result.name;
    });

    setImageUrl((currentImageUrl) => {
      if (!result.imageUrl) {
        return currentImageUrl;
      }

      if (
        !shouldApplyPreviewField(
          "imageUrl",
          currentImageUrl,
          autoFillTouchedFieldsRef.current,
          autoFilledValuesRef.current,
        )
      ) {
        return currentImageUrl;
      }

      autoFilledValuesRef.current = {
        ...autoFilledValuesRef.current,
        imageUrl: result.imageUrl,
      };
      return result.imageUrl;
    });

    setPrice((currentPrice) => {
      if (!result.price) {
        return currentPrice;
      }

      if (
        !shouldApplyPreviewField(
          "price",
          currentPrice,
          autoFillTouchedFieldsRef.current,
          autoFilledValuesRef.current,
        )
      ) {
        return currentPrice;
      }

      autoFilledValuesRef.current = {
        ...autoFilledValuesRef.current,
        price: result.price,
      };
      return result.price;
    });
  }

  useEffect(() => {
    const value = purchaseUrl.trim();
    const previewUrl = parseHttpUrl(value);

    if (!isItemDrawerOpen || !purchaseUrlEditedRef.current || !previewUrl) {
      setLinkPreview({ isLoading: false, error: null });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLinkPreview({ isLoading: true, error: null });

      try {
        const response = await fetch("/api/link-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: previewUrl }),
          signal: controller.signal,
        });
        const result = (await response.json()) as LinkPreviewResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Nao foi possivel analisar este link.");
        }

        applyLinkPreview(result);
        setLinkPreview({
          isLoading: false,
          error:
            result.name || result.imageUrl || result.price
              ? null
              : "Nao encontrei dados para preencher.",
        });
      } catch (previewError) {
        if (previewError instanceof DOMException && previewError.name === "AbortError") {
          return;
        }

        setLinkPreview({
          isLoading: false,
          error:
            previewError instanceof Error
              ? previewError.message
              : "Nao foi possivel analisar este link.",
        });
      }
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isItemDrawerOpen, purchaseUrl]);

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
    if (isSubmitting) {
      return;
    }
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
    if (pendingItemAction === pendingKey) {
      return;
    }
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
    if (pendingItemAction === pendingKey) {
      return;
    }
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
              <Tabs<ListFilter>
                value={listFilter}
                onChange={setListFilter}
                items={[
                  { id: "ativos", label: "Ativos", count: activeItems.length, icon: <ShoppingCart aria-hidden="true" className="h-5 w-5" /> },
                  { id: "arquivados", label: "Arquivados", count: archivedItems.length, icon: <Archive aria-hidden="true" className="h-5 w-5" /> },
                  { id: "todos", label: "Todos", count: items.length, icon: <Layers3 aria-hidden="true" className="h-5 w-5" /> },
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
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1b2235] px-3 text-sm font-medium text-white transition hover:bg-[#141b2d]"
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
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#bb334b] px-3 text-sm font-medium text-white transition hover:bg-[#a32840]"
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
        secondaryAction={{
          label: "Cancelar",
          onClick: () => {
            setIsItemDrawerOpen(false);
            resetForm();
          },
        }}
        primaryAction={{
          label: editingItemId ? "Salvar alteracoes" : "Adicionar item",
          onClick: () => {
            if (isSubmitting) {
              return;
            }
            (document.getElementById("admin-wishlist-item-form") as HTMLFormElement | null)?.requestSubmit();
          },
        }}
      >
        <form id="admin-wishlist-item-form" onSubmit={handleSubmit} className="space-y-6">
          <DrawerSection title="Propriedades">
            <DrawerFieldRow label={propertyLabel(<Edit3 aria-hidden="true" className="h-4 w-4" />, "Nome")} divider={false}>
              <input
                value={name}
                onChange={(event) => {
                  markAutoFillFieldTouched("name");
                  setName(event.target.value);
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba]"
                maxLength={120}
                required
              />
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<ExternalLink aria-hidden="true" className="h-4 w-4" />, "Link de compra")} divider={false}>
              <EditableLinkButtonField
                value={purchaseUrl}
                onChange={handlePurchaseUrlChange}
                placeholder="https://..."
                required
              />
              {linkPreview.isLoading || linkPreview.error ? (
                <p
                  className={`mt-1.5 text-xs ${
                    linkPreview.error ? "text-[#9a6b22]" : "text-[#68738a]"
                  }`}
                >
                  {linkPreview.isLoading ? "Buscando nome, imagem e preco..." : linkPreview.error}
                </p>
              ) : null}
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<ImageIcon aria-hidden="true" className="h-4 w-4" />, "Imagem do item")} divider={false}>
              <EditableLinkButtonField
                value={imageUrl}
                onChange={(value) => {
                  markAutoFillFieldTouched("imageUrl");
                  setImageUrl(value);
                }}
                placeholder="https://..."
              />
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<ShoppingCart aria-hidden="true" className="h-4 w-4" />, "Preco")} divider={false}>
              <input
                value={price}
                onChange={(event) => {
                  markAutoFillFieldTouched("price");
                  setPrice(event.target.value);
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba]"
                inputMode="decimal"
                placeholder="149,90"
                required
              />
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<Shirt aria-hidden="true" className="h-4 w-4" />, "Categoria")} divider={false}>
              <input
                list="wishlist-categories"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba]"
                maxLength={60}
                required
              />
              <datalist id="wishlist-categories">
                {categories.map((itemCategory) => (
                  <option key={itemCategory} value={itemCategory} />
                ))}
              </datalist>
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<Flag aria-hidden="true" className="h-4 w-4" />, "Prioridade")} divider={false}>
              <div className="flex flex-wrap gap-2">
                {priorities.map((itemPriority) => {
                  const active = priority === itemPriority;

                  return (
                    <Chip
                      key={itemPriority}
                      behavior="selectable"
                      selected={active}
                      onClick={() => setPriority(itemPriority)}
                      label={priorityLabels[itemPriority]}
                      type={active ? "info" : "tertiary"}
                      surface="neutral"
                      showIconLeft
                      iconLeft={<Flag aria-hidden="true" className="h-3.5 w-3.5" />}
                    />
                  );
                })}
              </div>
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(<RotateCcw aria-hidden="true" className="h-4 w-4" />, "Compra recorrente")} divider={false}>
              <input
                type="checkbox"
                checked={repurchaseState === "precisa_recompra" || repurchaseState === "ainda_tem"}
                onChange={(event) => setRepurchaseState(event.target.checked ? "precisa_recompra" : "nao_recompra")}
                className="h-4 w-4 rounded border-[#b9c4d7] accent-[#3555d2]"
              />
            </DrawerFieldRow>
          </DrawerSection>

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
        </form>
      </Drawer>
    </main>
  );
}
