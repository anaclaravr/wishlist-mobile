import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { AdminTasksBoard } from "@/components/admin-tasks-board";
import { getAdminPageData } from "@/lib/admin-hub-data";
import { getTaskPageSettingsByWishlistId, listAdminTasks } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  const settings = await getTaskPageSettingsByWishlistId(data.hub.wishlist.id);
  const tasksData = await listAdminTasks({ page: 1, pageSize: settings.defaultPageSize, filter: "all", query: "" });

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="tasks"
      title="Tarefas"
      description="Board pessoal para criar, organizar e concluir tarefas."
      compactHeader
    >
      <AdminTasksBoard initialData={tasksData} settings={settings} />
    </AdminLayout>
  );
}
