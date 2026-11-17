export function getPrimaryWishlistSlug() {
  return process.env.WISHLIST_SLUG?.trim() || null;
}

// "/" agora é o app "Meu espaço" (public/espaco.html); a wishlist antiga fica em /w/[slug].
export function getWishlistPublicPath(slug: string) {
  return `/w/${slug}`;
}
