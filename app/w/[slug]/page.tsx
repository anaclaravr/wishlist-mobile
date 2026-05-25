import Link from "next/link";

import { WishlistPublicView } from "@/components/wishlist-public-view";
import { getWishlistPublicPath } from "@/lib/config";
import { getWishlistDataBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getWishlistDataBySlug(slug);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
            Link invalido
          </p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Wishlist nao encontrada</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Confira se o link recebido esta completo ou volte para a wishlist principal.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-neutral-950 px-4 text-sm font-bold text-white"
          >
            Abrir wishlist
          </Link>
        </div>
      </main>
    );
  }

  return <WishlistPublicView data={data} canonicalPath={getWishlistPublicPath(slug)} />;
}
