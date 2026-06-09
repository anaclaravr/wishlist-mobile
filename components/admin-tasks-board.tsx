"use client";

import {
  FormEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
type SortMode = "manual" | "updated_desc" | "due_asc" | "priority_desc";
type TaskTab = "all" | AdminTaskStatus;
type ViewMode = "board" | "list";
type FilterPanelKey = "priority" | "due";
type DrawerMode = "task" | "subtask";
type DragMode = "pointer" | "keyboard";

type DropTarget = {
  status: AdminTaskStatus;
  beforeId: string | null;
  afterId: string | null;
};

type AdminTask = {
  id: string;
  title: string;
  notes: string | null;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: AdminTaskCategory;
  tags: string[];
  dueAt: string | null;
  sortOrder: number;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type TaskSubtask = {
  id: string;
  title: string;
  notes: RichTextBlock[];
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: AdminTaskCategory;
  tags: string[];
  dueAt: string | null;
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
  subtasks: TaskSubtask[];
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
const TASK_NOTES_VERSION = 2;

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
  const content = deserializeTaskContent(task.notes);

  return {
    title: task.title,
    notes: content.blocks,
    subtasks: content.subtasks,
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
    subtasks: [],
    status: "pending",
    priority: null,
    category: "pessoal",
    dueAt: "",
    tags: [],
  };
}

function createEmptySubtask(category: AdminTaskCategory): TaskSubtask {
  const now = new Date().toISOString();
  return {
    id: `subtask-${crypto.randomUUID()}`,
    title: "",
    notes: [createEmptyNoteBlock()],
    status: "pending",
    priority: null,
    category,
    tags: [],
    dueAt: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

function isRichTextBlockType(value: unknown): value is RichTextBlock["type"] {
  return value === "paragraph" || value === "h1" || value === "h2" || value === "h3" || value === "bullet" || value === "checklist" || value === "divider";
}

function normalizeRichTextBlocks(value: unknown): RichTextBlock[] {
  const fallback = [createEmptyNoteBlock()];
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  const blocks = value
    .map<RichTextBlock | null>((block) => {
      if (!block || typeof block !== "object") {
        return null;
      }
      const candidate = block as Partial<RichTextBlock>;
      const normalizedBlock: RichTextBlock = {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : `block-${crypto.randomUUID()}`,
        type: isRichTextBlockType(candidate.type) ? candidate.type : "paragraph",
        text: typeof candidate.text === "string" ? candidate.text : "",
      };
      if (normalizedBlock.type === "checklist") {
        normalizedBlock.checked = Boolean(candidate.checked);
      }
      return normalizedBlock;
    })
    .filter((block): block is RichTextBlock => Boolean(block));

  return blocks.length ? blocks : fallback;
}

function normalizeSubtasks(value: unknown): TaskSubtask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((subtask) => {
      if (!subtask || typeof subtask !== "object") {
        return null;
      }
      const candidate = subtask as Partial<TaskSubtask>;
      const title = typeof candidate.title === "string" ? candidate.title : "";
      const status = normalizeTaskStatus(
        typeof candidate.status === "string" ? candidate.status : (subtask as { completed?: unknown }).completed ? "done" : "pending",
      );
      const now = new Date().toISOString();
      return {
        id: typeof candidate.id === "string" && candidate.id ? candidate.id : `subtask-${crypto.randomUUID()}`,
        title,
        notes: normalizeRichTextBlocks(candidate.notes),
        status,
        priority: normalizeTaskPriority(candidate.priority),
        category: normalizeTaskCategory(candidate.category),
        tags: Array.isArray(candidate.tags) ? candidate.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
        dueAt: typeof candidate.dueAt === "string" && candidate.dueAt ? candidate.dueAt : null,
        createdAt: typeof candidate.createdAt === "string" && candidate.createdAt ? candidate.createdAt : now,
        updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt ? candidate.updatedAt : now,
        completedAt:
          typeof candidate.completedAt === "string" && candidate.completedAt
            ? candidate.completedAt
            : status === "done"
              ? now
              : null,
      };
    })
    .filter((subtask): subtask is TaskSubtask => Boolean(subtask));
}

function deserializeTaskContent(value: string | null): { blocks: RichTextBlock[]; subtasks: TaskSubtask[] } {
  const fallback = { blocks: [createEmptyNoteBlock()], subtasks: [] };
  if (!value?.trim()) {
    return fallback;
  }

  if (value.startsWith(RICH_TEXT_NOTES_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(RICH_TEXT_NOTES_PREFIX.length)) as unknown;
      if (Array.isArray(parsed)) {
        return { blocks: normalizeRichTextBlocks(parsed), subtasks: [] };
      }
      if (parsed && typeof parsed === "object") {
        const content = parsed as { blocks?: unknown; subtasks?: unknown };
        return {
          blocks: normalizeRichTextBlocks(content.blocks),
          subtasks: normalizeSubtasks(content.subtasks),
        };
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  return {
    blocks: [
      {
        id: `block-${crypto.randomUUID()}`,
        type: "paragraph",
        text: value,
      },
    ],
    subtasks: [],
  };
}

function deserializeTaskSubtasks(value: string | null): TaskSubtask[] {
  return deserializeTaskContent(value).subtasks;
}

function sanitizeTaskNotes(blocks: RichTextBlock[]) {
  return blocks
    .map((block) => ({
      id: block.id || `block-${crypto.randomUUID()}`,
      type: block.type,
      text: block.text ?? "",
      checked: block.type === "checklist" ? Boolean(block.checked) : undefined,
    }))
    .filter((block) => block.type === "divider" || block.text.trim().length > 0);
}

function sanitizeSubtasks(subtasks: TaskSubtask[]) {
  return subtasks
    .map((subtask) => ({
      id: subtask.id || `subtask-${crypto.randomUUID()}`,
      title: subtask.title.trim(),
      notes: sanitizeTaskNotes(subtask.notes),
      status: subtask.status,
      priority: subtask.priority,
      category: subtask.category.trim() || "pessoal",
      tags: subtask.tags.map((tag) => tag.trim()).filter(Boolean),
      dueAt: subtask.dueAt,
      createdAt: subtask.createdAt,
      updatedAt: subtask.updatedAt,
      completedAt: subtask.status === "done" ? subtask.completedAt ?? subtask.updatedAt : null,
    }))
    .filter((subtask) => subtask.title.length > 0);
}

function serializeTaskContent(blocks: RichTextBlock[], subtasks: TaskSubtask[]) {
  const sanitizedBlocks = sanitizeTaskNotes(blocks);
  const sanitizedSubtasks = sanitizeSubtasks(subtasks);

  if (sanitizedBlocks.length === 0 && sanitizedSubtasks.length === 0) {
    return null;
  }

  return `${RICH_TEXT_NOTES_PREFIX}${JSON.stringify({
    version: TASK_NOTES_VERSION,
    blocks: sanitizedBlocks,
    subtasks: sanitizedSubtasks,
  })}`;
}

function getSubtaskProgress(subtasks: TaskSubtask[]) {
  const validSubtasks = sanitizeSubtasks(subtasks);
  const total = validSubtasks.length;
  const completed = validSubtasks.filter((subtask) => subtask.status === "done").length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return { total, completed, percentage };
}

function normalizeTaskStatus(value: unknown): AdminTaskStatus {
  if (value === "done" || value === "in_progress") {
    return value;
  }
  return "pending";
}

function normalizeTaskPriority(value: unknown): AdminTaskPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return null;
}

function normalizeTaskCategory(value: unknown): AdminTaskCategory {
  return typeof value === "string" && value.trim() ? value.trim() : "pessoal";
}

function formToSubtask(formValue: TaskForm, existing?: TaskSubtask): TaskSubtask {
  const now = new Date().toISOString();
  const status = formValue.status;
  return {
    id: existing?.id ?? `subtask-${crypto.randomUUID()}`,
    title: formValue.title.trim(),
    notes: formValue.notes,
    status,
    priority: formValue.priority,
    category: formValue.category,
    tags: formValue.tags,
    dueAt: toIsoFromDateInput(formValue.dueAt),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    completedAt: status === "done" ? existing?.completedAt ?? now : null,
  };
}

function subtaskToForm(subtask: TaskSubtask): TaskForm {
  return {
    title: subtask.title,
    notes: subtask.notes,
    subtasks: [],
    status: subtask.status,
    priority: subtask.priority,
    category: subtask.category,
    dueAt: toDateInputValue(subtask.dueAt),
    tags: subtask.tags,
  };
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
  const [sortMode, setSortMode] = useState<SortMode>("manual");
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
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("task");
  const [form, setForm] = useState<TaskForm>(createDefaultTaskForm);
  const [parentFormDraft, setParentFormDraft] = useState<TaskForm | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [pressedTaskId, setPressedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const suppressTaskClickRef = useRef(false);

  const categoryOptions = useMemo<ComboboxOption[]>(() => {
    const defaults = new Map(defaultCategoryOptions.map((option) => [option.value, option]));
    const values = new Set([
      ...defaultCategoryOptions.map((option) => option.value),
      ...tasks.map((task) => task.category).filter(Boolean),
      ...tasks.flatMap((task) => deserializeTaskSubtasks(task.notes).map((subtask) => subtask.category)),
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
      Array.from(
        new Set([
          ...tasks.flatMap((task) => task.tags),
          ...tasks.flatMap((task) => deserializeTaskSubtasks(task.notes).flatMap((subtask) => subtask.tags)),
        ]),
      )
        .concat(form.tags)
        .sort((a, b) => a.localeCompare(b))
        .filter((tag, index, values) => tag && values.indexOf(tag) === index)
        .map((tag) => ({
          value: tag,
          label: tag,
          icon: <Tag aria-hidden="true" className="h-3.5 w-3.5" />,
          chipType: "tertiary",
        })),
    [form.tags, tasks],
  );

  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => matchesFilters(task, appliedFilters));

    const priorityWeight: Record<Exclude<AdminTaskPriority, null>, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return [...filtered].sort((a, b) => {
      if (sortMode === "manual") {
        const statusWeight: Record<AdminTaskStatus, number> = {
          pending: 0,
          in_progress: 1,
          done: 2,
        };
        const statusDelta = statusWeight[a.status] - statusWeight[b.status];
        if (statusDelta !== 0) {
          return statusDelta;
        }
        const sortDelta = a.sortOrder - b.sortOrder;
        if (sortDelta !== 0) {
          return sortDelta;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

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
  const canReorderTasks = sortMode === "manual" && !hasAppliedFilters && !query.trim();

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
    setDrawerMode("task");
    setEditingTaskId(null);
    setEditingSubtaskId(null);
    setParentFormDraft(null);
    setForm({ ...createDefaultTaskForm(), status: initialStatus ?? "pending" });
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEdit(task: AdminTask) {
    captureOpener();
    setDrawerMode("task");
    setEditingTaskId(task.id);
    setEditingSubtaskId(null);
    setParentFormDraft(null);
    setForm(taskToForm(task));
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEditSubtask(parentTask: AdminTask, subtask: TaskSubtask) {
    captureOpener();
    setDrawerMode("subtask");
    setEditingTaskId(parentTask.id);
    setEditingSubtaskId(subtask.id);
    setParentFormDraft(taskToForm(parentTask));
    setForm(subtaskToForm(subtask));
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEditSubtaskFromForm(subtask: TaskSubtask) {
    setParentFormDraft(form);
    setDrawerMode("subtask");
    setEditingSubtaskId(subtask.id);
    setForm(subtaskToForm(subtask));
    setError(null);
  }

  function returnToParentTask() {
    if (parentFormDraft) {
      setForm(parentFormDraft);
    }
    setDrawerMode("task");
    setEditingSubtaskId(null);
    setParentFormDraft(null);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingTaskId(null);
    setEditingSubtaskId(null);
    setDrawerMode("task");
    setForm(createDefaultTaskForm());
    setParentFormDraft(null);
    openerRef.current?.focus();
  }

  function createTaskPayload(formValue: TaskForm) {
    return {
      title: formValue.title.trim(),
      notes: serializeTaskContent(formValue.notes, formValue.subtasks),
      status: formValue.status,
      priority: formValue.priority,
      category: formValue.category,
      tags: formValue.tags,
      dueAt: toIsoFromDateInput(formValue.dueAt),
    };
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
      if (drawerMode === "subtask") {
        if (!editingSubtaskId || !parentFormDraft) {
          throw new Error("Nao foi possivel localizar a tarefa principal.");
        }

        const existingSubtask = parentFormDraft.subtasks.find((subtask) => subtask.id === editingSubtaskId);
        const nextSubtask = formToSubtask(form, existingSubtask);
        const nextParentForm = {
          ...parentFormDraft,
          subtasks: parentFormDraft.subtasks.map((subtask) =>
            subtask.id === editingSubtaskId ? nextSubtask : subtask,
          ),
        };

        if (!editingTaskId) {
          setParentFormDraft(null);
          setEditingSubtaskId(null);
          setDrawerMode("task");
          setForm(nextParentForm);
          return;
        }

        const response = await fetch(`/api/admin/tasks/${editingTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createTaskPayload(nextParentForm)),
        });
        const result = (await response.json()) as { task?: AdminTask; error?: string };
        if (!response.ok || !result.task) {
          throw new Error(result.error ?? "Nao foi possivel salvar a subtask.");
        }

        const nextForm = taskToForm(result.task);
        setTasks((current) => current.map((item) => (item.id === result.task!.id ? result.task! : item)));
        setParentFormDraft(null);
        setEditingSubtaskId(null);
        setDrawerMode("task");
        setForm(nextForm);
        setMessage("Subtask atualizada.");
        return;
      }

      const payload = createTaskPayload(form);
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

  function addSubtask() {
    const nextSubtask = createEmptySubtask(form.category);
    const nextParentForm = { ...form, subtasks: [...form.subtasks, nextSubtask] };
    setParentFormDraft(nextParentForm);
    setDrawerMode("subtask");
    setEditingSubtaskId(nextSubtask.id);
    setForm(subtaskToForm(nextSubtask));
  }

  function removeSubtask(subtaskId: string) {
    setForm((current) => ({
      ...current,
      subtasks: current.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }));
  }

  function getColumnTasksForDrop(status: AdminTaskStatus) {
    return groupedTasks[status].filter((task) => task.id !== draggingTaskId);
  }

  function dropTargetFromIndex(status: AdminTaskStatus, index: number): DropTarget {
    const columnTasks = getColumnTasksForDrop(status);
    const boundedIndex = Math.min(Math.max(index, 0), columnTasks.length);
    return {
      status,
      beforeId: boundedIndex > 0 ? columnTasks[boundedIndex - 1]?.id ?? null : null,
      afterId: boundedIndex < columnTasks.length ? columnTasks[boundedIndex]?.id ?? null : null,
    };
  }

  function getCurrentDropTarget(task: AdminTask): DropTarget {
    const columnTasks = groupedTasks[task.status];
    const currentIndex = columnTasks.findIndex((item) => item.id === task.id);
    return {
      status: task.status,
      beforeId: currentIndex > 0 ? columnTasks[currentIndex - 1]?.id ?? null : null,
      afterId: currentIndex >= 0 && currentIndex < columnTasks.length - 1 ? columnTasks[currentIndex + 1]?.id ?? null : null,
    };
  }

  function getAppendDropTarget(status: AdminTaskStatus): DropTarget {
    const columnTasks = getColumnTasksForDrop(status);
    const lastTask = columnTasks[columnTasks.length - 1];
    return { status, beforeId: lastTask?.id ?? null, afterId: null };
  }

  function getTaskDropTarget(task: AdminTask, placement: "before" | "after"): DropTarget {
    const columnTasks = getColumnTasksForDrop(task.status);
    const taskIndex = columnTasks.findIndex((item) => item.id === task.id);
    if (taskIndex < 0) {
      return getAppendDropTarget(task.status);
    }
    return dropTargetFromIndex(task.status, placement === "before" ? taskIndex : taskIndex + 1);
  }

  function isSameDropTarget(left: DropTarget | null, right: DropTarget | null) {
    return Boolean(
      left &&
        right &&
        left.status === right.status &&
        left.beforeId === right.beforeId &&
        left.afterId === right.afterId,
    );
  }

  function resetDragState() {
    setDraggingTaskId(null);
    setDragMode(null);
    setPressedTaskId(null);
    setDropTarget(null);
  }

  async function commitTaskReorder(target: DropTarget | null = dropTarget) {
    if (!draggingTaskId || !target || pendingAction === `reorder:${draggingTaskId}`) {
      resetDragState();
      return;
    }

    const task = tasks.find((item) => item.id === draggingTaskId);
    if (!task || !canReorderTasks) {
      resetDragState();
      return;
    }

    if (isSameDropTarget(getCurrentDropTarget(task), target)) {
      resetDragState();
      return;
    }

    setPendingAction(`reorder:${task.id}`);
    setError(null);
    try {
      const response = await fetch("/api/admin/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          targetStatus: target.status,
          beforeId: target.beforeId,
          afterId: target.afterId,
        }),
      });
      const result = (await response.json()) as { task?: AdminTask; error?: string };
      if (!response.ok || !result.task) {
        throw new Error(result.error ?? "Nao foi possivel reordenar a tarefa.");
      }
      setTasks((current) => current.map((item) => (item.id === result.task!.id ? result.task! : item)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
      resetDragState();
      suppressTaskClickRef.current = true;
      window.setTimeout(() => {
        suppressTaskClickRef.current = false;
      }, 0);
    }
  }

  function beginTaskDrag(task: AdminTask, mode: DragMode) {
    if (!canReorderTasks) {
      return;
    }
    setDraggingTaskId(task.id);
    setDragMode(mode);
    setDropTarget(getCurrentDropTarget(task));
  }

  function onTaskDragStart(event: ReactDragEvent<HTMLElement>, task: AdminTask) {
    if (!canReorderTasks) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    suppressTaskClickRef.current = true;
    beginTaskDrag(task, "pointer");
  }

  function onTaskCardDragStart(event: ReactDragEvent<HTMLElement>, task: AdminTask) {
    const target = event.target;
    if (isInteractiveTaskTarget(target)) {
      event.preventDefault();
      return;
    }
    onTaskDragStart(event, task);
  }

  function onTaskDragEnd() {
    if (dragMode === "pointer") {
      resetDragState();
      window.setTimeout(() => {
        suppressTaskClickRef.current = false;
      }, 0);
    }
  }

  function onTaskDragOver(event: ReactDragEvent<HTMLElement>, task: AdminTask) {
    if (!draggingTaskId || !canReorderTasks || draggingTaskId === task.id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    const nextTarget = getTaskDropTarget(task, placement);
    if (!isSameDropTarget(dropTarget, nextTarget)) {
      setDropTarget(nextTarget);
    }
  }

  function onColumnDragOver(event: ReactDragEvent<HTMLElement>, status: AdminTaskStatus) {
    if (!draggingTaskId || !canReorderTasks) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const nextTarget = getAppendDropTarget(status);
    if (!isSameDropTarget(dropTarget, nextTarget)) {
      setDropTarget(nextTarget);
    }
  }

  function onTaskDrop(event: ReactDragEvent<HTMLElement>, target: DropTarget | null = dropTarget) {
    if (!draggingTaskId || !canReorderTasks) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void commitTaskReorder(target);
  }

  function moveKeyboardDrop(task: AdminTask, direction: "up" | "down" | "left" | "right") {
    const currentTarget = dropTarget ?? getCurrentDropTarget(task);
    const orderedStatuses: AdminTaskStatus[] =
      activeTab === "all" ? ["pending", "in_progress", "done"] : [activeTab];
    const statusIndex = orderedStatuses.indexOf(currentTarget.status);

    if (direction === "left" || direction === "right") {
      const nextStatus = orderedStatuses[statusIndex + (direction === "right" ? 1 : -1)];
      if (!nextStatus) {
        return;
      }
      setDropTarget(getAppendDropTarget(nextStatus));
      return;
    }

    const columnTasks = getColumnTasksForDrop(currentTarget.status);
    const currentIndex =
      currentTarget.beforeId === null
        ? 0
        : columnTasks.findIndex((item) => item.id === currentTarget.beforeId) + 1;
    const nextIndex = currentIndex + (direction === "down" ? 1 : -1);
    setDropTarget(dropTargetFromIndex(currentTarget.status, nextIndex));
  }

  function onTaskCardKeyDown(event: ReactKeyboardEvent<HTMLElement>, task: AdminTask) {
    if (isInteractiveTaskTarget(event.target)) {
      return;
    }

    if (!canReorderTasks) {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (draggingTaskId === task.id && dragMode === "keyboard") {
        void commitTaskReorder(dropTarget ?? getCurrentDropTarget(task));
        return;
      }
      beginTaskDrag(task, "keyboard");
      return;
    }

    if (draggingTaskId !== task.id || dragMode !== "keyboard") {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetDragState();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveKeyboardDrop(
        task,
        event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : event.key === "ArrowLeft" ? "left" : "right",
      );
    }
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

  function renderCreatedDate(value: string) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-[#6f7890]">
        <CalendarClock aria-hidden="true" className="h-4 w-4" />
        <span>{formatCreatedDate(value)}</span>
      </div>
    );
  }

  function renderTaskDates(task: AdminTask) {
    return renderCreatedDate(task.createdAt);
  }

  function renderSubtaskCard(parentTask: AdminTask, subtask: TaskSubtask) {
    return (
      <article
        key={subtask.id}
        draggable={false}
        onDragStart={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openEditSubtask(parentTask, subtask);
        }}
        className="flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-[#e0e4df] bg-[#fbfbf9] p-2.5 transition hover:border-[#d4dad2] hover:bg-white"
      >
        <div>
          <h4
            className={cx(
              "line-clamp-2 text-[0.92rem] leading-5 text-[#161d2c]",
              subtask.status === "done" && "text-[#7e8798] line-through",
            )}
          >
            {subtask.title || "Sem titulo"}
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          {priorityChip(subtask.priority)}
          {dueChip(subtask.dueAt)}
          {settings.showTags ? renderTags(subtask.tags.slice(0, 2)) : null}
        </div>
      </article>
    );
  }

  function renderSubtasks(parentTask: AdminTask, subtasks = deserializeTaskSubtasks(parentTask.notes)) {
    const progress = getSubtaskProgress(subtasks);
    if (!progress.total) {
      return null;
    }

    return (
      <div className="space-y-3" aria-label={`Subtasks ${progress.completed} de ${progress.total}`}>
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-[#65708a]">
          <span>
            Subtasks {progress.completed}/{progress.total}
          </span>
          <span>{progress.percentage}% completas</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#e6e9e5]">
          <div
            className="h-full rounded-full bg-[#6f7c70] transition-[width]"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <div className="space-y-2">
          {subtasks.map((subtask) => renderSubtaskCard(parentTask, subtask))}
        </div>
      </div>
    );
  }

  function renderSubtaskDraftCard(subtask: TaskSubtask) {
    return (
      <article
        key={subtask.id}
        onClick={() => openEditSubtaskFromForm(subtask)}
        className="flex cursor-pointer flex-col gap-2.5 rounded-[14px] border border-[#e0e4df] bg-[#fbfbf9] p-2.5 transition hover:border-[#d4dad2] hover:bg-white"
      >
        <div>
          <h4
            className={cx(
              "line-clamp-2 text-[0.92rem] leading-5 text-[#161d2c]",
              subtask.status === "done" && "text-[#7e8798] line-through",
            )}
          >
            {subtask.title || "Sem titulo"}
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          {priorityChip(subtask.priority)}
          {dueChip(subtask.dueAt)}
          {settings.showTags ? renderTags(subtask.tags.slice(0, 2)) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#e7eae6] pt-3">
          <span className="text-xs font-medium text-[#65708a]">
            {subtask.status === "done" ? "Concluida" : subtask.status === "in_progress" ? "Em andamento" : "Pendente"}
          </span>
          <Pencil aria-hidden="true" className="h-4 w-4 text-[#7c86a0]" />
        </div>
      </article>
    );
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

  function renderDropZone(key: string) {
    return (
      <div
        key={key}
        className="min-h-[4.75rem] rounded-[18px] border border-dashed border-[#2f6fe4] bg-[#eaf2ff] shadow-[inset_0_0_0_1px_rgba(47,111,228,0.2)] transition-all duration-200"
        aria-hidden="true"
      />
    );
  }

  function shouldRenderDropBefore(task: AdminTask) {
    return Boolean(draggingTaskId && dropTarget?.status === task.status && dropTarget.afterId === task.id);
  }

  function shouldRenderDropAfter(task: AdminTask) {
    return Boolean(
      draggingTaskId &&
        dropTarget?.status === task.status &&
        dropTarget.beforeId === task.id &&
        dropTarget.afterId === null,
    );
  }

  function renderTaskCollection(taskList: AdminTask[], variant: ViewMode) {
    const renderer = variant === "board" ? renderTaskCard : renderTaskListItem;
    return taskList.map((task) => (
      <div key={task.id} className="space-y-2.5">
        {shouldRenderDropBefore(task) ? renderDropZone(`drop-before-${task.id}`) : null}
        {renderer(task)}
        {shouldRenderDropAfter(task) ? renderDropZone(`drop-after-${task.id}`) : null}
      </div>
    ));
  }

  function renderTaskCard(task: AdminTask) {
    const subtasks = deserializeTaskSubtasks(task.notes);
    const isGrabbed = draggingTaskId === task.id;
    const isPressed = pressedTaskId === task.id;
    const isReorderDisabled = !canReorderTasks;

    return (
      <article
        key={task.id}
        draggable={canReorderTasks}
        data-task-card
        tabIndex={canReorderTasks ? 0 : undefined}
        aria-grabbed={isGrabbed}
        title={canReorderTasks ? "Arraste o card para reordenar" : undefined}
        onDragStart={(event) => onTaskCardDragStart(event, task)}
        onDragEnd={onTaskDragEnd}
        onDragOver={(event) => onTaskDragOver(event, task)}
        onDrop={(event) => onTaskDrop(event)}
        onKeyDown={(event) => onTaskCardKeyDown(event, task)}
        onMouseDown={(event) => {
          if (!isInteractiveTaskTarget(event.target)) {
            setPressedTaskId(task.id);
          }
        }}
        onMouseUp={() => setPressedTaskId(null)}
        onMouseLeave={() => setPressedTaskId(null)}
        onClick={(event) => {
          if (suppressTaskClickRef.current) {
            suppressTaskClickRef.current = false;
            return;
          }
          if (isInteractiveTaskTarget(event.target)) {
            return;
          }
          openEdit(task);
        }}
        className={cx(
          "group flex cursor-pointer flex-col gap-2.5 rounded-[22px] border border-[#e0e4df] bg-white p-3 shadow-[var(--ds-shadow-soft)] transition-all duration-200 hover:border-[#d3d9d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f9a8b] focus-visible:ring-offset-2",
          canReorderTasks && "cursor-grab active:cursor-grabbing",
          isPressed && "border-[#cbd5ca] shadow-[0_10px_24px_rgba(35,44,36,0.1)]",
          isGrabbed && dragMode === "pointer" && "cursor-grabbing border-[#aeb9ad] opacity-60 shadow-[0_16px_32px_rgba(35,44,36,0.14)]",
          isGrabbed && dragMode === "keyboard" && "border-[#aeb9ad] opacity-90 shadow-[0_18px_34px_rgba(35,44,36,0.16)]",
        )}
        data-reorder-disabled={isReorderDisabled}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className={cx("text-[1.02rem] leading-6 text-[#141a27]", task.status === "done" && "text-[#7e8798] line-through")}>
              {task.title || "Sem titulo"}
            </h3>
            {renderTaskDates(task)}
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

        <div className="flex flex-wrap gap-2">
          {priorityChip(task.priority)}
          {categoryChip(task.category)}
          {dueChip(task.dueAt)}
          {settings.showTags ? renderTags(task.tags.slice(0, 2)) : null}
        </div>

        {renderSubtasks(task, subtasks)}
      </article>
    );
  }

  function renderTaskListItem(task: AdminTask) {
    const subtasks = deserializeTaskSubtasks(task.notes);
    const isGrabbed = draggingTaskId === task.id;
    const isPressed = pressedTaskId === task.id;

    return (
      <article
        key={task.id}
        draggable={canReorderTasks}
        data-task-card
        tabIndex={canReorderTasks ? 0 : undefined}
        aria-grabbed={isGrabbed}
        title={canReorderTasks ? "Arraste o card para reordenar" : undefined}
        onDragStart={(event) => onTaskCardDragStart(event, task)}
        onDragEnd={onTaskDragEnd}
        onDragOver={(event) => onTaskDragOver(event, task)}
        onDrop={(event) => onTaskDrop(event)}
        onKeyDown={(event) => onTaskCardKeyDown(event, task)}
        onMouseDown={(event) => {
          if (!isInteractiveTaskTarget(event.target)) {
            setPressedTaskId(task.id);
          }
        }}
        onMouseUp={() => setPressedTaskId(null)}
        onMouseLeave={() => setPressedTaskId(null)}
        onClick={(event) => {
          if (suppressTaskClickRef.current) {
            suppressTaskClickRef.current = false;
            return;
          }
          if (isInteractiveTaskTarget(event.target)) {
            return;
          }
          openEdit(task);
        }}
        className={cx(
          "group flex cursor-pointer flex-col gap-2.5 rounded-[22px] border border-[#e0e4df] bg-white p-3 shadow-[var(--ds-shadow-soft)] transition-all duration-200 hover:border-[#d3d9d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f9a8b] focus-visible:ring-offset-2 sm:flex-row sm:items-start sm:justify-between",
          canReorderTasks && "cursor-grab active:cursor-grabbing",
          isPressed && "border-[#cbd5ca] shadow-[0_10px_24px_rgba(35,44,36,0.1)]",
          isGrabbed && dragMode === "pointer" && "cursor-grabbing border-[#aeb9ad] opacity-60 shadow-[0_16px_32px_rgba(35,44,36,0.14)]",
          isGrabbed && dragMode === "keyboard" && "border-[#aeb9ad] opacity-90 shadow-[0_18px_34px_rgba(35,44,36,0.16)]",
        )}
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0 space-y-2">
            <h3 className={cx("text-[1.02rem] leading-6 text-[#141a27]", task.status === "done" && "text-[#7e8798] line-through")}>
              {task.title || "Sem titulo"}
            </h3>
            {renderTaskDates(task)}
          </div>

          <div className="flex flex-wrap gap-2">
            {priorityChip(task.priority)}
            {categoryChip(task.category)}
            {dueChip(task.dueAt)}
            {settings.showTags ? renderTags(task.tags) : null}
          </div>

          {renderSubtasks(task, subtasks)}
        </div>

        <div className="flex shrink-0 items-center gap-2" data-task-interactive>
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
      id: "manual",
      label: "Ordem manual",
      selected: sortMode === "manual",
      onSelect: () => selectSortMode("manual"),
    },
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
  const formSubtaskProgress = getSubtaskProgress(form.subtasks);

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
                variant={sortMode !== "manual" ? "info" : "secondary"}
                selected={sortMode !== "manual"}
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
        <div className="rounded-[24px] border border-[#e0e4df] bg-white px-4 py-8 text-center text-sm text-[#667068]">
          Carregando tarefas...
        </div>
      ) : filteredAndSortedTasks.length === 0 ? (
        <div className="rounded-[24px] border border-[#e0e4df] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#1f2b46]">Nenhuma tarefa encontrada.</p>
          <p className="mt-1 text-sm text-[#6d768d]">Ajuste a busca, os filtros ou crie uma nova tarefa.</p>
        </div>
      ) : viewMode === "board" ? (
        <div className={cx("grid max-w-[54rem] gap-3", boardColumns.length === 1 ? "grid-cols-1" : "lg:grid-cols-3 lg:items-start")}>
          {boardColumns.map((column) => (
            <section
              key={column.status}
              onDragOver={(event) => onColumnDragOver(event, column.status)}
              onDrop={(event) => onTaskDrop(event, dropTarget ?? getAppendDropTarget(column.status))}
              className="rounded-[22px] bg-[#f6f7f6] p-2.5"
            >
              <header className="mb-2.5 flex items-center gap-2 px-1">
                <span className="text-[#747d75]">{statusIcon(column.status, "h-4 w-4")}</span>
                <h4 className="text-[0.92rem] text-[#202720]">{column.label}</h4>
                <span className="text-sm text-[#7b847d]">{column.tasks.length}</span>
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

              <div className="space-y-2.5">
                {dropTarget?.status === column.status && dropTarget.beforeId === null && dropTarget.afterId === null
                  ? renderDropZone(`drop-empty-${column.status}`)
                  : null}
                {column.tasks.length === 0 ? (
                  <div className="rounded-[18px] bg-white px-3.5 py-3 text-sm text-[#7b837c]">
                    Nenhuma tarefa nesta etapa.
                  </div>
                ) : (
                  renderTaskCollection(column.tasks, "board")
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">{renderTaskCollection(visibleTasks, "list")}</div>
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
        secondaryAction={
          drawerMode === "subtask"
            ? { label: "Voltar para task", onClick: returnToParentTask }
            : { label: "Cancelar", onClick: closeDrawer }
        }
        primaryAction={{
          label: pendingAction === "save" ? "Salvando..." : drawerMode === "subtask" ? "Salvar subtask" : "Salvar",
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

          {drawerMode === "task" ? (
            <div className="border-t border-[#edf1f7] pt-6">
              <DrawerSection title="Subtasks">
                <div className="space-y-4">
                  {formSubtaskProgress.total ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm font-medium text-[#59657d]">
                        <span>
                          {formSubtaskProgress.completed} de {formSubtaskProgress.total} concluidas
                        </span>
                        <span>{formSubtaskProgress.percentage}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#e8edf5]">
                        <div
                          className="h-full rounded-full bg-[#4f6fad] transition-[width]"
                          style={{ width: `${formSubtaskProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {form.subtasks.length ? (
                    <div className="space-y-2">
                      {form.subtasks.map((subtask) => (
                        <div key={subtask.id} className="relative">
                          {renderSubtaskDraftCard(subtask)}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeSubtask(subtask.id);
                            }}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#7f899f] transition hover:bg-[#f1f4fa] hover:text-[#a43a4a]"
                            aria-label="Remover subtask"
                            title="Remover subtask"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <CommonButton
                    type="button"
                    onClick={addSubtask}
                    variant="secondary"
                    usage="general"
                    showIconLeft
                    iconLeft={<Plus aria-hidden="true" className="h-4 w-4" />}
                    className="h-10 px-3"
                    title="Adicionar subtask"
                  >
                    Adicionar subtask
                  </CommonButton>
                </div>
              </DrawerSection>
            </div>
          ) : null}

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
