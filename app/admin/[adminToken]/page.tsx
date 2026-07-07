import Link from "next/link";

import { AdminBootstrapLogin } from "@/components/admin-bootstrap-login";
import { bootstrapAdminProfileByToken } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const data = await bootstrapAdminProfileByToken(adminToken).catch(() => null);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f8f9fd] px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] items-center justify-center">
          <div className="w-full max-w-lg rounded-[24px] border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)]">
            <p className="text-[11px] font-medium uppercase text-[#8a92a7]">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#141a27]">Link admin invalido</h1>
            <p className="mt-3 text-sm leading-6 text-[#666f85]">
              O painel de edicao precisa do link secreto da sua wishlist.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#141a28] px-4 text-sm font-medium text-white"
            >
              Abrir wishlist
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <AdminBootstrapLogin adminToken={adminToken} wishlistTitle={data.wishlist.title} />;
}
