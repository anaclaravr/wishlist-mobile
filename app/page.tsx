import { Gift } from "lucide-react";

import { CreateWishlistForm } from "@/components/create-wishlist-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:max-w-2xl sm:py-10">
      <section className="flex flex-1 flex-col justify-center gap-6">
        <div className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-700 text-white shadow-soft">
            <Gift aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
              Wishlist
            </p>
            <h1 className="text-4xl font-black leading-tight text-neutral-950 sm:text-5xl">
              Crie sua lista compartilhavel
            </h1>
          </div>
        </div>

        <CreateWishlistForm />
      </section>
    </main>
  );
}
