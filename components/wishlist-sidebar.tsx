"use client";

import {
  CheckSquare,
  FolderOpen,
  LogOut,
  PanelLeft,
  Settings2,
  ShoppingCart,
} from "lucide-react";

type SidebarPage =
  | "wishlist"
  | "tasks"
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

export function WishlistSidebar({
  title,
  subtitle,
  avatarUrl,
  wishlistHref,
  tasksHref,
  showTasks,
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
  showTasks?: boolean;
  adminHref?: string;
  onAdminClick?: () => void;
  onLogout?: () => void;
  activePage: SidebarPage;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}) {
  const normalizedAvatarUrl = avatarUrl?.trim() || null;
  const isAnyAdminPage =
    activePage === "admin" ||
    activePage === "admin-users" ||
    activePage === "admin-pages" ||
    activePage === "admin-pages-wishlist" ||
    activePage === "admin-pages-tasks" ||
    activePage === "admin-pages-portfolio" ||
    activePage === "admin-general";

  const topLevelItemClass = (active: boolean) =>
    cx(
      "ds-focus inline-flex h-10 w-full items-center rounded-[var(--ds-sidebar-radius-md)] px-3 text-sm transition",
      "focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-1",
      isCollapsed ? "justify-center" : "justify-start gap-2",
      active
        ? "bg-[var(--ds-sidebar-item-bg-active)] text-[var(--ds-sidebar-item-text-active)]"
        : "text-[var(--ds-sidebar-item-text)] hover:bg-[var(--ds-sidebar-item-bg-hover)] hover:text-[var(--ds-sidebar-item-text-hover)]",
    );

  return (
    <aside className="ds-sidebar flex min-h-screen min-w-0 flex-col border-b p-4 sm:p-5 lg:sticky lg:top-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2">
        {isCollapsed ? (
          <div className="group/logo relative h-11 w-11 shrink-0">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl bg-[#1a1e27] text-white transition duration-200 group-hover/logo:scale-[0.97] group-hover/logo:opacity-0 group-focus-within/logo:scale-[0.97] group-focus-within/logo:opacity-0">
              {normalizedAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={normalizedAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ShoppingCart aria-hidden="true" className="h-5 w-5" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="ds-focus pointer-events-none absolute inset-0 inline-flex items-center justify-center rounded-[var(--ds-sidebar-radius-md)] bg-transparent text-[var(--ds-sidebar-icon)] opacity-0 transition duration-200 hover:text-[var(--ds-sidebar-icon-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-2 group-hover/logo:pointer-events-auto group-hover/logo:opacity-100 group-focus-within/logo:pointer-events-auto group-focus-within/logo:opacity-100"
              aria-label="Expandir navegação"
              title="Expandir navegação"
            >
              <PanelLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1a1e27] text-white">
                {normalizedAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={normalizedAvatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ShoppingCart aria-hidden="true" className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[1.05rem] font-semibold text-[#1e2433]">{title}</p>
                {subtitle ? <p className="truncate text-sm text-[#6c7489]">{subtitle}</p> : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="ds-focus inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-sidebar-radius-md)] bg-transparent text-[var(--ds-sidebar-icon)] transition hover:text-[var(--ds-sidebar-icon-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ds-sidebar-focus-ring)] focus-visible:ring-offset-2"
              aria-label="Recolher navegação"
              title="Recolher navegação"
            >
              <PanelLeft aria-hidden="true" className="h-4 w-4" />
            </button>
          </>
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
          </div>
        </div>

      </nav>

      <div className="sticky bottom-0 z-10 -mx-4 mt-2 shrink-0 border-t border-[var(--ds-sidebar-border)] bg-[var(--ds-sidebar-bg)] px-4 pt-4 sm:-mx-5 sm:px-5">
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
