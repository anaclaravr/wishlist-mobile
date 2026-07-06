/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowDownUp,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Filter,
  Heart,
  Home,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  ItemRepurchaseState,
  PersonalItem,
  PersonalItemVisibility,
  WishlistData,
  WishlistItem,
  WishlistItemPriority,
} from "@/lib/db";
import { formatPrice, isRecent } from "@/lib/format";
import { WishlistSidebar } from "@/components/wishlist-sidebar";
import {
  CommonButton,
  IconButton,
  Toolbar,
  ToolbarDivider,
  ToolbarItem,
} from "@/components/ui/button-system";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Breadcrumb } from "@/components/ui/breadcrumb";

type FollowerState = {
  id: string;
  email: string | null;
  followToken: string;
};

type FollowResponse = {
  follower?: FollowerState;
  error?: string;
};

type ItemResponse = {
  item?: WishlistItem;
  error?: string;
};

type FavoritesResponse = {
  favorites?: string[];
  error?: string;
};

type PersonalItemsResponse = {
  items?: PersonalItem[];
  error?: string;
};

type PersonalItemResponse = {
  item?: PersonalItem;
  ok?: boolean;
  error?: string;
};

type LinkPreviewResponse = {
  name?: string;
  imageUrl?: string;
  price?: string;
  error?: string;
};

type AvailabilityFilter = "todos" | "disponiveis" | "adquiridos";
type SortMode = "recentes" | "prioridade" | "preco-menor" | "preco-maior";
type PublicTab = "todos" | "favoritos" | "meus-itens";

type PersonalFormState = {
  name: string;
  purchaseUrl: string;
  imageUrl: string;
  price: string;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
};

type FollowPreferencesDraft = {
  followEnabled: boolean;
  personalItemsEnabled: boolean;
  acquireEnabled: boolean;
  emailUpdatesEnabled: boolean;
  email: string;
};

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

const priorityWeight: Record<WishlistItemPriority, number> = {
  baixa: 1,
  media: 2,
  alta: 3,
};

