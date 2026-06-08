"use client";

import {
  ArrowDownUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  Image as ImageIcon,
  Layers3,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  PlayCircle,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";

import {
  type StudyDashboardData,
  type StudyCourse,
  type StudyMaterial,
  type StudyMaterialType,
  type StudyModule,
  type StudyNoteBlock,
  type StudyPendingItem,
  type StudyPendingStatus,
  type StudyPriority,
  type StudyTopic,
  type StudyTopicStatus,
} from "@/lib/access-db";
import { Chip, type ChipType } from "@/components/ui/chip";
import { Drawer } from "@/components/ui/drawer";
import { CommonButton, IconButton, ListBox, Toolbar, ToolbarItem } from "@/components/ui/button-system";
import { RichTextEditor, type RichTextBlock, type RichTextBlockType } from "@/components/ui/rich-text-editor";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const topicStatusOptions: Array<{ value: StudyTopicStatus; label: string; chip: ChipType }> = [
  { value: "not_started", label: "Nao iniciado", chip: "tertiary" },
  { value: "in_progress", label: "Em andamento", chip: "info" },
  { value: "done", label: "Concluido", chip: "success" },
];

const pendingStatusOptions: Array<{ value: StudyPendingStatus; label: string; chip: ChipType }> = [
  { value: "pending", label: "Pendente", chip: "warning" },
  { value: "in_progress", label: "Em andamento", chip: "info" },
  { value: "done", label: "Concluida", chip: "success" },
];

const priorityOptions: Array<{ value: Exclude<StudyPriority, null>; label: string; chip: ChipType }> = [
  { value: "high", label: "Alta", chip: "destructive" },
  { value: "medium", label: "Media", chip: "warning" },
  { value: "low", label: "Baixa", chip: "tertiary" },
];

const materialOptions: Array<{ value: StudyMaterialType; label: string }> = [
  { value: "link", label: "Link" },
  { value: "image", label: "Imagem por URL" },
  { value: "file_reference", label: "Arquivo externo" },
  { value: "reference", label: "Referencia" },
];

const editorTypes: RichTextBlockType[] = [
  "paragraph",
  "h1",
  "h2",
  "h3",
  "bullet",
  "checklist",
  "divider",
  "link",
  "image",
  "reference",
];

type DrawerState =
  | { mode: "course"; courseId?: string }
  | { mode: "module"; moduleId?: string }
  | { mode: "topic"; moduleId: string; topicId?: string }
  | { mode: "pending"; pendingId?: string }
  | null;

type StudySortMode = "manual" | "updated_desc" | "progress_desc" | "priority_desc";

type CourseDraft = {
  title: string;
  description: string;
  priority: StudyPriority;
};

type ModuleDraft = {
  courseId: string;
  title: string;
  description: string;
  priority: StudyPriority;
};

type TopicDraft = {
  moduleId: string;
  title: string;
  status: StudyTopicStatus;
  priority: StudyPriority;
  dueAt: string;
  notes: RichTextBlock[];
};

type PendingDraft = {
  moduleId: string;
  topicId: string;
  title: string;
  status: StudyPendingStatus;
  priority: StudyPriority;
  dueAt: string;
  syncToTasks: boolean;
};

type MaterialDraft = {
  type: StudyMaterialType;
  title: string;
  url: string;
  description: string;
  metadata: string;
};

type InlineModuleDraft = {
  courseId: string;
  title: string;
  description: string;
  priority: StudyPriority;
};

type InlineLessonDraft = {
  moduleId: string;
  title: string;
  status: StudyTopicStatus;
  priority: StudyPriority;
  dueAt: string;
};

const emptyInlineModuleDraft: InlineModuleDraft = {
  courseId: "",
  title: "",
  description: "",
  priority: null,
};

const emptyInlineLessonDraft: InlineLessonDraft = {
  moduleId: "",
  title: "",
  status: "not_started",
  priority: null,
  dueAt: "",
};

function emptyEditorBlock(): RichTextBlock {
  return { id: `block-${crypto.randomUUID()}`, type: "paragraph", text: "" };
}

function toEditorBlocks(notes: StudyNoteBlock[]): RichTextBlock[] {
  const blocks = notes
    .map((block): RichTextBlock | null => {
      const type = editorTypes.includes(block.type as RichTextBlockType) ? (block.type as RichTextBlockType) : "paragraph";
      return {
        id: block.id || `block-${crypto.randomUUID()}`,
        type,
        text: block.text ?? "",
        checked: type === "checklist" ? Boolean(block.checked) : undefined,
        url: block.url,
      };
    })
    .filter((block): block is RichTextBlock => Boolean(block));

  return blocks.length ? blocks : [emptyEditorBlock()];
}

function fromEditorBlocks(blocks: RichTextBlock[]): StudyNoteBlock[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    text: block.text,
    checked: block.type === "checklist" ? Boolean(block.checked) : undefined,
    url: block.url,
  }));
}

