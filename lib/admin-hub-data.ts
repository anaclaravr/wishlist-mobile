import { getWishlistPublicPath } from "@/lib/config";
import {
  ensureAccessProfilesForWishlistId,
  getAdminHubDataByWishlistId,
  listAccessProfilesByWishlistId,
  listLegacyPublicSuggestionsByWishlistId,
  listPublicProfileSuggestionsByWishlistId,
} from "@/lib/access-db";
import { getCurrentAccessSession } from "@/lib/access-session";
import { mapSuggestions } from "@/components/admin-shared";

export async function getAdminPageData() {
  const session = await getCurrentAccessSession();
  if (!session || session.role !== "admin") {
    return null;
  }

  await ensureAccessProfilesForWishlistId(session.wishlistId);

  const [hub, profiles, profileSuggestions, legacySuggestions] = await Promise.all([
    getAdminHubDataByWishlistId(session.wishlistId),
    listAccessProfilesByWishlistId(session.wishlistId),
    listPublicProfileSuggestionsByWishlistId(session.wishlistId),
    listLegacyPublicSuggestionsByWishlistId(session.wishlistId),
  ]);

  return {
    hub,
    profiles,
    suggestions: mapSuggestions(profileSuggestions, legacySuggestions),
    wishlistHref: getWishlistPublicPath(hub.wishlist.slug),
  };
}
