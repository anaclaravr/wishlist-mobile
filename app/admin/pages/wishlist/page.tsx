import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { SuggestionsPanel } from "@/components/suggestions-panel";
import { WishlistSettingsForm } from "@/components/wishlist-settings-form";
import { getAdminPageData } from "@/lib/admin-hub-data";

export const dynamic = "force-dynamic";

export default async function AdminWishlistPage() {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="admin-pages-wishlist"
      title="Wishlist"
      description="Configure a pagina Wishlist e acompanhe sugestoes publicas."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <WishlistSettingsForm wishlist={data.hub.wishlist} />
        <SuggestionsPanel suggestions={data.suggestions} />
      </div>
    </AdminLayout>
  );
}
