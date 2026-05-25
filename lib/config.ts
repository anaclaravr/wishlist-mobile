export function getPrimaryWishlistSlug() {
  return process.env.WISHLIST_SLUG?.trim() || null;
}

export function getWishlistPublicPath(slug: string) {
  return slug === getPrimaryWishlistSlug() ? "/" : `/w/${slug}`;
}
