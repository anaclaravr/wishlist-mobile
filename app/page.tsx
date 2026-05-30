import { AlertCircle } from "lucide-react";

import { WishlistAccessGate } from "@/components/wishlist-access-gate";
import { WishlistAppView } from "@/components/wishlist-app-view";
import { getPrimaryWishlistSlug } from "@/lib/config";
import { getWishlistDataBySlug } from "@/lib/db";
import { getCurrentAccessSession } from "@/lib/access-session";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function WishlistSetupError({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[980px] items-center justify-center rounded-[30px] border border-[#d8deea] bg-[#f8f9fd] p-6 shadow-[0_34px_80px_rgba(27,36,54,0.12)] sm:p-10">
        <div className="w-full max-w-lg rounded-2xl border border-[#d8deea] bg-white p-6 shadow-[0_18px_35px_rgba(27,36,54,0.08)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fde9cf] text-[#8e5b12]">
          <AlertCircle aria-hidden="true" className="h-6 w-6" />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a92a7]">
            Wishlist
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#141a27]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#666f85]">{description}</p>
        </div>
      </div>
    </main>
  );
}

export default async function HomePage() {
  const slug = getPrimaryWishlistSlug();

  if (!slug) {
    return (
      <WishlistSetupError
        title="Configure a wishlist principal"
        description="Defina WISHLIST_SLUG no ambiente com o slug da sua wishlist para que a pagina inicial mostre a lista publica."
      />
    );
  }

  const session = await getCurrentAccessSession();

  if (!session || session.wishlistSlug !== slug || !hasPermission(session.role, "wishlist.read")) {
    return <WishlistAccessGate slug={slug} />;
  }

  const data = await getWishlistDataBySlug(slug);

  if (!data) {
    return (
      <WishlistSetupError
        title="Wishlist nao encontrada"
        description={`Nao encontramos uma wishlist com o slug "${slug}". Confira WISHLIST_SLUG ou crie essa wishlist no banco.`}
      />
    );
  }

  return (
    <WishlistAppView
      data={data}
      canonicalPath="/"
      access={{
        role: session.role,
        permissions: session.permissions,
      }}
    />
  );
}
