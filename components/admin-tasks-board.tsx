"use client";

import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { CommonButton, IconButton } from "@/components/ui/button-system";
import { Chip } from "@/components/ui/chip";
import { Drawer } from "@/components/ui/drawer";
import type { TaskPageSettings } from "@/lib/task-page-settings";

type AdminTaskStatus = "pending" | "in_progress" | "done";
type AdminTaskPriority = "low" | "medium" | "high" | null;
type PriorityFilter = "all" | "high" | "medium" | "low";
type SortMode = "updated_desc" | "due_asc" | "priority_desc";

type AdminTask = {
  id: string;
  title: string;
  notes: string | null;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
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
  notes: string;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  dueAt: string;
  tags: string[];
};

const defaultTaskForm: TaskForm = {
  title: "",
  notes: "",
  status: "pending",
  priority: null,
  dueAt: "",
  tags: [],
};

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

function dueStatus(dueAt: string | null) {
  if (!dueAt) return "none";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const due = new Date(dueAt);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  if (dueDay < startToday) return "overdue";
  if (dueDay === startToday) return "today";
  return "future";
}

function taskToForm(task: AdminTask): TaskForm {
  return {
    title: task.title,
    notes: task.notes ?? "",
    status: task.status,
    priority: task.priority,
    dueAt: toDateInputValue(task.dueAt),
    tags: task.tags ?? [],
  };
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
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated_desc");
  const [page, setPage] = useState(initialData.pagination.page);
  const [totalPages, setTotalPages] = useState(initialData.pagination.totalPages);
  const [total, setTotal] = useState(initialData.pagination.total);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(defaultTaskForm);
  const [tagDraft, setTagDraft] = useState("");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const filteredAndSortedTasks = useMemo(() => {
    const filtered =
      priorityFilter === "all" ? tasks : tasks.filter((task) => task.priority === priorityFilter);

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
        if (aDue !== bDue) return aDue - bDue;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [priorityFilter, sortMode, tasks]);

  const groupedTasks = useMemo(
    () => ({
      pending: filteredAndSortedTasks.filter((task) => task.status === "pending"),
      in_progress: filteredAndSortedTasks.filter((task) => task.status === "in_progress"),
      done: filteredAndSortedTasks.filter((task) => task.status === "done"),
    }),
    [filteredAndSortedTasks],
  );

  async function loadTasks(nextPage: number, nextQuery = query) {
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
      if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar tarefas.");
      setTasks(result.tasks ?? []);
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
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
    setForm({ ...defaultTaskForm, status: initialStatus ?? "pending" });
    setTagDraft("");
    setError(null);
    setIsDrawerOpen(true);
  }

  function openEdit(task: AdminTask) {
    captureOpener();
    setEditingTaskId(task.id);
    setForm(taskToForm(task));
    setTagDraft("");
    setError(null);
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingTaskId(null);
    setForm(defaultTaskForm);
    setTagDraft("");
    openerRef.current?.focus();
  }

  function commitTag() {
    const normalized = tagDraft.trim().slice(0, 32);
    if (!normalized) return;
    if (form.tags.includes(normalized) || form.tags.length >= 8) {
      setTagDraft("");
      return;
    }
    setForm((current) => ({ ...current, tags: [...current.tags, normalized] }));
    setTagDraft("");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setError("Informe um título para a tarefa.");
      return;
    }

    setPendingAction("save");
    setError(null);
    setMessage(null);

    try {
      const payload = {
        title,
        notes: form.notes.trim() || null,
        status: form.status,
        priority: form.priority,
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
        throw new Error(result.error ?? "Não foi possível salvar a tarefa.");
      }

      setMessage(editingTaskId ? "Tarefa atualizada." : "Tarefa criada.");
      closeDrawer();
      await loadTasks(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function setTaskStatus(task: AdminTask, status: AdminTaskStatus) {
    if (task.status === status) return;
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
        throw new Error(result.error ?? "Não foi possível atualizar o status.");
      }
      setTasks((current) => current.map((item) => (item.id === task.id ? result.task! : item)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteTask(task: AdminTask) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return;
    setPendingAction(`delete:${task.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Não foi possível excluir a tarefa.");
      }
      setMessage("Tarefa excluída.");
      await loadTasks(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchDraft.trim());
    await loadTasks(1, searchDraft);
  }

  async function onDropToColumn(status: AdminTaskStatus) {
    if (!draggingTaskId) return;
    const task = tasks.find((item) => item.id === draggingTaskId);
    setDraggingTaskId(null);
    if (!task || task.status === status) return;
    await setTaskStatus(task, status);
  }

  return (
    <section className="space-y-3">
      {message ? (
        <p className="rounded-lg border border-[#bddfce] bg-[#e8f8ef] px-3 py-2 text-sm text-[#276348]">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-[#f2c5cc] bg-[#fdeef1] px-3 py-2 text-sm text-[#9a3042]">{error}</p>
      ) : null}

      <div className="rounded-xl border border-[#dbe1ed] bg-white px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-xl text-[#151b28]">Tarefas</h3>
          <span className="rounded-full border border-[#d6ddeb] bg-white px-2 py-0.5 text-xs text-[#64708a]">
            {total} tarefas
          </span>

          <div className="inline-flex items-center gap-1 rounded-lg border border-[#d7dfed] bg-[#fafbfd] px-1.5 py-1">
            <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5 text-[#5f6a83]" />
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="h-7 border-0 bg-transparent px-1 text-xs text-[#4a556f] outline-none"
              aria-label="Filtrar por prioridade"
            >
              <option value="all">Todas prioridades</option>
              <option value="high">Prioridade alta</option>
              <option value="medium">Prioridade média</option>
              <option value="low">Prioridade baixa</option>
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-7 border-0 bg-transparent px-1 text-xs text-[#4a556f] outline-none"
              aria-label="Ordenar tarefas"
            >
              <option value="updated_desc">Atualizadas recentemente</option>
              <option value="due_asc">Vencimento próximo</option>
              <option value="priority_desc">Maior prioridade</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen((current) => !current)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#55607a] hover:bg-[#f2f5fb]"
              aria-label={isSearchOpen ? "Fechar busca" : "Abrir busca"}
            >
              <Search aria-hidden="true" className="h-4 w-4" />
            </button>
            <div
              className={`overflow-hidden transition-[width,opacity] duration-200 ${
                isSearchOpen ? "w-[220px] opacity-100" : "w-0 opacity-0"
              }`}
            >
              <label className="sr-only" htmlFor="tasks-search">
                Buscar tarefas
              </label>
              <input
                id="tasks-search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Buscar tarefas"
                className="h-8 w-full rounded-md border border-[#d5ddec] px-2.5 text-sm text-[#1a2233] outline-none focus:border-[#95a8cb]"
              />
            </div>
          </form>

          <CommonButton
            type="button"
            onClick={() => openCreate()}
            variant="primary"
            usage="info"
            showIconLeft
            iconLeft={<Plus aria-hidden="true" className="h-3.5 w-3.5" />}
            className="h-8 px-3 text-sm"
          >
            Nova tarefa
          </CommonButton>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-[#dbe1ed] bg-white px-4 py-8 text-center text-sm text-[#667086]">Carregando tarefas...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-[#dbe1ed] bg-white px-4 py-8 text-center">
          <p className="text-sm text-[#1f2b46]">Nenhuma tarefa ainda</p>
          <p className="mt-1 text-sm text-[#6d768d]">Adicione sua primeira tarefa para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
          {(
            [
              { status: "pending", label: settings.columnLabels.pending },
              { status: "in_progress", label: settings.columnLabels.inProgress },
              { status: "done", label: settings.columnLabels.done },
            ] as Array<{ status: AdminTaskStatus; label: string }>
          ).map((column) => {
            const columnTasks = groupedTasks[column.status];
            return (
              <section
                key={column.status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropToColumn(column.status)}
                className="rounded-xl border border-[#dde3ef] bg-[#f5f7fb] p-2.5"
              >
                <header className="mb-2 flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full bg-[#8f9fbe]" aria-hidden="true" />
                  <h4 className="text-sm text-[#20293d]">{column.label}</h4>
                  <span className="rounded-full border border-[#d5ddec] bg-white px-2 py-0.5 text-[11px] text-[#687189]">
                    {columnTasks.length}
                  </span>
                  <IconButton
                    type="button"
                    onClick={() => openCreate(column.status)}
                    className="ml-auto h-7 w-7 rounded-md text-[#5d6780] hover:bg-white"
                    size="xs"
                    variant="secondary"
                    aria-label={`Adicionar tarefa em ${column.label}`}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                </header>

                <div className="space-y-2">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg bg-white px-3 py-2 text-xs text-[#7b849a]">
                      Nenhuma tarefa nesta etapa.
                      <button
                        type="button"
                        onClick={() => openCreate(column.status)}
                        className="ml-2 text-[#4b5fb8] underline-offset-2 hover:underline"
                      >
                        Adicionar tarefa
                      </button>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const due = dueStatus(task.dueAt);
                      return (
                        <article
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggingTaskId(task.id)}
                          onDragEnd={() => setDraggingTaskId(null)}
                          onClick={() => openEdit(task)}
                          className={`group cursor-pointer rounded-lg border bg-white p-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition ${
                            draggingTaskId === task.id ? "border-[#9dadcf] opacity-70" : "border-[#d9e0ec] hover:border-[#bcc9df]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <IconButton
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void setTaskStatus(task, task.status === "done" ? "pending" : "done");
                              }}
                              disabled={pendingAction === `status:${task.id}`}
                              className="mt-0.5 h-5 w-5 rounded-full border border-[#cad3e7] text-[#1b2235] shadow-none"
                              size="xs"
                              variant="secondary"
                              aria-label={task.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
                            >
                              {task.status === "done" ? (
                                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              ) : (
                                <Circle aria-hidden="true" className="h-3.5 w-3.5" />
                              )}
                            </IconButton>

                            <div className="min-w-0 flex-1">
                              <p className={`line-clamp-2 text-sm ${task.status === "done" ? "line-through text-[#7d8598]" : "text-[#171d2b]"}`}>
                                {task.title || "Sem título"}
                              </p>
                              {task.notes ? <p className="mt-1 line-clamp-2 text-xs text-[#6d768d]">{task.notes}</p> : null}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {task.priority ? (
                                  <Chip
                                    label={task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                                    tone={task.priority === "high" ? "priority-high" : task.priority === "medium" ? "priority-medium" : "priority-low"}
                                  />
                                ) : null}
                                {settings.showTags
                                  ? task.tags.slice(0, 2).map((tag) => <Chip key={`${task.id}:${tag}`} label={tag} />)
                                  : null}
                                {settings.showDueDate && task.dueAt ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#d8deea] px-2 py-0.5 text-[11px] text-[#55607a]">
                                    <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                                    {due === "today" ? "Hoje" : formatDueDate(task.dueAt)}
                                    {due === "overdue" ? " · Atrasada" : due === "today" ? " · Vence hoje" : ""}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                              <IconButton
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEdit(task);
                                }}
                                className="h-7 w-7 rounded-md text-[#5f6880] hover:bg-[#f2f5fb] shadow-none"
                                size="xs"
                                variant="secondary"
                                aria-label="Editar tarefa"
                              >
                                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                              </IconButton>
                              <IconButton
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteTask(task);
                                }}
                                disabled={pendingAction === `delete:${task.id}`}
                                className="h-7 w-7 rounded-md text-[#5f6880] hover:bg-[#f2f5fb] shadow-none"
                                size="xs"
                                variant="destructive"
                                aria-label="Excluir tarefa"
                              >
                                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                              </IconButton>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {page < totalPages ? (
        <div className="flex items-center justify-center py-1">
          <CommonButton
            type="button"
            onClick={() => loadTasks(page + 1)}
            disabled={isLoading}
            variant="secondary"
            usage="general"
            showIconLeft
            iconLeft={<ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />}
            className="h-8 px-3 text-xs"
          >
            Carregar mais
          </CommonButton>
        </div>
      ) : null}

      <Drawer open={isDrawerOpen} onClose={closeDrawer} title={editingTaskId ? "Detalhes da tarefa" : "Nova tarefa"}>
        <form onSubmit={saveTask} className="flex min-h-[calc(100vh-80px)] flex-col">
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs text-[#7a8298]">Título</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                placeholder="Ex.: Revisar planejamento da semana"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-[#7a8298]">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as AdminTaskStatus }))
                  }
                  className="h-10 w-full rounded-lg border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluída</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-[#7a8298]">Prioridade</span>
                <select
                  value={form.priority ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value ? (event.target.value as AdminTaskPriority) : null,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                >
                  <option value="">Sem prioridade</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </label>
            </div>

            {settings.showDueDate ? (
              <label className="block space-y-1">
                <span className="text-xs text-[#7a8298]">Data de vencimento</span>
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#d1d9e9] px-3 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                />
              </label>
            ) : null}

            {settings.showTags ? (
              <label className="block space-y-1">
                <span className="text-xs text-[#7a8298]">Tags</span>
                <div className="rounded-lg border border-[#d1d9e9] px-2 py-2">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {form.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex h-6 items-center gap-1 rounded-full border border-[#d9dfeb] bg-[#f7f9fd] px-2 text-[11px] text-[#55607a]"
                      >
                        {tag}
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center text-[#7f889e]"
                          aria-label={`Remover tag ${tag}`}
                          onClick={() =>
                            setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))
                          }
                        >
                          <X aria-hidden="true" className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onBlur={commitTag}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        commitTag();
                      }
                    }}
                    placeholder="Digite e pressione Enter"
                    className="h-8 w-full border-0 bg-transparent px-1 text-sm text-[#151b28] outline-none placeholder:text-[#9aa3b8]"
                  />
                </div>
              </label>
            ) : null}

            <label className="block space-y-1">
              <span className="text-xs text-[#7a8298]">Descrição</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[120px] w-full rounded-lg border border-[#d1d9e9] px-3 py-2 text-sm text-[#151b28] outline-none focus:border-[#95a8cb]"
                placeholder="Adicione detalhes úteis da tarefa."
              />
            </label>
          </div>

          <div className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t border-[#e1e6f0] bg-white pt-3">
            <CommonButton type="button" onClick={closeDrawer} variant="secondary" usage="general">
              Cancelar
            </CommonButton>
            <CommonButton
              type="submit"
              disabled={pendingAction === "save"}
              variant="primary"
              usage="info"
              showIconLeft
              iconLeft={pendingAction === "save" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            >
              Salvar
            </CommonButton>
          </div>
        </form>
      </Drawer>
    </section>
  );
}
