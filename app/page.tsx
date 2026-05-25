import { AlertCircle } from "lucide-react";

import { WishlistPublicView } from "@/components/wishlist-public-view";
import { getPrimaryWishlistData } from "@/lib/db";

export const dynamic = "force-dynamic";

function WishlistSetupError({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
          <AlertCircle aria-hidden="true" className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
          Wishlist
        </p>
        <h1 className="mt-2 text-2xl font-black text-neutral-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">{description}</p>
      </div>
    </main>
  );
}

export default async function HomePage() {
  const { slug, data } = await getPrimaryWishlistData();

  if (!slug) {
    return (
      <WishlistSetupError
        title="Configure a wishlist principal"
        description="Defina WISHLIST_SLUG no ambiente com o slug da sua wishlist para que a pagina inicial mostre a lista publica."
      />
    );
  }

  if (!data) {
    return (
      <WishlistSetupError
        title="Wishlist nao encontrada"
        description={`Nao encontramos uma wishlist com o slug "${slug}". Confira WISHLIST_SLUG ou crie essa wishlist no banco.`}
      />
    );
  }

  return <WishlistPublicView data={data} canonicalPath="/" />;
}
