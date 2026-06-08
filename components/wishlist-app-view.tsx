/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Flag,
  Flame,
  Gamepad2,
  Gem,
  GraduationCap,
  Grid2X2,
  Home,
  Heart,
  Image as ImageIcon,
  Laptop,
  Layers3,
  Loader2,
  List,
  Minus,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  Sofa,
  Sparkles,
  ShoppingCart,
  Trash2,
  Tags,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import type { AccessRole } from "@/lib/access";
import type {
  ItemRepurchaseState,
  PersonalItemVisibility,
  WishlistData,
  WishlistItem,
  WishlistItemPriority,
} from "@/lib/db";
import { formatPrice, isRecent, parsePriceToCents } from "@/lib/format";
import { hasPermission, type PermissionKey } from "@/lib/rbac";
import { WishlistSidebar } from "@/components/wishlist-sidebar";
import {
  CommonButton,
  IconButton,
  ListBox,
  MenuIconButton,
  SwitchButton,
  Toolbar,
  ToolbarDivider,
  ToolbarItem,
} from "@/components/ui/button-system";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Drawer, DrawerFieldRow, DrawerSection } from "@/components/ui/drawer";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Chip } from "@/components/ui/chip";
import { Tabs } from "@/components/ui/tabs";
import { EditableLinkButtonField } from "@/components/ui/editable-link-button-field";

type AccessView = {
  role: AccessRole;
  permissions: string[];
};

type PersonalItem = {
  id: string;
  wishlistId: string;
  profileId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
  createdAt: string;
  updatedAt: string;
};

type OfficialForm = {
  name: string;
  purchaseUrl: string;
  imageUrl: string;
  price: string;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
};

type PersonalForm = OfficialForm & {
  visibility: PersonalItemVisibility;
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

type AvailabilityFilter = "todos" | "disponiveis" | "adquiridos";
type PriorityFilter = "todas" | WishlistItemPriority;
type RepurchaseFilter = "todas" | ItemRepurchaseState;
type SortMode = "recentes" | "prioridade" | "preco-menor" | "preco-maior";
type FilterPanelKey = "categoria" | "prioridade" | "status" | "recompra";
type ViewMode = "cards" | "list";

type FilterState = {
  category: string;
  priority: PriorityFilter;
  availability: AvailabilityFilter;
  repurchaseState: RepurchaseFilter;
  sortMode: SortMode;
};

const defaultOfficialForm: OfficialForm = {
  name: "",
  purchaseUrl: "",
  imageUrl: "",
  price: "",
  category: "Geral",
  priority: "media",
  repurchaseState: "nao_recompra",
};

const defaultPersonalForm: PersonalForm = {
  ...defaultOfficialForm,
  visibility: "private",
};

function createAutoFillTouchedFields(): AutoFillTouchedFields {
  return {
    name: false,
    imageUrl: false,
    price: false,
  };
}

const defaultFilterState: FilterState = {
  category: "Todas",
  priority: "todas",
  availability: "todos",
  repurchaseState: "todas",
  sortMode: "recentes",
};

const cardActionLinkClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#d4dbea] bg-white px-3 text-sm font-medium text-[#1c2538] shadow-[var(--ds-shadow-soft)] transition hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-55";

const priorityOrder: Record<WishlistItemPriority, number> = {
  alta: 3,
  media: 2,
  baixa: 1,
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

function applyLinkPreviewToForm<T extends OfficialForm>(
  currentForm: T,
  result: LinkPreviewResponse,
  touchedFields: AutoFillTouchedFields,
  autoFilledValues: Partial<Record<AutoFillField, string>>,
) {
  let nextForm = currentForm;
  const nextAutoFilledValues = { ...autoFilledValues };

  if (
    result.name &&
    shouldApplyPreviewField("name", currentForm.name, touchedFields, autoFilledValues)
  ) {
    nextForm = { ...nextForm, name: result.name };
    nextAutoFilledValues.name = result.name;
  }

  if (
    result.imageUrl &&
    shouldApplyPreviewField("imageUrl", currentForm.imageUrl, touchedFields, autoFilledValues)
  ) {
    nextForm = { ...nextForm, imageUrl: result.imageUrl };
    nextAutoFilledValues.imageUrl = result.imageUrl;
  }

  if (
    result.price &&
    shouldApplyPreviewField("price", currentForm.price, touchedFields, autoFilledValues)
  ) {
    nextForm = { ...nextForm, price: result.price };
    nextAutoFilledValues.price = result.price;
  }

  return { form: nextForm, autoFilledValues: nextAutoFilledValues };
}

function matchesTextQuery(
  item: Pick<WishlistItem, "name" | "category" | "purchaseUrl">,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalized) ||
    item.category.toLowerCase().includes(normalized) ||
    getSourceLabel(item.purchaseUrl).toLowerCase().includes(normalized)
  );
}

