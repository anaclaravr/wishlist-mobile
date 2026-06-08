"use client";

import Link from "next/link";
import {
  ArrowDownUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  Image as ImageIcon,
  Layers3,
  Link as LinkIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Play,
  Search,
  Sparkles,
  Trash2,
  X,
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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Drawer } from "@/components/ui/drawer";
import { CommonButton, IconButton, ListBox, Toolbar, ToolbarItem } from "@/components/ui/button-system";
import { Tabs } from "@/components/ui/tabs";
import { RichTextEditor, type RichTextBlock, type RichTextBlockType } from "@/components/ui/rich-text-editor";
import { LessonAnnotationsBoard } from "@/components/lesson-annotations-board";

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

const courseCategoryOptions = [
  { value: "course", label: "Curso" },
  { value: "bootcamp", label: "Bootcamp" },
  { value: "webinar", label: "Webinar" },
  { value: "article", label: "Artigo" },
  { value: "workshop", label: "Workshop" },
  { value: "book", label: "Livro" },
] as const;

const courseCategoryComboboxOptions: ComboboxOption[] = courseCategoryOptions.map((option) => ({
  ...option,
  chipType: "secondary",
  chipSurface: "neutral",
}));

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
  | { mode: "pending"; pendingId?: string }
  | null;

type StudySortMode = "manual" | "updated_desc" | "progress_desc" | "priority_desc";
type StudiesTab = "general" | "learning" | "pending";

type CourseDraft = {
  title: string;
  description: string;
  category: string;
  coverImageUrl: string;
  priority: StudyPriority;
};

const emptyCourseDraft: CourseDraft = {
  title: "",
  description: "",
  category: "course",
  coverImageUrl: "",
  priority: null,
};

