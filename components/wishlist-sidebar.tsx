"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CheckSquare,
  ChevronsUpDown,
  Eye,
  FolderOpen,
  LogOut,
  PanelLeft,
  PencilLine,
  Settings2,
  ShieldCheck,
} from "lucide-react";

type SidebarPage =
  | "wishlist"
  | "tasks"
  | "studies"
  | "admin"
  | "admin-users"
  | "admin-pages"
  | "admin-pages-wishlist"
  | "admin-pages-tasks"
  | "admin-pages-portfolio"
  | "admin-general";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const profileOptions = [
  { id: "admin", label: "Admin", description: "Acesso completo", icon: ShieldCheck },
  { id: "editor", label: "Editor", description: "Edicao de conteudo", icon: PencilLine },
  { id: "viewer", label: "Viewer", description: "Somente leitura", icon: Eye },
] as const;

type ProfileId = (typeof profileOptions)[number]["id"];

export function WishlistSidebar({
  title,
  subtitle,
  wishlistHref,
  tasksHref,
  studiesHref,
  showTasks,
  showStudies,
  adminHref,
  onAdminClick,
  onLogout,
  activePage,
  isCollapsed,
  setIsCollapsed,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  wishlistHref: string;
  tasksHref?: string;
  studiesHref?: string;
  showTasks?: boolean;
  showStudies?: boolean;
  adminHref?: string;
  onAdminClick?: () => void;
  onLogout?: () => void;
  activePage: SidebarPage;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState<ProfileId>("admin");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const selectedProfile = profileOptions.find((profile) => profile.id === selectedProfileId) ?? profileOptions[0];
  const SelectedProfileIcon = selectedProfile.icon;
  const isAnyAdminPage =
    activePage === "admin" ||
    activePage === "admin-users" ||
    activePage === "admin-pages" ||
    activePage === "admin-pages-wishlist" ||
    activePage === "admin-pages-tasks" ||
    activePage === "admin-pages-portfolio" ||
    activePage === "admin-general";

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function handleDocClick(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

  const topLevelItemClass = (active: boolean) =>
    cx(
      "ds-focus inline-flex h-10 w-full items-center rounded-[var(--ds-sidebar-radius-md)] border px-3 text-sm font-medium transition",
      "focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-1",
      isCollapsed ? "justify-center" : "justify-start gap-2",
      active
        ? "border-[var(--ds-sidebar-item-border-active)] bg-[var(--ds-sidebar-item-bg-active)] text-[var(--ds-sidebar-item-text-active)] shadow-[var(--ds-sidebar-shadow-soft)]"
        : "border-transparent text-[var(--ds-sidebar-item-text)] hover:bg-[var(--ds-sidebar-item-bg-hover)] hover:text-[var(--ds-sidebar-item-text-hover)]",
    );

  return (
    <aside className="ds-sidebar group/sidebar flex min-h-screen min-w-0 flex-col border-b p-3 sm:p-4 lg:sticky lg:top-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:border-b-0">
      <div className="relative">
        {isCollapsed ? (
          <div className="group/logo relative mx-auto h-11 w-11 shrink-0">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[14px] bg-[#171b16] text-white transition duration-200 group-hover/logo:scale-[0.97] group-hover/logo:opacity-0">
              <SelectedProfileIcon aria-hidden="true" className="h-5 w-5" />
            </div>
            <button
              type="button"
              onClick={(event) => {
                setIsCollapsed(false);
                event.currentTarget.blur();
              }}
              className="ds-focus pointer-events-none absolute inset-0 inline-flex items-center justify-center rounded-[var(--ds-sidebar-radius-md)] bg-transparent text-[var(--ds-sidebar-icon)] opacity-0 transition duration-200 hover:text-[var(--ds-sidebar-icon-hover)] focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-2 group-hover/logo:pointer-events-auto group-hover/logo:opacity-100"
              aria-label="Expandir navegação"
              title="Expandir navegação"
            >
              <PanelLeft aria-hidden="true" className="h-4 w-4 rotate-180" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div ref={profileMenuRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                className="ds-focus flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border border-[#dedfd9] bg-white px-3 text-left shadow-[var(--ds-sidebar-shadow-soft)] transition hover:border-[#d3d5cf] hover:shadow-[0_1px_2px_rgba(18,26,42,0.06),0_10px_24px_rgba(18,26,42,0.08)] focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-2"
                aria-haspopup="listbox"
                aria-expanded={isProfileMenuOpen}
                aria-label={`Selecionar perfil. Perfil atual: ${selectedProfile.label}`}
                title={subtitle ? `${title} - ${subtitle}` : title || "Selecionar perfil"}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#171b16] text-white">
                  <SelectedProfileIcon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-[#777f74]">Perfil</span>
                  <span className="block truncate text-[15px] font-semibold text-[#151915]">{selectedProfile.label}</span>
                </span>
                <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#7b8378]" />
              </button>

              {isProfileMenuOpen ? (
                <div
                  role="listbox"
                  aria-label="Perfis disponiveis"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-[16px] border border-[#dedfd9] bg-white p-1.5 shadow-[var(--ds-sidebar-shadow-flyout)]"
                >
                  {profileOptions.map((profile) => {
                    const ProfileIcon = profile.icon;
                    const selected = profile.id === selectedProfileId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setSelectedProfileId(profile.id);
                          setIsProfileMenuOpen(false);
                        }}
                        className={cx(
                          "ds-focus flex h-12 w-full items-center gap-3 rounded-[12px] px-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-1",
                          selected ? "bg-[#f3f4f2] text-[#151915]" : "text-[#565e54] hover:bg-[#f7f8f6] hover:text-[#151915]",
                        )}
                      >
                        <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", selected ? "bg-white text-[#151915] shadow-[var(--ds-sidebar-shadow-soft)]" : "bg-[#f1f2ef] text-[#656d62]")}>
                          <ProfileIcon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{profile.label}</span>
                          <span className="block truncate text-xs text-[#7c837a]">{profile.description}</span>
                        </span>
                        {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#151915]" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={(event) => {
                setIsCollapsed(true);
                event.currentTarget.blur();
              }}
              className="ds-focus pointer-events-none inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-transparent text-[var(--ds-sidebar-icon)] opacity-0 transition hover:text-[var(--ds-sidebar-icon-hover)] focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-2 group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100"
              aria-label="Recolher navegação"
              title="Recolher navegação"
            >
              <PanelLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <nav className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 pb-4">
        <div>
          {!isCollapsed ? (
            <p className="px-2 text-[11px] font-medium uppercase text-[var(--ds-sidebar-section-title)]">Workspace</p>
          ) : null}
          <div className="mt-2 space-y-1">
            <a href={wishlistHref} className={topLevelItemClass(activePage === "wishlist")} title="Wishlist">
              <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
              {!isCollapsed ? <span>Wishlist</span> : null}
            </a>

            {showTasks ? (
              <a href={tasksHref ?? "/tasks"} className={topLevelItemClass(activePage === "tasks")} title="Tarefas">
                <CheckSquare aria-hidden="true" className="h-4 w-4 shrink-0" />
                {!isCollapsed ? <span>Tarefas</span> : null}
              </a>
            ) : null}

            {showStudies ? (
              <a href={studiesHref ?? "/studies"} className={topLevelItemClass(activePage === "studies")} title="Estudos">
                <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0" />
                {!isCollapsed ? <span>Estudos</span> : null}
              </a>
            ) : null}
          </div>
        </div>

      </nav>

      <div className="sticky bottom-0 z-10 -mx-3 mt-2 shrink-0 bg-[var(--ds-sidebar-bg)] px-3 pt-4 sm:-mx-4 sm:px-4">
        <div className="mb-4 h-px bg-[var(--ds-sidebar-border)]" />
        {!isCollapsed ? <p className="px-2 text-[11px] font-medium uppercase text-[var(--ds-sidebar-section-title)]">Ações</p> : null}
        <div className="mt-2 space-y-1">
          {adminHref ? (
            <a href={adminHref} className={topLevelItemClass(isAnyAdminPage)} title="Admin">
              <Settings2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              {!isCollapsed ? <span>Admin</span> : null}
            </a>
          ) : (
            <button type="button" onClick={onAdminClick} className={topLevelItemClass(false)} title="Admin">
              <Settings2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              {!isCollapsed ? <span>Admin</span> : null}
            </button>
          )}

          {onLogout ? (
            <button type="button" onClick={onLogout} className={topLevelItemClass(false)} title="Logout">
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              {!isCollapsed ? <span>Logout</span> : null}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
