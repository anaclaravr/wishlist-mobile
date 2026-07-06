import Link from "next/link";

import { WishlistAccessGate } from "@/components/wishlist-access-gate";
import { WishlistAppView } from "@/components/wishlist-app-view";
import { getCurrentAccessSession } from "@/lib/access-session";
import { getWishlistPublicPath } from "@/lib/config";
import { getWishlistDataBySlug } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getCurrentAccessSession();

  if (!session || session.wishlistSlug !== slug || !hasPermission(session.role, "wishlist.read")) {
    return <WishlistAccessGate slug={slug} />;
  }

  const data = await getWishlistDataBySlug(slug);

  if (!data) {
    return (
      <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[980px] items-center justify-center rounded-[30px] border border-[#d8deea] bg-[#f8f9fd] p-6 shadow-[0_34px_80px_rgba(27,36,54,0.12)] sm:p-10">
          <div className="w-full max-w-lg rounded-2xl border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a92a7]">
            Link invalido
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#141a27]">Workspace nao encontrado</h1>
            <p className="mt-3 text-sm leading-6 text-[#666f85]">
              Confira se o link recebido esta completo ou volte para o workspace principal.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#141a28] px-4 text-sm font-semibold text-white"
            >
              Abrir workspace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <WishlistAppView
      data={data}
      canonicalPath={getWishlistPublicPath(slug)}
      access={{
        role: session.role,
        permissions: session.permissions,
      }}
    />
  );
}
