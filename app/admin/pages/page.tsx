import { Briefcase, CheckSquare, Gift, LayoutPanelTop } from "lucide-react";

import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { PageModuleCard } from "@/components/page-module-card";
import { getAdminPageData } from "@/lib/admin-hub-data";

export const dynamic = "force-dynamic";

export default async function AdminPagesHome() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-pages"
      title="Pages"
      description="Cada pagina da aplicacao possui um card dedicado com configuracoes centralizadas."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PageModuleCard
          title="Wishlist"
          subtitle="Pagina ativa"
          details="Configura titulo, slug e sugestoes publicas da Wishlist."
          icon={Gift}
          href="/admin/pages/wishlist"
        />
        <PageModuleCard
          title="Tasks"
          subtitle="Pagina ativa"
          details="Configura labels do Kanban, paginação e elementos visiveis dos cards."
          icon={CheckSquare}
          href="/admin/pages/tasks"
        />
        <PageModuleCard
          title="Portfolio"
          subtitle="Pagina publica"
          details="Configura apresentacao profissional, links e case studies para recrutadores."
          icon={Briefcase}
          href="/admin/pages/portfolio"
        />
        <PageModuleCard
          title="Futuras paginas"
          subtitle="Preparado para expansao"
          details="Cada nova pagina da aplicacao ganhara um card proprio e sua subpagina dedicada."
          icon={LayoutPanelTop}
          badge="Next"
        />
      </section>
    </AdminLayout>
  );
}