function noteText(notes: StudyNoteBlock[]) {
  return notes.map((block) => block.text ?? "").join(" ").toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInputValue(value: string) {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

function priorityLabel(priority: StudyPriority) {
  return priorityOptions.find((option) => option.value === priority)?.label ?? "Sem prioridade";
}

function priorityChip(priority: StudyPriority): ChipType {
  return priorityOptions.find((option) => option.value === priority)?.chip ?? "tertiary";
}

function priorityWeight(priority: StudyPriority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

function topicStatusLabel(status: StudyTopicStatus) {
  return topicStatusOptions.find((option) => option.value === status)?.label ?? "Nao iniciado";
}

function topicStatusChip(status: StudyTopicStatus): ChipType {
  return topicStatusOptions.find((option) => option.value === status)?.chip ?? "tertiary";
}

function pendingStatusLabel(status: StudyPendingStatus) {
  return pendingStatusOptions.find((option) => option.value === status)?.label ?? "Pendente";
}

function pendingStatusChip(status: StudyPendingStatus): ChipType {
  return pendingStatusOptions.find((option) => option.value === status)?.chip ?? "warning";
}

function materialIcon(type: StudyMaterialType) {
  if (type === "image") return <ImageIcon aria-hidden="true" className="h-4 w-4" />;
  if (type === "file_reference") return <FileText aria-hidden="true" className="h-4 w-4" />;
  if (type === "reference") return <BookOpen aria-hidden="true" className="h-4 w-4" />;
  return <LinkIcon aria-hidden="true" className="h-4 w-4" />;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Nao foi possivel salvar.");
  }
  return body as T;
}

function recalculateStats(modules: StudyModule[], pendingItems: StudyPendingItem[]): StudyDashboardData["stats"] {
  const topics = modules.flatMap((module) => module.topics);
  const completedTopicsCount = topics.filter((topic) => topic.status === "done").length;
  const dueSoonThreshold = Date.now() + 1000 * 60 * 60 * 24 * 7;
  return {
    modulesCount: modules.length,
    topicsCount: topics.length,
    completedTopicsCount,
    overallProgress: topics.length ? Math.round((completedTopicsCount / topics.length) * 100) : 0,
    openPendingCount: pendingItems.filter((item) => item.status !== "done").length,
    dueSoonCount: pendingItems.filter((item) => {
      if (item.status === "done" || !item.dueAt) return false;
      return new Date(item.dueAt).getTime() <= dueSoonThreshold;
    }).length,
  };
}

export function AdminStudiesDashboard({ initialData }: { initialData: StudyDashboardData }) {
  const [courses, setCourses] = useState(initialData.courses);
  const [pendingItems, setPendingItems] = useState(initialData.pendingItems);
  const [selectedCourseId, setSelectedCourseId] = useState(initialData.courses[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | StudyTopicStatus>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Exclude<StudyPriority, null>>("all");
  const [sortMode, setSortMode] = useState<StudySortMode>("manual");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [courseDraft, setCourseDraft] = useState<CourseDraft>({ title: "", description: "", priority: null });
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft>({ courseId: initialData.courses[0]?.id ?? "", title: "", description: "", priority: null });
  const [inlineModuleCourseId, setInlineModuleCourseId] = useState<string | null>(null);
  const [inlineModuleDraft, setInlineModuleDraft] = useState<InlineModuleDraft>(emptyInlineModuleDraft);
  const [inlineLessonModuleId, setInlineLessonModuleId] = useState<string | null>(null);
  const [inlineLessonDraft, setInlineLessonDraft] = useState<InlineLessonDraft>(emptyInlineLessonDraft);
  const [topicDraft, setTopicDraft] = useState<TopicDraft>({
    moduleId: "",
    title: "",
    status: "not_started",
    priority: null,
    dueAt: "",
    notes: [emptyEditorBlock()],
  });
  const [pendingDraft, setPendingDraft] = useState<PendingDraft>({
    moduleId: "",
    topicId: "",
    title: "",
    status: "pending",
    priority: null,
    dueAt: "",
    syncToTasks: false,
  });
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>({
    type: "link",
    title: "",
    url: "",
    description: "",
    metadata: "",
  });
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [draggedTopic, setDraggedTopic] = useState<{ moduleId: string; topicId: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const sortPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const modules = useMemo(() => courses.flatMap((course) => course.modules), [courses]);
  const stats = useMemo(() => recalculateStats(modules, pendingItems), [modules, pendingItems]);
  const hasActiveFilters = statusFilter !== "all" || moduleFilter !== "all" || priorityFilter !== "all";
  const activeFilterCount = [statusFilter !== "all", moduleFilter !== "all", priorityFilter !== "all"].filter(Boolean).length;

  useEffect(() => {
    if (!isFilterPopoverOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!filterPopoverRef.current || filterPopoverRef.current.contains(event.target as Node)) return;
      setIsFilterPopoverOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isFilterPopoverOpen]);

  useEffect(() => {
    if (!isSortPopoverOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!sortPopoverRef.current || sortPopoverRef.current.contains(event.target as Node)) return;
      setIsSortPopoverOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isSortPopoverOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);
  const allTopics = useMemo(
    () =>
      courses.flatMap((course) =>
        course.modules.flatMap((module) => module.topics.map((topic) => ({ ...topic, moduleTitle: module.title, courseTitle: course.title }))),
      ),
    [courses],
  );
  const coursesInProgress = useMemo(
    () => courses.filter((course) => course.progress > 0 && course.progress < 100),
    [courses],
  );
  const nextTopics = useMemo(
    () =>
      allTopics
        .filter((topic) => topic.status !== "done")
        .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
        .slice(0, 5),
    [allTopics],
  );
  const selectedTopic =
    drawer?.mode === "topic" && drawer.topicId
      ? courses.flatMap((course) => course.modules).flatMap((module) => module.topics).find((topic) => topic.id === drawer.topicId) ?? null
      : null;

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextCourses = courses
      .map((course) => {
        const courseMatches =
          !normalizedQuery ||
          course.title.toLowerCase().includes(normalizedQuery) ||
          course.description.toLowerCase().includes(normalizedQuery);
        const courseModules = course.modules
          .filter((module) => moduleFilter === "all" || module.id === moduleFilter)
          .map((module) => {
            const moduleMatches =
              courseMatches ||
              !normalizedQuery ||
              module.title.toLowerCase().includes(normalizedQuery) ||
              module.description.toLowerCase().includes(normalizedQuery);
            const topics = module.topics.filter((topic) => {
              const statusMatches = statusFilter === "all" || topic.status === statusFilter;
              const priorityMatches = priorityFilter === "all" || topic.priority === priorityFilter;
              const queryMatches =
                !normalizedQuery ||
                moduleMatches ||
                topic.title.toLowerCase().includes(normalizedQuery) ||
                noteText(topic.notes).includes(normalizedQuery) ||
                topic.materials.some((material) =>
                  [material.title, material.description, material.url ?? "", material.metadata].join(" ").toLowerCase().includes(normalizedQuery),
                );
              return statusMatches && priorityMatches && queryMatches;
            });
            return { ...module, topics };
          })
          .filter((module) => {
            if (module.topics.length > 0) return true;
            if (statusFilter !== "all" || priorityFilter !== "all") return false;
            if (!normalizedQuery) return true;
            return (
              courseMatches ||
              module.title.toLowerCase().includes(normalizedQuery) ||
              module.description.toLowerCase().includes(normalizedQuery)
            );
          });
        return { ...course, modules: courseModules };
      })
      .filter((course) => {
        if (course.modules.length > 0) return true;
        if (statusFilter !== "all" || moduleFilter !== "all" || priorityFilter !== "all") return false;
        if (!normalizedQuery) return true;
        return course.title.toLowerCase().includes(normalizedQuery) || course.description.toLowerCase().includes(normalizedQuery);
      });

    return nextCourses.sort((left, right) => {
      if (sortMode === "updated_desc") {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }
      if (sortMode === "progress_desc") {
        return right.progress - left.progress || left.title.localeCompare(right.title, "pt-BR");
      }
      if (sortMode === "priority_desc") {
        return priorityWeight(right.priority) - priorityWeight(left.priority) || left.title.localeCompare(right.title, "pt-BR");
      }
      return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
    });
  }, [courses, moduleFilter, priorityFilter, query, sortMode, statusFilter]);

  const activeCourse =
    filteredCourses.find((course) => course.id === selectedCourseId) ??
    filteredCourses[0] ??
    courses.find((course) => course.id === selectedCourseId) ??
    courses[0] ??
    null;
  const activeCourseModules = activeCourse?.modules ?? [];

  const filteredPendingItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return pendingItems.filter((item) => {
      const moduleMatches = moduleFilter === "all" || item.moduleId === moduleFilter;
      const priorityMatches = priorityFilter === "all" || item.priority === priorityFilter;
      const queryMatches = !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery);
      return moduleMatches && priorityMatches && queryMatches;
    });
  }, [moduleFilter, pendingItems, priorityFilter, query]);
  async function reload(message?: string) {
    const data = await apiRequest<StudyDashboardData>("/api/admin/studies");
    setCourses(data.courses);
    setPendingItems(data.pendingItems);
    setSelectedCourseId((current) => data.courses.some((course) => course.id === current) ? current : (data.courses[0]?.id ?? ""));
    if (message) setFeedback(message);
  }

  function openCourseDrawer(course?: StudyCourse) {
    setError(null);
    setDrawer({ mode: "course", courseId: course?.id });
    setCourseDraft({
      title: course?.title ?? "",
      description: course?.description ?? "",
      priority: course?.priority ?? null,
    });
  }

  function openModuleDrawer(module?: StudyModule, courseId = activeCourse?.id ?? "") {
    setError(null);
    setDrawer({ mode: "module", moduleId: module?.id });
    setModuleDraft({
      courseId: module?.courseId ?? courseId,
      title: module?.title ?? "",
      description: module?.description ?? "",
      priority: module?.priority ?? null,
    });
  }

  function openTopicDrawer(moduleId: string, topic?: StudyTopic) {
    setError(null);
    setDrawer({ mode: "topic", moduleId, topicId: topic?.id });
    setTopicDraft({
      moduleId,
      title: topic?.title ?? "",
      status: topic?.status ?? "not_started",
      priority: topic?.priority ?? null,
      dueAt: toDateInputValue(topic?.dueAt ?? null),
      notes: toEditorBlocks(topic?.notes ?? []),
    });
    setMaterialDraft({ type: "link", title: "", url: "", description: "", metadata: "" });
  }

  function openPendingDrawer(item?: StudyPendingItem) {
    setError(null);
    setDrawer({ mode: "pending", pendingId: item?.id });
    setPendingDraft({
      moduleId: item?.moduleId ?? "",
      topicId: item?.topicId ?? "",
      title: item?.title ?? "",
      status: item?.status ?? "pending",
      priority: item?.priority ?? null,
      dueAt: toDateInputValue(item?.dueAt ?? null),
      syncToTasks: Boolean(item?.syncToTasks),
    });
  }

  async function saveCourse() {
    if (!courseDraft.title.trim()) {
      setError("Informe o titulo do curso.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (drawer?.mode === "course" && drawer.courseId) {
        await apiRequest(`/api/admin/studies/courses/${drawer.courseId}`, {
          method: "PATCH",
          body: JSON.stringify(courseDraft),
        });
      } else {
        await apiRequest("/api/admin/studies", {
          method: "POST",
          body: JSON.stringify(courseDraft),
        });
      }
      setDrawer(null);
      await reload("Curso salvo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveModule() {
    if (!moduleDraft.title.trim()) {
      setError("Informe o titulo do modulo.");
      return;
    }
    if (!moduleDraft.courseId) {
      setError("Selecione um curso para o modulo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (drawer?.mode === "module" && drawer.moduleId) {
        await apiRequest(`/api/admin/studies/modules/${drawer.moduleId}`, {
          method: "PATCH",
          body: JSON.stringify(moduleDraft),
        });
      } else {
        await apiRequest("/api/admin/studies/modules", {
          method: "POST",
          body: JSON.stringify(moduleDraft),
        });
      }
      setDrawer(null);
      await reload("Modulo salvo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  function startInlineModule(courseId: string) {
    setError(null);
    setInlineLessonModuleId(null);
    setInlineModuleCourseId(courseId);
    setInlineModuleDraft({ ...emptyInlineModuleDraft, courseId });
  }

  function cancelInlineModule() {
    setInlineModuleCourseId(null);
    setInlineModuleDraft(emptyInlineModuleDraft);
  }

  async function saveInlineModule(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!inlineModuleDraft.title.trim() || !inlineModuleDraft.courseId) {
      setError("Informe o titulo do modulo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/admin/studies/modules", {
        method: "POST",
        body: JSON.stringify({
          courseId: inlineModuleDraft.courseId,
          title: inlineModuleDraft.title,
          description: inlineModuleDraft.description,
          priority: inlineModuleDraft.priority,
        }),
      });
      const courseId = inlineModuleDraft.courseId;
      cancelInlineModule();
      setSelectedCourseId(courseId);
      await reload("Modulo salvo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTopic() {
    if (!topicDraft.title.trim() || !topicDraft.moduleId) {
      setError("Informe modulo e titulo da aula.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      moduleId: topicDraft.moduleId,
      title: topicDraft.title,
      status: topicDraft.status,
      priority: topicDraft.priority,
      dueAt: fromDateInputValue(topicDraft.dueAt),
      notes: fromEditorBlocks(topicDraft.notes),
    };
    try {
      if (drawer?.mode === "topic" && drawer.topicId) {
        await apiRequest(`/api/admin/studies/topics/${drawer.topicId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/admin/studies/topics", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setDrawer(null);
      await reload("Aula salva.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  function startInlineLesson(moduleId: string) {
    setError(null);
    setInlineLessonModuleId(moduleId);
    setInlineLessonDraft({ ...emptyInlineLessonDraft, moduleId });
  }

  function cancelInlineLesson() {
    setInlineLessonModuleId(null);
    setInlineLessonDraft(emptyInlineLessonDraft);
  }

  async function saveInlineLesson(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!inlineLessonDraft.title.trim() || !inlineLessonDraft.moduleId) {
      setError("Informe o titulo da aula.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/admin/studies/topics", {
        method: "POST",
        body: JSON.stringify({
          moduleId: inlineLessonDraft.moduleId,
          title: inlineLessonDraft.title,
          status: inlineLessonDraft.status,
          priority: inlineLessonDraft.priority,
          dueAt: fromDateInputValue(inlineLessonDraft.dueAt),
          notes: fromEditorBlocks([emptyEditorBlock()]),
        }),
      });
      cancelInlineLesson();
      await reload("Aula salva.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function setTopicStatus(topic: StudyTopic, status: StudyTopicStatus) {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/studies/topics/${topic.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          moduleId: topic.moduleId,
          title: topic.title,
          notes: topic.notes,
          status,
          priority: topic.priority,
          dueAt: topic.dueAt,
        }),
      });
      await reload(status === "done" ? "Aula concluida." : "Status da aula atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel atualizar a aula.");
    } finally {
      setSaving(false);
    }
  }

  async function savePending() {
    if (!pendingDraft.title.trim()) {
      setError("Informe o titulo da pendencia.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      moduleId: pendingDraft.moduleId || null,
      topicId: pendingDraft.topicId || null,
      title: pendingDraft.title,
      status: pendingDraft.status,
      priority: pendingDraft.priority,
      dueAt: fromDateInputValue(pendingDraft.dueAt),
      syncToTasks: pendingDraft.syncToTasks,
    };
    try {
      if (drawer?.mode === "pending" && drawer.pendingId) {
        await apiRequest(`/api/admin/studies/pending/${drawer.pendingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/admin/studies/pending", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setDrawer(null);
      await reload("Pendencia salva.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteModule(module: StudyModule) {
    if (!window.confirm(`Excluir o modulo "${module.title}" e todo o conteudo dele?`)) return;
    await apiRequest(`/api/admin/studies/modules/${module.id}`, { method: "DELETE" });
    await reload("Modulo excluido.");
  }

  async function deleteCourse(course: StudyCourse) {
    if (!window.confirm(`Excluir o curso "${course.title}" e todos os modulos e aulas dele?`)) return;
    await apiRequest(`/api/admin/studies/courses/${course.id}`, { method: "DELETE" });
    await reload("Curso excluido.");
  }

  async function deleteTopic(topic: StudyTopic) {
    if (!window.confirm(`Excluir a aula "${topic.title}"?`)) return;
    await apiRequest(`/api/admin/studies/topics/${topic.id}`, { method: "DELETE" });
    await reload("Aula excluida.");
  }

  async function deletePending(item: StudyPendingItem) {
    if (!window.confirm(`Excluir a pendencia "${item.title}"?`)) return;
    await apiRequest(`/api/admin/studies/pending/${item.id}`, { method: "DELETE" });
    await reload("Pendencia excluida.");
  }

  async function addMaterial() {
    if (!selectedTopic || !materialDraft.title.trim()) {
      setError("Informe o titulo do material.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/admin/studies/materials", {
        method: "POST",
        body: JSON.stringify({
          topicId: selectedTopic.id,
          type: materialDraft.type,
          title: materialDraft.title,
          url: materialDraft.url || null,
          description: materialDraft.description,
          metadata: materialDraft.metadata,
        }),
      });
      setMaterialDraft({ type: "link", title: "", url: "", description: "", metadata: "" });
      await reload("Material adicionado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel adicionar material.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaterial(material: StudyMaterial) {
    if (!window.confirm(`Excluir o material "${material.title}"?`)) return;
    await apiRequest(`/api/admin/studies/materials/${material.id}`, { method: "DELETE" });
    await reload("Material excluido.");
  }

  async function persistModuleOrder(nextModules: StudyModule[], moduleId: string, courseId: string) {
    const nextIndex = nextModules.findIndex((module) => module.id === moduleId);
    await apiRequest("/api/admin/studies/modules/reorder", {
      method: "POST",
      body: JSON.stringify({
        moduleId,
        courseId,
        beforeId: nextModules[nextIndex - 1]?.id ?? null,
        afterId: nextModules[nextIndex + 1]?.id ?? null,
      }),
    });
  }

  function handleModuleDrop(targetId: string | null) {
    if (!draggedModuleId || !activeCourse) return;
    setDropTargetId(null);
    setCourses((current) => {
      const nextCourses = current.map((course) => {
        if (course.id !== activeCourse.id) return course;
        const dragged = course.modules.find((module) => module.id === draggedModuleId);
        if (!dragged) return course;
        const withoutDragged = course.modules.filter((module) => module.id !== draggedModuleId);
        const targetIndex = targetId ? withoutDragged.findIndex((module) => module.id === targetId) : withoutDragged.length;
        const insertIndex = targetIndex < 0 ? withoutDragged.length : targetIndex;
        const next = [...withoutDragged.slice(0, insertIndex), dragged, ...withoutDragged.slice(insertIndex)];
        void persistModuleOrder(next, draggedModuleId, course.id).catch((caught) => {
          setError(caught instanceof Error ? caught.message : "Nao foi possivel reordenar.");
          void reload();
        });
        return { ...course, modules: next };
      });
      return nextCourses;
    });
    setDraggedModuleId(null);
  }

  async function persistTopicOrder(nextTopics: StudyTopic[], moduleId: string, topicId: string) {
    const nextIndex = nextTopics.findIndex((topic) => topic.id === topicId);
    await apiRequest("/api/admin/studies/topics/reorder", {
      method: "POST",
      body: JSON.stringify({
        topicId,
        moduleId,
        beforeId: nextTopics[nextIndex - 1]?.id ?? null,
        afterId: nextTopics[nextIndex + 1]?.id ?? null,
      }),
    });
  }

  function handleTopicDrop(moduleId: string, targetId: string | null) {
    if (!draggedTopic) return;
    setDropTargetId(null);
    setCourses((current) => {
      const nextCourses = current.map((course) => {
        const dragged = course.modules.flatMap((module) => module.topics).find((topic) => topic.id === draggedTopic.topicId);
        if (!dragged) return course;
        return {
          ...course,
          modules: course.modules.map((module) => {
            if (module.id === draggedTopic.moduleId && draggedTopic.moduleId !== moduleId) {
              return { ...module, topics: module.topics.filter((topic) => topic.id !== draggedTopic.topicId) };
            }
            if (module.id !== moduleId) return module;
            const withoutDragged = module.topics.filter((topic) => topic.id !== draggedTopic.topicId);
            const targetIndex = targetId ? withoutDragged.findIndex((topic) => topic.id === targetId) : withoutDragged.length;
            const insertIndex = targetIndex < 0 ? withoutDragged.length : targetIndex;
            const nextTopics = [...withoutDragged.slice(0, insertIndex), { ...dragged, moduleId }, ...withoutDragged.slice(insertIndex)];
            void persistTopicOrder(nextTopics, moduleId, draggedTopic.topicId).catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Nao foi possivel reordenar a aula.");
              void reload();
            });
            return { ...module, topics: nextTopics };
          }),
        };
      });
      return nextCourses;
    });
    setDraggedTopic(null);
  }

  function allowDrop(event: DragEvent<HTMLElement>, id: string) {
    event.preventDefault();
    setDropTargetId(id);
  }

  function resetFilters() {
    setStatusFilter("all");
    setModuleFilter("all");
    setPriorityFilter("all");
  }

  const filterListItems = [
    {
      id: "status-all",
      label: "Todos os status",
      selected: statusFilter === "all",
      icon: <Layers3 aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setStatusFilter("all"),
    },
    ...topicStatusOptions.map((option) => ({
      id: `status-${option.value}`,
      label: option.label,
      selected: statusFilter === option.value,
      icon: <CheckCircle2 aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setStatusFilter(option.value),
    })),
    {
      id: "module-all",
      label: "Todos os modulos",
      selected: moduleFilter === "all",
      icon: <BookOpen aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setModuleFilter("all"),
    },
    ...activeCourseModules.map((module) => ({
      id: `module-${module.id}`,
      label: module.title,
      selected: moduleFilter === module.id,
      icon: <BookOpen aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setModuleFilter(module.id),
    })),
    {
      id: "priority-all",
      label: "Todas prioridades",
      selected: priorityFilter === "all",
      icon: <Flag aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setPriorityFilter("all"),
    },
    ...priorityOptions.map((option) => ({
      id: `priority-${option.value}`,
      label: option.label,
      selected: priorityFilter === option.value,
      icon: <Flag aria-hidden="true" className="h-4 w-4" />,
      onSelect: () => setPriorityFilter(option.value),
    })),
  ];

  const sortListItems = [
    {
      id: "manual",
      label: "Ordem manual",
      selected: sortMode === "manual",
      onSelect: () => {
        setSortMode("manual");
        setIsSortPopoverOpen(false);
      },
    },
    {
      id: "updated_desc",
      label: "Atualizados recentemente",
      selected: sortMode === "updated_desc",
      onSelect: () => {
        setSortMode("updated_desc");
        setIsSortPopoverOpen(false);
      },
    },
    {
      id: "progress_desc",
      label: "Maior progresso",
      selected: sortMode === "progress_desc",
      onSelect: () => {
        setSortMode("progress_desc");
        setIsSortPopoverOpen(false);
      },
    },
    {
      id: "priority_desc",
      label: "Maior prioridade",
      selected: sortMode === "priority_desc",
      onSelect: () => {
        setSortMode("priority_desc");
        setIsSortPopoverOpen(false);
      },
    },
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CourseHero
          activeCourse={activeCourse}
          stats={stats}
          coursesInProgress={coursesInProgress.length}
          onCreateCourse={() => openCourseDrawer()}
          onCreateModule={() => activeCourse && startInlineModule(activeCourse.id)}
        />
        <StudyQueuePanel
          nextTopics={nextTopics}
          pendingItems={filteredPendingItems.slice(0, 4)}
          onOpenTopic={(topic) => openTopicDrawer(topic.moduleId, topic)}
          onOpenPending={openPendingDrawer}
          onCreatePending={() => openPendingDrawer()}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {feedback ? <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">{feedback}</p> : null}
          {error ? <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">{error}</p> : null}
        </div>

        <Toolbar variant="ghost" className="ml-auto flex-wrap justify-end">
          <div ref={filterPopoverRef} className="relative inline-flex items-center">
            <IconButton
              type="button"
              onClick={() => {
                setIsFilterPopoverOpen((current) => !current);
                setIsSortPopoverOpen(false);
              }}
              variant={hasActiveFilters ? "info" : "secondary"}
              selected={hasActiveFilters}
              aria-label="Abrir filtros"
              title="Abrir filtros"
            >
              <span className="relative inline-flex">
                <Filter aria-hidden="true" className={cx("h-[18px] w-[18px]", hasActiveFilters && "fill-current")} />
                {activeFilterCount > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f9cf5a] ring-2 ring-[#f8f9fd]" /> : null}
              </span>
            </IconButton>

            {isFilterPopoverOpen ? (
              <div data-filter-popover className="absolute left-0 top-[3.15rem] z-30 w-[min(350px,calc(100vw-2rem))] rounded-[24px] border border-[#d7ddea] bg-white shadow-[0_24px_50px_rgba(20,28,45,0.18)] sm:left-auto sm:right-0">
                <div className="flex items-center justify-between border-b border-[#e6eaf3] px-4 py-3.5">
                  <p className="text-sm font-semibold text-[#161d2c]">Filtros</p>
                  <button
                    type="button"
                    onClick={() => setIsFilterPopoverOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5f687e] transition hover:bg-[#f1f4fa] hover:text-[#1f2738]"
                    aria-label="Fechar filtros"
                    title="Fechar filtros"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4 rotate-45" />
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto p-2">
                  <ListBox items={filterListItems} ariaLabel="Filtros de estudos" />
                </div>
                <div className="border-t border-[#e6eaf3] px-4 py-3">
                  <CommonButton type="button" variant="secondary" className="h-9 w-full" onClick={resetFilters} disabled={!hasActiveFilters}>
                    Limpar filtros
                  </CommonButton>
                </div>
              </div>
            ) : null}
          </div>

          <ToolbarItem>
            <div ref={sortPopoverRef} className="relative inline-flex items-center">
              <IconButton
                type="button"
                onClick={() => {
                  setIsSortPopoverOpen((current) => !current);
                  setIsFilterPopoverOpen(false);
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
                  <ListBox items={sortListItems} ariaLabel="Ordenacao de estudos" />
                </div>
              ) : null}
            </div>
          </ToolbarItem>

          <ToolbarItem
            className={cx(
              "h-10 overflow-hidden rounded-[10px] border transition-[width,border-color,background-color] duration-300",
              isSearchOpen ? "w-[min(20rem,calc(100vw-7rem))] border-transparent bg-transparent" : "w-10 border-transparent bg-transparent",
            )}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setIsSearchOpen(true);
              }}
              className="flex h-full w-full items-center"
            >
              <button
                type="button"
                onClick={() => setIsSearchOpen((current) => !current)}
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
                placeholder="Buscar estudos"
                className={cx(
                  "h-full min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm text-[#131823] outline-none placeholder:text-[#9aa3b8] transition-opacity duration-200",
                  isSearchOpen ? "opacity-100" : "pointer-events-none opacity-0",
                )}
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
            </form>
          </ToolbarItem>

          <ToolbarItem>
            <CommonButton type="button" variant="primary" className="h-10 px-3" onClick={() => openCourseDrawer()}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Curso
            </CommonButton>
          </ToolbarItem>
        </Toolbar>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
        <section
          className="rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleModuleDrop(null)}
          aria-label="Catalogo de cursos"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#151b29]">Catalogo de cursos</h3>
              <p className="text-sm text-[#6c7489]">
                {filteredCourses.length} {filteredCourses.length === 1 ? "curso organizado" : "cursos organizados"}
              </p>
            </div>
            <IconButton type="button" variant="info" aria-label="Criar curso" title="Criar curso" onClick={() => openCourseDrawer()}>
              <Plus aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>

          {filteredCourses.length ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
              {filteredCourses.map((course, index) => (
                <CourseModuleCard
                  key={course.id}
                  course={course}
                  index={index}
                  selected={activeCourse?.id === course.id}
                  onSelect={() => setSelectedCourseId(course.id)}
                  onEdit={() => openCourseDrawer(course)}
                  onDelete={() => deleteCourse(course)}
                  onCreateModule={() => startInlineModule(course.id)}
                  inlineModuleDraft={inlineModuleCourseId === course.id ? inlineModuleDraft : null}
                  saving={saving}
                  onInlineModuleChange={setInlineModuleDraft}
                  onInlineModuleSubmit={saveInlineModule}
                  onInlineModuleCancel={cancelInlineModule}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum curso encontrado" description="Crie um curso ou ajuste os filtros para retomar a trilha de estudos." actionLabel="Criar curso" onAction={() => openCourseDrawer()} />
          )}
        </section>

        <ModuleDetailPanel
          course={activeCourse}
          saving={saving}
          draggedModuleId={draggedModuleId}
          draggedTopic={draggedTopic}
          dropTargetId={dropTargetId}
          onEditCourse={openCourseDrawer}
          onCreateCourse={() => openCourseDrawer()}
          onEditModule={(module) => openModuleDrawer(module, activeCourse?.id ?? "")}
          onDeleteModule={deleteModule}
          onCreateModule={startInlineModule}
          inlineModuleDraft={activeCourse && inlineModuleCourseId === activeCourse.id ? inlineModuleDraft : null}
          onInlineModuleChange={setInlineModuleDraft}
          onInlineModuleSubmit={saveInlineModule}
          onInlineModuleCancel={cancelInlineModule}
          onCreateTopic={startInlineLesson}
          inlineLessonModuleId={inlineLessonModuleId}
          inlineLessonDraft={inlineLessonDraft}
          onInlineLessonChange={setInlineLessonDraft}
          onInlineLessonSubmit={saveInlineLesson}
          onInlineLessonCancel={cancelInlineLesson}
          onOpenTopic={(moduleId, topic) => openTopicDrawer(moduleId, topic)}
          onDeleteTopic={deleteTopic}
          onSetTopicStatus={setTopicStatus}
          onModuleDragStart={(moduleId) => setDraggedModuleId(moduleId)}
          onModuleDragOver={allowDrop}
          onModuleDrop={handleModuleDrop}
          onModuleDragEnd={() => {
            setDraggedModuleId(null);
            setDropTargetId(null);
          }}
          onTopicDragStart={(moduleId, topicId) => setDraggedTopic({ moduleId, topicId })}
          onTopicDragOver={allowDrop}
          onTopicDrop={handleTopicDrop}
          onTopicDragEnd={() => {
            setDraggedTopic(null);
            setDropTargetId(null);
          }}
        />
      </div>

      <Drawer
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
        title={
          drawer?.mode === "course"
            ? drawer.courseId
              ? "Editar curso"
              : "Novo curso"
            : drawer?.mode === "module"
            ? drawer.moduleId
              ? "Editar modulo"
              : "Novo modulo"
            : drawer?.mode === "topic"
              ? drawer.topicId
                ? "Editar aula"
                : "Nova aula"
              : drawer?.mode === "pending"
                ? drawer.pendingId
                  ? "Editar pendencia"
                  : "Nova pendencia"
                : ""
        }
        description="As alteracoes sao salvas no banco e aparecem no dashboard."
        primaryAction={{
          label: saving ? "Salvando..." : "Salvar",
          onClick: drawer?.mode === "course" ? saveCourse : drawer?.mode === "module" ? saveModule : drawer?.mode === "topic" ? saveTopic : savePending,
          disabled: saving,
        }}
        secondaryAction={drawer?.mode === "pending" && drawer.pendingId ? { label: "Excluir", onClick: () => {
          const item = pendingItems.find((pendingItem) => pendingItem.id === drawer.pendingId);
          if (item) void deletePending(item).then(() => setDrawer(null));
        } } : undefined}
        fullScreen={drawer?.mode === "topic"}
      >
        {drawer?.mode === "course" ? (
          <CourseForm draft={courseDraft} onChange={setCourseDraft} />
        ) : drawer?.mode === "module" ? (
          <ModuleForm courses={courses} draft={moduleDraft} onChange={setModuleDraft} />
        ) : drawer?.mode === "topic" ? (
          <TopicForm
            modules={modules}
            draft={topicDraft}
            onChange={setTopicDraft}
            selectedTopic={selectedTopic}
            materialDraft={materialDraft}
            onMaterialDraftChange={setMaterialDraft}
            onAddMaterial={addMaterial}
            onDeleteMaterial={deleteMaterial}
            saving={saving}
          />
        ) : drawer?.mode === "pending" ? (
          <PendingForm modules={modules} draft={pendingDraft} onChange={setPendingDraft} />
        ) : null}
      </Drawer>
    </div>
  );
}

function courseAccent(index: number) {
  const accents = [
    {
      cover: "bg-[#eef4ff] text-[#4f6fad]",
      line: "bg-[#4f6fad]",
      chip: "info" as ChipType,
      icon: <BookOpen aria-hidden="true" className="h-5 w-5" />,
    },
    {
      cover: "bg-[#f1f7ec] text-[#4f8a42]",
      line: "bg-[#5f9b4f]",
      chip: "success" as ChipType,
      icon: <Layers3 aria-hidden="true" className="h-5 w-5" />,
    },
    {
      cover: "bg-[#fff5df] text-[#a46f17]",
      line: "bg-[#d59a2d]",
      chip: "warning" as ChipType,
      icon: <Sparkles aria-hidden="true" className="h-5 w-5" />,
    },
    {
      cover: "bg-[#fff0f3] text-[#b94b61]",
      line: "bg-[#d75d72]",
      chip: "destructive" as ChipType,
      icon: <Flag aria-hidden="true" className="h-5 w-5" />,
    },
  ];
  return accents[index % accents.length];
}

function CourseHero({
  activeCourse,
  stats,
  coursesInProgress,
  onCreateCourse,
  onCreateModule,
}: {
  activeCourse: StudyCourse | null;
  stats: StudyDashboardData["stats"];
  coursesInProgress: number;
  onCreateCourse: () => void;
  onCreateModule: () => void;
}) {
  const currentLabel = activeCourse ? `${activeCourse.progress}% concluido` : "Sem curso ativo";

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#d8deea] bg-white shadow-[0_14px_30px_rgba(29,38,58,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Chip label="Centro de estudos" type="info" surface="neutral" size="sm" showIconLeft iconLeft={<BookOpen aria-hidden="true" />} />
            <Chip label={currentLabel} type={activeCourse?.progress === 100 ? "success" : "secondary"} size="sm" />
          </div>

          <div className="mt-5 max-w-[720px]">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#7a8498]">Trilha atual</p>
            <h3 className="mt-1 text-[1.65rem] font-semibold leading-tight text-[#121723] sm:text-[2rem]">
              {activeCourse?.title ?? "Monte seu primeiro curso"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#68738a]">
              {activeCourse?.description || "Organize cursos, modulos, aulas, materiais e pendencias em uma estrutura pronta para crescer."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <CommonButton type="button" variant="primary" className="h-10 px-4" onClick={activeCourse ? onCreateModule : onCreateCourse}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {activeCourse ? "Novo modulo" : "Criar curso"}
            </CommonButton>
            <CommonButton type="button" variant="secondary" className="h-10 px-4" onClick={onCreateCourse}>
              <Layers3 aria-hidden="true" className="h-4 w-4" />
              Curso
            </CommonButton>
          </div>
        </div>

        <div className="border-t border-[#e5ebf4] bg-[#f8faff] p-5 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="Progresso" value={`${stats.overallProgress}%`} />
            <HeroStat label="Modulos" value={stats.modulesCount.toString()} />
            <HeroStat label="Em andamento" value={coursesInProgress.toString()} />
            <HeroStat label="Pendencias" value={stats.openPendingCount.toString()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#dfe6f2] bg-white p-3">
      <p className="text-[11px] font-medium uppercase text-[#7a8498]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#141a27]">{value}</p>
    </div>
  );
}

function CourseModuleCard({
  course,
  index,
  selected,
  saving,
  inlineModuleDraft,
  onSelect,
  onEdit,
  onDelete,
  onCreateModule,
  onInlineModuleChange,
  onInlineModuleSubmit,
  onInlineModuleCancel,
}: {
  course: StudyCourse;
  index: number;
  selected: boolean;
  saving: boolean;
  inlineModuleDraft: InlineModuleDraft | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateModule: () => void;
  onInlineModuleChange: (draft: InlineModuleDraft) => void;
  onInlineModuleSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onInlineModuleCancel: () => void;
}) {
  const accent = courseAccent(index);
  const lessons = course.modules.flatMap((module) => module.topics);
  const completed = lessons.filter((topic) => topic.status === "done").length;
  const active = lessons.filter((topic) => topic.status === "in_progress").length;

  return (
    <article
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cx(
        "group cursor-pointer overflow-hidden rounded-[24px] border bg-white text-left shadow-[var(--ds-shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c6d2e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2",
        selected ? "border-[#9db2e2] ring-2 ring-[#dce6ff]" : "border-[#dde4ef]",
      )}
    >
      <div className={cx("flex min-h-[94px] items-start justify-between p-4", accent.cover)}>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/78 shadow-[var(--ds-shadow-soft)]">
          {accent.icon}
        </div>
        <Chip label={course.progress === 100 ? "Concluido" : active ? "Em andamento" : "Nao iniciado"} type={course.progress === 100 ? "success" : active ? "info" : "tertiary"} size="sm" />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-[1.05rem] font-semibold leading-6 text-[#141a27]">{course.title}</h4>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6c7489]">
              {course.description || "Curso sem descricao."}
            </p>
          </div>
          <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <IconButton
              type="button"
              variant="secondary"
              size="xs"
              aria-label="Editar curso"
              title="Editar curso"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              type="button"
              variant="destructive"
              size="xs"
              aria-label="Excluir curso"
              title="Excluir curso"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#69738a]">
            <span>{completed}/{lessons.length} aulas</span>
            <span>{course.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#eef2f8]">
            <div className={cx("h-full rounded-full transition-all", accent.line)} style={{ width: `${course.progress}%` }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {course.priority ? <Chip label={priorityLabel(course.priority)} type={priorityChip(course.priority)} size="sm" /> : null}
          <Chip label={`${course.modules.length} modulos`} type={accent.chip} surface="neutral" size="sm" />
          <Chip label={`${lessons.length} aulas`} type="tertiary" surface="neutral" size="sm" />
          <CommonButton
            type="button"
            variant="tertiary"
            className="ml-auto h-8 px-2 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onCreateModule();
            }}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Novo modulo
          </CommonButton>
        </div>

        {inlineModuleDraft ? (
          <form
            className="mt-4 space-y-3 rounded-[18px] border border-[#dbe4f2] bg-[#fbfcff] p-3"
            onSubmit={(event) => {
              event.stopPropagation();
              onInlineModuleSubmit(event);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <TextField
              label="Titulo do modulo"
              value={inlineModuleDraft.title}
              onChange={(title) => onInlineModuleChange({ ...inlineModuleDraft, title })}
              placeholder="Ex.: Fundamentos"
            />
            <TextareaField
              label="Descricao curta"
              value={inlineModuleDraft.description}
              onChange={(description) => onInlineModuleChange({ ...inlineModuleDraft, description })}
              placeholder="Resumo opcional"
              rows={2}
            />
            <PrioritySelect value={inlineModuleDraft.priority} onChange={(priority) => onInlineModuleChange({ ...inlineModuleDraft, priority })} compact />
            <div className="flex justify-end gap-2">
              <CommonButton type="button" variant="tertiary" className="h-8 px-2 text-xs" onClick={onInlineModuleCancel} disabled={saving}>
                Cancelar
              </CommonButton>
              <CommonButton type="submit" variant="primary" className="h-8 px-3 text-xs" disabled={saving}>
                {saving ? "Salvando..." : "Salvar modulo"}
              </CommonButton>
            </div>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ModuleDetailPanel({
  course,
  saving,
  draggedModuleId,
  draggedTopic,
  dropTargetId,
  onEditCourse,
  onCreateCourse,
  onEditModule,
  onDeleteModule,
  onCreateModule,
  inlineModuleDraft,
  onInlineModuleChange,
  onInlineModuleSubmit,
  onInlineModuleCancel,
  onCreateTopic,
  inlineLessonModuleId,
  inlineLessonDraft,
  onInlineLessonChange,
  onInlineLessonSubmit,
  onInlineLessonCancel,
  onOpenTopic,
  onDeleteTopic,
  onSetTopicStatus,
  onModuleDragStart,
  onModuleDragOver,
  onModuleDrop,
  onModuleDragEnd,
  onTopicDragStart,
  onTopicDragOver,
  onTopicDrop,
  onTopicDragEnd,
}: {
  course: StudyCourse | null;
  saving: boolean;
  draggedModuleId: string | null;
  draggedTopic: { moduleId: string; topicId: string } | null;
  dropTargetId: string | null;
  onEditCourse: (course: StudyCourse) => void;
  onCreateCourse: () => void;
  onEditModule: (module: StudyModule) => void;
  onDeleteModule: (module: StudyModule) => void;
  onCreateModule: (courseId: string) => void;
  inlineModuleDraft: InlineModuleDraft | null;
  onInlineModuleChange: (draft: InlineModuleDraft) => void;
  onInlineModuleSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onInlineModuleCancel: () => void;
  onCreateTopic: (moduleId: string) => void;
  inlineLessonModuleId: string | null;
  inlineLessonDraft: InlineLessonDraft;
  onInlineLessonChange: (draft: InlineLessonDraft) => void;
  onInlineLessonSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onInlineLessonCancel: () => void;
  onOpenTopic: (moduleId: string, topic: StudyTopic) => void;
  onDeleteTopic: (topic: StudyTopic) => void;
  onSetTopicStatus: (topic: StudyTopic, status: StudyTopicStatus) => void;
  onModuleDragStart: (moduleId: string) => void;
  onModuleDragOver: (event: DragEvent<HTMLElement>, id: string) => void;
  onModuleDrop: (targetId: string | null) => void;
  onModuleDragEnd: () => void;
  onTopicDragStart: (moduleId: string, topicId: string) => void;
  onTopicDragOver: (event: DragEvent<HTMLElement>, id: string) => void;
  onTopicDrop: (moduleId: string, targetId: string | null) => void;
  onTopicDragEnd: () => void;
}) {
  if (!course) {
    return (
      <section className="rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)]">
        <EmptyState title="Nenhum curso selecionado" description="Crie ou selecione um curso para visualizar modulos e aulas." actionLabel="Criar curso" onAction={onCreateCourse} />
      </section>
    );
  }
  const lessons = course.modules.flatMap((module) => module.topics);

  return (
    <section className="rounded-[28px] border border-[#dde4ef] bg-white shadow-[var(--ds-shadow-soft)]">
      <div className="border-b border-[#e5ebf4] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip label="Curso ativo" type="info" surface="neutral" size="sm" showIconLeft iconLeft={<PlayCircle aria-hidden="true" />} />
              <Chip label={`${course.progress}%`} type={course.progress === 100 ? "success" : "secondary"} size="sm" />
              {course.priority ? <Chip label={priorityLabel(course.priority)} type={priorityChip(course.priority)} size="sm" /> : null}
            </div>
            <h3 className="mt-3 text-[1.45rem] font-semibold leading-tight text-[#141a27]">{course.title}</h3>
            {course.description ? <p className="mt-2 max-w-[760px] text-sm leading-6 text-[#6c7489]">{course.description}</p> : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <CommonButton type="button" variant="secondary" className="h-10 px-3" onClick={() => onEditCourse(course)}>
              Editar
            </CommonButton>
            <CommonButton type="button" variant="primary" className="h-10 px-3" onClick={() => onCreateModule(course.id)}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Novo modulo
            </CommonButton>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ModuleMiniStat label="Modulos" value={course.modules.length.toString()} />
          <ModuleMiniStat label="Aulas" value={lessons.length.toString()} />
          <ModuleMiniStat label="Concluidas" value={lessons.filter((topic) => topic.status === "done").length.toString()} />
        </div>
      </div>

      <div
        className="p-4 sm:p-5"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onModuleDrop(null)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-[#151b29]">Modulos e aulas</h4>
            <p className="text-sm text-[#6c7489]">Estrutura do curso em ordem.</p>
          </div>
        </div>

        {inlineModuleDraft ? (
          <form className="mb-4 rounded-[20px] border border-[#dbe4f2] bg-[#fbfcff] p-3" onSubmit={onInlineModuleSubmit}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px]">
              <TextField
                label="Novo modulo"
                value={inlineModuleDraft.title}
                onChange={(title) => onInlineModuleChange({ ...inlineModuleDraft, title })}
                placeholder="Titulo do modulo"
              />
              <TextField
                label="Descricao"
                value={inlineModuleDraft.description}
                onChange={(description) => onInlineModuleChange({ ...inlineModuleDraft, description })}
                placeholder="Descricao opcional"
              />
              <PrioritySelect value={inlineModuleDraft.priority} onChange={(priority) => onInlineModuleChange({ ...inlineModuleDraft, priority })} compact />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <CommonButton type="button" variant="tertiary" className="h-9 px-3" onClick={onInlineModuleCancel} disabled={saving}>
                Cancelar
              </CommonButton>
              <CommonButton type="submit" variant="primary" className="h-9 px-3" disabled={saving}>
                {saving ? "Salvando..." : "Salvar modulo"}
              </CommonButton>
            </div>
          </form>
        ) : null}

        {course.modules.length ? (
          <div className="space-y-4">
            {course.modules.map((module, moduleIndex) => (
              <section
                key={module.id}
                draggable
                className={cx(
                  "rounded-[22px] border border-[#dfe6f2] bg-[#fbfcff] p-3 transition-all duration-200",
                  draggedModuleId === module.id && "cursor-grabbing opacity-45 shadow-[0_18px_36px_rgba(24,35,55,0.16)]",
                  dropTargetId === module.id && "border-[#8fb8ff] ring-2 ring-[#cfe0ff]",
                )}
                onDragStart={(event) => {
                  event.stopPropagation();
                  onModuleDragStart(module.id);
                }}
                onDragOver={(event) => onModuleDragOver(event, module.id)}
                onDrop={(event) => {
                  event.stopPropagation();
                  if (draggedTopic) {
                    onTopicDrop(module.id, null);
                  } else {
                    onModuleDrop(module.id);
                  }
                }}
                onDragEnd={onModuleDragEnd}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase text-[#7a8498]">Modulo {moduleIndex + 1}</p>
                    <h5 className="text-sm font-semibold text-[#172033]">{module.title}</h5>
                    {module.description ? <p className="mt-1 text-xs text-[#6c7489]">{module.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <CommonButton type="button" variant="tertiary" className="h-8 px-2 text-xs" onClick={() => onEditModule(module)}>
                      Editar
                    </CommonButton>
                    <IconButton type="button" variant="destructive" size="sm" aria-label="Excluir modulo" title="Excluir modulo" onClick={() => onDeleteModule(module)}>
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                    <CommonButton type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => onCreateTopic(module.id)}>
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                      Nova aula
                    </CommonButton>
                  </div>
                </div>

                {inlineLessonModuleId === module.id ? (
                  <form className="mb-3 rounded-[18px] border border-[#dbe4f2] bg-white p-3" onSubmit={onInlineLessonSubmit}>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px]">
                      <TextField
                        label="Nova aula"
                        value={inlineLessonDraft.title}
                        onChange={(title) => onInlineLessonChange({ ...inlineLessonDraft, title })}
                        placeholder="Titulo da aula"
                      />
                      <SelectField label="Status" value={inlineLessonDraft.status} onChange={(status) => onInlineLessonChange({ ...inlineLessonDraft, status: status as StudyTopicStatus })}>
                        {topicStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                      <PrioritySelect value={inlineLessonDraft.priority} onChange={(priority) => onInlineLessonChange({ ...inlineLessonDraft, priority })} compact />
                      <TextField label="Prazo" type="date" value={inlineLessonDraft.dueAt} onChange={(dueAt) => onInlineLessonChange({ ...inlineLessonDraft, dueAt })} />
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <CommonButton type="button" variant="tertiary" className="h-8 px-2 text-xs" onClick={onInlineLessonCancel} disabled={saving}>
                        Cancelar
                      </CommonButton>
                      <CommonButton type="submit" variant="primary" className="h-8 px-3 text-xs" disabled={saving}>
                        {saving ? "Salvando..." : "Salvar aula"}
                      </CommonButton>
                    </div>
                  </form>
                ) : null}

                {module.topics.length ? (
                  <div className="space-y-2">
                    {module.topics.map((topic, index) => (
                      <LessonRow
                        key={topic.id}
                        index={index}
                        topic={topic}
                        saving={saving}
                        grabbed={draggedTopic?.topicId === topic.id}
                        dropTarget={dropTargetId === topic.id}
                        onOpen={() => onOpenTopic(module.id, topic)}
                        onDelete={() => onDeleteTopic(topic)}
                        onSetStatus={(status) => onSetTopicStatus(topic, status)}
                        onDragStart={() => onTopicDragStart(module.id, topic.id)}
                        onDragOver={(event) => onTopicDragOver(event, topic.id)}
                        onDrop={(event) => {
                          event.stopPropagation();
                          onTopicDrop(module.id, topic.id);
                        }}
                        onDragEnd={onTopicDragEnd}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-dashed border-[#ccd7ea] bg-white p-4 text-sm text-[#69738a]">
                    Este modulo ainda nao tem aulas.
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="Curso sem modulos" description="Adicione o primeiro modulo para estruturar as aulas deste curso." actionLabel="Criar modulo" onAction={() => onCreateModule(course.id)} />
        )}
      </div>
    </section>
  );
}

function ModuleMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#e0e6f0] bg-[#fbfcff] p-3">
      <p className="text-[11px] font-medium uppercase text-[#7a8498]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#151b29]">{value}</p>
    </div>
  );
}

function LessonRow({
  index,
  topic,
  saving,
  grabbed,
  dropTarget,
  onOpen,
  onDelete,
  onSetStatus,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  index: number;
  topic: StudyTopic;
  saving: boolean;
  grabbed: boolean;
  dropTarget: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onSetStatus: (status: StudyTopicStatus) => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const nextStatus: StudyTopicStatus = topic.status === "done" ? "in_progress" : "done";

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cx(
        "group rounded-[20px] border bg-[#fbfcff] p-3 transition-all duration-200 hover:border-[#c6d2e5] hover:bg-white",
        grabbed && "cursor-grabbing opacity-45",
        dropTarget && "border-[#8fb8ff] ring-2 ring-[#cfe0ff]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2]">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-sm font-semibold text-[#62708a] shadow-[var(--ds-shadow-soft)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span className={cx("block text-sm font-semibold text-[#172033]", topic.status === "done" && "text-[#7e8798] line-through")}>
              {topic.title}
            </span>
            <span className="mt-1 flex flex-wrap gap-2">
              <Chip label={topicStatusLabel(topic.status)} type={topicStatusChip(topic.status)} size="sm" />
              <Chip label={formatDate(topic.dueAt)} type="info" surface="neutral" size="sm" showIconLeft iconLeft={<CalendarClock aria-hidden="true" />} />
              {topic.priority ? <Chip label={priorityLabel(topic.priority)} type={priorityChip(topic.priority)} size="sm" /> : null}
              {topic.materials.length ? <Chip label="Materiais" counter={topic.materials.length} showCounter type="secondary" size="sm" /> : null}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {topic.status === "not_started" ? (
            <CommonButton type="button" variant="secondary" usage="info" className="h-9 px-3" disabled={saving} onClick={() => onSetStatus("in_progress")}>
              <PlayCircle aria-hidden="true" className="h-4 w-4" />
              Iniciar
            </CommonButton>
          ) : (
            <CommonButton type="button" variant="secondary" usage={topic.status === "done" ? "general" : "success"} className="h-9 px-3" disabled={saving} onClick={() => onSetStatus(nextStatus)}>
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              {topic.status === "done" ? "Reabrir" : "Concluir"}
            </CommonButton>
          )}
          <IconButton type="button" variant="destructive" size="sm" aria-label="Excluir aula" title="Excluir aula" onClick={onDelete}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function StudyQueuePanel({
  nextTopics,
  pendingItems,
  onOpenTopic,
  onOpenPending,
  onCreatePending,
}: {
  nextTopics: Array<StudyTopic & { moduleTitle: string }>;
  pendingItems: StudyPendingItem[];
  onOpenTopic: (topic: StudyTopic & { moduleTitle: string }) => void;
  onOpenPending: (item: StudyPendingItem) => void;
  onCreatePending: () => void;
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-[26px] border border-[#dfe6f2] bg-white p-4 shadow-[var(--ds-shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#151b29]">Proximas aulas</h3>
            <p className="text-sm text-[#6c7489]">Fila de estudo</p>
          </div>
          <CalendarClock aria-hidden="true" className="h-5 w-5 text-[#7b879d]" />
        </div>

        <div className="mt-4 space-y-2">
          {nextTopics.length ? (
            nextTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onOpenTopic(topic)}
                className="w-full rounded-[16px] border border-[#e1e7f1] bg-[#fbfcff] p-3 text-left transition hover:border-[#c6d2e5] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2]"
              >
                <p className="text-sm font-semibold text-[#172033]">{topic.title}</p>
                <p className="mt-1 text-xs text-[#6c7489]">{topic.moduleTitle} · {formatDate(topic.dueAt)}</p>
              </button>
            ))
          ) : (
            <p className="rounded-[16px] border border-dashed border-[#ccd7ea] bg-[#fafcff] p-3 text-sm text-[#69738a]">
              Nenhuma aula pendente.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[26px] border border-[#dfe6f2] bg-white p-4 shadow-[var(--ds-shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[#151b29]">Pendencias</h3>
            <p className="text-sm text-[#6c7489]">Rotina e prazos</p>
          </div>
          <IconButton type="button" variant="info" aria-label="Criar pendencia" title="Criar pendencia" onClick={onCreatePending}>
            <Plus aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-4 space-y-2">
          {pendingItems.length ? (
            pendingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenPending(item)}
                className="w-full rounded-[18px] border border-[#dfe6f2] bg-[#fbfcff] p-3 text-left transition hover:border-[#b8c7e5] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-[#172033]">{item.title}</p>
                  <Chip label={pendingStatusLabel(item.status)} type={pendingStatusChip(item.status)} size="sm" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip label={formatDate(item.dueAt)} type="info" surface="neutral" size="sm" showIconLeft iconLeft={<CalendarClock aria-hidden="true" />} />
                  {item.priority ? <Chip label={priorityLabel(item.priority)} type={priorityChip(item.priority)} size="sm" /> : null}
                  {item.syncToTasks ? <Chip label="Tasks" type="secondary" size="sm" /> : null}
                </div>
              </button>
            ))
          ) : (
            <p className="rounded-[18px] border border-dashed border-[#ccd7ea] bg-[#fafcff] p-4 text-sm text-[#69738a]">
              Nenhuma pendencia para os filtros atuais.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-[150px]">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[14px] border border-[#d9e1ee] bg-white px-3 text-sm text-[#1b2435] outline-none transition focus:border-[#8fa6d8] focus:ring-2 focus:ring-[#dce6ff]"
      >
        {children}
      </select>
    </label>
  );
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-[26px] border border-dashed border-[#cbd6e8] bg-white p-8 text-center shadow-[var(--ds-shadow-soft)]">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef4ff] text-[#4f6fad]">
        <BookOpen aria-hidden="true" className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-lg font-semibold text-[#141a27]">{title}</h3>
      <p className="mx-auto mt-1 max-w-[440px] text-sm leading-6 text-[#6c7489]">{description}</p>
      <CommonButton type="button" variant="primary" className="mt-4 h-10 px-4" onClick={onAction}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        {actionLabel}
      </CommonButton>
    </div>
  );
}

function CourseForm({ draft, onChange }: { draft: CourseDraft; onChange: (draft: CourseDraft) => void }) {
  return (
    <div className="space-y-4">
      <TextField label="Titulo" value={draft.title} onChange={(title) => onChange({ ...draft, title })} placeholder="Ex.: Front-end do zero ao portfolio" />
      <TextareaField label="Descricao curta" value={draft.description} onChange={(description) => onChange({ ...draft, description })} placeholder="Resumo do objetivo do curso" />
      <PrioritySelect value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} />
    </div>
  );
}

function ModuleForm({
  courses,
  draft,
  onChange,
}: {
  courses: StudyCourse[];
  draft: ModuleDraft;
  onChange: (draft: ModuleDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <SelectField label="Curso" value={draft.courseId} onChange={(courseId) => onChange({ ...draft, courseId })}>
        <option value="">Selecione um curso</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </SelectField>
      <TextField label="Titulo" value={draft.title} onChange={(title) => onChange({ ...draft, title })} placeholder="Ex.: Fundamentos de React" />
      <TextareaField label="Descricao curta" value={draft.description} onChange={(description) => onChange({ ...draft, description })} placeholder="Resumo do objetivo do modulo" />
      <PrioritySelect value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} />
    </div>
  );
}

function TopicForm({
  modules,
  draft,
  onChange,
  selectedTopic,
  materialDraft,
  onMaterialDraftChange,
  onAddMaterial,
  onDeleteMaterial,
  saving,
}: {
  modules: StudyModule[];
  draft: TopicDraft;
  onChange: (draft: TopicDraft) => void;
  selectedTopic: StudyTopic | null;
  materialDraft: MaterialDraft;
  onMaterialDraftChange: (draft: MaterialDraft) => void;
  onAddMaterial: () => void;
  onDeleteMaterial: (material: StudyMaterial) => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <TextField label="Titulo" value={draft.title} onChange={(title) => onChange({ ...draft, title })} placeholder="Ex.: Hooks e estado local" />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Modulo" value={draft.moduleId} onChange={(moduleId) => onChange({ ...draft, moduleId })}>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </SelectField>
          <SelectField label="Status" value={draft.status} onChange={(status) => onChange({ ...draft, status: status as StudyTopicStatus })}>
            {topicStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <PrioritySelect value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} compact />
          <TextField label="Prazo" type="date" value={draft.dueAt} onChange={(dueAt) => onChange({ ...draft, dueAt })} />
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#172033]">Anotacoes</h4>
            <span className="text-xs text-[#7a8498]">Use / para inserir blocos</span>
          </div>
          <RichTextEditor value={draft.notes} onChange={(notes) => onChange({ ...draft, notes })} className="rounded-[18px] border border-[#dfe6f2] bg-[#fbfcff] p-4" />
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-[20px] border border-[#dfe6f2] bg-[#fbfcff] p-4">
          <h4 className="font-semibold text-[#172033]">Materiais complementares</h4>
          <div className="mt-3 space-y-2">
            {selectedTopic?.materials.length ? (
              selectedTopic.materials.map((material) => (
                <div key={material.id} className="rounded-[16px] border border-[#dfe6f2] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                        {materialIcon(material.type)}
                        <span className="truncate">{material.title}</span>
                      </div>
                      {material.description ? <p className="mt-1 text-xs leading-5 text-[#6c7489]">{material.description}</p> : null}
                    </div>
                    <IconButton type="button" variant="destructive" size="xs" aria-label="Excluir material" title="Excluir material" onClick={() => onDeleteMaterial(material)}>
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  {material.url ? (
                    <a href={material.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#3555d2]">
                      Abrir <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-[16px] border border-dashed border-[#ccd7ea] p-3 text-sm text-[#6c7489]">
                Salve a aula e adicione links, imagens por URL, arquivos externos ou referencias.
              </p>
            )}
          </div>
        </section>

        {selectedTopic ? (
          <section className="rounded-[20px] border border-[#dfe6f2] bg-white p-4">
            <h4 className="font-semibold text-[#172033]">Adicionar material</h4>
            <div className="mt-3 space-y-3">
              <SelectField label="Tipo" value={materialDraft.type} onChange={(type) => onMaterialDraftChange({ ...materialDraft, type: type as StudyMaterialType })}>
                {materialOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <TextField label="Titulo" value={materialDraft.title} onChange={(title) => onMaterialDraftChange({ ...materialDraft, title })} />
              <TextField label="URL ou referencia" value={materialDraft.url} onChange={(url) => onMaterialDraftChange({ ...materialDraft, url })} />
              <TextareaField label="Descricao" value={materialDraft.description} onChange={(description) => onMaterialDraftChange({ ...materialDraft, description })} />
              <CommonButton type="button" variant="secondary" className="h-10 w-full" onClick={onAddMaterial} disabled={saving}>
                {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
                Adicionar
              </CommonButton>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function PendingForm({ modules, draft, onChange }: { modules: StudyModule[]; draft: PendingDraft; onChange: (draft: PendingDraft) => void }) {
  const topics = modules.find((module) => module.id === draft.moduleId)?.topics ?? [];
  return (
    <div className="space-y-4">
      <TextField label="Titulo" value={draft.title} onChange={(title) => onChange({ ...draft, title })} placeholder="Ex.: Revisar anotações de closures" />
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField label="Modulo" value={draft.moduleId} onChange={(moduleId) => onChange({ ...draft, moduleId, topicId: "" })}>
          <option value="">Sem modulo</option>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Aula" value={draft.topicId} onChange={(topicId) => onChange({ ...draft, topicId })}>
          <option value="">Sem aula</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" value={draft.status} onChange={(status) => onChange({ ...draft, status: status as StudyPendingStatus })}>
          {pendingStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <PrioritySelect value={draft.priority} onChange={(priority) => onChange({ ...draft, priority })} compact />
        <TextField label="Prazo" type="date" value={draft.dueAt} onChange={(dueAt) => onChange({ ...draft, dueAt })} />
      </div>
      <label className="flex items-center gap-3 rounded-[18px] border border-[#dfe6f2] bg-[#fbfcff] p-4 text-sm text-[#1f293b]">
        <input
          type="checkbox"
          checked={draft.syncToTasks}
          onChange={(event) => onChange({ ...draft, syncToTasks: event.target.checked })}
          className="h-4 w-4 accent-[#4f6fad]"
        />
        Sincronizar com Tasks
      </label>
    </div>
  );
}

function PrioritySelect({ value, onChange, compact = false }: { value: StudyPriority; onChange: (priority: StudyPriority) => void; compact?: boolean }) {
  return (
    <SelectField label="Prioridade" value={value ?? ""} onChange={(next) => onChange((next || null) as StudyPriority)}>
      <option value="">Sem prioridade</option>
      {priorityOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {compact ? option.label : `Prioridade ${option.label.toLowerCase()}`}
        </option>
      ))}
    </SelectField>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-[#778199]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[14px] border border-[#d9e1ee] bg-white px-3 text-sm text-[#1b2435] outline-none transition placeholder:text-[#9aa5b8] focus:border-[#8fa6d8] focus:ring-2 focus:ring-[#dce6ff]"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-[#778199]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-[14px] border border-[#d9e1ee] bg-white px-3 py-2 text-sm leading-6 text-[#1b2435] outline-none transition placeholder:text-[#9aa5b8] focus:border-[#8fa6d8] focus:ring-2 focus:ring-[#dce6ff]"
      />
    </label>
  );
}
