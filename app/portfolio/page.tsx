import { PortfolioPublicView, PortfolioUnavailable } from "@/components/portfolio-public-view";
import { getPortfolioPageSettingsByWishlistId } from "@/lib/access-db";
import { getPrimaryWishlistSlug } from "@/lib/config";
import { getWishlistDataBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const slug = getPrimaryWishlistSlug();

  if (!slug) {
    return <PortfolioUnavailable />;
  }

  const data = await getWishlistDataBySlug(slug);

  if (!data) {
    return <PortfolioUnavailable />;
  }

  const settings = await getPortfolioPageSettingsByWishlistId(data.wishlist.id);

  if (!settings.isPublished) {
    return <PortfolioUnavailable />;
  }

  return <PortfolioPublicView settings={settings} />;
}
