"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Home, Settings2, Users, LayoutPanelTop, Gift, CheckSquare, Briefcase } from "lucide-react";

import type { Wishlist } from "@/lib/db";
import { WishlistSidebar } from "@/components/wishlist-sidebar";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

type AdminActivePage =
  | "tasks"
  | "studies"
  | "admin"
  | "admin-users"
  | "admin-pages"
  | "admin-pages-wishlist"
  | "admin-pages-tasks"
  | "admin-pages-portfolio"
  | "admin-general";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "wishlist:admin-sidebar-collapsed";

export function AdminLayout({
  wishlist,
  wishlistHref,
  activePage,
  breadcrumbItems,
  title,
  description,
  compactHeader = false,
  children,
}: {
  wishlist: Wishlist;
  wishlistHref: string;
  activePage: AdminActivePage;
  breadcrumbItems?: BreadcrumbItem[];
  title: ReactNode;
  description?: string;
  compactHeader?: boolean;
  children: ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      setIsSidebarCollapsed(false);
    }
  }, []);

  function persistSidebarCollapsed(collapsed: boolean) {
    setIsSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage failures; the in-memory state still updates for the current page.
    }
  }

  const ownerName = wishlist.ownerName || "Perfil do workspace";
  const ownerEmail = wishlist.ownerEmail || "Sem e-mail configurado";
  async function handleLogout() {
    try {
      await fetch("/api/access/logout", { method: "POST" });
    } finally {
      window.location.href = wishlistHref;
    }
  }
  const resolvedBreadcrumbItems: BreadcrumbItem[] =
    breadcrumbItems ??
    ({
      tasks: [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Tarefas", icon: <Briefcase aria-hidden="true" /> },
      ],
      studies: [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Estudos", icon: <BookOpen aria-hidden="true" /> },
      ],
      admin: [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", icon: <Settings2 aria-hidden="true" /> },
      ],
      "admin-users": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "Users", icon: <Users aria-hidden="true" /> },
      ],
      "admin-pages": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "Pages", icon: <LayoutPanelTop aria-hidden="true" /> },
      ],
      "admin-pages-wishlist": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "Pages", href: "/admin/pages", icon: <LayoutPanelTop aria-hidden="true" /> },
        { label: "Workspace", icon: <Gift aria-hidden="true" /> },
      ],
      "admin-pages-tasks": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "Pages", href: "/admin/pages", icon: <LayoutPanelTop aria-hidden="true" /> },
        { label: "Tasks", icon: <CheckSquare aria-hidden="true" /> },
      ],
      "admin-pages-portfolio": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "Pages", href: "/admin/pages", icon: <LayoutPanelTop aria-hidden="true" /> },
        { label: "Portfolio", icon: <Briefcase aria-hidden="true" /> },
      ],
      "admin-general": [
        { label: "Home", href: wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Admin", href: "/admin", icon: <Settings2 aria-hidden="true" /> },
        { label: "General", icon: <Settings2 aria-hidden="true" /> },
      ],
    } satisfies Record<AdminActivePage, BreadcrumbItem[]>)[activePage];

  return (
    <main className="ds-app-shell min-h-screen">
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-300 ${
          isSidebarCollapsed ? "lg:grid-cols-[92px_1fr]" : "lg:grid-cols-[272px_1fr]"
        }`}
      >
        <WishlistSidebar
          title={ownerName}
          subtitle={ownerEmail}
          avatarUrl={wishlist.ownerAvatarUrl}
          wishlistHref={wishlistHref}
          tasksHref="/tasks"
          studiesHref="/studies"
          showTasks
          showStudies
          adminHref="/admin"
          onLogout={handleLogout}
          activePage={activePage}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={persistSidebarCollapsed}
        />

        <section className="ds-app-panel p-4 sm:p-6">
          <header className={compactHeader ? "mb-2" : "mb-4"}>
            <Breadcrumb items={resolvedBreadcrumbItems} className="mb-1" />
            <div className={`mt-1 font-semibold text-[#141a27] ${compactHeader ? "text-[24px]" : "text-[30px]"}`}>
              {title}
            </div>
            {description ? <p className="mt-2 text-sm text-[#6c7489]">{description}</p> : null}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
