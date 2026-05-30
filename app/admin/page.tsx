import Link from "next/link";

import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { getAdminPageData } from "@/lib/admin-hub-data";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin"
      title="Admin Hub"
      description="Gerencie usuarios, paginas e configuracoes gerais da aplicacao."
    >
      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href="/admin/users"
          className="rounded-2xl border border-[#d8deea] bg-white p-4 shadow-[0_12px_24px_rgba(29,38,58,0.08)]"
        >
          <p className="text-sm font-medium text-[#171d2b]">Users</p>
          <p className="mt-1 text-xs text-[#6c7489]">Perfis RBAC, status e permissoes.</p>
        </Link>
        <Link
          href="/admin/pages"
          className="rounded-2xl border border-[#d8deea] bg-white p-4 shadow-[0_12px_24px_rgba(29,38,58,0.08)]"
        >
          <p className="text-sm font-medium text-[#171d2b]">Pages</p>
          <p className="mt-1 text-xs text-[#6c7489]">Cards por pagina e acesso as subpaginas dedicadas.</p>
        </Link>
        <Link
          href="/admin/general"
          className="rounded-2xl border border-[#d8deea] bg-white p-4 shadow-[0_12px_24px_rgba(29,38,58,0.08)]"
        >
          <p className="text-sm font-medium text-[#171d2b]">General</p>
          <p className="mt-1 text-xs text-[#6c7489]">Controles gerais e espaco para futuras configuracoes.</p>
        </Link>
      </section>
    </AdminLayout>
  );
}
