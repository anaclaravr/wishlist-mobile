"use client";

import {
  FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BookOpen,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Filter,
  Flag,
  Grid2X2,
  Layers3,
  List,
  Loader2,
  Flame,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  CommonButton,
  IconButton,
  ListBox,
  MenuIconButton,
  SwitchButton,
  Toolbar,
  ToolbarItem,
} from "@/components/ui/button-system";
import { Chip } from "@/components/ui/chip";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Drawer, DrawerFieldRow, DrawerSection } from "@/components/ui/drawer";
import { RichTextEditor, type RichTextBlock } from "@/components/ui/rich-text-editor";
import { Tabs } from "@/components/ui/tabs";
import type { TaskPageSettings } from "@/lib/task-page-settings";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function propertyLabel(icon: ReactNode, label: string) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[#7a8398]">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

type AdminTaskStatus = "pending" | "in_progress" | "done";
type AdminTaskPriority = "low" | "medium" | "high" | null;
type AdminTaskCategory = string;
type PriorityFilter = "all" | "high" | "medium" | "low";
type DueFilter = "all" | "overdue" | "today" | "upcoming" | "none";
type SortMode = "updated_desc" | "due_asc" | "priority_desc";
type TaskTab = "all" | AdminTaskStatus;
type ViewMode = "board" | "list";
type FilterPanelKey = "priority" | "due";

type AdminTask = {
  id: string;
  title: string;
  notes: string | null;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: AdminTaskCategory;
  tags: string[];
  dueAt: string | null;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type TasksResponse = {
  tasks: AdminTask[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

type TaskForm = {
  title: string;
  notes: RichTextBlock[];
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: AdminTaskCategory;
  dueAt: string;
  tags: string[];
};

type FilterState = {
  priority: PriorityFilter;
  due: DueFilter;
};

const RICH_TEXT_NOTES_PREFIX = "__rich_text__:";

const defaultFilterState: FilterState = {
  priority: "all",
  due: "all",
};

const statusOptions: ComboboxOption[] = [
  {
    value: "pending",
    label: "Pendente",
    icon: <Circle aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "warning",
  },
  {
    value: "in_progress",
    label: "Em andamento",
    icon: <Loader2 aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "secondary",
  },
  {
    value: "done",
    label: "Concluida",
    icon: <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "success",
  },
];

const priorityOptions: ComboboxOption[] = [
  {
    value: "low",
    label: "Baixa",
    icon: <Minus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#6f7a95]" />,
    chipType: "tertiary",
    chipSurface: "filled",
  },
  {
    value: "medium",
    label: "Media",
    icon: <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#d2952c]" />,
    chipType: "warning",
    chipSurface: "filled",
  },
  {
    value: "high",
    label: "Alta",
    icon: <Flame aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#d65840]" />,
    chipType: "destructive",
    chipSurface: "filled",
  },
];

const defaultCategoryOptions: ComboboxOption[] = [
  {
    value: "trabalho",
    label: "Trabalho",
    icon: <Briefcase aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "info",
  },
  {
    value: "estudos",
    label: "Estudos",
    icon: <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "warning",
  },
  {
    value: "pessoal",
    label: "Pessoal",
    icon: <UserRound aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "secondary",
  },
];

function toDateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function toIsoFromDateInput(value: string) {
  if (!value.trim()) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

function formatCreatedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function dueStatus(dueAt: string | null) {
  if (!dueAt) return "none" as const;
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  if (dueDay < startToday) return "overdue" as const;
  if (dueDay === startToday) return "today" as const;
  return "future" as const;
}

function taskToForm(task: AdminTask): TaskForm {
  return {
    title: task.title,
    notes: deserializeTaskNotes(task.notes),
    status: task.status,
    priority: task.priority,
    category: task.category,
    dueAt: toDateInputValue(task.dueAt),
    tags: task.tags ?? [],
  };
}

function createEmptyNoteBlock(): RichTextBlock {
  return { id: `block-${crypto.randomUUID()}`, type: "paragraph", text: "" };
}

function createDefaultTaskForm(): TaskForm {
  return {
    title: "",
    notes: [createEmptyNoteBlock()],
    status: "pending",
    priority: null,
    category: "pessoal",
    dueAt: "",
    tags: [],
  };
}

function deserializeTaskNotes(value: string | null): RichTextBlock[] {
  const fallback = [createEmptyNoteBlock()];
  if (!value?.trim()) {
    return fallback;
  }

  if (value.startsWith(RICH_TEXT_NOTES_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(RICH_TEXT_NOTES_PREFIX.length)) as RichTextBlock[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return fallback;
      }
      return parsed.map((block) => ({
        id: typeof block.id === "string" && block.id ? block.id : `block-${crypto.randomUUID()}`,
        type: block.type,
        text: typeof block.text === "string" ? block.text : "",
      }));
    } catch {
      return fallback;
    }
  }

  return [
    {
      id: `block-${crypto.randomUUID()}`,
      type: "paragraph",
      text: value,
    },
  ];
}

function serializeTaskNotes(blocks: RichTextBlock[]) {
  const sanitized = blocks
    .map((block) => ({
      id: block.id || `block-${crypto.randomUUID()}`,
      type: block.type,
      text: block.text ?? "",
    }))
    .filter((block) => block.type === "divider" || block.text.trim().length > 0);

  if (sanitized.length === 0) {
    return null;
  }

  return `${RICH_TEXT_NOTES_PREFIX}${JSON.stringify(sanitized)}`;
}

function summarizeTaskNotes(value: string | null) {
  if (!value?.trim()) {
    return "";
  }

  const blocks = deserializeTaskNotes(value);
  return blocks
    .filter((block) => block.type !== "divider" && block.text.trim())
    .map((block) => block.type === "bullet" ? `• ${block.text.trim()}` : block.text.trim())
    .join(" ")
    .trim();
}

function priorityLabel(priority: AdminTaskPriority) {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  if (priority === "low") return "Baixa";
  return "Sem prioridade";
}

function categoryLabel(category: AdminTaskCategory) {
  if (category === "trabalho") return "Trabalho";
  if (category === "estudos") return "Estudos";
  if (category === "pessoal") return "Pessoal";
  return category;
}

function statusIcon(status: AdminTaskStatus, className = "h-4 w-4") {
  if (status === "pending") {
    return <Circle aria-hidden="true" className={className} />;
  }
  if (status === "in_progress") {
    return <Loader2 aria-hidden="true" className={className} />;
  }
  return <CheckCircle2 aria-hidden="true" className={className} />;
}

function priorityIcon(priority: AdminTaskPriority, className = "h-4 w-4") {
  if (!priority) {
    return <Flag aria-hidden="true" className={className} />;
  }
  return <Flag aria-hidden="true" className={className} />;
}

function categoryIcon(category: AdminTaskCategory, className = "h-4 w-4") {
  if (category === "trabalho") {
    return <Briefcase aria-hidden="true" className={className} />;
  }
  if (category === "estudos") {
    return <BookOpen aria-hidden="true" className={className} />;
  }
  if (category === "pessoal") {
    return <UserRound aria-hidden="true" className={className} />;
  }
  return <Tag aria-hidden="true" className={className} />;
}

function optionChipProps(options: ComboboxOption[], value: string) {
  const option = options.find((item) => item.value === value);

  return {
    type: option?.chipType ?? "tertiary",
    surface: option?.chipSurface ?? "neutral",
    icon: option?.icon,
  };
}

function priorityFilterIcon(priority: PriorityFilter) {
  if (priority === "all") {
    return <Layers3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />;
  }

  return (
    priorityOptions.find((option) => option.value === priority)?.icon ?? (
      <Flag aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a95]" />
    )
  );
}

function categoryOptionForValue(category: AdminTaskCategory): ComboboxOption {
  const defaultOption = defaultCategoryOptions.find((option) => option.value === category);
  if (defaultOption) {
    return defaultOption;
  }

  return {
    value: category,
    label: categoryLabel(category),
    icon: <Tag aria-hidden="true" className="h-3.5 w-3.5" />,
    chipType: "secondary",
    chipSurface: "neutral",
  };
}

function priorityChip(priority: AdminTaskPriority) {
  if (!priority) return null;
  const chip = optionChipProps(priorityOptions, priority);

  return (
    <Chip
      label={priorityLabel(priority)}
      size="sm"
      type={chip.type}
      surface={chip.surface}
      showIconLeft={Boolean(chip.icon)}
      iconLeft={chip.icon}
    />
  );
}

function dueChip(dueAt: string | null) {
  if (!dueAt) return null;
  const status = dueStatus(dueAt);
  return (
    <Chip
      label={status === "today" ? "Vence hoje" : status === "overdue" ? "Atrasada" : formatDueDate(dueAt)}
      size="sm"
      type={status === "overdue" ? "destructive" : status === "today" ? "warning" : "info"}
      surface="neutral"
      showIconLeft
      iconLeft={<CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />}
    />
  );
}

function categoryChip(category: AdminTaskCategory) {
  const option = categoryOptionForValue(category);
  const chip = optionChipProps([option], category);

  return (
    <Chip
      label={categoryLabel(category)}
      size="sm"
      type={chip.type}
      surface={chip.surface}
      showIconLeft={Boolean(chip.icon)}
      iconLeft={chip.icon}
    />
  );
}

function matchesFilters(task: AdminTask, filters: FilterState) {
  if (filters.priority !== "all" && task.priority !== filters.priority) {
    return false;
  }

  if (filters.due === "all") {
    return true;
  }

  const status = dueStatus(task.dueAt);
  if (filters.due === "upcoming") {
    return status === "future";
  }
  if (filters.due === "none") {
    return status === "none";
  }
  return status === filters.due;
}

function isInteractiveTaskTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("[data-task-interactive], a, button, input, select, textarea, label"))
    : false;
}

export function AdminTasksBoard({
  initialData,
  settings,
}: {
  initialData: TasksResponse;
  settings: TaskPageSettings;
}) {
  const [tasks, setTasks] = useState(initialData.tasks);
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(defaultFilterState);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilterState);
  const [activeFilterPanel, setActiveFilterPanel] = useState<FilterPanelKey | null>(null);
  const [activeFilterPanelOffset, setActiveFilterPanelOffset] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [activeTab, setActiveTab] = useState<TaskTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [page, setPage] = useState(initialData.pagination.page);
  const [totalPages, setTotalPages] = useState(initialData.pagination.totalPages);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(createDefaultTaskForm);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo<ComboboxOption[]>(() => {
    const defaults = new Map(defaultCategoryOptions.map((option) => [option.value, option]));
    const values = new Set([
      ...defaultCategoryOptions.map((option) => option.value),
      ...tasks.map((task) => task.category).filter(Boolean),
      form.category,
    ]);

    return Array.from(values)
      .filter(Boolean)
      .sort((left, right) => {
        const leftDefaultIndex = defaultCategoryOptions.findIndex((option) => option.value === left);
        const rightDefaultIndex = defaultCategoryOptions.findIndex((option) => option.value === right);

        if (leftDefaultIndex >= 0 || rightDefaultIndex >= 0) {
          return (leftDefaultIndex >= 0 ? leftDefaultIndex : Number.MAX_SAFE_INTEGER) -
            (rightDefaultIndex >= 0 ? rightDefaultIndex : Number.MAX_SAFE_INTEGER);
        }

        return categoryLabel(left).localeCompare(categoryLabel(right), "pt-BR");
      })
      .map((category) => defaults.get(category) ?? categoryOptionForValue(category));
  }, [form.category, tasks]);

  const tagOptions = useMemo<ComboboxOption[]>(
    () =>
      Array.from(new Set(tasks.flatMap((task) => task.tags)))
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => ({
          value: tag,
          label: tag,
          icon: <Tag aria-hidden="true" className="h-3.5 w-3.5" />,
          chipType: "tertiary",
        })),
    [tasks],
  );

  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => matchesFilters(task, appliedFilters));

    const priorityWeight: Record<Exclude<AdminTaskPriority, null>, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...filtered].sort((a, b) => {
      if (sortMode === "priority_desc") {
        return (priorityWeight[b.priority ?? "low"] ?? 0) - (priorityWeight[a.priority ?? "low"] ?? 0);
      }

      if (sortMode === "due_asc") {
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) {
          return aDue - bDue;
        }
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [appliedFilters, sortMode, tasks]);

  const groupedTasks = useMemo(
    () => ({
      pending: filteredAndSortedTasks.filter((task) => task.status === "pending"),
      in_progress: filteredAndSortedTasks.filter((task) => task.status === "in_progress"),
      done: filteredAndSortedTasks.filter((task) => task.status === "done"),
    }),
    [filteredAndSortedTasks],
  );

  const visibleTasks = useMemo(() => {
    if (activeTab === "all") {
      return filteredAndSortedTasks;
    }
    return groupedTasks[activeTab];
  }, [activeTab, filteredAndSortedTasks, groupedTasks]);

  const priorityCounts = useMemo(
    () => ({
      all: tasks.length,
      high: tasks.filter((task) => task.priority === "high").length,
      medium: tasks.filter((task) => task.priority === "medium").length,
      low: tasks.filter((task) => task.priority === "low").length,
    }),
    [tasks],
  );

  const dueCounts = useMemo(
    () => ({
      all: tasks.length,
      overdue: tasks.filter((task) => dueStatus(task.dueAt) === "overdue").length,
      today: tasks.filter((task) => dueStatus(task.dueAt) === "today").length,
      upcoming: tasks.filter((task) => dueStatus(task.dueAt) === "future").length,
      none: tasks.filter((task) => dueStatus(task.dueAt) === "none").length,
    }),
    [tasks],
  );

  const hasAppliedFilters =
    appliedFilters.priority !== defaultFilterState.priority || appliedFilters.due !== defaultFilterState.due;
  const hasDraftFilters =
    draftFilters.priority !== defaultFilterState.priority || draftFilters.due !== defaultFilterState.due;
  const hasPendingFilterChanges =
    draftFilters.priority !== appliedFilters.priority || draftFilters.due !== appliedFilters.due;
  const activeFilterCount =
    Number(appliedFilters.priority !== defaultFilterState.priority) +
    Number(appliedFilters.due !== defaultFilterState.due);

  useEffect(() => {
    if (!isFilterPopoverOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!filterPopoverRef.current || filterPopoverRef.current.contains(event.target as Node)) {
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
      if (!sortPopoverRef.current || sortPopoverRef.current.contains(event.target as Node)) {
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

  async function loadTasks(nextPage: number, nextQuery = query) {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(settings.defaultPageSize),
        filter: "all",
        q: nextQuery.trim(),
      });
      const response = await fetch(`/api/admin/tasks?${params.toString()}`);
      const result = (await response.json()) as TasksResponse & { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Nao foi possivel carregar tarefas.");
      }
      setTasks(result.tasks ?? []);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  function captureOpener() {
    if (document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
  }

  function openCreate(initialStatus?: AdminTaskStatus) {
    captureOpener();
    setEditingTaskId(null);
    setForm({ ...createDefaultTaskForm(), status: initialStatus ?? "pending" });
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEdit(task: AdminTask) {
    captureOpener();
    setEditingTaskId(task.id);
    setForm(taskToForm(task));
    setError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingTaskId(null);
    setForm(createDefaultTaskForm());
    openerRef.current?.focus();
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("Informe um titulo para a tarefa.");
      return;
    }
    if (pendingAction === "save") {
      return;
    }

    setPendingAction("save");
    setError(null);
    setMessage(null);

    try {
      const payload = {
        title,
        notes: serializeTaskNotes(form.notes),
        status: form.status,
        priority: form.priority,
        category: form.category,
        tags: form.tags,
        dueAt: toIsoFromDateInput(form.dueAt),
      };
      const response = await fetch(editingTaskId ? `/api/admin/tasks/${editingTaskId}` : "/api/admin/tasks", {
        method: editingTaskId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { task?: AdminTask; error?: string };
      if (!response.ok || !result.task) {
        throw new Error(result.error ?? "Nao foi possivel salvar a tarefa.");
      }

      setMessage(editingTaskId ? "Tarefa atualizada." : "Tarefa criada.");
      closeDrawer();
      await loadTasks(1, query);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function setTaskStatus(task: AdminTask, status: AdminTaskStatus) {
    if (task.status === status || pendingAction === `status:${task.id}`) {
      return;
    }

    setPendingAction(`status:${task.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { task?: AdminTask; error?: string };
      if (!response.ok || !result.task) {
        throw new Error(result.error ?? "Nao foi possivel atualizar o status.");
      }
      setTasks((current) => current.map((item) => (item.id === task.id ? result.task! : item)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteTask(task: AdminTask) {
    if (pendingAction === `delete:${task.id}`) {
      return;
    }
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) {
      return;
    }

    setPendingAction(`delete:${task.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Nao foi possivel excluir a tarefa.");
      }
      setMessage("Tarefa excluida.");
      await loadTasks(1, query);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchDraft.trim();
    setQuery(nextQuery);
    await loadTasks(1, nextQuery);
  }

  async function resetSearch() {
    setSearchDraft("");
    setQuery("");
    await loadTasks(1, "");
  }

  async function onDropToColumn(status: AdminTaskStatus) {
    if (!draggingTaskId) return;
    const task = tasks.find((item) => item.id === draggingTaskId);
    setDraggingTaskId(null);
    if (!task || task.status === status) return;
    await setTaskStatus(task, status);
  }

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
    setAppliedFilters(draftFilters);
    setIsFilterPopoverOpen(false);
  }

  function resetDraftFilters() {
    setDraftFilters(defaultFilterState);
  }

  function selectSortMode(nextSortMode: SortMode) {
    setSortMode(nextSortMode);
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

  function renderTags(tags: string[]) {
    return tags.map((tag) => (
      <Chip
        key={tag}
        label={tag}
        size="sm"
        type="tertiary"
        surface="neutral"
        showIconLeft
        iconLeft={<Tag aria-hidden="true" className="h-3.5 w-3.5" />}
      />
    ));
  }

  function renderTaskMenu(task: AdminTask) {
    return [
      {
        id: `edit:${task.id}`,
        label: "Editar",
        icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
        onSelect: () => openEdit(task),
      },
      ...(task.status !== "pending"
        ? [
            {
              id: `move-pending:${task.id}`,
              label: "Mover para Pendente",
              icon: <Circle aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => void setTaskStatus(task, "pending"),
            },
          ]
        : []),
      ...(task.status !== "in_progress"
        ? [
            {
              id: `move-progress:${task.id}`,
              label: "Mover para Em andamento",
              icon: <Loader2 aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => void setTaskStatus(task, "in_progress"),
            },
          ]
        : []),
      ...(task.status !== "done"
        ? [
            {
              id: `move-done:${task.id}`,
              label: "Mover para Concluida",
              icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" />,
              onSelect: () => void setTaskStatus(task, "done"),
            },
          ]
        : []),
      {
        id: `delete:${task.id}`,
        label: "Excluir",
        icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
        separatorBefore: true,
        danger: true,
        onSelect: () => void deleteTask(task),
      },
    ];
  }

  function renderTaskCard(task: AdminTask) {
    const isStatusPending = pendingAction === `status:${task.id}`;
    const notesSummary = summarizeTaskNotes(task.notes);

    return (
      <article
        key={task.id}
        draggable
        onDragStart={() => setDraggingTaskId(task.id)}
        onDragEnd={() => setDraggingTaskId(null)}
        onClick={(event) => {
          if (isInteractiveTaskTarget(event.target)) {
            return;
          }
          openEdit(task);
        }}
        className={cx(
          "group flex cursor-pointer flex-col gap-3 rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)] transition hover:border-[#c8d3e6]",
          draggingTaskId === task.id && "border-[#93a6d3] opacity-75",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h3 className={cx("text-[1.15rem] leading-7 text-[#141a27]", task.status === "done" && "text-[#7e8798] line-through")}>
              {task.title || "Sem titulo"}
            </h3>
            <div className="inline-flex items-center gap-2 text-sm text-[#6f7890]">
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              <span>{task.dueAt ? formatDueDate(task.dueAt) : formatCreatedDate(task.createdAt)}</span>
            </div>
          </div>

          <div className="-m-2 shrink-0 p-2" data-task-interactive>
            <MenuIconButton
              ariaLabel={`Abrir acoes de ${task.title || "tarefa"}`}
              tooltip
              dropdown={false}
              buttonClassName="h-10 w-10 rounded-[10px]"
              items={renderTaskMenu(task)}
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </MenuIconButton>
          </div>
        </div>

        {notesSummary ? <p className="line-clamp-3 text-sm leading-6 text-[#69718a]">{notesSummary}</p> : null}

        <div className="flex flex-wrap gap-2">
          {priorityChip(task.priority)}
          {categoryChip(task.category)}
          {dueChip(task.dueAt)}
          {settings.showTags ? renderTags(task.tags.slice(0, 2)) : null}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-[#edf1f7] pt-3">
          <CommonButton
            type="button"
            onClick={() => void setTaskStatus(task, task.status === "done" ? "pending" : "done")}
            variant="secondary"
            usage={task.status === "done" ? "general" : "info"}
            showIconLeft
            iconLeft={
              isStatusPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : task.status === "done" ? (
                <Circle aria-hidden="true" className="h-4 w-4" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              )
            }
            className="h-10 flex-1 justify-center"
            title={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
            data-task-interactive
          >
            {task.status === "done" ? "Reabrir" : "Concluir"}
          </CommonButton>
        </div>
      </article>
    );
  }

  function renderTaskListItem(task: AdminTask) {
    const isStatusPending = pendingAction === `status:${task.id}`;
    const notesSummary = summarizeTaskNotes(task.notes);

    return (
      <article
        key={task.id}
        onClick={(event) => {
          if (isInteractiveTaskTarget(event.target)) {
            return;
          }
          openEdit(task);
        }}
        className="group flex cursor-pointer flex-col gap-3 rounded-[24px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)] transition hover:border-[#c8d3e6] sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <h3 className={cx("text-[1.15rem] leading-7 text-[#141a27]", task.status === "done" && "text-[#7e8798] line-through")}>
              {task.title || "Sem titulo"}
            </h3>
            <div className="inline-flex items-center gap-2 text-sm text-[#6f7890]">
              <CalendarClock aria-hidden="true" className="h-4 w-4" />
              <span>{task.dueAt ? formatDueDate(task.dueAt) : formatCreatedDate(task.createdAt)}</span>
            </div>
          </div>

          {notesSummary ? <p className="line-clamp-2 text-sm leading-6 text-[#69718a]">{notesSummary}</p> : null}

          <div className="flex flex-wrap gap-2">
            {priorityChip(task.priority)}
            {categoryChip(task.category)}
            {dueChip(task.dueAt)}
            {settings.showTags ? renderTags(task.tags) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" data-task-interactive>
          <CommonButton
            type="button"
            onClick={() => void setTaskStatus(task, task.status === "done" ? "pending" : "done")}
            variant="secondary"
            usage={task.status === "done" ? "general" : "info"}
            showIconLeft
            iconLeft={
              isStatusPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : task.status === "done" ? (
                <Circle aria-hidden="true" className="h-4 w-4" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              )
            }
            className="h-10 whitespace-nowrap px-4"
            title={task.status === "done" ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
          >
            {task.status === "done" ? "Reabrir" : "Concluir"}
          </CommonButton>

          <MenuIconButton
            ariaLabel={`Abrir acoes de ${task.title || "tarefa"}`}
            tooltip
            dropdown={false}
            buttonClassName="h-10 w-10 rounded-[10px]"
            items={renderTaskMenu(task)}
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </MenuIconButton>
        </div>
      </article>
    );
  }

  const filterSections = [
    {
      id: "priority" as const,
      label: "Prioridade",
      icon: <Flag aria-hidden="true" className="h-5 w-5" />,
      selectedCount: appliedFilters.priority === "all" ? 0 : 1,
    },
    {
      id: "due" as const,
      label: "Prazo",
      icon: <CalendarClock aria-hidden="true" className="h-5 w-5" />,
      selectedCount: appliedFilters.due === "all" ? 0 : 1,
    },
  ];

  const activeFilterOptions = useMemo(() => {
    if (activeFilterPanel === "priority") {
      return [
        {
          id: "all",
          label: "Todas",
          selected: draftFilters.priority === "all",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "all" })),
          count: priorityCounts.all,
          icon: priorityFilterIcon("all"),
        },
        {
          id: "high",
          label: "Alta",
          selected: draftFilters.priority === "high",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "high" })),
          count: priorityCounts.high,
          icon: priorityFilterIcon("high"),
        },
        {
          id: "medium",
          label: "Media",
          selected: draftFilters.priority === "medium",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "medium" })),
          count: priorityCounts.medium,
          icon: priorityFilterIcon("medium"),
        },
        {
          id: "low",
          label: "Baixa",
          selected: draftFilters.priority === "low",
          onSelect: () => setDraftFilters((current) => ({ ...current, priority: "low" })),
          count: priorityCounts.low,
          icon: priorityFilterIcon("low"),
        },
      ];
    }

    if (activeFilterPanel === "due") {
      return [
        {
          id: "all",
          label: "Todos",
          selected: draftFilters.due === "all",
          onSelect: () => setDraftFilters((current) => ({ ...current, due: "all" })),
          count: dueCounts.all,
          icon: <Layers3 aria-hidden="true" className="h-4 w-4" />,
        },
        {
          id: "overdue",
          label: "Atrasadas",
          selected: draftFilters.due === "overdue",
          onSelect: () => setDraftFilters((current) => ({ ...current, due: "overdue" })),
          count: dueCounts.overdue,
          icon: <CalendarClock aria-hidden="true" className="h-4 w-4" />,
        },
        {
          id: "today",
          label: "Vencem hoje",
          selected: draftFilters.due === "today",
          onSelect: () => setDraftFilters((current) => ({ ...current, due: "today" })),
          count: dueCounts.today,
          icon: <CalendarClock aria-hidden="true" className="h-4 w-4" />,
        },
        {
          id: "upcoming",
          label: "Proximas",
          selected: draftFilters.due === "upcoming",
          onSelect: () => setDraftFilters((current) => ({ ...current, due: "upcoming" })),
          count: dueCounts.upcoming,
          icon: <CalendarClock aria-hidden="true" className="h-4 w-4" />,
        },
        {
          id: "none",
          label: "Sem prazo",
          selected: draftFilters.due === "none",
          onSelect: () => setDraftFilters((current) => ({ ...current, due: "none" })),
          count: dueCounts.none,
          icon: <CalendarClock aria-hidden="true" className="h-4 w-4" />,
        },
      ];
    }

    return [];
  }, [activeFilterPanel, draftFilters.due, draftFilters.priority, dueCounts, priorityCounts]);

  const filterSectionListItems = filterSections.map((section) => ({
    id: section.id,
    label: section.label,
    icon: section.icon,
    selected: section.id === activeFilterPanel,
    count: section.selectedCount || undefined,
    endIcon: <ChevronRight aria-hidden="true" className="h-4 w-4" />,
    onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => selectFilterPanel(section.id, event.currentTarget),
  }));

  const activeFilterListItems = activeFilterOptions.map((option) => ({
    id: option.id,
    label: option.label,
    icon: option.icon,
    count: option.count,
    selected: option.selected,
    onSelect: () => option.onSelect(),
  }));

  const sortListItems = [
    {
      id: "updated_desc",
      label: "Atualizadas recentemente",
      selected: sortMode === "updated_desc",
      onSelect: () => selectSortMode("updated_desc"),
    },
    {
      id: "due_asc",
      label: "Vencimento proximo",
      selected: sortMode === "due_asc",
      onSelect: () => selectSortMode("due_asc"),
    },
    {
      id: "priority_desc",
      label: "Maior prioridade",
      selected: sortMode === "priority_desc",
      onSelect: () => selectSortMode("priority_desc"),
    },
  ];

  const boardColumns =
    activeTab === "all"
      ? [
          { status: "pending" as const, label: settings.columnLabels.pending, tasks: groupedTasks.pending },
          { status: "in_progress" as const, label: settings.columnLabels.inProgress, tasks: groupedTasks.in_progress },
          { status: "done" as const, label: settings.columnLabels.done, tasks: groupedTasks.done },
        ]
      : [
          {
            status: activeTab,
            label:
              activeTab === "pending"
                ? settings.columnLabels.pending
                : activeTab === "in_progress"
                  ? settings.columnLabels.inProgress
                  : settings.columnLabels.done,
            tasks: groupedTasks[activeTab],
          },
        ];

  return (
    <section className="space-y-3">
      <Tabs<TaskTab>
        value={activeTab}
        onChange={setActiveTab}
        items={[
          {
            id: "all",
            label: "Todas",
            count: filteredAndSortedTasks.length,
            icon: <Layers3 aria-hidden="true" className="h-5 w-5" />,
          },
          {
            id: "pending",
            label: settings.columnLabels.pending,
            count: groupedTasks.pending.length,
            icon: <Circle aria-hidden="true" className="h-5 w-5" />,
          },
          {
            id: "in_progress",
            label: settings.columnLabels.inProgress,
            count: groupedTasks.in_progress.length,
            icon: <Loader2 aria-hidden="true" className="h-5 w-5" />,
          },
          {
            id: "done",
            label: settings.columnLabels.done,
            count: groupedTasks.done.length,
            icon: <CheckCircle2 aria-hidden="true" className="h-5 w-5" />,
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SwitchButton<ViewMode>
          items={[
            {
              value: "board",
              label: "",
              ariaLabel: "Visualizacao em board",
              icon: <Grid2X2 aria-hidden="true" className="h-4 w-4" />,
            },
            {
              value: "list",
              label: "",
              ariaLabel: "Visualizacao em lista",
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
                <Filter aria-hidden="true" className={cx("h-[18px] w-[18px]", hasAppliedFilters && "fill-current")} />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f9cf5a] ring-2 ring-[#f8f9fd]" />
                ) : null}
              </span>
            </IconButton>

            {isFilterPopoverOpen ? (
              <div
                data-filter-popover
                className="absolute left-0 top-[3.15rem] z-30 w-[min(350px,calc(100vw-2rem))] rounded-[24px] border border-[#d7ddea] bg-white shadow-[0_24px_50px_rgba(20,28,45,0.18)] sm:left-auto sm:right-0"
              >
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
                    ariaLabel="Filtros de tarefas"
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

                {activeFilterPanel ? (
                  <div
                    className="mt-2 border-t border-[#eceff6] px-4 pb-4 pt-3 md:absolute md:left-full md:mt-0 md:ml-3 md:w-[280px] md:rounded-[20px] md:border md:border-[#d7ddea] md:bg-white md:p-2 md:shadow-[0_16px_35px_rgba(20,28,45,0.15)]"
                    style={activeFilterPanelOffset === null ? undefined : { top: activeFilterPanelOffset }}
                  >
                    <ListBox items={activeFilterListItems} ariaLabel="Opcoes do filtro de tarefas" />
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
                variant={sortMode !== "updated_desc" ? "info" : "secondary"}
                selected={sortMode !== "updated_desc"}
                aria-label="Abrir ordenacao"
                title="Abrir ordenacao"
              >
                <ArrowDownUp aria-hidden="true" className="h-[18px] w-[18px]" />
              </IconButton>

              {isSortPopoverOpen ? (
                <div className="absolute left-0 top-[3.15rem] z-30 w-[240px] rounded-[16px] border border-[#d7ddea] bg-white p-2 shadow-[var(--ds-shadow-soft)] sm:left-auto sm:right-0">
                  <ListBox items={sortListItems} ariaLabel="Ordenacao de tarefas" />
                </div>
              ) : null}
            </div>
          </ToolbarItem>

          <ToolbarItem
            className={`h-10 overflow-hidden rounded-[10px] border transition-[width,border-color,background-color] duration-300 ${
              isSearchOpen ? "w-[min(20rem,calc(100vw-7rem))] border-transparent bg-transparent" : "w-10 border-transparent bg-transparent"
            }`}
          >
            <form onSubmit={handleSearchSubmit} className="flex h-full w-full items-center">
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
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar tarefas"
                className={`h-full min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[#131823] outline-none placeholder:text-[#9aa3b8] transition-opacity duration-200 ${
                  isSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              />
              {isSearchOpen && searchDraft ? (
                <button
                  type="button"
                  onClick={() => void resetSearch()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#69718a] transition hover:bg-[#f2f5fb] hover:text-[#1f2b46]"
                  aria-label="Limpar busca"
                  title="Limpar busca"
                >
                  <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
                </button>
              ) : null}
            </form>
          </ToolbarItem>

          <ToolbarItem>
            <CommonButton
              type="button"
              onClick={() => openCreate()}
              variant="primary"
              usage="info"
              showIconLeft
              iconLeft={<Plus aria-hidden="true" className="h-4 w-4" />}
              className="h-10 whitespace-nowrap px-3"
              title="Adicionar tarefa"
            >
              Nova tarefa
            </CommonButton>
          </ToolbarItem>
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

      {isLoading ? (
        <div className="rounded-[24px] border border-[#dbe1ed] bg-white px-4 py-8 text-center text-sm text-[#667086]">
          Carregando tarefas...
        </div>
      ) : filteredAndSortedTasks.length === 0 ? (
        <div className="rounded-[24px] border border-[#dbe1ed] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#1f2b46]">Nenhuma tarefa encontrada.</p>
          <p className="mt-1 text-sm text-[#6d768d]">Ajuste a busca, os filtros ou crie uma nova tarefa.</p>
        </div>
      ) : viewMode === "board" ? (
        <div className={cx("grid gap-4", boardColumns.length === 1 ? "grid-cols-1" : "lg:grid-cols-3 lg:items-start")}>
          {boardColumns.map((column) => (
            <section
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void onDropToColumn(column.status)}
              className="rounded-[28px] border border-[#dde3ef] bg-[#f5f7fb] p-3"
            >
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className="text-[#7c86a0]">{statusIcon(column.status, "h-4 w-4")}</span>
                <h4 className="text-[1rem] text-[#20293d]">{column.label}</h4>
                <span className="text-sm text-[#7d869b]">{column.tasks.length}</span>
                <IconButton
                  type="button"
                  onClick={() => openCreate(column.status)}
                  className="ml-auto h-9 w-9 rounded-[10px]"
                  variant="secondary"
                  aria-label={`Adicionar tarefa em ${column.label}`}
                  title={`Adicionar tarefa em ${column.label}`}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </header>

              <div className="space-y-3">
                {column.tasks.length === 0 ? (
                  <div className="rounded-[20px] bg-white px-4 py-4 text-sm text-[#7b849a]">
                    Nenhuma tarefa nesta etapa.
                  </div>
                ) : (
                  column.tasks.map((task) => renderTaskCard(task))
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">{visibleTasks.map((task) => renderTaskListItem(task))}</div>
      )}

      {page < totalPages ? (
        <div className="flex items-center justify-center py-1">
          <CommonButton
            type="button"
            onClick={() => void loadTasks(page + 1, query)}
            variant="secondary"
            usage="general"
            showIconLeft
            iconLeft={isLoading ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}
            className="h-10 px-4 text-sm"
            title="Carregar mais tarefas"
          >
            {isLoading ? "Carregando..." : "Carregar mais"}
          </CommonButton>
        </div>
      ) : null}

      <Drawer
        open={isDrawerOpen}
        onClose={closeDrawer}
        title={form.title}
        onTitleChange={(value) => setForm((current) => ({ ...current, title: value }))}
        secondaryAction={{ label: "Cancelar", onClick: closeDrawer }}
        primaryAction={{
          label: pendingAction === "save" ? "Salvando..." : "Salvar",
          onClick: () => {
            if (pendingAction === "save") {
              return;
            }
            (document.getElementById("admin-task-form") as HTMLFormElement | null)?.requestSubmit();
          },
        }}
      >
        <form id="admin-task-form" onSubmit={saveTask} className="space-y-6">
          <DrawerSection title="Propriedades">
            <DrawerFieldRow label={propertyLabel(statusIcon(form.status, "h-4 w-4"), "Status")} divider={false}>
              <Combobox
                options={statusOptions}
                value={form.status}
                onChange={(value) => {
                  if (!value) return;
                  setForm((current) => ({ ...current, status: value as AdminTaskStatus }));
                }}
                variant="embedded"
              />
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(priorityIcon(form.priority, "h-4 w-4"), "Prioridade")} divider={false}>
              <Combobox
                options={priorityOptions}
                value={form.priority}
                onChange={(value) => setForm((current) => ({ ...current, priority: (value as AdminTaskPriority) ?? null }))}
                variant="embedded"
                placeholder="Selecionar prioridade"
              />
            </DrawerFieldRow>

            <DrawerFieldRow label={propertyLabel(categoryIcon(form.category, "h-4 w-4"), "Categoria")} divider={false}>
              <Combobox
                options={categoryOptions}
                value={form.category}
                onChange={(value) => {
                  if (!value) return;
                  setForm((current) => ({ ...current, category: value.trim() || current.category }));
                }}
                variant="embedded"
                allowCustomValue
                customValueLabel="Criar categoria"
              />
            </DrawerFieldRow>

            {settings.showDueDate ? (
              <DrawerFieldRow
                label={propertyLabel(<CalendarClock aria-hidden="true" className="h-4 w-4" />, "Data de vencimento")}
                divider={false}
              >
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                  className="h-10 w-full max-w-[220px] bg-transparent px-0 text-sm text-[#151b28] outline-none"
                />
              </DrawerFieldRow>
            ) : null}

            {settings.showTags ? (
              <DrawerFieldRow label={propertyLabel(<Tag aria-hidden="true" className="h-4 w-4" />, "Tags")} divider={false}>
                <Combobox
                  selectionMode="multiple"
                  options={tagOptions}
                  value={form.tags}
                  onChange={(value) => setForm((current) => ({ ...current, tags: value }))}
                  variant="embedded"
                  placeholder="Adicionar tag"
                  allowCustomValue
                  customValueLabel="Criar tag"
                />
              </DrawerFieldRow>
            ) : null}
          </DrawerSection>

          <div className="border-t border-[#edf1f7] pt-6">
            <DrawerSection title="Descricao">
              <RichTextEditor
                value={form.notes}
                onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                className="min-h-[220px]"
              />
            </DrawerSection>
          </div>
        </form>
      </Drawer>
    </section>
  );
}
