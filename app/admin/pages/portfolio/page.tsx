import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { PortfolioPageSettingsForm } from "@/components/portfolio-page-settings-form";
import { getAdminPageData } from "@/lib/admin-hub-data";
import { getPortfolioPageSettingsByWishlistId } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function AdminPortfolioSettingsPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  const settings = await getPortfolioPageSettingsByWishlistId(data.hub.wishlist.id);

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-pages-portfolio"
      title="Portfolio"
      description="Configure a pagina publica de portfolio para recrutadores."
    >
      <PortfolioPageSettingsForm initialSettings={settings} />
    </AdminLayout>
  );
}