const defaultPersonalForm: PersonalFormState = {
  name: "",
  purchaseUrl: "",
  imageUrl: "",
  price: "",
  category: "Geral",
  priority: "media",
  repurchaseState: "nao_recompra",
  visibility: "private",
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

function formatPriceInput(priceCents: number) {
  return (priceCents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getPriorityMeta(priority: WishlistItemPriority) {
  if (priority === "alta") {
    return {
      label: "Alta",
    };
  }

  if (priority === "media") {
    return {
      label: "Media",
    };
  }

  return {
    label: "Baixa",
  };
}

function getRepurchaseMeta(repurchaseState: ItemRepurchaseState) {
  if (repurchaseState === "precisa_recompra") {
    return { label: repurchaseLabels.precisa_recompra };
  }

  if (repurchaseState === "ainda_tem") {
    return { label: repurchaseLabels.ainda_tem };
  }

  return { label: repurchaseLabels.nao_recompra };
}

function isSameFollower(item: WishlistItem, follower: FollowerState | null) {
  if (!follower) {
    return false;
  }

  return item.acquiredByFollowerId === follower.id;
}

function PreferenceToggle({
  checked,
  disabled,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
        checked ? "border-[#4f67e6] bg-[#4f67e6]" : "border-[#d5dcea] bg-[#eceff5]"
      } disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function WishlistPublicView({
  data,
  canonicalPath = `/w/${data.wishlist.slug}`,
}: {
  data: WishlistData;
  canonicalPath?: string;
}) {
  const [items, setItems] = useState(data.items);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<PublicTab>("todos");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedPriority, setSelectedPriority] = useState<"todas" | WishlistItemPriority>(
    "todas",
  );
  const [availability, setAvailability] = useState<AvailabilityFilter>("todos");
  const [sortMode, setSortMode] = useState<SortMode>("recentes");
  const [draftSelectedCategory, setDraftSelectedCategory] = useState("Todos");
  const [draftSelectedPriority, setDraftSelectedPriority] = useState<
    "todas" | WishlistItemPriority
  >("todas");
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>("todos");
  const [draftSortMode, setDraftSortMode] = useState<SortMode>("recentes");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [follower, setFollower] = useState<FollowerState | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [isLoadingFollowerData, setIsLoadingFollowerData] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isEmailPopoverOpen, setIsEmailPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const [isApplyingFollowPrefs, setIsApplyingFollowPrefs] = useState(false);
  const [allowPersonalItemsFeature, setAllowPersonalItemsFeature] = useState(true);
  const [allowAcquireActions, setAllowAcquireActions] = useState(true);
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState(false);
  const [followPrefsDraft, setFollowPrefsDraft] = useState<FollowPreferencesDraft>({
    followEnabled: false,
    personalItemsEnabled: true,
    acquireEnabled: true,
    emailUpdatesEnabled: false,
    email: "",
  });
  const [isPersonalSubmitting, setIsPersonalSubmitting] = useState(false);
  const [editingPersonalItemId, setEditingPersonalItemId] = useState<string | null>(null);
  const [personalForm, setPersonalForm] = useState(defaultPersonalForm);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const emailPopoverRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const storageKey = `wishlist:${data.wishlist.slug}:followToken`;
  const preferencesStorageKey = `wishlist:${data.wishlist.slug}:followPrefs`;
  const hasActiveFilters =
    selectedCategory !== "Todos" ||
    selectedPriority !== "todas" ||
    availability !== "todos";
  const hasActiveSort = sortMode !== "recentes";
  const hasPendingFilterChanges =
    draftSelectedCategory !== selectedCategory ||
    draftSelectedPriority !== selectedPriority ||
    draftAvailability !== availability ||
    draftSortMode !== sortMode;

  const filterPoolItems = activeTab === "meus-itens" ? personalItems : items;
  const categories = useMemo(
    () =>
      ["Todos", ...Array.from(new Set(filterPoolItems.map((item) => item.category))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      )],
    [filterPoolItems],
  );

  useEffect(() => {
    if (categories.includes(selectedCategory)) {
      return;
    }

    setSelectedCategory("Todos");
    setDraftSelectedCategory("Todos");
  }, [categories, selectedCategory]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(preferencesStorageKey);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<{
        allowPersonalItemsFeature: boolean;
        allowAcquireActions: boolean;
        emailUpdatesEnabled: boolean;
      }>;

      if (typeof parsed.allowPersonalItemsFeature === "boolean") {
        setAllowPersonalItemsFeature(parsed.allowPersonalItemsFeature);
      }

      if (typeof parsed.allowAcquireActions === "boolean") {
        setAllowAcquireActions(parsed.allowAcquireActions);
      }

      if (typeof parsed.emailUpdatesEnabled === "boolean") {
        setEmailUpdatesEnabled(parsed.emailUpdatesEnabled);
      }
    } catch {
      // ignore invalid local preference payload
    }
  }, [preferencesStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(
      preferencesStorageKey,
      JSON.stringify({
        allowPersonalItemsFeature,
        allowAcquireActions,
        emailUpdatesEnabled,
      }),
    );
  }, [allowAcquireActions, allowPersonalItemsFeature, emailUpdatesEnabled, preferencesStorageKey]);

  useEffect(() => {
    if (activeTab === "meus-itens" && !allowPersonalItemsFeature) {
      setActiveTab("todos");
    }
  }, [activeTab, allowPersonalItemsFeature]);

  const visibleOfficialItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items
      .filter((item) => {
        const matchesCategory =
          selectedCategory === "Todos" || item.category === selectedCategory;
        const matchesPriority = selectedPriority === "todas" || item.priority === selectedPriority;
        const matchesAvailability =
          availability === "todos" ||
          (availability === "disponiveis" && !item.acquiredAt) ||
          (availability === "adquiridos" && Boolean(item.acquiredAt));
        const matchesQuery =
          !normalizedQuery ||
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          getSourceLabel(item.purchaseUrl).toLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesPriority && matchesAvailability && matchesQuery;
      })
      .sort((left, right) => {
        if (sortMode === "prioridade") {
          return priorityWeight[right.priority] - priorityWeight[left.priority];
        }

        if (sortMode === "preco-menor") {
          return left.priceCents - right.priceCents;
        }

        if (sortMode === "preco-maior") {
          return right.priceCents - left.priceCents;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [availability, items, query, selectedCategory, selectedPriority, sortMode]);

  const visiblePersonalItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return personalItems
      .filter((item) => {
        const matchesCategory =
          selectedCategory === "Todos" || item.category === selectedCategory;
        const matchesPriority = selectedPriority === "todas" || item.priority === selectedPriority;
        const matchesQuery =
          !normalizedQuery ||
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          getSourceLabel(item.purchaseUrl).toLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesPriority && matchesQuery;
      })
      .sort((left, right) => {
        if (sortMode === "prioridade") {
          return priorityWeight[right.priority] - priorityWeight[left.priority];
        }

        if (sortMode === "preco-menor") {
          return left.priceCents - right.priceCents;
        }

        if (sortMode === "preco-maior") {
          return right.priceCents - left.priceCents;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [personalItems, query, selectedCategory, selectedPriority, sortMode]);

  const favoriteItems = useMemo(
    () => visibleOfficialItems.filter((item) => favoriteItemIds.has(item.id)),
    [favoriteItemIds, visibleOfficialItems],
  );

  const visibleItemsCount = useMemo(() => {
    if (activeTab === "meus-itens") {
      return visiblePersonalItems.length;
    }

    if (activeTab === "favoritos") {
      return favoriteItems.length;
    }

    return visibleOfficialItems.length;
  }, [activeTab, favoriteItems.length, visibleOfficialItems.length, visiblePersonalItems.length]);

  useEffect(() => {
    async function hydrateFollower() {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get("follow");
      const savedToken = tokenFromUrl || window.localStorage.getItem(storageKey);

      if (!savedToken) {
        return;
      }

      try {
        const response = await fetch(
          `/api/follow/status?slug=${encodeURIComponent(data.wishlist.slug)}&token=${encodeURIComponent(
            savedToken,
          )}`,
        );
        const result = (await response.json()) as FollowResponse;

        if (!response.ok || !result.follower) {
          window.localStorage.removeItem(storageKey);
          return;
        }

        window.localStorage.setItem(storageKey, result.follower.followToken);
        setFollower(result.follower);
        setEmailDraft(result.follower.email ?? "");

        if (tokenFromUrl) {
          window.history.replaceState(null, "", canonicalPath);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    hydrateFollower();
  }, [canonicalPath, data.wishlist.slug, storageKey]);

  useEffect(() => {
    if (!follower) {
      setFavoriteItemIds(new Set());
      setPersonalItems([]);
      return;
    }

    const followerToken = follower.followToken;
    let cancelled = false;

    async function loadFollowerData() {
      setIsLoadingFollowerData(true);

      try {
        const [favoritesResponse, personalItemsResponse] = await Promise.all([
          fetch(
            `/api/items/favorites?slug=${encodeURIComponent(
              data.wishlist.slug,
            )}&token=${encodeURIComponent(followerToken)}`,
          ),
          fetch(
            `/api/personal-items?slug=${encodeURIComponent(data.wishlist.slug)}&token=${encodeURIComponent(followerToken)}`,
          ),
        ]);

        const favoritesResult = (await favoritesResponse.json()) as FavoritesResponse;
        const personalItemsResult = (await personalItemsResponse.json()) as PersonalItemsResponse;

        if (cancelled) {
          return;
        }

        if (!favoritesResponse.ok) {
          throw new Error(favoritesResult.error ?? "Nao foi possivel carregar favoritos.");
        }

        if (!personalItemsResponse.ok) {
          throw new Error(personalItemsResult.error ?? "Nao foi possivel carregar seus itens.");
        }

        setFavoriteItemIds(new Set(favoritesResult.favorites ?? []));
        setPersonalItems(personalItemsResult.items ?? []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
      } finally {
        if (!cancelled) {
          setIsLoadingFollowerData(false);
        }
      }
    }

    loadFollowerData();

    return () => {
      cancelled = true;
    };
  }, [data.wishlist.slug, follower]);

  useEffect(() => {
    if (!isFilterPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterPopoverRef.current) {
        return;
      }

      if (filterPopoverRef.current.contains(event.target as Node)) {
        return;
      }

      setDraftSelectedCategory(selectedCategory);
      setDraftSelectedPriority(selectedPriority);
      setDraftAvailability(availability);
      setDraftSortMode(sortMode);
      setIsFilterPopoverOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [
    availability,
    isFilterPopoverOpen,
    selectedCategory,
    selectedPriority,
    sortMode,
  ]);

  useEffect(() => {
    if (!isEmailPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!emailPopoverRef.current) {
        return;
      }

      if (emailPopoverRef.current.contains(event.target as Node)) {
        return;
      }

      setIsEmailPopoverOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEmailPopoverOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isEmailPopoverOpen]);

  useEffect(() => {
    if (!isSortPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!sortPopoverRef.current) {
        return;
      }

      if (sortPopoverRef.current.contains(event.target as Node)) {
        return;
      }

      setIsSortPopoverOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSortPopoverOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSortPopoverOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  function syncDraftWithAppliedFilters() {
    setDraftSelectedCategory(selectedCategory);
    setDraftSelectedPriority(selectedPriority);
    setDraftAvailability(availability);
    setDraftSortMode(sortMode);
  }

  function openFilterPopover() {
    syncDraftWithAppliedFilters();
    setIsEmailPopoverOpen(false);
    setIsSortPopoverOpen(false);
    setIsFilterPopoverOpen(true);
  }

  function closeFilterPopover() {
    syncDraftWithAppliedFilters();
    setIsFilterPopoverOpen(false);
  }

  function applyDraftFilters() {
    setSelectedCategory(draftSelectedCategory);
    setSelectedPriority(draftSelectedPriority);
    setAvailability(draftAvailability);
    setSortMode(draftSortMode);
    setIsFilterPopoverOpen(false);
  }

  function resetDraftFilters() {
    setDraftSelectedCategory("Todos");
    setDraftSelectedPriority("todas");
    setDraftAvailability("todos");
    setDraftSortMode("recentes");
  }

  function resetPersonalForm() {
    setPersonalForm(defaultPersonalForm);
    setEditingPersonalItemId(null);
  }

  function openPersonalItemComposer() {
    resetPersonalForm();
    setActiveTab("meus-itens");
    setIsFilterPopoverOpen(false);
    setIsEmailPopoverOpen(false);
    setIsSortPopoverOpen(false);
  }

  function handlePersonalFormField<K extends keyof PersonalFormState>(
    field: K,
    value: PersonalFormState[K],
  ) {
    setPersonalForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function handleFollow() {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
        }),
      });
      const result = (await response.json()) as FollowResponse;

      if (!response.ok || !result.follower) {
        throw new Error(result.error ?? "Nao foi possivel acompanhar o workspace.");
      }

      window.localStorage.setItem(storageKey, result.follower.followToken);
      setFollower(result.follower);
      setEmailDraft(result.follower.email ?? "");
      setMessage("Acompanhamento ativo. E-mail continua opcional.");
      return result.follower;
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Erro inesperado.");
      return null;
    }
  }

  function openAdminFromSidebar() {
    const token = window.prompt("Cole seu token admin para abrir o painel:");

    if (!token?.trim()) {
      return;
    }

    window.location.href = `/admin/${encodeURIComponent(token.trim())}`;
  }

  async function saveFollowerEmail(nextEmail: string, options: { silentSuccess?: boolean } = {}) {
    if (!follower) {
      setError("Ative o acompanhamento antes de salvar e-mail.");
      return null;
    }

    const emailToSave = nextEmail.trim();
    setError(null);
    if (!options.silentSuccess) {
      setMessage(null);
    }

    try {
      const response = await fetch("/api/follow/email", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
          followToken: follower.followToken,
          email: emailToSave,
        }),
      });
      const result = (await response.json()) as FollowResponse;

      if (!response.ok || !result.follower) {
        throw new Error(result.error ?? "Nao foi possivel salvar o e-mail.");
      }

      setFollower(result.follower);
      setEmailDraft(result.follower.email ?? "");
      if (!options.silentSuccess) {
        setMessage("E-mail atualizado para receber novos itens.");
      }
      return result.follower;
    } catch (saveEmailError) {
      setError(saveEmailError instanceof Error ? saveEmailError.message : "Erro inesperado.");
      return null;
    }
  }

  function openFollowPreferencesPopover() {
    if (isEmailPopoverOpen) {
      setIsEmailPopoverOpen(false);
      return;
    }

    setIsFilterPopoverOpen(false);
    setIsSortPopoverOpen(false);
    setFollowPrefsDraft({
      followEnabled: true,
      personalItemsEnabled: allowPersonalItemsFeature,
      acquireEnabled: allowAcquireActions,
      emailUpdatesEnabled: emailUpdatesEnabled || Boolean(follower?.email),
      email: follower?.email ?? emailDraft,
    });
    setIsEmailPopoverOpen(true);
  }

  function openSortPopover() {
    if (isSortPopoverOpen) {
      setIsSortPopoverOpen(false);
      return;
    }

    setIsFilterPopoverOpen(false);
    setIsEmailPopoverOpen(false);
    setIsSortPopoverOpen(true);
  }

  async function applyFollowPreferences() {
    setIsApplyingFollowPrefs(true);
    setError(null);
    setMessage(null);

    try {
      let ensuredFollower = follower;

      if (followPrefsDraft.followEnabled && !ensuredFollower) {
        ensuredFollower = await handleFollow();

        if (!ensuredFollower) {
          return;
        }
      }

      setAllowPersonalItemsFeature(followPrefsDraft.personalItemsEnabled);
      setAllowAcquireActions(followPrefsDraft.acquireEnabled);
      setEmailUpdatesEnabled(followPrefsDraft.emailUpdatesEnabled);

      if (followPrefsDraft.emailUpdatesEnabled && ensuredFollower) {
        const nextEmail = followPrefsDraft.email.trim();

        if (!nextEmail) {
          throw new Error("Informe um e-mail para receber atualizacoes.");
        }

        const updatedFollower = await saveFollowerEmail(nextEmail, { silentSuccess: true });

        if (!updatedFollower) {
          return;
        }
      }

      setIsEmailPopoverOpen(false);
      setMessage("Preferencias de acompanhamento atualizadas.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Erro inesperado.");
    } finally {
      setIsApplyingFollowPrefs(false);
    }
  }

  async function updateItemAcquisition(item: WishlistItem, action: "acquire" | "undo") {
    if (!allowAcquireActions) {
      setError('Habilite "Marcar como adquirido" nas preferencias da toolbar.');
      return;
    }

    if (!follower) {
      setError("Acompanhe o workspace para marcar ou desfazer um item.");
      return;
    }

    const pendingKey = `${action}:${item.id}`;
    setPendingAction(pendingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/items/${item.id}/acquire`, {
        method: action === "acquire" ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followToken: follower.followToken,
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
      setMessage(action === "acquire" ? "Item marcado como adquirido." : "Marcacao desfeita.");
    } catch (acquireError) {
      setError(acquireError instanceof Error ? acquireError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleFavorite(item: WishlistItem) {
    if (!follower) {
      setError("Acompanhe o workspace para favoritar itens.");
      return;
    }

    const isFavorite = favoriteItemIds.has(item.id);
    const pendingKey = `favorite:${item.id}`;
    setPendingAction(pendingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/items/${item.id}/favorite`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
          followToken: follower.followToken,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel atualizar favorito.");
      }

      setFavoriteItemIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (isFavorite) {
          nextIds.delete(item.id);
        } else {
          nextIds.add(item.id);
        }

        return nextIds;
      });
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmitPersonalItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!follower) {
      setError("Acompanhe o workspace para criar seus itens.");
      return;
    }

    setIsPersonalSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        editingPersonalItemId ? `/api/personal-items/${editingPersonalItemId}` : "/api/personal-items",
        {
          method: editingPersonalItemId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: data.wishlist.slug,
            followToken: follower.followToken,
            name: personalForm.name,
            purchaseUrl: personalForm.purchaseUrl,
            imageUrl: personalForm.imageUrl,
            price: personalForm.price,
              category: personalForm.category,
              priority: personalForm.priority,
              repurchaseState: personalForm.repurchaseState,
              visibility: personalForm.visibility,
            }),
        },
      );
      const result = (await response.json()) as PersonalItemResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel salvar seu item.");
      }

      if (editingPersonalItemId) {
        setPersonalItems((currentItems) =>
          currentItems.map((item) => (item.id === result.item?.id ? result.item : item)),
        );
        setMessage("Item pessoal atualizado.");
      } else {
        setPersonalItems((currentItems) => [result.item as PersonalItem, ...currentItems]);
        setMessage("Item pessoal adicionado.");
      }

      resetPersonalForm();
    } catch (personalSubmitError) {
      setError(personalSubmitError instanceof Error ? personalSubmitError.message : "Erro inesperado.");
    } finally {
      setIsPersonalSubmitting(false);
    }
  }

  async function deletePersonalItem(item: PersonalItem) {
    if (!follower) {
      setError("Acompanhamento nao encontrado.");
      return;
    }

    if (!window.confirm(`Excluir "${item.name}" dos seus itens?`)) {
      return;
    }

    const pendingKey = `personal-delete:${item.id}`;
    setPendingAction(pendingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/personal-items/${item.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
          followToken: follower.followToken,
        }),
      });
      const result = (await response.json()) as PersonalItemResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel excluir seu item.");
      }

      setPersonalItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
      setMessage("Item pessoal removido.");

      if (editingPersonalItemId === item.id) {
        resetPersonalForm();
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  function startEditingPersonalItem(item: PersonalItem) {
    setEditingPersonalItemId(item.id);
    setPersonalForm({
      name: item.name,
      purchaseUrl: item.purchaseUrl,
      imageUrl: item.imageUrl ?? "",
      price: formatPriceInput(item.priceCents),
      category: item.category,
      priority: item.priority,
      repurchaseState: item.repurchaseState,
      visibility: item.visibility,
    });
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function fillPersonalItemFromLink() {
    const value = personalForm.purchaseUrl.trim();

    if (!value) {
      setError("Cole um link antes de usar o preenchimento automatico.");
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: value }),
      });
      const result = (await response.json()) as LinkPreviewResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel analisar este link.");
      }

      const hasData = Boolean(result.name || result.imageUrl || result.price);

      setPersonalForm((currentForm) => ({
        ...currentForm,
        name: result.name ?? currentForm.name,
        imageUrl: result.imageUrl ?? currentForm.imageUrl,
        price: result.price ?? currentForm.price,
      }));

      setMessage(
        hasData
          ? "Preenchimento automatico aplicado. Revise antes de salvar."
          : "Sem metadados suficientes. Continue com preenchimento manual.",
      );
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Erro inesperado.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function renderOfficialCard(item: WishlistItem) {
    const pendingAcquire = pendingAction === `acquire:${item.id}`;
    const pendingUndo = pendingAction === `undo:${item.id}`;
    const pendingFavorite = pendingAction === `favorite:${item.id}`;
    const acquiredByCurrentFollower = isSameFollower(item, follower);
    const isUnavailable = Boolean(item.acquiredAt && !acquiredByCurrentFollower);
    const isRecentItem = isRecent(item.createdAt);
    const isFavorite = favoriteItemIds.has(item.id);
    const priorityMeta = getPriorityMeta(item.priority);
    const repurchaseMeta = getRepurchaseMeta(item.repurchaseState);

    return (
      <article
        key={item.id}
        className="overflow-hidden rounded-[26px] border border-[#e8edf5] bg-white p-3 shadow-[0_14px_30px_rgba(30,39,57,0.1)]"
      >
        <div className="relative overflow-hidden rounded-[20px] bg-[#edf1f8]">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="aspect-[16/11] w-full object-cover" />
          ) : (
            <div className="flex aspect-[16/11] items-center justify-center text-[#606981]">
              <ShoppingCart aria-hidden="true" className="h-8 w-8" />
            </div>
          )}
          {isRecentItem ? (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#222a3a] shadow-sm">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Recente
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => toggleFavorite(item)}
            disabled={pendingFavorite}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#4f5870] shadow-sm transition hover:text-[#d23d61] disabled:opacity-60"
            aria-label={isFavorite ? "Desfavoritar item" : "Favoritar item"}
            title={isFavorite ? "Desfavoritar item" : "Favoritar item"}
          >
            {pendingFavorite ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Heart
                aria-hidden="true"
                className={`h-4 w-4 ${isFavorite ? "fill-current text-[#d23d61]" : ""}`}
              />
            )}
          </button>
        </div>

        <div className="space-y-3 px-2 pb-2 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[1rem] font-semibold leading-tight text-[#121723]">
                {item.name}
              </h3>
              <p className="mt-1 truncate text-xs text-[#6c7489]">{getSourceLabel(item.purchaseUrl)}</p>
            </div>
            <p className="shrink-0 text-right text-[1.02rem] font-semibold leading-none text-[#101623]">
              {formatPrice(item.priceCents, item.currency)}
            </p>
          </div>

          <div className="pt-2">
            <div className="mx-auto grid w-full max-w-[420px] grid-cols-[0.95fr_1.15fr_1.1fr] divide-x divide-[#dbe1ed]">
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <Flag aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0">Prioridade</span>
                </p>
                <p className="mt-1 text-xs font-medium text-[#323a4d]">{priorityMeta.label}</p>
              </div>
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <ShoppingCart aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0">Disponibilidade</span>
                </p>
                <p className="mt-1 truncate text-xs font-medium text-[#323a4d]">
                  {item.acquiredAt ? "Adquirido" : "Nao adquirido"}
                </p>
              </div>
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <CalendarDays aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 whitespace-nowrap">Adicionado em</span>
                </p>
                <p className="mt-1 whitespace-nowrap text-xs font-medium text-[#323a4d]">
                  {formatCreatedLabel(item.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <p className="inline-flex items-center gap-1 text-[11px] text-[#5e667c]">
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {repurchaseMeta.label}
          </p>

          {item.acquiredAt && item.acquiredByEmail ? (
            <p className="truncate text-[11px] text-[#6f7890]">Marcado por {item.acquiredByEmail}</p>
          ) : null}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#d4dbea] bg-white px-3 text-sm font-medium text-[#1c2538] shadow-[var(--ds-shadow-soft)] transition hover:bg-[#f8faff]"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Comprar
            </a>
            <IconButton
              type="button"
              onClick={() => updateItemAcquisition(item, acquiredByCurrentFollower ? "undo" : "acquire")}
              disabled={!allowAcquireActions || isUnavailable || pendingAcquire || pendingUndo}
              className="h-10 w-10 rounded-[10px]"
              variant={item.acquiredAt ? "info" : "secondary"}
              selected={Boolean(item.acquiredAt)}
              aria-label={
                !allowAcquireActions
                  ? "Marcacao desativada nas preferencias"
                  : isUnavailable
                  ? "Item ja adquirido por outra pessoa"
                  : acquiredByCurrentFollower
                    ? "Desfazer item adquirido"
                    : "Marcar item adquirido"
              }
              title={
                !allowAcquireActions
                  ? "Marcacao desativada nas preferencias"
                  : isUnavailable
                  ? "Item ja adquirido por outra pessoa"
                  : acquiredByCurrentFollower
                    ? "Desfazer item adquirido"
                    : "Marcar item adquirido"
              }
            >
              {pendingAcquire || pendingUndo ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <ShoppingCart
                  aria-hidden="true"
                  className={`h-5 w-5 ${item.acquiredAt ? "fill-current" : ""}`}
                />
              )}
            </IconButton>
          </div>
        </div>
      </article>
    );
  }

  function renderPersonalItemCard(item: PersonalItem) {
    const pendingDelete = pendingAction === `personal-delete:${item.id}`;
    const isRecentItem = isRecent(item.createdAt);
    const priorityMeta = getPriorityMeta(item.priority);
    const repurchaseMeta = getRepurchaseMeta(item.repurchaseState);

    return (
      <article
        key={item.id}
        className="overflow-hidden rounded-[26px] border border-[#e8edf5] bg-white p-3 shadow-[0_14px_30px_rgba(30,39,57,0.1)]"
      >
        <div className="relative overflow-hidden rounded-[20px] bg-[#edf1f8]">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="aspect-[16/11] w-full object-cover" />
          ) : (
            <div className="flex aspect-[16/11] items-center justify-center text-[#606981]">
              <ImageIcon aria-hidden="true" className="h-8 w-8" />
            </div>
          )}
          {isRecentItem ? (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#222a3a] shadow-sm">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Recente
            </div>
          ) : null}
          <span className="absolute right-3 top-3 inline-flex h-8 items-center gap-1 rounded-full bg-white/95 px-2 text-[11px] font-semibold text-[#2e374c] shadow-sm">
            {item.visibility === "public" ? (
              <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <EyeOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            )}
            {item.visibility === "public" ? "Publico" : "Privado"}
          </span>
        </div>

        <div className="space-y-3 px-2 pb-2 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[1rem] font-semibold leading-tight text-[#121723]">
                {item.name}
              </h3>
              <p className="mt-1 truncate text-xs text-[#6c7489]">{getSourceLabel(item.purchaseUrl)}</p>
            </div>
            <p className="shrink-0 text-right text-[1.02rem] font-semibold leading-none text-[#101623]">
              {formatPrice(item.priceCents, item.currency)}
            </p>
          </div>

          <div className="pt-2">
            <div className="mx-auto grid w-full max-w-[420px] grid-cols-[0.95fr_1.15fr_1.1fr] divide-x divide-[#dbe1ed]">
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <Flag aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0">Prioridade</span>
                </p>
                <p className="mt-1 text-xs font-medium text-[#323a4d]">{priorityMeta.label}</p>
              </div>
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <Eye aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0">Visibilidade</span>
                </p>
                <p className="mt-1 truncate text-xs font-medium text-[#323a4d]">
                  {item.visibility === "public" ? "Publico" : "Privado"}
                </p>
              </div>
              <div className="min-w-0 px-3 text-left">
                <p className="flex items-center gap-1 text-[8px] font-normal uppercase leading-[1] tracking-[0em] text-[#8a93a8]">
                  <CalendarDays aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 whitespace-nowrap">Adicionado em</span>
                </p>
                <p className="mt-1 whitespace-nowrap text-xs font-medium text-[#323a4d]">
                  {formatCreatedLabel(item.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <p className="inline-flex items-center gap-1 text-[11px] text-[#5e667c]">
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {repurchaseMeta.label}
          </p>

          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#d4dbea] bg-white px-3 text-sm font-medium text-[#1c2538] shadow-[var(--ds-shadow-soft)] transition hover:bg-[#f8faff]"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Abrir
            </a>
            <IconButton
              type="button"
              onClick={() => startEditingPersonalItem(item)}
              className="h-10 w-10 rounded-[10px]"
              variant="secondary"
              aria-label="Editar item pessoal"
              title="Editar item pessoal"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <IconButton
              type="button"
              onClick={() => deletePersonalItem(item)}
              disabled={pendingDelete}
              className="h-10 w-10 rounded-[10px]"
              variant="destructive"
              selected
              aria-label="Excluir item pessoal"
              title="Excluir item pessoal"
            >
              {pendingDelete ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              )}
            </IconButton>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="ds-app-shell min-h-screen">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[272px_1fr]"
        }`}
      >
        <WishlistSidebar
          title={data.wishlist.ownerName || "Perfil do workspace"}
          subtitle={data.wishlist.ownerEmail || "Sem e-mail configurado"}
          avatarUrl={data.wishlist.ownerAvatarUrl}
          wishlistHref={canonicalPath}
          onAdminClick={openAdminFromSidebar}
          activePage="wishlist"
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <section className="ds-app-panel">
          <header className="border-b border-[#dee4ef] px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Breadcrumb
                  items={[
                    { label: "Home", href: "/", icon: <Home aria-hidden="true" /> },
                    { label: "Lista publica", icon: <ShoppingCart aria-hidden="true" /> },
                  ]}
                />
                <h2 className="mt-1 text-3xl font-semibold text-[#141a27]">Todos os presentes</h2>
              </div>

              <Toolbar className="shrink-0">
                <ToolbarItem>
	                  <IconButton
	                    type="button"
	                    onClick={openPersonalItemComposer}
	                    disabled={!allowPersonalItemsFeature}
	                    variant="info"
	                    aria-label="Adicionar item pessoal"
	                    title={
	                      allowPersonalItemsFeature
	                        ? "Adicionar item pessoal"
	                        : "Itens pessoais desativados"
	                    }
	                  >
                    <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
                  </IconButton>
                </ToolbarItem>

                <ToolbarItem
                  className={`h-10 overflow-hidden rounded-[10px] border transition-[width,border-color,background-color] duration-300 ${
                    isSearchOpen
                      ? "w-[min(20rem,calc(100vw-7rem))] border-[#d6ddeb] bg-white"
                      : "w-10 border-transparent bg-transparent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen((currentState) => !currentState)}
                    className="ds-focus inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[#4a5570] transition hover:bg-[#f2f5fb] hover:text-[#1c2538] focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2"
                    aria-label={isSearchOpen ? "Ocultar busca" : "Abrir busca"}
                    title={isSearchOpen ? "Ocultar busca" : "Abrir busca"}
                  >
                    <Search aria-hidden="true" className="h-[18px] w-[18px]" />
                  </button>
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por item ou categoria"
                    className={`h-full min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[#131823] outline-none placeholder:text-[#9aa3b8] transition-opacity duration-200 ${
                      isSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  />
                  {isSearchOpen && query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#69718a] transition hover:bg-[#f2f5fb] hover:text-[#1f2b46]"
                      aria-label="Limpar busca"
                      title="Limpar busca"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  ) : null}
                </ToolbarItem>

                <ToolbarDivider />

                <div ref={filterPopoverRef} className="relative inline-flex items-center">
                  <IconButton
                    type="button"
                    onClick={() => {
                      if (isFilterPopoverOpen) {
                        closeFilterPopover();
                        return;
                      }

                      openFilterPopover();
                    }}
                    variant={hasActiveFilters ? "info" : "secondary"}
                    selected={hasActiveFilters}
                    aria-label="Abrir filtros"
                    title="Abrir filtros"
                  >
                    <span className="relative inline-flex">
                      <Filter
                        aria-hidden="true"
                        className={`h-[18px] w-[18px] ${hasActiveFilters ? "fill-current" : ""}`}
                      />
                      {hasActiveFilters ? (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#f9cf5a]" />
                      ) : null}
                    </span>
                  </IconButton>

                  {isFilterPopoverOpen ? (
                    <div className="absolute right-0 top-12 z-20 w-[340px] rounded-2xl border border-[#d8deea] bg-white p-3 shadow-[0_20px_40px_rgba(23,32,49,0.18)]">
                      <div className="flex items-start gap-3 border-b border-[#e4e8f1] pb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2fb] text-[#5b66c6]">
                          <Filter aria-hidden="true" className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1f2534]">Filtros</p>
                          <p className="mt-0.5 text-xs text-[#6a7288]">
                            Refine quais itens aparecem na lista.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <label className="block space-y-1">
                          <span className="text-[11px] font-medium text-[#6a7288]">Categoria</span>
                          <select
                            value={draftSelectedCategory}
                            onChange={(event) => setDraftSelectedCategory(event.target.value)}
                            className="h-9 w-full rounded-lg border border-[#d3dbeb] bg-white px-3 text-sm font-medium text-[#182031] outline-none focus:border-[#99aacb]"
                          >
                            {categories.map((categoryName) => (
                              <option key={categoryName} value={categoryName}>
                                {categoryName}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-1">
                          <span className="text-[11px] font-medium text-[#6a7288]">Prioridade</span>
                          <select
                            value={draftSelectedPriority}
                            onChange={(event) =>
                              setDraftSelectedPriority(
                                event.target.value as "todas" | WishlistItemPriority,
                              )
                            }
                            className="h-9 w-full rounded-lg border border-[#d3dbeb] bg-white px-3 text-sm font-medium text-[#182031] outline-none focus:border-[#99aacb]"
                          >
                            <option value="todas">Todas</option>
                            <option value="alta">Alta</option>
                            <option value="media">Media</option>
                            <option value="baixa">Baixa</option>
                          </select>
                        </label>

                        {activeTab !== "meus-itens" ? (
                          <label className="block space-y-1">
                            <span className="text-[11px] font-medium text-[#6a7288]">Disponibilidade</span>
                            <select
                              value={draftAvailability}
                              onChange={(event) =>
                                setDraftAvailability(event.target.value as AvailabilityFilter)
                              }
                              className="h-9 w-full rounded-lg border border-[#d3dbeb] bg-white px-3 text-sm font-medium text-[#182031] outline-none focus:border-[#99aacb]"
                            >
                              <option value="todos">Todos</option>
                              <option value="disponiveis">Disponiveis</option>
                              <option value="adquiridos">Adquiridos</option>
                            </select>
                          </label>
                        ) : null}

                        <label className="block space-y-1">
                          <span className="text-[11px] font-medium text-[#6a7288]">Ordenar</span>
                          <select
                            value={draftSortMode}
                            onChange={(event) => setDraftSortMode(event.target.value as SortMode)}
                            className="h-9 w-full rounded-lg border border-[#d3dbeb] bg-white px-3 text-sm font-medium text-[#182031] outline-none focus:border-[#99aacb]"
                          >
                            <option value="recentes">Recentes</option>
                            <option value="prioridade">Prioridade</option>
                            <option value="preco-menor">Menor preco</option>
                            <option value="preco-maior">Maior preco</option>
                          </select>
                        </label>
                      </div>

                      {hasActiveFilters ? (
                        <button
                          type="button"
                          onClick={resetDraftFilters}
                          className="mt-3 inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-[#5d667d] transition hover:text-[#1f2b46]"
                        >
                          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                          Resetar
                        </button>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={closeFilterPopover}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d3dbeb] text-sm font-medium text-[#4e576d]"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={applyDraftFilters}
                          disabled={!hasPendingFilterChanges}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#3f5de8] text-sm font-medium text-white disabled:opacity-50"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div ref={sortPopoverRef} className="relative inline-flex items-center">
                  <IconButton
                    type="button"
                    onClick={openSortPopover}
                    variant={hasActiveSort ? "info" : "secondary"}
                    selected={hasActiveSort}
                    aria-label="Abrir ordenacao"
                    title="Abrir ordenacao"
                  >
                    <ArrowDownUp aria-hidden="true" className="h-[18px] w-[18px]" />
                  </IconButton>

                  {isSortPopoverOpen ? (
                    <div className="absolute right-0 top-12 z-20 w-[260px] rounded-2xl border border-[#d8deea] bg-white p-2 shadow-[0_20px_40px_rgba(23,32,49,0.18)]">
                      {[
                        { id: "recentes", label: "Recentes" },
                        { id: "prioridade", label: "Prioridade" },
                        { id: "preco-menor", label: "Menor preco" },
                        { id: "preco-maior", label: "Maior preco" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSortMode(option.id as SortMode);
                            setDraftSortMode(option.id as SortMode);
                            setIsSortPopoverOpen(false);
                          }}
                          className={`flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium transition ${
                            sortMode === option.id
                              ? "bg-[#eef2ff] text-[#3246b8]"
                              : "text-[#394357] hover:bg-[#f5f7fc]"
                          }`}
                        >
                          <ArrowDownUp aria-hidden="true" className="h-4 w-4 shrink-0 text-current" />
                          <span className="flex-1">{option.label}</span>
                          {sortMode === option.id ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div ref={emailPopoverRef} className="relative inline-flex items-center">
                  <IconButton
                    type="button"
                    onClick={openFollowPreferencesPopover}
                    variant={follower?.email || emailUpdatesEnabled ? "info" : "secondary"}
                    selected={Boolean(follower?.email || emailUpdatesEnabled)}
                    aria-label="Preferencias de acompanhamento"
                    title="Preferencias de acompanhamento"
                  >
                    <Mail
                      aria-hidden="true"
                      className={`h-[18px] w-[18px] ${follower?.email || emailUpdatesEnabled ? "fill-current" : ""}`}
                    />
                  </IconButton>

                  {isEmailPopoverOpen ? (
                    <div className="absolute right-0 top-12 z-20 w-[340px] rounded-2xl border border-[#d8deea] bg-white p-3 shadow-[0_20px_40px_rgba(23,32,49,0.18)]">
                      <div className="flex items-start gap-3 border-b border-[#e4e8f1] pb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2fb] text-[#5b66c6]">
                          <Mail aria-hidden="true" className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1f2534]">Preferencias de acompanhamento</p>
                          <p className="mt-0.5 text-xs text-[#6a7288]">
                            Defina como acompanhar o workspace.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#1f2534]">Acompanhar workspace</p>
                            <p className="text-xs text-[#6a7288]">
                              Habilita acompanhar, favoritar e receber permissao para interacoes.
                            </p>
                          </div>
                          <PreferenceToggle
                            checked={followPrefsDraft.followEnabled}
                            disabled={Boolean(follower)}
                            onToggle={() =>
                              setFollowPrefsDraft((currentDraft) => ({
                                ...currentDraft,
                                followEnabled: !currentDraft.followEnabled,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#1f2534]">Cadastrar itens pessoais</p>
                            <p className="text-xs text-[#6a7288]">
                              Mostra a aba de itens pessoais para suas sugestoes.
                            </p>
                          </div>
                          <PreferenceToggle
                            checked={followPrefsDraft.personalItemsEnabled}
                            onToggle={() =>
                              setFollowPrefsDraft((currentDraft) => ({
                                ...currentDraft,
                                personalItemsEnabled: !currentDraft.personalItemsEnabled,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#1f2534]">Marcar como adquirido</p>
                            <p className="text-xs text-[#6a7288]">
                              Permite marcar e desfazer marcacao de itens oficiais.
                            </p>
                          </div>
                          <PreferenceToggle
                            checked={followPrefsDraft.acquireEnabled}
                            onToggle={() =>
                              setFollowPrefsDraft((currentDraft) => ({
                                ...currentDraft,
                                acquireEnabled: !currentDraft.acquireEnabled,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#1f2534]">Receber updates por e-mail</p>
                            <p className="text-xs text-[#6a7288]">
                              Avisos quando novos itens forem adicionados.
                            </p>
                          </div>
                          <PreferenceToggle
                            checked={followPrefsDraft.emailUpdatesEnabled}
                            onToggle={() =>
                              setFollowPrefsDraft((currentDraft) => ({
                                ...currentDraft,
                                emailUpdatesEnabled: !currentDraft.emailUpdatesEnabled,
                              }))
                            }
                          />
                        </div>

                        {followPrefsDraft.emailUpdatesEnabled ? (
                          <div className="rounded-xl border border-[#d6deef] bg-[#f7f9fd] p-2">
                            <label className="sr-only" htmlFor="popover-follow-email">
                              E-mail para updates
                            </label>
                            <input
                              id="popover-follow-email"
                              type="email"
                              value={followPrefsDraft.email}
                              onChange={(event) =>
                                setFollowPrefsDraft((currentDraft) => ({
                                  ...currentDraft,
                                  email: event.target.value,
                                }))
                              }
                              placeholder="seu@email.com"
                              className="h-9 w-full rounded-lg border border-[#d1d9e9] px-3 text-sm text-[#131823] outline-none placeholder:text-[#9aa3b8] focus:border-[#95a8cb]"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEmailPopoverOpen(false)}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#d3dbeb] text-sm font-medium text-[#4e576d]"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={applyFollowPreferences}
                          disabled={isApplyingFollowPrefs}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#3f5de8] text-sm font-medium text-white disabled:opacity-60"
                        >
                          {isApplyingFollowPrefs ? (
                            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                          ) : null}
                          Aplicar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

              </Toolbar>
            </div>

            <div className="mt-5 overflow-x-auto">
              <SegmentedTabs<PublicTab>
                value={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    id: "todos",
                    label: "Todos",
                    count: visibleOfficialItems.length,
                    icon: (
                      <Sparkles
                        aria-hidden="true"
                        className={`h-4 w-4 ${
                          activeTab === "todos" ? "text-[#6b5cff]" : "text-[#7f879b]"
                        }`}
                      />
                    ),
                  },
                  {
                    id: "favoritos",
                    label: "Favoritos",
                    count: favoriteItems.length,
                    icon: (
                      <Heart
                        aria-hidden="true"
                        className={`h-4 w-4 ${
                          activeTab === "favoritos"
                            ? "fill-current text-[#6b5cff]"
                            : "text-[#7f879b]"
                        }`}
                      />
                    ),
                  },
                  {
                    id: "meus-itens",
                    label: "Meus itens",
                    count: personalItems.length,
                    disabled: !allowPersonalItemsFeature,
                    icon: (
                      <Pencil
                        aria-hidden="true"
                        className={`h-4 w-4 ${
                          activeTab === "meus-itens" ? "text-[#6b5cff]" : "text-[#7f879b]"
                        }`}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </header>

          <section className="space-y-3 p-4 sm:p-6">
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

            {isLoadingFollowerData ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#d8deea] bg-white px-3 py-2 text-sm text-[#505970]">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Carregando seus dados...
              </div>
            ) : null}

            {activeTab === "favoritos" && !follower ? (
              <div className="rounded-2xl border border-dashed border-[#ccd5e7] bg-white px-4 py-10 text-center">
                <Heart aria-hidden="true" className="mx-auto h-6 w-6 text-[#8d4863]" />
                <p className="mt-2 text-sm font-medium text-[#6e778f]">
                  Ative o acompanhamento para salvar e visualizar favoritos.
                </p>
              </div>
            ) : null}

            {activeTab === "meus-itens" && !allowPersonalItemsFeature ? (
              <div className="rounded-2xl border border-dashed border-[#ccd5e7] bg-white px-4 py-10 text-center">
                <Pencil aria-hidden="true" className="mx-auto h-6 w-6 text-[#48628d]" />
                <p className="mt-2 text-sm font-medium text-[#6e778f]">
                  Habilite &quot;Cadastrar itens pessoais&quot; nas preferencias da toolbar.
                </p>
              </div>
            ) : null}

            {activeTab === "meus-itens" && !follower ? (
              <div className="rounded-2xl border border-dashed border-[#ccd5e7] bg-white px-4 py-10 text-center">
                <Pencil aria-hidden="true" className="mx-auto h-6 w-6 text-[#48628d]" />
                <p className="mt-2 text-sm font-medium text-[#6e778f]">
                  Acompanhe o workspace para criar seus itens pessoais.
                </p>
              </div>
            ) : null}

            {activeTab === "meus-itens" && follower && allowPersonalItemsFeature ? (
              <section className="rounded-[24px] border border-[#d8deea] bg-white p-4 shadow-[0_14px_30px_rgba(29,38,58,0.08)] sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8edf7] text-[#4c5a7b]">
                      {editingPersonalItemId ? (
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Plus aria-hidden="true" className="h-4 w-4" />
                      )}
                    </div>
                    <h3 className="text-[15px] font-semibold text-[#151b28]">
                      {editingPersonalItemId ? "Editar item pessoal" : "Adicionar item pessoal"}
                    </h3>
                  </div>
                  {editingPersonalItemId ? (
                    <CommonButton
                      type="button"
                      onClick={resetPersonalForm}
                      variant="secondary"
                      usage="general"
                      className="h-9 px-3 text-xs"
                    >
                      Cancelar edicao
                    </CommonButton>
                  ) : null}
                </div>

                <form onSubmit={handleSubmitPersonalItem} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Link</span>
                    <div className="flex items-center gap-2 rounded-xl border border-[#d1d9e9] px-3 focus-within:border-[#95a8cb]">
                      <Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#687086]" />
                      <input
                        value={personalForm.purchaseUrl}
                        onChange={(event) => handlePersonalFormField("purchaseUrl", event.target.value)}
                        className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba]"
                        placeholder="https://..."
                        required
                      />
                    </div>
                  </label>

                  <div className="flex items-end">
                    <CommonButton
                      type="button"
                      onClick={fillPersonalItemFromLink}
                      disabled={isPreviewLoading}
                      variant="secondary"
                      usage="general"
                      showIconLeft
                      iconLeft={
                        isPreviewLoading ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles aria-hidden="true" className="h-4 w-4" />
                        )
                      }
                      className="h-11 w-full px-3"
                    >
                      Preencher pelo link
                    </CommonButton>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Nome</span>
                    <input
                      value={personalForm.name}
                      onChange={(event) => handlePersonalFormField("name", event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Imagem</span>
                    <input
                      value={personalForm.imageUrl}
                      onChange={(event) => handlePersonalFormField("imageUrl", event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                      placeholder="https://..."
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Preco</span>
                    <input
                      value={personalForm.price}
                      onChange={(event) => handlePersonalFormField("price", event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                      inputMode="decimal"
                      placeholder="149,90"
                      required
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Categoria</span>
                    <input
                      value={personalForm.category}
                      onChange={(event) => handlePersonalFormField("category", event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none placeholder:text-[#9ca5ba] focus:border-[#95a8cb]"
                      maxLength={60}
                      required
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Prioridade</span>
                    <div className="grid h-11 grid-cols-3 overflow-hidden rounded-xl border border-[#d1d9e9]">
                      {(["baixa", "media", "alta"] as WishlistItemPriority[]).map((priorityOption) => {
                        const active = personalForm.priority === priorityOption;

                        return (
                          <button
                            key={priorityOption}
                            type="button"
                            onClick={() => handlePersonalFormField("priority", priorityOption)}
                            className={`text-sm font-medium transition ${
                              active ? "bg-[#1a2235] text-white" : "bg-white text-[#4e576d]"
                            }`}
                          >
                            {priorityLabels[priorityOption]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-medium text-[#7a8298]">Recompra</span>
                    <div className="grid h-11 grid-cols-3 overflow-hidden rounded-xl border border-[#d1d9e9]">
                      {(
                        [
                          { value: "nao_recompra", label: "Nao e recompra" },
                          { value: "precisa_recompra", label: "Precisa agora" },
                          { value: "ainda_tem", label: "Ainda tem" },
                        ] as Array<{ value: ItemRepurchaseState; label: string }>
                      ).map((repurchaseOption) => {
                        const active = personalForm.repurchaseState === repurchaseOption.value;

                        return (
                          <button
                            key={repurchaseOption.value}
                            type="button"
                            onClick={() =>
                              handlePersonalFormField("repurchaseState", repurchaseOption.value)
                            }
                            className={`text-xs font-medium transition ${
                              active ? "bg-[#1a2235] text-white" : "bg-white text-[#4e576d]"
                            }`}
                          >
                            {repurchaseOption.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-[#7a8298]">Visibilidade</span>
                    <div className="grid h-11 grid-cols-2 overflow-hidden rounded-xl border border-[#d1d9e9]">
                      {(
                        [
                          { value: "private", label: "Privado", icon: EyeOff },
                          { value: "public", label: "Publico", icon: Eye },
                        ] as Array<{
                          value: PersonalItemVisibility;
                          label: string;
                          icon: typeof Eye;
                        }>
                      ).map((visibilityOption) => {
                        const active = personalForm.visibility === visibilityOption.value;
                        const Icon = visibilityOption.icon;

                        return (
                          <button
                            key={visibilityOption.value}
                            type="button"
                            onClick={() => handlePersonalFormField("visibility", visibilityOption.value)}
                            className={`inline-flex items-center justify-center gap-1 text-sm font-medium transition ${
                              active ? "bg-[#1a2235] text-white" : "bg-white text-[#4e576d]"
                            }`}
                          >
                            <Icon aria-hidden="true" className="h-4 w-4" />
                            {visibilityOption.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <CommonButton
                      type="submit"
                      disabled={isPersonalSubmitting}
                      variant="primary"
                      usage="general"
                      showIconLeft
                      iconLeft={
                        isPersonalSubmitting ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : editingPersonalItemId ? (
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        )
                      }
                      className="h-11 w-full px-4"
                    >
                      {editingPersonalItemId ? "Salvar item pessoal" : "Adicionar item pessoal"}
                    </CommonButton>
                  </div>
                </form>
              </section>
            ) : null}

            {visibleItemsCount === 0 && !(activeTab === "favoritos" && !follower) && !(activeTab === "meus-itens" && !follower) ? (
              <div className="rounded-2xl border border-dashed border-[#ccd5e7] bg-white px-4 py-12 text-center">
                <Sparkles aria-hidden="true" className="mx-auto h-6 w-6 text-[#9c6f19]" />
                <p className="mt-2 text-sm font-medium text-[#6e778f]">
                  Nenhum item encontrado com estes filtros.
                </p>
              </div>
            ) : null}

            {activeTab === "todos" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleOfficialItems.map((item) => renderOfficialCard(item))}
              </div>
            ) : null}

            {activeTab === "favoritos" && follower ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {favoriteItems.map((item) => renderOfficialCard(item))}
              </div>
            ) : null}

            {activeTab === "meus-itens" && follower ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePersonalItems.map((item) => renderPersonalItemCard(item))}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
