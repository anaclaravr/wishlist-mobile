import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { AdminStudiesDashboard } from "@/components/admin-studies-dashboard";
import { getAdminPageData } from "@/lib/admin-hub-data";
import { listStudyData } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function StudiesPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  const studiesData = await listStudyData({ wishlistId: data.hub.wishlist.id });

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="studies"
      title="Estudos"
      description="Organize cursos, modulos, aulas, anotacoes, materiais e pendencias da rotina de aprendizado."
      compactHeader
    >
      <AdminStudiesDashboard initialData={studiesData} />
    </AdminLayout>
  );
}