function sortItemsByMode<T extends { priority: WishlistItemPriority; priceCents: number; createdAt: string }>(
  items: T[],
  mode: SortMode,
) {
  return [...items].sort((left, right) => {
    if (mode === "prioridade") {
      return priorityOrder[right.priority] - priorityOrder[left.priority];
    }
    if (mode === "preco-menor") {
      return left.priceCents - right.priceCents;
    }
    if (mode === "preco-maior") {
      return right.priceCents - left.priceCents;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function isRecurringItem(repurchaseState: ItemRepurchaseState) {
  return repurchaseState !== "nao_recompra";
}

function matchesRepurchaseState(itemState: ItemRepurchaseState, filterState: RepurchaseFilter) {
  if (filterState === "todas") {
    return true;
  }

  if (filterState === "precisa_recompra") {
    return isRecurringItem(itemState);
  }

  return itemState === filterState;
}

function priorityChipType(priority: WishlistItemPriority) {
  if (priority === "alta") {
    return "destructive" as const;
  }
  if (priority === "media") {
    return "warning" as const;
  }
  return "tertiary" as const;
}

function priorityLabel(priority: WishlistItemPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function categoryIcon(category: string | null | undefined) {
  const normalized = (category ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized || normalized === "geral") {
    return Tags;
  }
  if (/(roupa|camisa|vestido|saia|calca|jaqueta|moda|blusa|look)/.test(normalized)) {
    return Shirt;
  }
  if (/(tech|tecnologia|eletron|notebook|pc|computador|celular|iphone|gadget)/.test(normalized)) {
    return Laptop;
  }
  if (/(casa|decor|move|sofa|quarto|cozinha|mesa|banho)/.test(normalized)) {
    return Sofa;
  }
  if (/(livro|book|leitura|revista)/.test(normalized)) {
    return BookOpen;
  }
  if (/(estudo|escola|curso|faculdade|aula)/.test(normalized)) {
    return GraduationCap;
  }
  if (/(game|jogo|console)/.test(normalized)) {
    return Gamepad2;
  }
  if (/(maquiagem|make|batom|base|rimel|blush)/.test(normalized)) {
    return Paintbrush;
  }
  if (/(beleza|perfume|skincare|cosmet)/.test(normalized)) {
    return Sparkles;
  }
  if (/(joia|acessorio|anel|colar|brinco)/.test(normalized)) {
    return Gem;
  }
  if (/(fitness|academia|esporte|treino)/.test(normalized)) {
    return Dumbbell;
  }
  if (/(comida|bebida|cafe|restaurante|cozinha)/.test(normalized)) {
    return UtensilsCrossed;
  }

  return Tags;
}

function renderCategoryIcon(
  category: string | null | undefined,
  className = "h-4 w-4 shrink-0 text-[#6f7a95]",
) {
  const Icon = categoryIcon(category);
  return <Icon aria-hidden="true" className={className} />;
}

function renderPriorityIcon(priority: WishlistItemPriority, className = "h-4 w-4 shrink-0") {
  if (priority === "alta") {
    return <Flame aria-hidden="true" className={`${className} text-[#d65840]`} />;
  }
  if (priority === "media") {
    return <AlertTriangle aria-hidden="true" className={`${className} text-[#d2952c]`} />;
  }
  return <Minus aria-hidden="true" className={`${className} text-[#6f7a95]`} />;
}

function propertyLabel(icon: ReactNode, label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[#7a8398]">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function isInteractiveCardTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("[data-card-interactive], a, button, input, select, textarea, label"))
    : false;
}

export function WishlistAppView({
  data,
  canonicalPath,
  access,
}: {
  data: WishlistData;
  canonicalPath: string;
  access: AccessView;
}) {
  const [items, setItems] = useState(data.items);
  const [personalItems, setPersonalItems] = useState<PersonalItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"todos" | "favoritos" | "meus-itens">("todos");
  const [query, setQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilterState);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilterState);
  const [activeFilterPanel, setActiveFilterPanel] = useState<FilterPanelKey | null>(null);
  const [activeFilterPanelOffset, setActiveFilterPanelOffset] = useState<number | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [isOfficialDrawerOpen, setIsOfficialDrawerOpen] = useState(false);
  const [isPersonalDrawerOpen, setIsPersonalDrawerOpen] = useState(false);
  const [editingOfficialItemId, setEditingOfficialItemId] = useState<string | null>(null);
  const [editingPersonalItemId, setEditingPersonalItemId] = useState<string | null>(null);
  const [officialForm, setOfficialForm] = useState<OfficialForm>(defaultOfficialForm);
  const [personalForm, setPersonalForm] = useState<PersonalForm>(defaultPersonalForm);
  const [officialLinkPreview, setOfficialLinkPreview] = useState<LinkPreviewState>({
    isLoading: false,
    error: null,
  });
  const [personalLinkPreview, setPersonalLinkPreview] = useState<LinkPreviewState>({
    isLoading: false,
    error: null,
  });
  const [customCategoryOptions, setCustomCategoryOptions] = useState<ComboboxOption[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const officialAutoFillTouchedFieldsRef = useRef<AutoFillTouchedFields>(
    createAutoFillTouchedFields(),
  );
  const personalAutoFillTouchedFieldsRef = useRef<AutoFillTouchedFields>(
    createAutoFillTouchedFields(),
  );
  const officialAutoFilledValuesRef = useRef<Partial<Record<AutoFillField, string>>>({});
  const personalAutoFilledValuesRef = useRef<Partial<Record<AutoFillField, string>>>({});
  const officialPurchaseUrlEditedRef = useRef(false);
  const personalPurchaseUrlEditedRef = useRef(false);

  function can(permission: PermissionKey) {
    return hasPermission(access.role, permission);
  }
  const canManageFavorites = can("wishlist.favorites.manage");
  const canManagePersonal = can("wishlist.personal.create") || can("wishlist.personal.edit");

  useEffect(() => {
    async function loadExtras() {
      try {
        if (canManageFavorites) {
          const favoritesResponse = await fetch(
            `/api/items/favorites?slug=${encodeURIComponent(data.wishlist.slug)}`,
          );

          const favoritesResult = (await favoritesResponse.json()) as {
            favorites?: string[];
            error?: string;
          };

          if (!favoritesResponse.ok) {
            throw new Error(favoritesResult.error ?? "Nao foi possivel carregar favoritos.");
          }

          setFavoriteItemIds(new Set(favoritesResult.favorites ?? []));
        } else {
          setFavoriteItemIds(new Set());
        }

        if (canManagePersonal) {
          const personalResponse = await fetch(
            `/api/personal-items?slug=${encodeURIComponent(data.wishlist.slug)}`,
          );
          const personalResult = (await personalResponse.json()) as {
            items?: PersonalItem[];
            error?: string;
          };

          if (!personalResponse.ok) {
            throw new Error(personalResult.error ?? "Nao foi possivel carregar itens pessoais.");
          }

          setPersonalItems(personalResult.items ?? []);
        } else {
          setPersonalItems([]);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
      }
    }

    loadExtras();
  }, [canManageFavorites, canManagePersonal, data.wishlist.slug]);

  useEffect(() => {
    if (activeTab === "favoritos" && !canManageFavorites) {
      setActiveTab("todos");
      return;
    }

    if (activeTab === "meus-itens" && !canManagePersonal) {
      setActiveTab("todos");
    }
  }, [activeTab, canManageFavorites, canManagePersonal]);

  const favoriteBaseItems = useMemo(
    () => items.filter((item) => favoriteItemIds.has(item.id)),
    [favoriteItemIds, items],
  );

  const officialQueryItems = useMemo(
    () => items.filter((item) => matchesTextQuery(item, query)),
    [items, query],
  );
  const favoriteQueryItems = useMemo(
    () => favoriteBaseItems.filter((item) => matchesTextQuery(item, query)),
    [favoriteBaseItems, query],
  );
  const personalQueryItems = useMemo(
    () => personalItems.filter((item) => matchesTextQuery(item, query)),
    [personalItems, query],
  );

  const filterPoolItems = useMemo(() => {
    if (activeTab === "meus-itens") {
      return personalQueryItems;
    }
    if (activeTab === "favoritos") {
      return favoriteQueryItems;
    }
    return officialQueryItems;
  }, [activeTab, favoriteQueryItems, officialQueryItems, personalQueryItems]);

  const categories = useMemo(
    () =>
      ["Todas", ...Array.from(new Set(filterPoolItems.map((item) => item.category))).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      )],
    [filterPoolItems],
  );
  const formCategoryOptions = useMemo<ComboboxOption[]>(
    () =>
      Array.from(
        new Set([
          ...items.map((item) => item.category),
          ...personalItems.map((item) => item.category),
          defaultOfficialForm.category,
        ]),
      )
        .sort((left, right) => left.localeCompare(right, "pt-BR"))
        .map<ComboboxOption>((category) => ({
          value: category,
          label: category,
          icon: renderCategoryIcon(category, "h-3.5 w-3.5"),
          chipType: "secondary",
          chipSurface: "neutral",
        }))
        .concat(customCategoryOptions),
    [customCategoryOptions, items, personalItems],
  );
  const priorityOptions = useMemo<ComboboxOption[]>(
    () =>
      (["baixa", "media", "alta"] as WishlistItemPriority[]).map<ComboboxOption>((priority) => ({
        value: priority,
        label: priorityLabel(priority),
        icon: renderPriorityIcon(priority, "h-3.5 w-3.5 shrink-0"),
        chipType: priorityChipType(priority),
        chipSurface: "filled",
      })),
    [],
  );

  useEffect(() => {
    if (categories.includes(appliedFilters.category)) {
      return;
    }

    setAppliedFilters((current) => ({ ...current, category: "Todas" }));
    setDraftFilters((current) => ({ ...current, category: "Todas" }));
  }, [appliedFilters.category, categories]);

  useEffect(() => {
    if (activeTab !== "meus-itens") {
      return;
    }

    if (appliedFilters.availability !== "todos" || draftFilters.availability !== "todos") {
      setAppliedFilters((current) => ({ ...current, availability: "todos" }));
      setDraftFilters((current) => ({ ...current, availability: "todos" }));
    }
  }, [activeTab, appliedFilters.availability, draftFilters.availability]);

  function appendCustomCategoryOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setCustomCategoryOptions((current) =>
      current.some((option) => option.value.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [
            ...current,
            {
              value: trimmed,
              label: trimmed,
              icon: renderCategoryIcon(trimmed, "h-3.5 w-3.5"),
              chipType: "secondary",
              chipSurface: "neutral",
            },
          ],
    );
  }

  function matchesOfficialFilters(item: WishlistItem, filters: FilterState) {
    const matchesCategory = filters.category === "Todas" || item.category === filters.category;
    const matchesPriority = filters.priority === "todas" || item.priority === filters.priority;
    const matchesAvailability =
      filters.availability === "todos" ||
      (filters.availability === "disponiveis" && !item.acquiredAt) ||
      (filters.availability === "adquiridos" && Boolean(item.acquiredAt));
    const matchesRepurchase = matchesRepurchaseState(item.repurchaseState, filters.repurchaseState);

    return matchesCategory && matchesPriority && matchesAvailability && matchesRepurchase;
  }

  function matchesPersonalFilters(item: PersonalItem, filters: FilterState) {
    const matchesCategory = filters.category === "Todas" || item.category === filters.category;
    const matchesPriority = filters.priority === "todas" || item.priority === filters.priority;
    const matchesRepurchase = matchesRepurchaseState(item.repurchaseState, filters.repurchaseState);

    return matchesCategory && matchesPriority && matchesRepurchase;
  }

  const visibleOfficialItems = useMemo(
    () =>
      sortItemsByMode(
        officialQueryItems.filter((item) => matchesOfficialFilters(item, appliedFilters)),
        appliedFilters.sortMode,
      ),
    [appliedFilters, officialQueryItems],
  );

  const favoriteItems = useMemo(
    () =>
      sortItemsByMode(
        favoriteQueryItems.filter((item) => matchesOfficialFilters(item, appliedFilters)),
        appliedFilters.sortMode,
      ),
    [appliedFilters, favoriteQueryItems],
  );

  const visiblePersonalItems = useMemo(
    () =>
      sortItemsByMode(
        personalQueryItems.filter((item) => matchesPersonalFilters(item, appliedFilters)),
        appliedFilters.sortMode,
      ),
    [appliedFilters, personalQueryItems],
  );

  const showAvailabilityFilter = activeTab !== "meus-itens";
  const hasAppliedFilters =
    appliedFilters.category !== defaultFilterState.category ||
    appliedFilters.priority !== defaultFilterState.priority ||
    appliedFilters.repurchaseState !== defaultFilterState.repurchaseState ||
    (showAvailabilityFilter && appliedFilters.availability !== defaultFilterState.availability);
  const hasDraftFilters =
    draftFilters.category !== defaultFilterState.category ||
    draftFilters.priority !== defaultFilterState.priority ||
    draftFilters.repurchaseState !== defaultFilterState.repurchaseState ||
    (showAvailabilityFilter && draftFilters.availability !== defaultFilterState.availability);
  const hasPendingFilterChanges =
    appliedFilters.category !== draftFilters.category ||
    appliedFilters.priority !== draftFilters.priority ||
    appliedFilters.repurchaseState !== draftFilters.repurchaseState ||
    (showAvailabilityFilter && appliedFilters.availability !== draftFilters.availability);
  const activeFilterCount =
    Number(appliedFilters.category !== defaultFilterState.category) +
    Number(appliedFilters.priority !== defaultFilterState.priority) +
    Number(appliedFilters.repurchaseState !== defaultFilterState.repurchaseState) +
    Number(showAvailabilityFilter && appliedFilters.availability !== defaultFilterState.availability);

  const statusCountPool = useMemo(
    () => (activeTab === "favoritos" ? favoriteQueryItems : officialQueryItems),
    [activeTab, favoriteQueryItems, officialQueryItems],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of filterPoolItems) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [filterPoolItems]);

  const priorityCounts = useMemo(
    () => ({
      alta: filterPoolItems.filter((item) => item.priority === "alta").length,
      media: filterPoolItems.filter((item) => item.priority === "media").length,
      baixa: filterPoolItems.filter((item) => item.priority === "baixa").length,
    }),
    [filterPoolItems],
  );

  const repurchaseCounts = useMemo(
    () => ({
      nao_recompra: filterPoolItems.filter((item) => item.repurchaseState === "nao_recompra").length,
      precisa_recompra: filterPoolItems.filter((item) => isRecurringItem(item.repurchaseState)).length,
    }),
    [filterPoolItems],
  );

  const availabilityCounts = useMemo(
    () => ({
      todos: statusCountPool.length,
      disponiveis: statusCountPool.filter((item) => !item.acquiredAt).length,
      adquiridos: statusCountPool.filter((item) => Boolean(item.acquiredAt)).length,
    }),
    [statusCountPool],
  );

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

      setDraftFilters(appliedFilters);
      setIsFilterPopoverOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDraftFilters(appliedFilters);
        setIsFilterPopoverOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [appliedFilters, isFilterPopoverOpen]);

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

  useEffect(() => {
    if (showAvailabilityFilter) {
      return;
    }

    if (activeFilterPanel === "status") {
      setActiveFilterPanel(null);
      setActiveFilterPanelOffset(null);
    }
  }, [activeFilterPanel, showAvailabilityFilter]);

  function openFilterPopover() {
    setDraftFilters(appliedFilters);
    setActiveFilterPanel(null);
    setActiveFilterPanelOffset(null);
    setIsSortPopoverOpen(false);
    setIsFilterPopoverOpen(true);
  }

  function openSortPopover() {
    setDraftFilters(appliedFilters);
    setActiveFilterPanel(null);
    setActiveFilterPanelOffset(null);
    setIsFilterPopoverOpen(false);
    setIsSortPopoverOpen(true);
  }

  function closeFilterPopover() {
    setDraftFilters(appliedFilters);
    setActiveFilterPanelOffset(null);
    setIsFilterPopoverOpen(false);
  }

  function applyDraftFilters() {
    setAppliedFilters((current) => ({ ...draftFilters, sortMode: current.sortMode }));
    setIsFilterPopoverOpen(false);
  }

  function resetDraftFilters() {
    setDraftFilters((current) => ({
      ...defaultFilterState,
      availability: showAvailabilityFilter ? defaultFilterState.availability : current.availability,
      sortMode: current.sortMode,
    }));
  }

  function selectSortMode(sortMode: SortMode) {
    setAppliedFilters((current) => ({ ...current, sortMode }));
    setDraftFilters((current) => ({ ...current, sortMode }));
    setIsSortPopoverOpen(false);
  }

  function selectFilterPanel(panel: FilterPanelKey, trigger: HTMLButtonElement) {
    const popover = trigger.closest("[data-filter-popover]");
    if (popover instanceof HTMLElement) {
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      setActiveFilterPanelOffset(triggerRect.top - popoverRect.top);
    }
    setActiveFilterPanel(panel);
  }

  async function logout() {
    setPendingAction("logout");
    setError(null);
    setMessage(null);

    try {
      await fetch("/api/access/logout", { method: "POST" });
      window.location.reload();
    } catch {
      setError("Nao foi possivel sair agora.");
      setPendingAction(null);
    }
  }

  async function toggleFavorite(item: WishlistItem) {
    if (!canManageFavorites) {
      setError("Seu perfil nao pode favoritar itens.");
      return;
    }

    const isFavorite = favoriteItemIds.has(item.id);
    const pendingKey = `favorite:${item.id}`;
    if (pendingAction === pendingKey) {
      return;
    }
    setPendingAction(pendingKey);
    setError(null);

    try {
      const response = await fetch(`/api/items/${item.id}/favorite`, {
        method: isFavorite ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel atualizar favorito.");
      }

      setFavoriteItemIds((current) => {
        const next = new Set(current);
        if (isFavorite) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleAcquire(item: WishlistItem) {
    if (!can("wishlist.acquire.toggle")) {
      setError("Seu perfil nao pode marcar itens como adquiridos.");
      return;
    }

    const pendingKey = `acquire:${item.id}`;
    if (pendingAction === pendingKey) {
      return;
    }
    setPendingAction(pendingKey);
    setError(null);

    try {
      const response = await fetch(`/api/items/${item.id}/acquire`, {
        method: item.acquiredAt ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as { item?: WishlistItem; error?: string };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel atualizar o item.");
      }

      setItems((currentItems) =>
        currentItems.map((currentItem) =>
          currentItem.id === result.item?.id ? result.item : currentItem,
        ),
      );
    } catch (acquireError) {
      setError(acquireError instanceof Error ? acquireError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  function resetOfficialAutoFillState() {
    officialAutoFillTouchedFieldsRef.current = createAutoFillTouchedFields();
    officialAutoFilledValuesRef.current = {};
    officialPurchaseUrlEditedRef.current = false;
    setOfficialLinkPreview({ isLoading: false, error: null });
  }

  function resetPersonalAutoFillState() {
    personalAutoFillTouchedFieldsRef.current = createAutoFillTouchedFields();
    personalAutoFilledValuesRef.current = {};
    personalPurchaseUrlEditedRef.current = false;
    setPersonalLinkPreview({ isLoading: false, error: null });
  }

  function markOfficialAutoFillFieldTouched(field: AutoFillField) {
    officialAutoFillTouchedFieldsRef.current = {
      ...officialAutoFillTouchedFieldsRef.current,
      [field]: true,
    };
  }

  function markPersonalAutoFillFieldTouched(field: AutoFillField) {
    personalAutoFillTouchedFieldsRef.current = {
      ...personalAutoFillTouchedFieldsRef.current,
      [field]: true,
    };
  }

  function handleOfficialPurchaseUrlChange(value: string) {
    officialPurchaseUrlEditedRef.current = true;
    setOfficialForm((current) => ({ ...current, purchaseUrl: value }));
  }

  function handlePersonalPurchaseUrlChange(value: string) {
    personalPurchaseUrlEditedRef.current = true;
    setPersonalForm((current) => ({ ...current, purchaseUrl: value }));
  }

  useEffect(() => {
    const value = officialForm.purchaseUrl.trim();
    const previewUrl = parseHttpUrl(value);

    if (!isOfficialDrawerOpen || !officialPurchaseUrlEditedRef.current || !previewUrl) {
      setOfficialLinkPreview({ isLoading: false, error: null });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setOfficialLinkPreview({ isLoading: true, error: null });

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

        setOfficialForm((currentForm) => {
          const applied = applyLinkPreviewToForm(
            currentForm,
            result,
            officialAutoFillTouchedFieldsRef.current,
            officialAutoFilledValuesRef.current,
          );
          officialAutoFilledValuesRef.current = applied.autoFilledValues;
          return applied.form;
        });
        setOfficialLinkPreview({
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

        setOfficialLinkPreview({
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
  }, [isOfficialDrawerOpen, officialForm.purchaseUrl]);

  useEffect(() => {
    const value = personalForm.purchaseUrl.trim();
    const previewUrl = parseHttpUrl(value);

    if (!isPersonalDrawerOpen || !personalPurchaseUrlEditedRef.current || !previewUrl) {
      setPersonalLinkPreview({ isLoading: false, error: null });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPersonalLinkPreview({ isLoading: true, error: null });

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

        setPersonalForm((currentForm) => {
          const applied = applyLinkPreviewToForm(
            currentForm,
            result,
            personalAutoFillTouchedFieldsRef.current,
            personalAutoFilledValuesRef.current,
          );
          personalAutoFilledValuesRef.current = applied.autoFilledValues;
          return applied.form;
        });
        setPersonalLinkPreview({
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

        setPersonalLinkPreview({
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
  }, [isPersonalDrawerOpen, personalForm.purchaseUrl]);

  function openCreateOfficialDrawer() {
    setEditingOfficialItemId(null);
    setOfficialForm(defaultOfficialForm);
    resetOfficialAutoFillState();
    setIsOfficialDrawerOpen(true);
  }

  function openEditOfficialDrawer(item: WishlistItem) {
    setEditingOfficialItemId(item.id);
    setOfficialForm({
      name: item.name,
      purchaseUrl: item.purchaseUrl,
      imageUrl: item.imageUrl ?? "",
      price: (item.priceCents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      category: item.category,
      priority: item.priority,
      repurchaseState: isRecurringItem(item.repurchaseState) ? "precisa_recompra" : "nao_recompra",
    });
    resetOfficialAutoFillState();
    setIsOfficialDrawerOpen(true);
  }

  async function submitOfficialForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction === "official:submit") {
      return;
    }

    if (!can("wishlist.official.create")) {
      setError("Seu perfil nao pode criar itens oficiais.");
      return;
    }

    const purchaseUrl = parseHttpUrl(officialForm.purchaseUrl);
    const imageUrl = officialForm.imageUrl.trim() ? parseHttpUrl(officialForm.imageUrl) : "";
    const priceCents = parsePriceToCents(officialForm.price);

    if (!purchaseUrl) {
      setError("Informe um link de compra valido.");
      return;
    }
    if (officialForm.imageUrl.trim() && !imageUrl) {
      setError("Informe uma URL de imagem valida.");
      return;
    }
    if (priceCents === null) {
      setError("Informe um preco valido.");
      return;
    }

    setPendingAction("official:submit");
    setError(null);

    try {
      const response = await fetch(
        editingOfficialItemId ? `/api/items/${editingOfficialItemId}` : "/api/items",
        {
          method: editingOfficialItemId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: officialForm.name,
            purchaseUrl,
            imageUrl: imageUrl || undefined,
            price: officialForm.price,
            category: officialForm.category,
            priority: officialForm.priority,
            repurchaseState: isRecurringItem(officialForm.repurchaseState)
              ? "precisa_recompra"
              : "nao_recompra",
          }),
        },
      );
      const result = (await response.json()) as { item?: WishlistItem; error?: string };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel salvar o item.");
      }

      if (editingOfficialItemId) {
        setItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === result.item?.id ? result.item : currentItem,
          ),
        );
      } else {
        setItems((currentItems) => [result.item as WishlistItem, ...currentItems]);
      }

      setMessage(editingOfficialItemId ? "Item oficial atualizado." : "Item oficial criado.");
      setIsOfficialDrawerOpen(false);
      setOfficialForm(defaultOfficialForm);
      setEditingOfficialItemId(null);
      resetOfficialAutoFillState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function archiveOfficialItem(item: WishlistItem) {
    if (!can("wishlist.official.archive")) {
      setError("Seu perfil nao pode arquivar itens oficiais.");
      return;
    }

    const pendingKey = `archive:${item.id}`;
    if (pendingAction === pendingKey) {
      return;
    }
    setPendingAction(pendingKey);
    setError(null);

    try {
      const response = await fetch(`/api/items/${item.id}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          archived: true,
        }),
      });
      const result = (await response.json()) as { item?: WishlistItem; error?: string };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel arquivar.");
      }

      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteOfficialItem(item: WishlistItem) {
    if (!can("wishlist.official.delete")) {
      setError("Seu perfil nao pode excluir itens oficiais.");
      return;
    }

    if (!window.confirm(`Excluir "${item.name}"?`)) {
      return;
    }

    const pendingKey = `delete:${item.id}`;
    if (pendingAction === pendingKey) {
      return;
    }
    setPendingAction(pendingKey);
    setError(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel excluir.");
      }

      setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  function openCreatePersonalDrawer() {
    setEditingPersonalItemId(null);
    setPersonalForm(defaultPersonalForm);
    resetPersonalAutoFillState();
    setIsPersonalDrawerOpen(true);
  }

  function openEditPersonalDrawer(item: PersonalItem) {
    setEditingPersonalItemId(item.id);
    setPersonalForm({
      name: item.name,
      purchaseUrl: item.purchaseUrl,
      imageUrl: item.imageUrl ?? "",
      price: (item.priceCents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      category: item.category,
      priority: item.priority,
      repurchaseState: isRecurringItem(item.repurchaseState) ? "precisa_recompra" : "nao_recompra",
      visibility: item.visibility,
    });
    resetPersonalAutoFillState();
    setIsPersonalDrawerOpen(true);
  }

  async function submitPersonalForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction === "personal:submit") {
      return;
    }

    if (!can("wishlist.personal.create")) {
      setError("Seu perfil nao pode criar itens pessoais.");
      return;
    }

    const purchaseUrl = parseHttpUrl(personalForm.purchaseUrl);
    const imageUrl = personalForm.imageUrl.trim() ? parseHttpUrl(personalForm.imageUrl) : "";
    const priceCents = parsePriceToCents(personalForm.price);

    if (!purchaseUrl) {
      setError("Informe um link de compra valido.");
      return;
    }
    if (personalForm.imageUrl.trim() && !imageUrl) {
      setError("Informe uma URL de imagem valida.");
      return;
    }
    if (priceCents === null) {
      setError("Informe um preco valido.");
      return;
    }

    setPendingAction("personal:submit");
    setError(null);

    try {
      const response = await fetch(
        editingPersonalItemId ? `/api/personal-items/${editingPersonalItemId}` : "/api/personal-items",
        {
          method: editingPersonalItemId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: personalForm.name,
            purchaseUrl,
            imageUrl: imageUrl || undefined,
            price: personalForm.price,
            category: personalForm.category,
            priority: personalForm.priority,
            repurchaseState: isRecurringItem(personalForm.repurchaseState)
              ? "precisa_recompra"
              : "nao_recompra",
            visibility: personalForm.visibility,
          }),
        },
      );
      const result = (await response.json()) as { item?: PersonalItem; error?: string };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel salvar o item pessoal.");
      }

      if (editingPersonalItemId) {
        setPersonalItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === result.item?.id ? result.item : currentItem,
          ),
        );
      } else {
        setPersonalItems((currentItems) => [result.item as PersonalItem, ...currentItems]);
      }

      setMessage(editingPersonalItemId ? "Item pessoal atualizado." : "Item pessoal criado.");
      setIsPersonalDrawerOpen(false);
      setEditingPersonalItemId(null);
      setPersonalForm(defaultPersonalForm);
      resetPersonalAutoFillState();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deletePersonalItem(item: PersonalItem) {
    if (!can("wishlist.personal.delete")) {
      setError("Seu perfil nao pode excluir itens pessoais.");
      return;
    }

    if (!window.confirm(`Excluir "${item.name}"?`)) {
      return;
    }

    const pendingKey = `personal-delete:${item.id}`;
    if (pendingAction === pendingKey) {
      return;
    }
    setPendingAction(pendingKey);
    setError(null);

    try {
      const response = await fetch(`/api/personal-items/${item.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel excluir item pessoal.");
      }

      setPersonalItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  function handleOfficialCardClick(event: ReactMouseEvent<HTMLElement>, item: WishlistItem) {
    if (!can("wishlist.official.edit") || isInteractiveCardTarget(event.target)) {
      return;
    }

    openEditOfficialDrawer(item);
  }

  function handlePersonalCardClick(event: ReactMouseEvent<HTMLElement>, item: PersonalItem) {
    if (!can("wishlist.personal.edit") || isInteractiveCardTarget(event.target)) {
      return;
    }

    openEditPersonalDrawer(item);
  }

  function getOfficialMenuItems(item: WishlistItem, isAcquired: boolean, isRecurring: boolean) {
    return [
      ...(isAcquired && isRecurring && can("wishlist.acquire.toggle")
        ? [
            {
              id: "renew-stock",
              label: "Renovar estoque",
              icon:
                pendingAction === `acquire:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                ),
              onSelect: () => toggleAcquire(item),
            },
          ]
        : []),
      ...(can("wishlist.official.edit")
        ? [
            {
              id: "edit",
              label: "Editar",
              icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
              separatorBefore: isAcquired && isRecurring && can("wishlist.acquire.toggle"),
              onSelect: () => openEditOfficialDrawer(item),
            },
          ]
        : []),
      ...(can("wishlist.official.archive")
        ? [
            {
              id: "archive",
              label: "Arquivar",
              icon:
                pendingAction === `archive:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive aria-hidden="true" className="h-4 w-4" />
                ),
              onSelect: () => archiveOfficialItem(item),
            },
          ]
        : []),
      ...(can("wishlist.official.delete")
        ? [
            {
              id: "delete",
              label: "Excluir",
              icon:
                pendingAction === `delete:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                ),
              danger: true,
              separatorBefore: true,
              onSelect: () => deleteOfficialItem(item),
            },
          ]
        : []),
    ];
  }

  function getPersonalMenuItems(item: PersonalItem) {
    return [
      ...(can("wishlist.personal.edit")
        ? [
            {
              id: "edit",
              label: "Editar",
              icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => openEditPersonalDrawer(item),
            },
          ]
        : []),
      ...(can("wishlist.personal.delete")
        ? [
            {
              id: "delete",
              label: "Excluir",
              icon:
                pendingAction === `personal-delete:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                ),
              danger: true,
              separatorBefore: can("wishlist.personal.edit"),
              onSelect: () => deletePersonalItem(item),
            },
          ]
        : []),
    ];
  }

  function renderOfficialCard(item: WishlistItem) {
    const isFavorite = favoriteItemIds.has(item.id);
    const isAcquired = Boolean(item.acquiredAt);
    const isRecentItem = isRecent(item.createdAt);
    const isRecurring = isRecurringItem(item.repurchaseState);
    const menuItems = getOfficialMenuItems(item, isAcquired, isRecurring);

    return (
      <article
        key={item.id}
        onClick={(event) => handleOfficialCardClick(event, item)}
        className={`flex h-full flex-col overflow-visible rounded-[26px] border border-[#e8edf5] bg-white p-3 shadow-[0_14px_30px_rgba(30,39,57,0.1)] ${
          can("wishlist.official.edit") ? "cursor-pointer" : ""
        }`}
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
            <Chip
              label="Recente"
              size="sm"
              type="warning"
              surface="neutral"
              showIconLeft
              iconLeft={<Clock3 aria-hidden="true" />}
              className="absolute left-3 top-3"
            />
          ) : null}

          {canManageFavorites ? (
            <IconButton
              type="button"
              onClick={() => toggleFavorite(item)}
              className="absolute right-3 top-3 h-8 w-8 border-white/90 bg-white/90 text-[#4f5870] shadow-sm hover:text-[#d23d61]"
              size="sm"
              variant="secondary"
              selected={isFavorite}
              aria-label={isFavorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
              title={isFavorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
            >
              {pendingAction === `favorite:${item.id}` ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  aria-hidden="true"
                  className={`h-4 w-4 ${isFavorite ? "fill-current text-[#d23d61]" : ""}`}
                />
              )}
            </IconButton>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-3 px-2 pb-2 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[1rem] font-semibold leading-tight text-[#121723]">
                {item.name}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#3f475b]">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#6c7489]" />
                {formatCreatedLabel(item.createdAt)}
              </p>
            </div>
            <p className="shrink-0 text-right text-[1.02rem] font-semibold leading-none text-[#101623]">
              {formatPrice(item.priceCents, item.currency)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label={item.category}
              size="sm"
              type="secondary"
              surface="neutral"
              showIconLeft
              iconLeft={renderCategoryIcon(item.category, "h-3.5 w-3.5")}
            />
            <Chip
              label={priorityLabel(item.priority)}
              size="sm"
              type={priorityChipType(item.priority)}
              showIconLeft
              iconLeft={renderPriorityIcon(item.priority, "h-3.5 w-3.5 shrink-0")}
            />
            <Chip
              label={isAcquired ? "Adquirido" : "Disponivel"}
              size="sm"
              type={isAcquired ? "success" : "info"}
              showIconLeft
              iconLeft={<ShoppingCart aria-hidden="true" />}
            />
            {isRecurring ? (
              <Chip
                label="Compra recorrente"
                size="sm"
                type="primary"
                surface="neutral"
                showIconLeft
                iconLeft={<RotateCcw aria-hidden="true" />}
              />
            ) : null}
          </div>

          <div className="mt-auto grid grid-cols-[1fr_auto_auto] gap-2">
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className={cardActionLinkClass}
              data-card-interactive
              title={`Abrir link de compra de ${item.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Comprar
            </a>
            <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
              <IconButton
                type="button"
                onClick={() => toggleAcquire(item)}
                className="h-11 w-11"
                variant={isAcquired ? "info" : "secondary"}
                selected={isAcquired}
                aria-label={isAcquired ? `Desmarcar ${item.name} como adquirido` : `Marcar ${item.name} como adquirido`}
                title={isAcquired ? `Desmarcar ${item.name} como adquirido` : `Marcar ${item.name} como adquirido`}
              >
                {pendingAction === `acquire:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                ) : (
                  <ShoppingCart aria-hidden="true" className={`h-5 w-5 ${isAcquired ? "fill-current" : ""}`} />
                )}
              </IconButton>
            </div>
            {menuItems.length > 0 ? (
              <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                <MenuIconButton
                  ariaLabel={`Mais acoes para ${item.name}`}
                  variant="secondary"
                  menuAlignment="right"
                  tooltip
                  items={menuItems}
                  buttonClassName="h-11 w-11"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </MenuIconButton>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  function renderPersonalCard(item: PersonalItem) {
    const isRecentItem = isRecent(item.createdAt);
    const isRecurring = isRecurringItem(item.repurchaseState);
    const menuItems = getPersonalMenuItems(item);

    return (
      <article
        key={item.id}
        onClick={(event) => handlePersonalCardClick(event, item)}
        className={`flex h-full flex-col overflow-visible rounded-[26px] border border-[#e8edf5] bg-white p-3 shadow-[0_14px_30px_rgba(30,39,57,0.1)] ${
          can("wishlist.personal.edit") ? "cursor-pointer" : ""
        }`}
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
            <Chip
              label="Recente"
              size="sm"
              type="warning"
              surface="neutral"
              showIconLeft
              iconLeft={<Clock3 aria-hidden="true" />}
              className="absolute left-3 top-3"
            />
          ) : null}
          <span className="absolute right-3 top-3 inline-flex h-8 items-center gap-1 rounded-full bg-white/95 px-2 text-[11px] font-medium text-[#2e374c] shadow-sm">
            {item.visibility === "public" ? (
              <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <EyeOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            )}
            {item.visibility === "public" ? "Publico" : "Privado"}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-2 pb-2 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[1rem] font-semibold leading-tight text-[#121723]">
                {item.name}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#3f475b]">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#6c7489]" />
                {formatCreatedLabel(item.createdAt)}
              </p>
            </div>
            <p className="shrink-0 text-right text-[1.02rem] font-semibold leading-none text-[#101623]">
              {formatPrice(item.priceCents, item.currency)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              label={item.category}
              size="sm"
              type="secondary"
              surface="neutral"
              showIconLeft
              iconLeft={renderCategoryIcon(item.category, "h-3.5 w-3.5")}
            />
            <Chip
              label={priorityLabel(item.priority)}
              size="sm"
              type={priorityChipType(item.priority)}
              showIconLeft
              iconLeft={renderPriorityIcon(item.priority, "h-3.5 w-3.5 shrink-0")}
            />
            <Chip
              label="Disponivel"
              size="sm"
              type="info"
              showIconLeft
              iconLeft={<ShoppingCart aria-hidden="true" />}
            />
            {isRecurring ? (
              <Chip
                label="Compra recorrente"
                size="sm"
                type="primary"
                surface="neutral"
                showIconLeft
                iconLeft={<RotateCcw aria-hidden="true" />}
              />
            ) : null}
          </div>

          <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className={cardActionLinkClass}
              data-card-interactive
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Abrir
            </a>
            {menuItems.length > 0 ? (
              <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                <MenuIconButton
                  ariaLabel={`Mais acoes para ${item.name}`}
                  variant="secondary"
                  menuAlignment="right"
                  tooltip
                  items={menuItems}
                  buttonClassName="h-11 w-11"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </MenuIconButton>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  function renderOfficialListItem(item: WishlistItem) {
    const isFavorite = favoriteItemIds.has(item.id);
    const isAcquired = Boolean(item.acquiredAt);
    const isRecentItem = isRecent(item.createdAt);
    const isRecurring = isRecurringItem(item.repurchaseState);
    const menuItems = getOfficialMenuItems(item, isAcquired, isRecurring);

    return (
      <article
        key={item.id}
        onClick={(event) => handleOfficialCardClick(event, item)}
        className={`rounded-[22px] border border-[#e0e6f0] bg-white p-3 shadow-[0_10px_24px_rgba(30,39,57,0.08)] transition hover:border-[#cfd9ea] ${
          can("wishlist.official.edit") ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[16px] bg-[#edf1f8]">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#606981]">
                  <ImageIcon aria-hidden="true" className="h-7 w-7" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[1rem] font-semibold text-[#121723]">{item.name}</h3>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#3f475b]">
                    <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#6c7489]" />
                    {formatCreatedLabel(item.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-[1rem] font-semibold text-[#101623]">
                  {formatPrice(item.priceCents, item.currency)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isRecentItem ? (
                  <Chip
                    label="Recente"
                    size="sm"
                    type="warning"
                    surface="neutral"
                    showIconLeft
                    iconLeft={<Clock3 aria-hidden="true" />}
                  />
                ) : null}
                <Chip
                  label={item.category}
                  size="sm"
                  type="secondary"
                  surface="neutral"
                  showIconLeft
                  iconLeft={renderCategoryIcon(item.category, "h-3.5 w-3.5")}
                />
                <Chip
                  label={priorityLabel(item.priority)}
                  size="sm"
                  type={priorityChipType(item.priority)}
                  showIconLeft
                  iconLeft={renderPriorityIcon(item.priority, "h-3.5 w-3.5 shrink-0")}
                />
                <Chip
                  label={isAcquired ? "Adquirido" : "Disponivel"}
                  size="sm"
                  type={isAcquired ? "success" : "info"}
                  showIconLeft
                  iconLeft={<ShoppingCart aria-hidden="true" />}
                />
                {isRecurring ? (
                  <Chip
                    label="Compra recorrente"
                    size="sm"
                    type="primary"
                    surface="neutral"
                    showIconLeft
                    iconLeft={<RotateCcw aria-hidden="true" />}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:self-stretch">
            {canManageFavorites ? (
              <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                <IconButton
                  type="button"
                  onClick={() => toggleFavorite(item)}
                  variant="secondary"
                  selected={isFavorite}
                  className="h-11 w-11"
                  aria-label={isFavorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
                  title={isFavorite ? `Remover ${item.name} dos favoritos` : `Adicionar ${item.name} aos favoritos`}
                >
                  {pendingAction === `favorite:${item.id}` ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart
                      aria-hidden="true"
                      className={`h-4 w-4 ${isFavorite ? "fill-current text-[#d23d61]" : ""}`}
                    />
                  )}
                </IconButton>
              </div>
            ) : null}
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className={cardActionLinkClass}
              data-card-interactive
              title={`Abrir link de compra de ${item.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Comprar
            </a>
            <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
              <IconButton
                type="button"
                onClick={() => toggleAcquire(item)}
                className="h-11 w-11"
                variant={isAcquired ? "info" : "secondary"}
                selected={isAcquired}
                aria-label={isAcquired ? `Desmarcar ${item.name} como adquirido` : `Marcar ${item.name} como adquirido`}
                title={isAcquired ? `Desmarcar ${item.name} como adquirido` : `Marcar ${item.name} como adquirido`}
              >
                {pendingAction === `acquire:${item.id}` ? (
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                ) : (
                  <ShoppingCart aria-hidden="true" className={`h-5 w-5 ${isAcquired ? "fill-current" : ""}`} />
                )}
              </IconButton>
            </div>
            {menuItems.length > 0 ? (
              <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                <MenuIconButton
                  ariaLabel={`Mais acoes para ${item.name}`}
                  variant="secondary"
                  menuAlignment="right"
                  tooltip
                  items={menuItems}
                  buttonClassName="h-11 w-11"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </MenuIconButton>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  function renderPersonalListItem(item: PersonalItem) {
    const isRecentItem = isRecent(item.createdAt);
    const isRecurring = isRecurringItem(item.repurchaseState);
    const menuItems = getPersonalMenuItems(item);

    return (
      <article
        key={item.id}
        onClick={(event) => handlePersonalCardClick(event, item)}
        className={`rounded-[22px] border border-[#e0e6f0] bg-white p-3 shadow-[0_10px_24px_rgba(30,39,57,0.08)] transition hover:border-[#cfd9ea] ${
          can("wishlist.personal.edit") ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[16px] bg-[#edf1f8]">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#606981]">
                  <ImageIcon aria-hidden="true" className="h-7 w-7" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[1rem] font-semibold text-[#121723]">{item.name}</h3>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#3f475b]">
                    <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#6c7489]" />
                    {formatCreatedLabel(item.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-[1rem] font-semibold text-[#101623]">
                  {formatPrice(item.priceCents, item.currency)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isRecentItem ? (
                  <Chip
                    label="Recente"
                    size="sm"
                    type="warning"
                    surface="neutral"
                    showIconLeft
                    iconLeft={<Clock3 aria-hidden="true" />}
                  />
                ) : null}
                <Chip
                  label={item.category}
                  size="sm"
                  type="secondary"
                  surface="neutral"
                  showIconLeft
                  iconLeft={renderCategoryIcon(item.category, "h-3.5 w-3.5")}
                />
                <Chip
                  label={priorityLabel(item.priority)}
                  size="sm"
                  type={priorityChipType(item.priority)}
                  showIconLeft
                  iconLeft={renderPriorityIcon(item.priority, "h-3.5 w-3.5 shrink-0")}
                />
                <Chip
                  label="Disponivel"
                  size="sm"
                  type="info"
                  showIconLeft
                  iconLeft={<ShoppingCart aria-hidden="true" />}
                />
                {isRecurring ? (
                  <Chip
                    label="Compra recorrente"
                    size="sm"
                    type="primary"
                    surface="neutral"
                    showIconLeft
                    iconLeft={<RotateCcw aria-hidden="true" />}
                  />
                ) : null}
                <Chip
                  label={item.visibility === "public" ? "Publico" : "Privado"}
                  size="sm"
                  type="tertiary"
                  surface="neutral"
                  showIconLeft
                  iconLeft={
                    item.visibility === "public" ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:self-stretch">
            <a
              href={item.purchaseUrl}
              target="_blank"
              rel="noreferrer"
              className={cardActionLinkClass}
              data-card-interactive
              title={`Abrir link de ${item.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Abrir
            </a>
            {menuItems.length > 0 ? (
              <div data-card-interactive className="-m-1 flex items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                <MenuIconButton
                  ariaLabel={`Mais acoes para ${item.name}`}
                  variant="secondary"
                  menuAlignment="right"
                  tooltip
                  items={menuItems}
                  buttonClassName="h-11 w-11"
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </MenuIconButton>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  const filterSections = [
    {
      id: "categoria" as const,
      label: "Categoria",
      icon: Layers3,
      selectedCount: appliedFilters.category === "Todas" ? 0 : 1,
    },
    {
      id: "prioridade" as const,
      label: "Prioridade",
      icon: Flag,
      selectedCount: appliedFilters.priority === "todas" ? 0 : 1,
    },
    ...(showAvailabilityFilter
      ? [
          {
            id: "status" as const,
            label: "Status",
            icon: ShoppingCart,
            selectedCount: appliedFilters.availability === "todos" ? 0 : 1,
          },
        ]
      : []),
    {
      id: "recompra" as const,
      label: "Compra recorrente",
      icon: RotateCcw,
      selectedCount: appliedFilters.repurchaseState === "todas" ? 0 : 1,
    },
  ];

  const effectiveActiveFilterPanel =
    activeFilterPanel && filterSections.some((section) => section.id === activeFilterPanel)
      ? activeFilterPanel
      : null;

  const showOfficialTrigger = activeTab === "todos" && can("wishlist.official.create");
  const showPersonalTrigger = activeTab === "meus-itens" && can("wishlist.personal.create");
  const showAddTrigger = showOfficialTrigger || showPersonalTrigger;

  const activeFilterOptions = useMemo(() => {
    if (!effectiveActiveFilterPanel) {
      return [];
    }

    if (effectiveActiveFilterPanel === "categoria") {
      return categories.map((category) => ({
        id: category,
        label: category,
        count: category === "Todas" ? filterPoolItems.length : categoryCounts.get(category) ?? 0,
        selected: draftFilters.category === category,
        onSelect: () => setDraftFilters((current) => ({ ...current, category })),
      }));
    }

    if (effectiveActiveFilterPanel === "prioridade") {
      return [
        {
          id: "todas",
          label: "Todas",
          count: filterPoolItems.length,
          selected: draftFilters.priority === "todas",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "todas" })),
        },
        {
          id: "alta",
          label: "Alta",
          count: priorityCounts.alta,
          selected: draftFilters.priority === "alta",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "alta" })),
        },
        {
          id: "media",
          label: "Media",
          count: priorityCounts.media,
          selected: draftFilters.priority === "media",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "media" })),
        },
        {
          id: "baixa",
          label: "Baixa",
          count: priorityCounts.baixa,
          selected: draftFilters.priority === "baixa",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "baixa" })),
        },
      ];
    }

    if (effectiveActiveFilterPanel === "status") {
      return [
        {
          id: "todos",
          label: "Todos",
          count: availabilityCounts.todos,
          selected: draftFilters.availability === "todos",
          onSelect: () => setDraftFilters((current) => ({ ...current, availability: "todos" })),
        },
        {
          id: "disponiveis",
          label: "Disponiveis",
          count: availabilityCounts.disponiveis,
          selected: draftFilters.availability === "disponiveis",
          onSelect: () =>
            setDraftFilters((current) => ({ ...current, availability: "disponiveis" })),
        },
        {
          id: "adquiridos",
          label: "Adquiridos",
          count: availabilityCounts.adquiridos,
          selected: draftFilters.availability === "adquiridos",
          onSelect: () => setDraftFilters((current) => ({ ...current, availability: "adquiridos" })),
        },
      ];
    }

    if (effectiveActiveFilterPanel === "recompra") {
      return [
        {
          id: "todas",
          label: "Todas",
          count: filterPoolItems.length,
          selected: draftFilters.repurchaseState === "todas",
          onSelect: () => setDraftFilters((current) => ({ ...current, repurchaseState: "todas" })),
        },
        {
          id: "precisa_recompra",
          label: "Compra recorrente",
          count: repurchaseCounts.precisa_recompra,
          selected: draftFilters.repurchaseState === "precisa_recompra",
          onSelect: () =>
            setDraftFilters((current) => ({ ...current, repurchaseState: "precisa_recompra" })),
        },
        {
          id: "nao_recompra",
          label: "Nao recorrente",
          count: repurchaseCounts.nao_recompra,
          selected: draftFilters.repurchaseState === "nao_recompra",
          onSelect: () =>
            setDraftFilters((current) => ({ ...current, repurchaseState: "nao_recompra" })),
        },
      ];
    }

    return [];
  }, [
    availabilityCounts.adquiridos,
    availabilityCounts.disponiveis,
    availabilityCounts.todos,
    categories,
    categoryCounts,
    draftFilters.availability,
    draftFilters.category,
    draftFilters.priority,
    draftFilters.repurchaseState,
    effectiveActiveFilterPanel,
    filterPoolItems.length,
    priorityCounts.alta,
    priorityCounts.baixa,
    priorityCounts.media,
    repurchaseCounts.nao_recompra,
    repurchaseCounts.precisa_recompra,
  ]);

  function getActiveFilterOptionIcon(optionId: string) {
    if (effectiveActiveFilterPanel === "prioridade") {
      if (optionId === "alta") {
        return renderPriorityIcon("alta");
      }
      if (optionId === "media") {
        return renderPriorityIcon("media");
      }
      if (optionId === "baixa") {
        return renderPriorityIcon("baixa");
      }
      return renderPriorityIcon("media");
    }

    if (effectiveActiveFilterPanel === "status") {
      if (optionId === "todos") {
        return <Layers3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />;
      }
      if (optionId === "disponiveis") {
        return <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />;
      }
      if (optionId === "adquiridos") {
        return <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#1d7b43]" />;
      }
      return <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />;
    }

    if (effectiveActiveFilterPanel === "recompra") {
      return <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />;
    }

    return renderCategoryIcon(optionId);
  }

  const filterSectionListItems = filterSections.map((section) => {
    const Icon = section.icon;
    const isRecurringSection = section.id === "recompra";
    const recurringSelected = draftFilters.repurchaseState === "precisa_recompra";

    return {
      id: section.id,
      label: section.label,
      count: isRecurringSection
        ? recurringSelected
          ? 1
          : undefined
        : section.selectedCount > 0
          ? section.selectedCount
          : undefined,
      selected: isRecurringSection ? recurringSelected : section.id === effectiveActiveFilterPanel,
      icon: <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-[#77809a]" />,
      endIcon: isRecurringSection ? undefined : <ChevronRight aria-hidden="true" className="h-4 w-4" />,
      onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (isRecurringSection) {
          setActiveFilterPanel(null);
          setActiveFilterPanelOffset(null);
          setDraftFilters((current) => ({
            ...current,
            repurchaseState: current.repurchaseState === "precisa_recompra" ? "todas" : "precisa_recompra",
          }));
          return;
        }

        selectFilterPanel(section.id, event.currentTarget);
      },
    };
  });

  const activeFilterListItems = activeFilterOptions.map((option) => ({
    id: option.id,
    label: option.label,
    count: option.count,
    selected: option.selected,
    icon: getActiveFilterOptionIcon(option.id),
    onSelect: option.onSelect,
  }));

  const sortListItems = [
    {
      id: "recentes",
      label: "Mais recentes",
      selected: appliedFilters.sortMode === "recentes",
      onSelect: () => selectSortMode("recentes"),
    },
    {
      id: "prioridade",
      label: "Prioridade",
      selected: appliedFilters.sortMode === "prioridade",
      onSelect: () => selectSortMode("prioridade"),
    },
    {
      id: "preco-menor",
      label: "Menor preco",
      selected: appliedFilters.sortMode === "preco-menor",
      onSelect: () => selectSortMode("preco-menor"),
    },
    {
      id: "preco-maior",
      label: "Maior preco",
      selected: appliedFilters.sortMode === "preco-maior",
      onSelect: () => selectSortMode("preco-maior"),
    },
  ];

  return (
    <main className="ds-app-shell min-h-screen">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[272px_1fr]"
        }`}
      >
        <WishlistSidebar
          title={data.wishlist.ownerName || "Perfil da wishlist"}
          subtitle={data.wishlist.ownerEmail || "Sem e-mail configurado"}
          avatarUrl={data.wishlist.ownerAvatarUrl}
          wishlistHref={canonicalPath}
          tasksHref="/tasks"
          studiesHref="/studies"
          showTasks={can("admin.tasks.manage")}
          showStudies={can("admin.studies.manage")}
          adminHref="/admin"
          onLogout={logout}
          activePage="wishlist"
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <section className="ds-app-panel">
          <header className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Breadcrumb
                  items={[
                    { label: "Home", href: "/", icon: <Home aria-hidden="true" /> },
                    { label: "Wishlist", icon: <Layers3 aria-hidden="true" /> },
                  ]}
                />
                <h2 className="mt-1 text-3xl font-semibold text-[#141a27]">{data.wishlist.title}</h2>
              </div>

              <Toolbar className="hidden">
                {showAddTrigger ? (
                  <ToolbarItem>
                    <IconButton
                      type="button"
                      onClick={showOfficialTrigger ? openCreateOfficialDrawer : openCreatePersonalDrawer}
                      variant="info"
                      aria-label={showOfficialTrigger ? "Adicionar item oficial" : "Adicionar item pessoal"}
                      title={showOfficialTrigger ? "Adicionar item oficial" : "Adicionar item pessoal"}
                    >
                      <Plus aria-hidden="true" className="h-[18px] w-[18px]" />
                    </IconButton>
                  </ToolbarItem>
                ) : null}

                <ToolbarItem
                  className={`h-10 overflow-hidden rounded-[10px] border transition-[width,border-color,background-color] duration-300 ${
                    isSearchOpen
                      ? "w-[min(20rem,calc(100vw-7rem))] border-transparent bg-transparent"
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
                    placeholder="Buscar por nome ou categoria"
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
                      <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
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
                    variant={hasAppliedFilters ? "info" : "secondary"}
                    selected={hasAppliedFilters}
                    aria-label="Abrir filtros"
                    title="Abrir filtros"
                  >
                    <span className="relative inline-flex">
                      <Filter
                        aria-hidden="true"
                        className={`h-[18px] w-[18px] ${hasAppliedFilters ? "fill-current" : ""}`}
                      />
                      {activeFilterCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f9cf5a] ring-2 ring-[#f8f9fd]" />
                      ) : null}
                    </span>
                  </IconButton>

                  {isFilterPopoverOpen ? (
                    <div data-filter-popover className="absolute left-0 top-[3.15rem] z-30 w-[min(350px,calc(100vw-2rem))] rounded-[24px] border border-[#d7ddea] bg-white shadow-[0_24px_50px_rgba(20,28,45,0.18)] sm:left-auto sm:right-0">
                      <div className="flex items-center justify-between border-b border-[#e6eaf3] px-4 py-3.5">
                        <p className="text-[1.4rem] font-medium text-[#161d2c]">Filters</p>
                        <button
                          type="button"
                          onClick={closeFilterPopover}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5f687e] transition hover:bg-[#f1f4fa] hover:text-[#1f2738]"
                          aria-label="Fechar filtros"
                          title="Fechar filtros"
                        >
                          <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
                        </button>
                      </div>

                      <div className="p-2">
                        <ListBox
                          items={filterSectionListItems}
                          emptyLabel="Nenhum filtro encontrado."
                          showSelectedCheck={false}
                          ariaLabel="Filtros"
                        />
                      </div>

                      <div className="border-t border-[#e6eaf3] px-4 py-3">
                        <div className="grid grid-cols-2 gap-2">
                          <CommonButton
                            type="button"
                            onClick={() => {
                              if (!hasDraftFilters) {
                                return;
                              }
                              resetDraftFilters();
                            }}
                            variant="secondary"
                            usage="general"
                            title="Limpar filtros"
                          >
                            Reset
                          </CommonButton>
                          <CommonButton
                            type="button"
                            onClick={() => {
                              if (!hasPendingFilterChanges) {
                                return;
                              }
                              applyDraftFilters();
                            }}
                            variant="primary"
                            usage="info"
                            title="Aplicar filtros"
                          >
                            Apply
                          </CommonButton>
                        </div>
                      </div>

                      {effectiveActiveFilterPanel ? (
                        <div
                          className="mt-2 border-t border-[#eceff6] px-4 pb-4 pt-3 md:absolute md:left-full md:mt-0 md:ml-3 md:w-[280px] md:rounded-[20px] md:border md:border-[#d7ddea] md:bg-white md:p-2 md:shadow-[0_16px_35px_rgba(20,28,45,0.15)]"
                          style={activeFilterPanelOffset === null ? undefined : { top: activeFilterPanelOffset }}
                        >
                          <ListBox items={activeFilterListItems} ariaLabel="Opções de filtro" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <ToolbarItem>
                  <div ref={sortPopoverRef} className="relative inline-flex items-center">
                    <IconButton
                      type="button"
                      onClick={() => {
                        if (isSortPopoverOpen) {
                          setIsSortPopoverOpen(false);
                          return;
                        }
                        openSortPopover();
                      }}
                      variant={appliedFilters.sortMode !== defaultFilterState.sortMode ? "info" : "secondary"}
                      selected={appliedFilters.sortMode !== defaultFilterState.sortMode}
                      aria-label="Abrir ordenacao"
                      title="Abrir ordenacao"
                    >
                      <ArrowDownUp aria-hidden="true" className="h-[18px] w-[18px]" />
                    </IconButton>

                    {isSortPopoverOpen ? (
                      <div className="absolute left-0 top-[3.15rem] z-30 w-[220px] rounded-[16px] border border-[#d7ddea] bg-white p-2 shadow-[var(--ds-shadow-soft)] sm:left-auto sm:right-0">
                        <ListBox items={sortListItems} ariaLabel="Ordenacao" />
                      </div>
                    ) : null}
                  </div>
                </ToolbarItem>
              </Toolbar>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Tabs<"todos" | "favoritos" | "meus-itens">
                value={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    id: "todos",
                    label: "Todos",
                    count: visibleOfficialItems.length,
                    icon: <Layers3 aria-hidden="true" className="h-5 w-5" />,
                  },
                  ...(canManageFavorites
                    ? [
                        {
                          id: "favoritos" as const,
                          label: "Favoritos",
                          count: favoriteItems.length,
                          icon: <Heart aria-hidden="true" className="h-5 w-5" />,
                        },
                      ]
                    : []),
                  ...(canManagePersonal
                    ? [
                        {
                          id: "meus-itens" as const,
                          label: "Meus itens",
                          count: visiblePersonalItems.length,
                          icon: <UserRound aria-hidden="true" className="h-5 w-5" />,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </header>

          <section className="space-y-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SwitchButton<ViewMode>
                items={[
                  {
                    value: "cards",
                    label: "",
                    ariaLabel: "Visualizacao por cards",
                    icon: <Grid2X2 aria-hidden="true" className="h-4 w-4" />,
                  },
                  {
                    value: "list",
                    label: "",
                    ariaLabel: "Visualizacao por lista",
                    icon: <List aria-hidden="true" className="h-4 w-4" />,
                  },
                ]}
                value={viewMode}
                onChange={setViewMode}
                iconOnly
              />
              <Toolbar variant="ghost" className="flex-wrap justify-end">
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
                    variant={hasAppliedFilters ? "info" : "secondary"}
                    selected={hasAppliedFilters}
                    aria-label="Abrir filtros"
                    title="Abrir filtros"
                  >
                    <span className="relative inline-flex">
                      <Filter
                        aria-hidden="true"
                        className={`h-[18px] w-[18px] ${hasAppliedFilters ? "fill-current" : ""}`}
                      />
                      {activeFilterCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f9cf5a] ring-2 ring-[#f8f9fd]" />
                      ) : null}
                    </span>
                  </IconButton>

                  {isFilterPopoverOpen ? (
                    <div data-filter-popover className="absolute left-0 top-[3.15rem] z-30 w-[min(350px,calc(100vw-2rem))] rounded-[24px] border border-[#d7ddea] bg-white shadow-[0_24px_50px_rgba(20,28,45,0.18)] sm:left-auto sm:right-0">
                      <div className="flex items-center justify-between border-b border-[#e6eaf3] px-4 py-3.5">
                        <p className="text-[1.4rem] font-medium text-[#161d2c]">Filters</p>
                        <button
                          type="button"
                          onClick={closeFilterPopover}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5f687e] transition hover:bg-[#f1f4fa] hover:text-[#1f2738]"
                          aria-label="Fechar filtros"
                          title="Fechar filtros"
                        >
                          <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
                        </button>
                      </div>

                      <div className="p-2">
                        <ListBox
                          items={filterSectionListItems}
                          emptyLabel="Nenhum filtro encontrado."
                          showSelectedCheck={false}
                          ariaLabel="Filtros"
                        />
                      </div>

                      <div className="border-t border-[#e6eaf3] px-4 py-3">
                        <div className="grid grid-cols-2 gap-2">
                          <CommonButton
                            type="button"
                            onClick={() => {
                              if (!hasDraftFilters) {
                                return;
                              }
                              resetDraftFilters();
                            }}
                            variant="secondary"
                            usage="general"
                            title="Limpar filtros"
                          >
                            Reset
                          </CommonButton>
                          <CommonButton
                            type="button"
                            onClick={() => {
                              if (!hasPendingFilterChanges) {
                                return;
                              }
                              applyDraftFilters();
                            }}
                            variant="primary"
                            usage="info"
                            title="Aplicar filtros"
                          >
                            Apply
                          </CommonButton>
                        </div>
                      </div>

                      {effectiveActiveFilterPanel ? (
                        <div
                          className="mt-2 border-t border-[#eceff6] px-4 pb-4 pt-3 md:absolute md:left-full md:mt-0 md:ml-3 md:w-[280px] md:rounded-[20px] md:border md:border-[#d7ddea] md:bg-white md:p-2 md:shadow-[0_16px_35px_rgba(20,28,45,0.15)]"
                          style={activeFilterPanelOffset === null ? undefined : { top: activeFilterPanelOffset }}
                        >
                          <ListBox items={activeFilterListItems} ariaLabel="Opções de filtro" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <ToolbarItem>
                  <div ref={sortPopoverRef} className="relative inline-flex items-center">
                    <IconButton
                      type="button"
                      onClick={() => {
                        if (isSortPopoverOpen) {
                          setIsSortPopoverOpen(false);
                          return;
                        }
                        openSortPopover();
                      }}
                      variant={appliedFilters.sortMode !== defaultFilterState.sortMode ? "info" : "secondary"}
                      selected={appliedFilters.sortMode !== defaultFilterState.sortMode}
                      aria-label="Abrir ordenacao"
                      title="Abrir ordenacao"
                    >
                      <ArrowDownUp aria-hidden="true" className="h-[18px] w-[18px]" />
                    </IconButton>

                    {isSortPopoverOpen ? (
                      <div className="absolute left-0 top-[3.15rem] z-30 w-[220px] rounded-[16px] border border-[#d7ddea] bg-white p-2 shadow-[var(--ds-shadow-soft)] sm:left-auto sm:right-0">
                        <ListBox items={sortListItems} ariaLabel="Ordenacao" />
                      </div>
                    ) : null}
                  </div>
                </ToolbarItem>

                <ToolbarItem
                  className={`h-10 overflow-hidden rounded-[10px] border transition-[width,border-color,background-color] duration-300 ${
                    isSearchOpen
                      ? "w-[min(20rem,calc(100vw-7rem))] border-transparent bg-transparent"
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
                    placeholder="Buscar por nome ou categoria"
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
                      <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
                    </button>
                  ) : null}
                </ToolbarItem>

                {showAddTrigger ? (
                  <ToolbarItem>
                    <CommonButton
                      type="button"
                      onClick={showOfficialTrigger ? openCreateOfficialDrawer : openCreatePersonalDrawer}
                      variant="primary"
                      usage="info"
                      showIconLeft
                      iconLeft={<Plus aria-hidden="true" className="h-4 w-4" />}
                      className="h-10 whitespace-nowrap px-3"
                      title={showOfficialTrigger ? "Adicionar item oficial" : "Adicionar item pessoal"}
                    >
                      Novo item
                    </CommonButton>
                  </ToolbarItem>
                ) : null}
              </Toolbar>
            </div>

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

            {activeTab === "todos" ? (
              viewMode === "cards" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleOfficialItems.map((item) => renderOfficialCard(item))}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleOfficialItems.map((item) => renderOfficialListItem(item))}
                </div>
              )
            ) : null}
            {activeTab === "favoritos" ? (
              viewMode === "cards" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {favoriteItems.map((item) => renderOfficialCard(item))}
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteItems.map((item) => renderOfficialListItem(item))}
                </div>
              )
            ) : null}
            {activeTab === "meus-itens" ? (
              viewMode === "cards" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePersonalItems.map((item) => renderPersonalCard(item))}
                </div>
              ) : (
                <div className="space-y-3">
                  {visiblePersonalItems.map((item) => renderPersonalListItem(item))}
                </div>
              )
            ) : null}
          </section>
        </section>
      </div>

      <Drawer
        open={isOfficialDrawerOpen}
        onClose={() => {
          setIsOfficialDrawerOpen(false);
          setEditingOfficialItemId(null);
          setOfficialForm(defaultOfficialForm);
          resetOfficialAutoFillState();
        }}
        title={editingOfficialItemId ? "Editar item oficial" : "Novo item oficial"}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => {
            setIsOfficialDrawerOpen(false);
            setEditingOfficialItemId(null);
            setOfficialForm(defaultOfficialForm);
            resetOfficialAutoFillState();
          },
        }}
        primaryAction={{
          label: editingOfficialItemId ? "Salvar item oficial" : "Criar item oficial",
          onClick: () => {
            if (pendingAction === "official:submit") {
              return;
            }
            (document.getElementById("official-item-form") as HTMLFormElement | null)?.requestSubmit();
          },
        }}
      >
        <form id="official-item-form" onSubmit={submitOfficialForm} className="space-y-6">
          <DrawerSection title="Propriedades">
            <DrawerFieldRow label={propertyLabel(<Pencil aria-hidden="true" className="h-4 w-4" />, "Nome")} divider={false}>
              <input
                value={officialForm.name}
                onChange={(event) => {
                  markOfficialAutoFillFieldTouched("name");
                  setOfficialForm((current) => ({ ...current, name: event.target.value }));
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9aa3b8]"
                required
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ExternalLink aria-hidden="true" className="h-4 w-4" />, "Link")} divider={false}>
              <EditableLinkButtonField
                value={officialForm.purchaseUrl}
                onChange={handleOfficialPurchaseUrlChange}
                placeholder="https://..."
                required
              />
              {officialLinkPreview.isLoading || officialLinkPreview.error ? (
                <p
                  className={`mt-1.5 text-xs ${
                    officialLinkPreview.error ? "text-[#9a6b22]" : "text-[#68738a]"
                  }`}
                >
                  {officialLinkPreview.isLoading
                    ? "Buscando nome, imagem e preco..."
                    : officialLinkPreview.error}
                </p>
              ) : null}
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ImageIcon aria-hidden="true" className="h-4 w-4" />, "Imagem")} divider={false}>
              <EditableLinkButtonField
                value={officialForm.imageUrl}
                onChange={(value) => {
                  markOfficialAutoFillFieldTouched("imageUrl");
                  setOfficialForm((current) => ({ ...current, imageUrl: value }));
                }}
                placeholder="https://..."
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ShoppingCart aria-hidden="true" className="h-4 w-4" />, "Preco")} divider={false}>
              <input
                value={officialForm.price}
                onChange={(event) => {
                  markOfficialAutoFillFieldTouched("price");
                  setOfficialForm((current) => ({ ...current, price: event.target.value }));
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9aa3b8]"
                placeholder="149,90"
                required
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(renderCategoryIcon(officialForm.category, "h-4 w-4"), "Categoria")} divider={false}>
              <div className="max-w-[320px]">
                <Combobox
                  variant="embedded"
                  options={formCategoryOptions}
                  value={officialForm.category}
                  onChange={(value) =>
                    setOfficialForm((current) => ({ ...current, category: value ?? current.category }))
                  }
                  placeholder="Selecione uma categoria"
                  allowCustomValue
                  onCreateOption={appendCustomCategoryOption}
                />
              </div>
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<Flag aria-hidden="true" className="h-4 w-4" />, "Prioridade")} divider={false}>
              <div className="max-w-[280px]">
                <Combobox
                  variant="embedded"
                  options={priorityOptions}
                  value={officialForm.priority}
                  onChange={(value) =>
                    setOfficialForm((current) => ({
                      ...current,
                      priority: (value as WishlistItemPriority | null) ?? current.priority,
                    }))
                  }
                  placeholder="Selecione uma prioridade"
                />
              </div>
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<RotateCcw aria-hidden="true" className="h-4 w-4" />, "Compra recorrente")} divider={false}>
              <input
                type="checkbox"
                checked={isRecurringItem(officialForm.repurchaseState)}
                onChange={(event) =>
                  setOfficialForm((current) => ({
                    ...current,
                    repurchaseState: event.target.checked ? "precisa_recompra" : "nao_recompra",
                  }))
                }
                className="h-4 w-4 rounded border-[#b9c4d7] accent-[#3555d2]"
              />
            </DrawerFieldRow>
          </DrawerSection>
        </form>
      </Drawer>

      <Drawer
        open={isPersonalDrawerOpen}
        onClose={() => {
          setIsPersonalDrawerOpen(false);
          setEditingPersonalItemId(null);
          setPersonalForm(defaultPersonalForm);
          resetPersonalAutoFillState();
        }}
        title={editingPersonalItemId ? "Editar item pessoal" : "Novo item pessoal"}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => {
            setIsPersonalDrawerOpen(false);
            setEditingPersonalItemId(null);
            setPersonalForm(defaultPersonalForm);
            resetPersonalAutoFillState();
          },
        }}
        primaryAction={{
          label: editingPersonalItemId ? "Salvar item pessoal" : "Criar item pessoal",
          onClick: () => {
            if (pendingAction === "personal:submit") {
              return;
            }
            (document.getElementById("personal-item-form") as HTMLFormElement | null)?.requestSubmit();
          },
        }}
      >
        <form id="personal-item-form" onSubmit={submitPersonalForm} className="space-y-6">
          <DrawerSection title="Propriedades">
            <DrawerFieldRow label={propertyLabel(<Pencil aria-hidden="true" className="h-4 w-4" />, "Nome")} divider={false}>
              <input
                value={personalForm.name}
                onChange={(event) => {
                  markPersonalAutoFillFieldTouched("name");
                  setPersonalForm((current) => ({ ...current, name: event.target.value }));
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9aa3b8]"
                required
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ExternalLink aria-hidden="true" className="h-4 w-4" />, "Link")} divider={false}>
              <EditableLinkButtonField
                value={personalForm.purchaseUrl}
                onChange={handlePersonalPurchaseUrlChange}
                placeholder="https://..."
                required
              />
              {personalLinkPreview.isLoading || personalLinkPreview.error ? (
                <p
                  className={`mt-1.5 text-xs ${
                    personalLinkPreview.error ? "text-[#9a6b22]" : "text-[#68738a]"
                  }`}
                >
                  {personalLinkPreview.isLoading
                    ? "Buscando nome, imagem e preco..."
                    : personalLinkPreview.error}
                </p>
              ) : null}
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ImageIcon aria-hidden="true" className="h-4 w-4" />, "Imagem")} divider={false}>
              <EditableLinkButtonField
                value={personalForm.imageUrl}
                onChange={(value) => {
                  markPersonalAutoFillFieldTouched("imageUrl");
                  setPersonalForm((current) => ({ ...current, imageUrl: value }));
                }}
                placeholder="https://..."
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<ShoppingCart aria-hidden="true" className="h-4 w-4" />, "Preco")} divider={false}>
              <input
                value={personalForm.price}
                onChange={(event) => {
                  markPersonalAutoFillFieldTouched("price");
                  setPersonalForm((current) => ({ ...current, price: event.target.value }));
                }}
                className="h-10 w-full bg-transparent px-0 text-sm text-[#151b28] outline-none placeholder:text-[#9aa3b8]"
                placeholder="149,90"
                required
              />
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(renderCategoryIcon(personalForm.category, "h-4 w-4"), "Categoria")} divider={false}>
              <div className="max-w-[320px]">
                <Combobox
                  variant="embedded"
                  options={formCategoryOptions}
                  value={personalForm.category}
                  onChange={(value) =>
                    setPersonalForm((current) => ({ ...current, category: value ?? current.category }))
                  }
                  placeholder="Selecione uma categoria"
                  allowCustomValue
                  onCreateOption={appendCustomCategoryOption}
                />
              </div>
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<Flag aria-hidden="true" className="h-4 w-4" />, "Prioridade")} divider={false}>
              <div className="max-w-[280px]">
                <Combobox
                  variant="embedded"
                  options={priorityOptions}
                  value={personalForm.priority}
                  onChange={(value) =>
                    setPersonalForm((current) => ({
                      ...current,
                      priority: (value as WishlistItemPriority | null) ?? current.priority,
                    }))
                  }
                  placeholder="Selecione uma prioridade"
                />
              </div>
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<Eye aria-hidden="true" className="h-4 w-4" />, "Visibilidade")} divider={false}>
              <div className="flex flex-wrap gap-2">
                {(["private", "public"] as PersonalItemVisibility[]).map((visibility) => (
                  <Chip
                    key={visibility}
                    behavior="selectable"
                    selected={personalForm.visibility === visibility}
                    onClick={() => setPersonalForm((current) => ({ ...current, visibility }))}
                    label={visibility === "private" ? "Privado" : "Publico"}
                    type={personalForm.visibility === visibility ? "info" : "tertiary"}
                    surface="neutral"
                  />
                ))}
              </div>
            </DrawerFieldRow>
            <DrawerFieldRow label={propertyLabel(<RotateCcw aria-hidden="true" className="h-4 w-4" />, "Compra recorrente")} divider={false}>
              <input
                type="checkbox"
                checked={isRecurringItem(personalForm.repurchaseState)}
                onChange={(event) =>
                  setPersonalForm((current) => ({
                    ...current,
                    repurchaseState: event.target.checked ? "precisa_recompra" : "nao_recompra",
                  }))
                }
                className="h-4 w-4 rounded border-[#b9c4d7] accent-[#3555d2]"
              />
            </DrawerFieldRow>
          </DrawerSection>
        </form>
      </Drawer>
    </main>
  );
}
