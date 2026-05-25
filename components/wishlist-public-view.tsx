"use client";

import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { WishlistData, WishlistItem } from "@/lib/db";
import { formatPrice, isRecent } from "@/lib/format";

type FollowerState = {
  email: string;
  followToken: string;
};

type FollowResponse = {
  follower?: FollowerState;
  error?: string;
};

type AcquireResponse = {
  item?: WishlistItem;
  error?: string;
};

export function WishlistPublicView({ data }: { data: WishlistData }) {
  const [items, setItems] = useState(data.items);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [email, setEmail] = useState("");
  const [follower, setFollower] = useState<FollowerState | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [pendingAcquire, setPendingAcquire] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `wishlist:${data.wishlist.slug}:followToken`;
  const categories = useMemo(() => ["Todos", ...data.categories], [data.categories]);
  const visibleItems = useMemo(
    () =>
      selectedCategory === "Todos"
        ? items
        : items.filter((item) => item.category === selectedCategory),
    [items, selectedCategory],
  );

  useEffect(() => {
    async function hydrateFollower() {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get("follow");
      const savedToken = tokenFromUrl || window.localStorage.getItem(storageKey);

      if (!savedToken) {
        return;
      }

      try {
        const response = await fetch(
          `/api/follow/status?slug=${encodeURIComponent(data.wishlist.slug)}&token=${encodeURIComponent(
            savedToken,
          )}`,
        );
        const result = (await response.json()) as FollowResponse;

        if (!response.ok || !result.follower) {
          window.localStorage.removeItem(storageKey);
          return;
        }

        window.localStorage.setItem(storageKey, result.follower.followToken);
        setFollower(result.follower);
        setEmail(result.follower.email);

        if (tokenFromUrl) {
          window.history.replaceState(null, "", `/w/${data.wishlist.slug}`);
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }

    hydrateFollower();
  }, [data.wishlist.slug, storageKey]);

  async function handleFollow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsFollowing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: data.wishlist.slug,
          email,
        }),
      });
      const result = (await response.json()) as FollowResponse;

      if (!response.ok || !result.follower) {
        throw new Error(result.error ?? "Nao foi possivel acompanhar a wishlist.");
      }

      window.localStorage.setItem(storageKey, result.follower.followToken);
      setFollower(result.follower);
      setMessage("Acompanhamento ativado. Voce recebera novidades por e-mail.");
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : "Erro inesperado.");
    } finally {
      setIsFollowing(false);
    }
  }

  async function handleAcquire(itemId: string) {
    if (!follower) {
      setError("Acompanhe a wishlist para marcar um item como adquirido.");
      return;
    }

    setPendingAcquire(itemId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/items/${itemId}/acquire`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followToken: follower.followToken,
        }),
      });
      const result = (await response.json()) as AcquireResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel marcar o item.");
      }

      setItems((currentItems) =>
        currentItems.map((item) => (item.id === result.item?.id ? result.item : item)),
      );
      setMessage("Item marcado como adquirido.");
    } catch (acquireError) {
      setError(acquireError instanceof Error ? acquireError.message : "Erro inesperado.");
    } finally {
      setPendingAcquire(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-5 sm:max-w-2xl">
      <header className="space-y-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
              Wishlist
            </p>
            <h1 className="break-words text-3xl font-black leading-tight text-neutral-950">
              {data.wishlist.title}
            </h1>
            {data.wishlist.ownerName ? (
              <p className="text-sm font-semibold text-neutral-600">
                Por {data.wishlist.ownerName}
              </p>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white shadow-soft">
            <ShoppingBag aria-hidden="true" className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-neutral-200 bg-white px-2 py-3">
            <p className="text-lg font-black text-neutral-950">{items.length}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Itens</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-2 py-3">
            <p className="text-lg font-black text-neutral-950">{data.followersCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Seguindo
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-2 py-3">
            <p className="text-lg font-black text-neutral-950">
              {items.filter((item) => item.acquiredAt).length}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Comprados
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Bell aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-black text-neutral-950">
            {follower ? "Acompanhando" : "Acompanhar wishlist"}
          </h2>
        </div>
        {follower ? (
          <p className="text-sm font-semibold text-neutral-600">{follower.email}</p>
        ) : (
          <form onSubmit={handleFollow} className="flex gap-2">
            <label className="sr-only" htmlFor="follow-email">
              E-mail
            </label>
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-neutral-300 px-3 focus-within:border-teal-700 focus-within:ring-4 focus-within:ring-teal-700/10">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                id="follow-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                required
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isFollowing}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white disabled:opacity-60"
              aria-label="Acompanhar wishlist"
              title="Acompanhar wishlist"
            >
              {isFollowing ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <Bell aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </form>
        )}
      </section>

      {message ? (
        <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {categories.length > 1 ? (
        <section className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-neutral-800">
            <Filter aria-hidden="true" className="h-4 w-4" />
            Categorias
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {categories.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`h-10 shrink-0 rounded-lg px-4 text-sm font-black transition ${
                    active
                      ? "bg-teal-700 text-white"
                      : "border border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-5 space-y-3">
        {visibleItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 text-center">
            <Sparkles aria-hidden="true" className="mx-auto h-6 w-6 text-orange-600" />
            <p className="mt-2 text-sm font-bold text-neutral-600">Nenhum item nesta categoria.</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <article
              key={item.id}
              className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-black text-orange-800">
                      {item.category}
                    </span>
                    {isRecent(item.createdAt) ? (
                      <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-black text-teal-800">
                        Recente
                      </span>
                    ) : null}
                    {item.acquiredAt ? (
                      <span className="rounded-md bg-neutral-900 px-2 py-1 text-xs font-black text-white">
                        Adquirido
                      </span>
                    ) : null}
                  </div>
                  <h2 className="break-words text-xl font-black leading-tight text-neutral-950">
                    {item.name}
                  </h2>
                </div>
                <p className="shrink-0 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-black text-neutral-950">
                  {formatPrice(item.priceCents, item.currency)}
                </p>
              </div>

              {item.acquiredByEmail ? (
                <p className="text-sm font-semibold text-neutral-500">
                  Marcado por {item.acquiredByEmail}
                </p>
              ) : null}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <a
                  href={item.purchaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-black text-neutral-900"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Comprar
                </a>
                <button
                  type="button"
                  onClick={() => handleAcquire(item.id)}
                  disabled={Boolean(item.acquiredAt) || pendingAcquire === item.id}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-700 text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
                  aria-label="Marcar como adquirido"
                  title="Marcar como adquirido"
                >
                  {pendingAcquire === item.id ? (
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
