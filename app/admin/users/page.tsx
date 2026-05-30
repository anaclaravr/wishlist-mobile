import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { UsersTable } from "@/components/users-table";
import { getAdminPageData } from "@/lib/admin-hub-data";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-users"
      title="Users"
      description="Detalhes, permissoes e chaves de acesso dos perfis admin/editor/viewer."
    >
      <UsersTable profiles={data.profiles} wishlist={data.hub.wishlist} />
    </AdminLayout>
  );
}
