import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { TasksPageSettingsForm } from "@/components/tasks-page-settings-form";
import { getAdminPageData } from "@/lib/admin-hub-data";
import { getTaskPageSettingsByWishlistId } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function AdminTasksSettingsPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  const settings = await getTaskPageSettingsByWishlistId(data.hub.wishlist.id);

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-pages-tasks"
      title="Tasks"
      description="Configure labels do Kanban, paginação padrao e visibilidade de campos nos cards."
    >
      <TasksPageSettingsForm initialSettings={settings} />
    </AdminLayout>
  );
}