type TopicDraft = {
  moduleId: string;
  title: string;
  status: StudyTopicStatus;
  priority: StudyPriority;
  dueAt: string;
  notes: StudyNoteBlock[];
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
      if (!editorTypes.includes(block.type as RichTextBlockType)) {
        return typeof block.text === "string" && block.text.trim()
          ? {
              id: block.id || `block-${crypto.randomUUID()}`,
              type: "paragraph",
              text: block.text,
            }
          : null;
      }
      const type = block.type as RichTextBlockType;
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

function toTopicDraft(moduleId: string, topic?: StudyTopic): TopicDraft {
  return {
    moduleId,
    title: topic?.title ?? "",
    status: topic?.status ?? "not_started",
    priority: topic?.priority ?? null,
    dueAt: toDateInputValue(topic?.dueAt ?? null),
    notes: topic?.notes?.length ? topic.notes : fromEditorBlocks([emptyEditorBlock()]),
  };
}

function noteText(notes: StudyNoteBlock[]) {
  return notes
    .flatMap((block) => {
      if (Array.isArray(block.elements)) {
        return block.elements
          .filter((element): element is Record<string, unknown> => Boolean(element) && typeof element === "object")
          .map((element) => (typeof element.text === "string" ? element.text : ""));
      }

      return block.text ?? "";
    })
    .join(" ")
    .toLowerCase();
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

function courseCategoryLabel(category: string) {
  return courseCategoryOptions.find((option) => option.value === category)?.label ?? (category || "Curso");
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

export function AdminStudiesDashboard({
  initialData,
  courseId,
}: {
  initialData: StudyDashboardData;
  courseId?: string;
}) {
  const [courses, setCourses] = useState(initialData.courses);
  const [pendingItems, setPendingItems] = useState(initialData.pendingItems);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId ?? initialData.courses[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<StudiesTab>("learning");
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | StudyTopicStatus>("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Exclude<StudyPriority, null>>("all");
  const [sortMode, setSortMode] = useState<StudySortMode>("manual");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [courseDraft, setCourseDraft] = useState<CourseDraft>(emptyCourseDraft);
  const [inlineCourseDraft, setInlineCourseDraft] = useState<CourseDraft | null>(null);
  const [selectedInlineTopicId, setSelectedInlineTopicId] = useState<string | null>(null);
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
    notes: fromEditorBlocks([emptyEditorBlock()]),
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
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const nextCourses = courses
      .map((course) => {
        const courseMatches =
          !normalizedQuery ||
          course.title.toLowerCase().includes(normalizedQuery) ||
          course.description.toLowerCase().includes(normalizedQuery) ||
          courseCategoryLabel(course.category).toLowerCase().includes(normalizedQuery);
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
    (courseId ? courses.find((course) => course.id === courseId) : null) ??
    filteredCourses[0] ??
    courses.find((course) => course.id === selectedCourseId) ??
    courses[0] ??
    null;
  const activeCourseModules = useMemo(() => activeCourse?.modules ?? [], [activeCourse]);
  const activeCourseTopics = useMemo(() => activeCourseModules.flatMap((module) => module.topics), [activeCourseModules]);
  const selectedInlineTopic = selectedInlineTopicId
    ? activeCourseTopics.find((topic) => topic.id === selectedInlineTopicId) ?? null
    : courseId
      ? activeCourseTopics.find((topic) => topic.status === "in_progress") ??
        activeCourseTopics.find((topic) => topic.status !== "done") ??
        activeCourseTopics[0] ??
        null
      : null;
  const activeTopicDraft =
    courseId && selectedInlineTopic && selectedInlineTopic.id !== selectedInlineTopicId
      ? toTopicDraft(selectedInlineTopic.moduleId, selectedInlineTopic)
      : topicDraft;
  const selectedTopic = selectedInlineTopic;
  const selectedInlineTopicIndex = selectedInlineTopic
    ? activeCourseTopics.findIndex((topic) => topic.id === selectedInlineTopic.id)
    : -1;
  const previousInlineTopic = selectedInlineTopicIndex > 0 ? activeCourseTopics[selectedInlineTopicIndex - 1] : null;
  const nextInlineTopic =
    selectedInlineTopicIndex >= 0 && selectedInlineTopicIndex < activeCourseTopics.length - 1
      ? activeCourseTopics[selectedInlineTopicIndex + 1]
      : null;

  useEffect(() => {
    if (!courseId || !activeCourse) return;

    if (!activeCourseTopics.length) {
      if (selectedInlineTopicId) setSelectedInlineTopicId(null);
      return;
    }

    const currentTopic = activeCourseTopics.find((topic) => topic.id === selectedInlineTopicId);
    const nextTopic =
      currentTopic ??
      activeCourseTopics.find((topic) => topic.status === "in_progress") ??
      activeCourseTopics.find((topic) => topic.status !== "done") ??
      activeCourseTopics[0];

    if (!nextTopic || nextTopic.id === selectedInlineTopicId) return;

    setSelectedInlineTopicId(nextTopic.id);
    setTopicDraft(toTopicDraft(nextTopic.moduleId, nextTopic));
    setMaterialDraft({ type: "link", title: "", url: "", description: "", metadata: "" });
  }, [activeCourse, activeCourseTopics, courseId, selectedInlineTopicId]);

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
    setSelectedCourseId((current) => {
      if (courseId && data.courses.some((course) => course.id === courseId)) return courseId;
      return data.courses.some((course) => course.id === current) ? current : (data.courses[0]?.id ?? "");
    });
    if (message) setFeedback(message);
  }

  function openCourseDrawer(course?: StudyCourse) {
    setError(null);
    setDrawer({ mode: "course", courseId: course?.id });
    setCourseDraft({
      title: course?.title ?? "",
      description: course?.description ?? "",
      category: course?.category ?? "course",
      coverImageUrl: course?.coverImageUrl ?? "",
      priority: course?.priority ?? null,
    });
  }

  function startInlineCourse() {
    setError(null);
    setDrawer(null);
    setQuery("");
    setInlineCourseDraft(emptyCourseDraft);
  }

  function cancelInlineCourse() {
    setInlineCourseDraft(null);
  }

  function loadTopicDraft(moduleId: string, topic?: StudyTopic) {
    setTopicDraft(toTopicDraft(moduleId, topic));
    setMaterialDraft({ type: "link", title: "", url: "", description: "", metadata: "" });
  }

  function openInlineTopic(moduleId: string, topic: StudyTopic) {
    setError(null);
    setSelectedInlineTopicId(topic.id);
    loadTopicDraft(moduleId, topic);
  }

  function openTopicCourse(topic: Pick<StudyTopic, "moduleId">) {
    const course = courses.find((currentCourse) => currentCourse.modules.some((module) => module.id === topic.moduleId));
    if (!course) return;
    window.location.href = `/studies/${course.id}`;
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

  async function saveInlineCourse(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!inlineCourseDraft?.title.trim()) {
      setError("Informe o titulo do curso.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiRequest("/api/admin/studies", {
        method: "POST",
        body: JSON.stringify(inlineCourseDraft),
      });
      cancelInlineCourse();
      await reload("Curso salvo.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCourseCover(course: StudyCourse, coverImageUrl: string) {
    setError(null);
    await apiRequest(`/api/admin/studies/courses/${course.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: course.title,
        description: course.description,
        category: course.category,
        coverImageUrl: coverImageUrl.trim(),
        priority: course.priority,
      }),
    });
    await reload(coverImageUrl.trim() ? "Imagem do curso salva." : "Imagem do curso removida.");
  }

  async function deleteCourse(course: StudyCourse) {
    if (!window.confirm(`Excluir o curso "${course.title}" e todo o conteudo dele?`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/studies/courses/${course.id}`, { method: "DELETE" });
      await reload("Curso excluido.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel excluir o curso.");
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

  function startInlineLesson(moduleId: string) {
    setError(null);
    setInlineModuleCourseId(null);
    setInlineLessonModuleId(moduleId);
    setInlineLessonDraft({ ...emptyInlineLessonDraft, moduleId });
  }

  async function saveTopic() {
    const draftToSave = activeTopicDraft;
    if (!draftToSave.title.trim() || !draftToSave.moduleId) {
      setError("Informe modulo e titulo da aula.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      moduleId: draftToSave.moduleId,
      title: draftToSave.title,
      status: draftToSave.status,
      priority: draftToSave.priority,
      dueAt: fromDateInputValue(draftToSave.dueAt),
      notes: draftToSave.notes,
    };
    const editingTopicId = selectedInlineTopic?.id ?? selectedInlineTopicId;
    try {
      if (editingTopicId) {
        await apiRequest(`/api/admin/studies/topics/${editingTopicId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/admin/studies/topics", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await reload("Aula salva.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
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
      {courseId ? (
        <>
          {feedback || error ? (
            <div className="min-w-0">
              {feedback ? <p className="rounded-xl border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm font-medium text-[#276348]">{feedback}</p> : null}
              {error ? <p className="rounded-xl border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm font-medium text-[#9a3042]">{error}</p> : null}
            </div>
          ) : null}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <LessonWorkspace
              course={activeCourse}
              topic={selectedInlineTopic}
              modules={activeCourseModules}
              draft={activeTopicDraft}
              onDraftChange={setTopicDraft}
              materialDraft={materialDraft}
              onMaterialDraftChange={setMaterialDraft}
              onAddMaterial={addMaterial}
              onDeleteMaterial={deleteMaterial}
              onSave={saveTopic}
              saving={saving}
              previousTopic={previousInlineTopic}
              nextTopic={nextInlineTopic}
              onOpenTopic={openInlineTopic}
            />
            <ModuleDetailPanel
              course={activeCourse}
              saving={saving}
              draggedModuleId={draggedModuleId}
              draggedTopic={draggedTopic}
              dropTargetId={dropTargetId}
              selectedTopicId={selectedInlineTopic?.id ?? selectedInlineTopicId}
              panelMode="sidebar"
              onCreateCourse={() => openCourseDrawer()}
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
              onOpenTopic={openInlineTopic}
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
          </section>
        </>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Tabs<StudiesTab>
              value={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  id: "general",
                  label: "Geral",
                  count: courses.length,
                  icon: <Layers3 aria-hidden="true" className="h-5 w-5" />,
                },
                {
                  id: "learning",
                  label: "Meu aprendizado",
                  count: coursesInProgress.length,
                  icon: <BookOpen aria-hidden="true" className="h-5 w-5" />,
                },
                {
                  id: "pending",
                  label: "Pendencias",
                  count: pendingItems.filter((item) => item.status !== "done").length,
                  icon: <CalendarClock aria-hidden="true" className="h-5 w-5" />,
                },
              ]}
            />
          </div>

          {activeTab === "general" ? (
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
                onOpenTopic={openTopicCourse}
                onOpenPending={openPendingDrawer}
                onCreatePending={() => openPendingDrawer()}
              />
            </section>
          ) : null}

      {activeTab === "learning" ? (
        <>
      <section className="space-y-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#151b29]">Continue aprendendo...</h3>
          </div>
        </div>
        {coursesInProgress.length ? (
          <CourseLearningRail courses={coursesInProgress} onSaveCover={saveCourseCover} onDeleteCourse={deleteCourse} />
        ) : (
          <div className="rounded-[20px] border border-dashed border-[#ccd7ea] bg-[#fafcff] p-5 text-sm text-[#69738a]">
            Nenhum curso em andamento. Inicie uma aula para ela aparecer aqui.
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
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
            <CommonButton type="button" variant="primary" className="h-10 px-3" onClick={startInlineCourse}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Novo curso
            </CommonButton>
          </ToolbarItem>
        </Toolbar>
      </div>

      <section className="space-y-4" aria-label="Todos os cursos">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#151b29]">Todos os cursos</h3>
            </div>
          </div>

          {filteredCourses.length || inlineCourseDraft ? (
            <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {inlineCourseDraft ? (
                <InlineCourseCard
                  draft={inlineCourseDraft}
                  onChange={setInlineCourseDraft}
                  onSubmit={saveInlineCourse}
                  onCancel={cancelInlineCourse}
                  saving={saving}
                />
              ) : null}
              {filteredCourses.map((course, index) => (
                <CourseLearningCard key={course.id} course={course} index={index} variant="catalog" onSaveCover={saveCourseCover} onDeleteCourse={deleteCourse} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhum curso encontrado" description="Crie um curso ou ajuste os filtros para retomar a trilha de estudos." actionLabel="Novo curso" onAction={startInlineCourse} />
          )}
        </section>
        </>
      ) : null}

      {activeTab === "pending" ? (
        <PendingTabPanel
          pendingItems={filteredPendingItems}
          onOpenPending={openPendingDrawer}
          onCreatePending={() => openPendingDrawer()}
        />
      ) : null}
        </>
      )}

      <Drawer
        open={Boolean(drawer)}
        onClose={() => setDrawer(null)}
        title={
          drawer?.mode === "course"
            ? drawer.courseId
              ? "Editar curso"
              : "Novo curso"
            : drawer?.mode === "pending"
              ? drawer.pendingId
                ? "Editar pendencia"
                : "Nova pendencia"
              : ""
        }
        description="As alteracoes sao salvas no banco e aparecem no dashboard."
        primaryAction={{
          label: saving ? "Salvando..." : "Salvar",
          onClick: drawer?.mode === "course" ? saveCourse : savePending,
          disabled: saving,
        }}
        secondaryAction={drawer?.mode === "pending" && drawer.pendingId ? { label: "Excluir", onClick: () => {
          const item = pendingItems.find((pendingItem) => pendingItem.id === drawer.pendingId);
          if (item) void deletePending(item).then(() => setDrawer(null));
        } } : undefined}
      >
        {drawer?.mode === "course" ? (
          <CourseForm draft={courseDraft} onChange={setCourseDraft} />
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

function CourseLearningRail({
  courses,
  onSaveCover,
  onDeleteCourse,
}: {
  courses: StudyCourse[];
  onSaveCover: (course: StudyCourse, coverImageUrl: string) => Promise<void>;
  onDeleteCourse: (course: StudyCourse) => Promise<void>;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ hasOverflow: false, canScrollPrev: false, canScrollNext: false });

  function updateScrollState() {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setScrollState({
      hasOverflow: maxScrollLeft > 1,
      canScrollPrev: rail.scrollLeft > 1,
      canScrollNext: rail.scrollLeft < maxScrollLeft - 1,
    });
  }

  function scrollCourses(direction: "prev" | "next") {
    const rail = railRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction === "next" ? rail.clientWidth * 0.82 : -rail.clientWidth * 0.82,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    updateScrollState();
    const rail = railRef.current;
    if (!rail) return;

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    observer?.observe(rail);
    window.addEventListener("resize", updateScrollState);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [courses.length]);

  return (
    <div className="space-y-2">
      {scrollState.hasOverflow ? (
        <div className="flex justify-end gap-2">
          <IconButton
            type="button"
            variant="secondary"
            size="sm"
            aria-label="Cursos anteriores"
            title="Cursos anteriores"
            onClick={() => scrollCourses("prev")}
            disabled={!scrollState.canScrollPrev}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton
            type="button"
            variant="secondary"
            size="sm"
            aria-label="Proximos cursos"
            title="Proximos cursos"
            onClick={() => scrollCourses("next")}
            disabled={!scrollState.canScrollNext}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      ) : null}

      <div
        ref={railRef}
        onScroll={updateScrollState}
        className="flex snap-x gap-3 overflow-x-auto pb-2 pr-2"
      >
        {courses.map((course, index) => (
          <CourseLearningCard key={course.id} course={course} index={index} onSaveCover={onSaveCover} onDeleteCourse={onDeleteCourse} />
        ))}
      </div>
    </div>
  );
}

function CourseLearningCard({
  course,
  index,
  variant = "rail",
  onSaveCover,
  onDeleteCourse,
}: {
  course: StudyCourse;
  index: number;
  variant?: "rail" | "catalog";
  onSaveCover: (course: StudyCourse, coverImageUrl: string) => Promise<void>;
  onDeleteCourse: (course: StudyCourse) => Promise<void>;
}) {
  const accent = courseAccent(index);
  const lessons = course.modules.flatMap((module) => module.topics);
  const completed = lessons.filter((topic) => topic.status === "done").length;
  const active = lessons.filter((topic) => topic.status === "in_progress").length;
  const statusLabel = course.progress === 100 ? "Concluido" : active ? "Em andamento" : "Nao iniciado";
  const statusType: ChipType = course.progress === 100 ? "success" : active ? "info" : "tertiary";
  const statusIcon =
    course.progress === 100 ? (
      <CheckCircle2 aria-hidden="true" />
    ) : active ? (
      <Play aria-hidden="true" />
    ) : (
      <BookOpen aria-hidden="true" />
    );
  const isCatalog = variant === "catalog";

  return (
    <article className={cx("relative", isCatalog ? "h-full w-full" : "w-[min(460px,calc(100vw-3rem))] shrink-0 snap-start")}>
      <Link
        href={`/studies/${course.id}`}
        className={cx(
          "group flex overflow-hidden rounded-[20px] border border-[#dde4ef] bg-white text-left shadow-[var(--ds-shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c6d2e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2",
          isCatalog ? "h-full min-h-[300px] w-full flex-col" : "h-[198px] w-full",
        )}
      >
        <div
          className={cx(
            "relative flex shrink-0 flex-col items-start justify-between bg-cover bg-center p-3",
            isCatalog ? "h-28 w-full" : "w-32",
            course.coverImageUrl ? "text-white" : accent.cover,
          )}
          style={course.coverImageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10, 15, 25, 0.2), rgba(10, 15, 25, 0.64)), url("${course.coverImageUrl}")` } : undefined}
        >
          {!course.coverImageUrl ? (
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/78 shadow-[var(--ds-shadow-soft)]">
              {accent.icon}
            </div>
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/20 shadow-[var(--ds-shadow-soft)] backdrop-blur">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
            </span>
          )}
          <Chip label={statusLabel} type={statusType} surface="neutral" size="sm" showIconLeft iconLeft={statusIcon} />
        </div>

        <div className={cx("flex min-w-0 flex-1 flex-col", isCatalog ? "p-4" : "p-4")}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={courseCategoryLabel(course.category)} type={accent.chip} surface="neutral" size="sm" />
            {course.priority ? <Chip label={priorityLabel(course.priority)} type={priorityChip(course.priority)} size="sm" /> : null}
          </div>
          <h4 className={cx("font-semibold text-[#141a27]", isCatalog ? "mt-3 line-clamp-2 text-[1.02rem] leading-6" : "mt-2 min-h-6 text-[1rem] leading-6")}>{course.title}</h4>
          {course.description ? <p className={cx("mt-1 text-[#6c7489]", isCatalog ? "line-clamp-3 text-sm leading-5" : "line-clamp-2 text-sm leading-5")}>{course.description}</p> : null}

          <div className={cx(isCatalog ? "mt-auto pt-4" : "mt-3")}>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#69738a]">
              <span>{completed}/{lessons.length} aulas</span>
              <span>{course.progress}%</span>
            </div>
            <div className={cx("overflow-hidden rounded-full bg-[#eef2f8]", isCatalog ? "h-2" : "h-2")}>
              <div className={cx("h-full rounded-full transition-all", accent.line)} style={{ width: `${course.progress}%` }} />
            </div>
          </div>

          <div className={cx("flex flex-wrap gap-2", isCatalog ? "pt-4" : "mt-auto pt-2")}>
            <Chip label={`${course.modules.length} modulos`} type="secondary" surface="neutral" size="sm" />
            <Chip label={`${lessons.length} aulas`} type="tertiary" surface="neutral" size="sm" />
          </div>
        </div>
      </Link>
      <CourseCardActions course={course} onSaveCover={onSaveCover} onDeleteCourse={onDeleteCourse} />
    </article>
  );
}

function InlineCourseCard({
  draft,
  onChange,
  onSubmit,
  onCancel,
  saving,
}: {
  draft: CourseDraft;
  onChange: (draft: CourseDraft) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const accent = courseAccent(0);
  const title = draft.title.trim() || "Novo curso";
  const coverImageUrl = draft.coverImageUrl.trim();

  return (
    <article className="relative h-full w-full">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="group flex h-full min-h-[340px] w-full flex-col overflow-visible rounded-[20px] border border-[#9fb7df] bg-white text-left shadow-[var(--ds-shadow-soft)] ring-2 ring-[#dce8ff]"
      >
        <div
          className={cx(
            "relative flex h-28 w-full shrink-0 flex-col items-start justify-between rounded-t-[20px] bg-cover bg-center p-3",
            coverImageUrl ? "text-white" : accent.cover,
          )}
          style={coverImageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10, 15, 25, 0.2), rgba(10, 15, 25, 0.64)), url("${coverImageUrl}")` } : undefined}
        >
          <InlineCourseCoverPopover coverImageUrl={draft.coverImageUrl} onChange={(nextCoverImageUrl) => onChange({ ...draft, coverImageUrl: nextCoverImageUrl })} />
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/78 shadow-[var(--ds-shadow-soft)]">
            <BookOpen aria-hidden="true" className="h-5 w-5" />
          </div>
          <Chip label="Nao iniciado" type="tertiary" surface="neutral" size="sm" showIconLeft iconLeft={<BookOpen aria-hidden="true" />} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <Combobox
            variant="embedded"
            className="w-[220px] max-w-full"
            options={courseCategoryComboboxOptions}
            value={draft.category}
            onChange={(value) => onChange({ ...draft, category: value ?? draft.category })}
            placeholder="Tipo"
          />

          <label className="mt-3 block">
            <span className="sr-only">Titulo do novo curso</span>
            <input
              aria-label="Titulo do novo curso"
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              placeholder={title}
              className="h-9 w-full border-0 bg-transparent px-0 text-[1.08rem] font-semibold leading-6 text-[#141a27] outline-none placeholder:text-[#9da8bb] focus:ring-0"
              autoFocus
            />
          </label>

          <label className="mt-2 block">
            <span className="sr-only">Descricao do novo curso</span>
            <textarea
              aria-label="Descricao do novo curso"
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="Descricao do curso"
              rows={2}
              className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-5 text-[#5f687e] outline-none placeholder:text-[#9da8bb] focus:ring-0"
            />
          </label>

          <div className="mt-auto pt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#69738a]">
              <span>0/0 aulas</span>
              <span>0%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef2f8]" />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <CommonButton type="button" variant="tertiary" className="h-9 px-3 text-sm" onClick={onCancel} disabled={saving}>
              <X aria-hidden="true" className="h-4 w-4" />
              Cancelar
            </CommonButton>
            <CommonButton type="submit" variant="primary" className="h-9 px-3 text-sm" disabled={saving}>
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              Salvar
            </CommonButton>
          </div>
        </div>
      </form>
    </article>
  );
}

function InlineCourseCoverPopover({
  coverImageUrl,
  onChange,
}: {
  coverImageUrl: string;
  onChange: (coverImageUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cleanCoverImageUrl = coverImageUrl.trim();

  return (
    <div className="absolute right-3 top-3 z-20">
      <IconButton
        type="button"
        variant={cleanCoverImageUrl ? "info" : "secondary"}
        size="sm"
        aria-label="Editar imagem do novo curso"
        title="Editar imagem do novo curso"
        selected={open}
        onClick={() => setOpen((current) => !current)}
        className="bg-white/90 shadow-[var(--ds-shadow-soft)] backdrop-blur"
      >
        <ImageIcon aria-hidden="true" className="h-4 w-4" />
      </IconButton>

      {open ? (
        <div className="absolute right-0 top-11 z-30 w-[min(300px,calc(100vw-3rem))] rounded-[18px] border border-[#d7ddea] bg-white p-3 text-left shadow-[0_18px_40px_rgba(20,28,45,0.18)]">
          <label className="block text-xs font-medium text-[#5f687e]">
            Imagem do curso
            <input
              aria-label="URL da imagem do novo curso"
              className="ds-focus mt-1 h-10 w-full rounded-[10px] border border-[#dce3ef] bg-white px-3 text-sm text-[#141a27] outline-none placeholder:text-[#9aa5ba] focus:border-[#b9c6df] focus-visible:ring-2 focus-visible:ring-[#8ea1cc]"
              value={coverImageUrl}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {cleanCoverImageUrl ? (
              <CommonButton type="button" variant="tertiary" className="h-9 px-3 text-sm" onClick={() => onChange("")}>
                <X aria-hidden="true" className="h-4 w-4" />
                Limpar
              </CommonButton>
            ) : null}
            <CommonButton type="button" variant="secondary" className="h-9 px-3 text-sm" onClick={() => setOpen(false)}>
              Fechar
            </CommonButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CourseCardActions({
  course,
  onSaveCover,
  onDeleteCourse,
}: {
  course: StudyCourse;
  onSaveCover: (course: StudyCourse, coverImageUrl: string) => Promise<void>;
  onDeleteCourse: (course: StudyCourse) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState(course.coverImageUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanCoverImageUrl = coverImageUrl.trim();
  const changed = cleanCoverImageUrl !== course.coverImageUrl;

  useEffect(() => {
    setCoverImageUrl(course.coverImageUrl);
    setError(null);
  }, [course.coverImageUrl]);

  async function submitCover(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!changed || saving) {
      setCoverOpen(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSaveCover(course, cleanCoverImageUrl);
      setCoverOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel salvar a imagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute right-3 top-3 z-20">
      <IconButton
        type="button"
        variant={menuOpen || coverOpen ? "info" : "secondary"}
        size="sm"
        aria-label="Acoes do curso"
        title="Acoes do curso"
        selected={menuOpen || coverOpen}
        onClick={() => {
          setMenuOpen((current) => !current);
          setCoverOpen(false);
        }}
        className="bg-white/90 shadow-[var(--ds-shadow-soft)] backdrop-blur"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </IconButton>

      {menuOpen ? (
        <div className="absolute right-0 top-11 z-30 w-[220px] rounded-[16px] border border-[#d7ddea] bg-white p-2 text-left shadow-[0_18px_40px_rgba(20,28,45,0.18)]">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setCoverOpen(true);
            }}
            className="ds-focus flex h-10 w-full items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium text-[#26324a] transition hover:bg-[#f3f6fc] focus-visible:ring-2 focus-visible:ring-[#8ea1cc]"
          >
            <ImageIcon aria-hidden="true" className="h-4 w-4 text-[#4f6fad]" />
            Foto do curso
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void onDeleteCourse(course);
            }}
            className="ds-focus mt-1 flex h-10 w-full items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium text-[#b8243f] transition hover:bg-[#fff1f4] focus-visible:ring-2 focus-visible:ring-[#d95d72]"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Excluir curso
          </button>
        </div>
      ) : null}

      {coverOpen ? (
        <form
          onSubmit={(event) => void submitCover(event)}
          className="absolute right-0 top-11 z-30 w-[min(300px,calc(100vw-3rem))] rounded-[18px] border border-[#d7ddea] bg-white p-3 text-left shadow-[0_18px_40px_rgba(20,28,45,0.18)]"
        >
          <label className="block text-xs font-medium text-[#5f687e]">
            Imagem do curso
            <input
              aria-label="URL da imagem do curso"
              className="ds-focus mt-1 h-10 w-full rounded-[10px] border border-[#dce3ef] bg-white px-3 text-sm text-[#141a27] outline-none placeholder:text-[#9aa5ba] focus:border-[#b9c6df] focus-visible:ring-2 focus-visible:ring-[#8ea1cc]"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>

          {error ? <p className="mt-2 text-xs font-medium text-[#b4233b]">{error}</p> : null}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {cleanCoverImageUrl ? (
              <CommonButton type="button" variant="tertiary" className="h-9 px-3 text-sm" disabled={saving} onClick={() => setCoverImageUrl("")}>
                <X aria-hidden="true" className="h-4 w-4" />
                Limpar
              </CommonButton>
            ) : null}
            <CommonButton type="button" variant="tertiary" className="h-9 px-3 text-sm" disabled={saving} onClick={() => setCoverOpen(false)}>
              Fechar
            </CommonButton>
            <CommonButton type="submit" variant="secondary" className="h-9 px-3 text-sm" disabled={saving || !changed}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </CommonButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function CourseProgressCircle({ value }: { value: number }) {
  const progress = Math.max(0, Math.min(100, value));
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4 -rotate-90">
      <circle cx="9" cy="9" r={radius} fill="none" stroke="#e5e9f2" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke={progress === 100 ? "#2f8b57" : "#6d63ff"}
        strokeLinecap="round"
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function LessonWorkspace({
  course,
  topic,
  modules,
  draft,
  onDraftChange,
  materialDraft,
  onMaterialDraftChange,
  onAddMaterial,
  onDeleteMaterial,
  onSave,
  saving,
  previousTopic,
  nextTopic,
  onOpenTopic,
}: {
  course: StudyCourse | null;
  topic: StudyTopic | null;
  modules: StudyModule[];
  draft: TopicDraft;
  onDraftChange: (draft: TopicDraft) => void;
  materialDraft: MaterialDraft;
  onMaterialDraftChange: (draft: MaterialDraft) => void;
  onAddMaterial: () => void;
  onDeleteMaterial: (material: StudyMaterial) => void;
  onSave: () => void;
  saving: boolean;
  previousTopic: StudyTopic | null;
  nextTopic: StudyTopic | null;
  onOpenTopic: (moduleId: string, topic: StudyTopic) => void;
}) {
  const lessonModule = topic ? modules.find((currentModule) => currentModule.id === topic.moduleId) ?? null : null;
  const topicIndex = lessonModule?.topics.findIndex((currentTopic) => currentTopic.id === topic?.id) ?? -1;
  const statusOption = topicStatusOptions.find((option) => option.value === draft.status);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = titleTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft.title]);

  if (!course) {
    return (
      <section className="rounded-[28px] border border-[#dde4ef] bg-white p-6 shadow-[var(--ds-shadow-soft)]">
        <div className="rounded-[22px] border border-dashed border-[#cbd6e8] bg-[#fafcff] p-8 text-center">
          <h3 className="text-lg font-semibold text-[#141a27]">Nenhum curso selecionado</h3>
          <p className="mt-1 text-sm leading-6 text-[#6c7489]">Selecione um curso para abrir as aulas.</p>
        </div>
      </section>
    );
  }

  if (!topic) {
    return (
      <section className="rounded-[28px] border border-[#dde4ef] bg-white p-6 shadow-[var(--ds-shadow-soft)]">
        <div className="rounded-[22px] border border-dashed border-[#cbd6e8] bg-[#fafcff] p-8 text-center">
          <BookOpen aria-hidden="true" className="mx-auto h-8 w-8 text-[#70809c]" />
          <h3 className="mt-3 text-lg font-semibold text-[#141a27]">Nenhuma aula cadastrada</h3>
          <p className="mt-1 text-sm leading-6 text-[#6c7489]">Adicione uma aula no acompanhamento para abrir o conteudo principal.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)] sm:p-5">
      <div className="mb-5 flex flex-col gap-4 border-b border-[#e5ebf4] pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip label={lessonModule ? lessonModule.title : "Modulo"} type="info" surface="neutral" size="sm" />
            {topicIndex >= 0 ? <Chip label={`Aula ${String(topicIndex + 1).padStart(2, "0")}`} type="secondary" size="sm" /> : null}
            {statusOption ? <Chip label={statusOption.label} type={statusOption.chip} size="sm" /> : null}
            {draft.priority ? <Chip label={priorityLabel(draft.priority)} type={priorityChip(draft.priority)} size="sm" /> : null}
          </div>
          <label className="sr-only" htmlFor="lesson-title-inline">Titulo da aula</label>
          <textarea
            ref={titleTextareaRef}
            id="lesson-title-inline"
            value={draft.title}
            title={draft.title}
            onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
            placeholder="Titulo da aula"
            rows={1}
            className="ds-focus mt-3 block w-full resize-none overflow-hidden rounded-[10px] border border-transparent bg-transparent px-0 py-1 text-2xl font-semibold leading-tight text-[#121723] outline-none transition placeholder:text-[#9aa5ba] hover:border-[#dce3ef] hover:bg-white hover:px-2 focus:border-[#b9c6df] focus:bg-white focus:px-2 focus-visible:ring-2 focus-visible:ring-[#8ea1cc] sm:text-[2rem]"
          />
          <p className="mt-2 text-sm leading-6 text-[#6c7489]" title={course.title}>{course.title}</p>
        </div>

        <Toolbar variant="ghost" className="shrink-0 justify-start lg:justify-end">
          <ToolbarItem>
            <IconButton
              type="button"
              variant="secondary"
              size="md"
              aria-label="Aula anterior"
              title="Aula anterior"
              disabled={!previousTopic}
              onClick={() => {
                if (previousTopic) onOpenTopic(previousTopic.moduleId, previousTopic);
              }}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </ToolbarItem>
          <ToolbarItem>
            <IconButton
              type="button"
              variant="secondary"
              size="md"
              aria-label="Proxima aula"
              title="Proxima aula"
              disabled={!nextTopic}
              onClick={() => {
                if (nextTopic) onOpenTopic(nextTopic.moduleId, nextTopic);
              }}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </ToolbarItem>
          <ToolbarItem>
            <CommonButton type="button" variant="primary" className="h-10 shrink-0 px-4" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              Salvar aula
            </CommonButton>
          </ToolbarItem>
        </Toolbar>
      </div>

      <TopicForm
        modules={modules}
        draft={draft}
        onChange={onDraftChange}
        selectedTopic={topic}
        materialDraft={materialDraft}
        onMaterialDraftChange={onMaterialDraftChange}
        onAddMaterial={onAddMaterial}
        onDeleteMaterial={onDeleteMaterial}
        saving={saving}
        showTitleField={false}
        showMetadataFields={false}
        showMaterials={false}
      />
    </section>
  );
}

function ModuleDetailPanel({
  course,
  saving,
  draggedModuleId,
  draggedTopic,
  dropTargetId,
  selectedTopicId,
  panelMode = "full",
  onCreateCourse,
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
  selectedTopicId?: string | null;
  panelMode?: "full" | "sidebar";
  onCreateCourse: () => void;
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
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(() => new Set());
  const [isEditing, setIsEditing] = useState(false);

  function toggleModule(moduleId: string) {
    setCollapsedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  if (!course) {
    return (
      <section className="rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)]">
        <EmptyState title="Nenhum curso selecionado" description="Crie ou selecione um curso para visualizar modulos e aulas." actionLabel="Criar curso" onAction={onCreateCourse} />
      </section>
    );
  }
  const allModulesExpanded = course.modules.every((module) => !collapsedModuleIds.has(module.id));

  function exitEditMode() {
    setIsEditing(false);
    onInlineModuleCancel();
    onInlineLessonCancel();
  }

  return (
    <section
      className={cx(
        "rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)] sm:p-5",
        panelMode === "sidebar" && "overflow-x-hidden xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto",
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onModuleDrop(null)}
    >
        <div
          className={cx(
            panelMode === "sidebar"
              ? "mb-4 flex items-start justify-between gap-3"
              : "mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
          )}
        >
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-[#151b29]">
              {panelMode === "sidebar" ? "Acompanhamento" : "Modulos e aulas"}
            </h4>
            <p className="text-sm text-[#6c7489]">
              {panelMode === "sidebar" ? "Progresso por modulo e aula." : "Estrutura do curso em ordem."}
            </p>
          </div>
          <Toolbar variant="ghost" className={cx("max-w-full shrink-0 flex-wrap justify-end", panelMode === "full" && "lg:justify-end")}>
            <ToolbarItem>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-sm font-medium text-[#46536a]">
                {course.progress}%
                <CourseProgressCircle value={course.progress} />
              </span>
            </ToolbarItem>
            <ToolbarItem>
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={course.modules.length === 0}
                aria-label={allModulesExpanded ? "Colapsar tudo" : "Expandir tudo"}
                title={allModulesExpanded ? "Colapsar tudo" : "Expandir tudo"}
                onClick={() => {
                  if (allModulesExpanded) {
                    setCollapsedModuleIds(new Set(course.modules.map((module) => module.id)));
                  } else {
                    setCollapsedModuleIds(new Set());
                  }
                }}
              >
                {allModulesExpanded ? (
                  <ChevronsDownUp aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <ChevronsUpDown aria-hidden="true" className="h-4 w-4" />
                )}
              </IconButton>
            </ToolbarItem>
            <ToolbarItem>
              {isEditing ? (
                panelMode === "sidebar" ? (
                  <div className="flex items-center gap-1.5">
                    <IconButton
                      type="button"
                      variant="secondary"
                      size="md"
                      aria-label="Cancelar edicao"
                      title="Cancelar edicao"
                      onClick={exitEditMode}
                      disabled={saving}
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      variant="primary"
                      size="md"
                      aria-label="Salvar alteracoes"
                      title="Salvar alteracoes"
                      onClick={exitEditMode}
                      disabled={saving}
                    >
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    </IconButton>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CommonButton type="button" variant="secondary" className="h-9 px-3" onClick={exitEditMode} disabled={saving}>
                      Cancelar
                    </CommonButton>
                    <CommonButton type="button" variant="primary" className="h-9 px-3" onClick={exitEditMode} disabled={saving}>
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      Salvar alteracoes
                    </CommonButton>
                  </div>
                )
              ) : (
                <IconButton
                  type="button"
                  variant="secondary"
                  size="md"
                  aria-label="Editar modulos e aulas"
                  title="Editar modulos e aulas"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              )}
            </ToolbarItem>
          </Toolbar>
        </div>

        <div className="divide-y divide-[#e3e9f2] border-y border-[#e3e9f2]">
          {course.modules.map((module, moduleIndex) => {
            const completedTopics = module.topics.filter((topic) => topic.status === "done").length;
            const isExpanded = !collapsedModuleIds.has(module.id);

            return (
              <section
                key={module.id}
                draggable
                className={cx(
                  "transition-all duration-200",
                  draggedModuleId === module.id && "cursor-grabbing opacity-45",
                  dropTargetId === module.id && "bg-[#f6f9ff] ring-2 ring-[#cfe0ff]",
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
                <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    className="group flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2] focus-visible:ring-offset-2"
                    aria-expanded={isExpanded}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#66728a] transition group-hover:text-[#1f2738]">
                      <ChevronDown
                        aria-hidden="true"
                        className={cx("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-medium uppercase text-[#7a8498]">Modulo {moduleIndex + 1}</span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-[#172033]">{module.title}</span>
                      {module.description ? <span className="mt-1 block truncate text-xs text-[#6c7489]">{module.description}</span> : null}
                    </span>
                  </button>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[#5f6b82]">
                      {completedTopics} / {module.topics.length}
                    </span>
                    {isEditing ? (
                      <>
                        <IconButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label="Adicionar aula"
                          title="Adicionar aula"
                          onClick={() => {
                            setCollapsedModuleIds((current) => {
                              const next = new Set(current);
                              next.delete(module.id);
                              return next;
                            });
                            onCreateTopic(module.id);
                          }}
                          disabled={inlineLessonModuleId === module.id}
                        >
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                        <IconButton type="button" variant="destructive" size="sm" aria-label="Excluir modulo" title="Excluir modulo" onClick={() => onDeleteModule(module)}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </>
                    ) : null}
                  </div>
                </div>

                {isEditing && isExpanded && inlineLessonModuleId === module.id ? (
                  <form className="pb-4 pl-0 sm:pl-12" onSubmit={onInlineLessonSubmit}>
                    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <IconButton type="button" variant="info" size="sm" className="shrink-0 rounded-full border border-[#cbd6e8] bg-white shadow-none" disabled>
                          <Play aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                        <span className="flex min-h-8 min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 text-sm font-semibold text-[#62708a]">
                            {String(module.topics.length + 1).padStart(2, "0")}
                          </span>
                          <input
                            autoFocus
                            className="ds-focus min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-0 py-1 text-sm font-semibold text-[#172033] placeholder:text-[#9aa5ba] hover:border-[#dce3ef] hover:bg-white hover:px-2 focus:border-[#b9c6df] focus:bg-white focus:px-2 focus-visible:ring-2 focus-visible:ring-[#8ea1cc]"
                            value={inlineLessonDraft.title}
                            onChange={(event) => onInlineLessonChange({ ...inlineLessonDraft, title: event.target.value })}
                            placeholder="Titulo da aula"
                          />
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <IconButton type="submit" variant="success" size="sm" aria-label="Salvar aula" title="Salvar aula" disabled={saving}>
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                        <IconButton type="button" variant="destructive" size="sm" aria-label="Cancelar aula" title="Cancelar aula" onClick={onInlineLessonCancel} disabled={saving}>
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </form>
                ) : null}

                {isExpanded && module.topics.length ? (
                  <div className="divide-y divide-[#edf1f7] pb-4 pl-0 sm:pl-12">
                    {module.topics.map((topic, index) => (
                      <LessonRow
                        key={topic.id}
                        index={index}
                        topic={topic}
                        saving={saving}
                        grabbed={draggedTopic?.topicId === topic.id}
                        dropTarget={dropTargetId === topic.id}
                        selected={selectedTopicId === topic.id}
                        onOpen={() => onOpenTopic(module.id, topic)}
                        onDelete={isEditing ? () => onDeleteTopic(topic) : undefined}
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
                ) : isExpanded ? (
                  <div className="pb-4 pl-0 text-sm text-[#69738a] sm:pl-12">
                    Este modulo ainda nao tem aulas.
                  </div>
                ) : null}
              </section>
            );
          })}

          {isEditing && inlineModuleDraft ? (
            <form className="transition-all duration-200" onSubmit={onInlineModuleSubmit}>
              <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#66728a]">
                    <ChevronDown aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs font-medium uppercase text-[#7a8498]">Modulo {course.modules.length + 1}</span>
                    <input
                      autoFocus
                      className="ds-focus mt-0.5 block w-full rounded-[8px] border border-transparent bg-transparent px-0 py-1 text-sm font-semibold text-[#172033] placeholder:text-[#9aa5ba] hover:border-[#dce3ef] hover:bg-white hover:px-2 focus:border-[#b9c6df] focus:bg-white focus:px-2 focus-visible:ring-2 focus-visible:ring-[#8ea1cc]"
                      value={inlineModuleDraft.title}
                      onChange={(event) => onInlineModuleChange({ ...inlineModuleDraft, title: event.target.value })}
                      placeholder="Titulo do modulo"
                    />
                  </span>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#5f6b82]">0 / 0</span>
                  <IconButton type="submit" variant="success" size="sm" aria-label="Salvar modulo" title="Salvar modulo" disabled={saving}>
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                  <IconButton type="button" variant="destructive" size="sm" aria-label="Cancelar modulo" title="Cancelar modulo" onClick={onInlineModuleCancel} disabled={saving}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </form>
          ) : null}
        </div>

        {isEditing ? (
          <button
            type="button"
            onClick={() => onCreateModule(course.id)}
            disabled={Boolean(inlineModuleDraft)}
            className="ds-focus mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#cbd6e8] bg-transparent px-4 text-sm font-medium text-[#4d5872] transition hover:border-[#9fb0d0] hover:bg-[#f8faff] hover:text-[#1c2538] focus-visible:ring-2 focus-visible:ring-[#8ea1cc] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Adicionar modulo
          </button>
        ) : null}
    </section>
  );
}

function LessonRow({
  index,
  topic,
  saving,
  grabbed,
  dropTarget,
  selected,
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
  selected?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
  onSetStatus: (status: StudyTopicStatus) => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const done = topic.status === "done";

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
        "group -mx-3 rounded-[16px] px-3 py-3 transition-all duration-200",
        selected && "bg-[#f2f4f7]",
        grabbed && "cursor-grabbing opacity-45",
        dropTarget && "rounded-[14px] ring-2 ring-[#cfe0ff]",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <IconButton
            type="button"
            variant="info"
            size="sm"
            onClick={() => onSetStatus(done ? "in_progress" : "done")}
            disabled={saving}
            className="shrink-0 rounded-full border border-[#cbd6e8] bg-white text-[#3555d2] shadow-none"
            aria-label={done ? "Marcar aula como nao assistida" : "Marcar aula como assistida"}
            title={done ? "Marcar como nao assistida" : "Marcar como assistida"}
          >
            {done ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
          </IconButton>

          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2]"
            aria-current={selected ? "page" : undefined}
          >
            <span className="flex min-h-8 min-w-0 max-w-full items-center gap-2 self-stretch">
              <span className="shrink-0 text-sm font-semibold text-[#62708a]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={cx("block min-w-0 flex-1 truncate text-sm font-semibold text-[#172033]", done && "text-[#7e8798] line-through")} title={topic.title}>
                {topic.title}
              </span>
            </span>
            {topic.priority || topic.materials.length ? (
              <span className="ml-8 flex max-w-full flex-wrap gap-2">
                {topic.priority ? <Chip label={priorityLabel(topic.priority)} type={priorityChip(topic.priority)} size="sm" /> : null}
                {topic.materials.length ? <Chip label="Materiais" counter={topic.materials.length} showCounter type="secondary" size="sm" /> : null}
              </span>
            ) : null}
          </button>
        </div>

        {onDelete ? (
          <div className="flex shrink-0 items-center gap-2">
            <IconButton type="button" variant="destructive" size="sm" aria-label="Excluir aula" title="Excluir aula" onClick={onDelete}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
        ) : null}
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

function PendingTabPanel({
  pendingItems,
  onOpenPending,
  onCreatePending,
}: {
  pendingItems: StudyPendingItem[];
  onOpenPending: (item: StudyPendingItem) => void;
  onCreatePending: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-[#dde4ef] bg-white p-4 shadow-[var(--ds-shadow-soft)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#151b29]">Pendencias</h3>
          <p className="text-sm text-[#6c7489]">
            {pendingItems.length} {pendingItems.length === 1 ? "item aberto ou concluido" : "itens abertos ou concluidos"}
          </p>
        </div>
        <CommonButton type="button" variant="primary" className="h-10 px-3" onClick={onCreatePending}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Pendencia
        </CommonButton>
      </div>

      {pendingItems.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {pendingItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenPending(item)}
              className="rounded-[20px] border border-[#dfe6f2] bg-[#fbfcff] p-4 text-left transition hover:border-[#b8c7e5] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9db2e2]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-semibold text-[#172033]">{item.title}</p>
                <Chip label={pendingStatusLabel(item.status)} type={pendingStatusChip(item.status)} size="sm" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip label={formatDate(item.dueAt)} type="info" surface="neutral" size="sm" showIconLeft iconLeft={<CalendarClock aria-hidden="true" />} />
                {item.priority ? <Chip label={priorityLabel(item.priority)} type={priorityChip(item.priority)} size="sm" /> : null}
                {item.syncToTasks ? <Chip label="Tasks" type="secondary" size="sm" /> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma pendencia" description="Crie pendencias para revisoes, prazos e proximas acoes de estudo." actionLabel="Criar pendencia" onAction={onCreatePending} />
      )}
    </section>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Categoria" value={draft.category} onChange={(category) => onChange({ ...draft, category })}>
          {courseCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField label="URL da capa" value={draft.coverImageUrl} onChange={(coverImageUrl) => onChange({ ...draft, coverImageUrl })} placeholder="https://..." />
      </div>
      <TextareaField label="Descricao curta" value={draft.description} onChange={(description) => onChange({ ...draft, description })} placeholder="Resumo do objetivo do curso" />
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
  showTitleField = true,
  showMetadataFields = true,
  showMaterials = true,
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
  showTitleField?: boolean;
  showMetadataFields?: boolean;
  showMaterials?: boolean;
}) {
  return (
    <div className={cx("grid gap-5", showMaterials && "lg:grid-cols-[minmax(0,1fr)_330px]")}>
      <div className="space-y-4">
        {showTitleField ? (
          <TextField label="Titulo" value={draft.title} onChange={(title) => onChange({ ...draft, title })} placeholder="Ex.: Hooks e estado local" />
        ) : null}
        {showMetadataFields ? (
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
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#172033]">Anotacoes</h4>
            {showTitleField || showMaterials ? <span className="text-xs text-[#7a8498]">Use / para inserir blocos</span> : null}
          </div>
          {showTitleField || showMaterials ? (
            <RichTextEditor
              value={toEditorBlocks(draft.notes)}
              onChange={(notes) => onChange({ ...draft, notes: fromEditorBlocks(notes) })}
              className="rounded-[18px] border border-[#dfe6f2] bg-[#fbfcff] p-4"
            />
          ) : (
            <LessonAnnotationsBoard value={draft.notes} onChange={(notes) => onChange({ ...draft, notes })} />
          )}
        </section>
      </div>

      {showMaterials ? (
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
      ) : null}
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
