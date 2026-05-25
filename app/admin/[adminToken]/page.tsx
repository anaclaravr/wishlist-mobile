import Link from "next/link";

import { AdminWishlistPanel } from "@/components/admin-wishlist-panel";
import { getWishlistPublicPath } from "@/lib/config";
import { getWishlistDataByAdminToken } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const data = await getWishlistDataByAdminToken(adminToken);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
            Admin
          </p>
          <h1 className="mt-2 text-2xl font-black text-neutral-950">Link admin invalido</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            O painel de edicao precisa do link secreto da sua wishlist.
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

  return (
    <AdminWishlistPanel
      data={data}
      adminToken={adminToken}
      publicPath={getWishlistPublicPath(data.wishlist.slug)}
    />
  );
}
