"use client";

import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import type { Wishlist, WishlistData, WishlistItem } from "@/lib/db";
import { formatPrice, isRecent } from "@/lib/format";

type AdminData = Omit<WishlistData, "wishlist"> & {
  wishlist: Wishlist;
};

type AddItemResponse = {
  item?: WishlistItem;
  notifications?: {
    sent: number;
    skipped: number;
  };
  error?: string;
};

export function AdminWishlistPanel({
  data,
  adminToken,
  publicPath,
}: {
  data: AdminData;
  adminToken: string;
  publicPath: string;
}) {
  const [items, setItems] = useState(data.items);
  const [name, setName] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(data.categories[0] ?? "Geral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set([...data.categories, ...items.map((item) => item.category), "Geral"]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data.categories, items],
  );

  async function copyPublicLink() {
    setError(null);

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicPath}`);
      setMessage("Link publico copiado.");
    } catch {
      setError(publicPath);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminToken,
          name,
          purchaseUrl,
          price,
          category,
        }),
      });
      const result = (await response.json()) as AddItemResponse;

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Nao foi possivel adicionar o item.");
      }

      setItems((currentItems) => [result.item as WishlistItem, ...currentItems]);
      setName("");
      setPurchaseUrl("");
      setPrice("");
      setCategory(result.item.category);
      setMessage(
        result.notifications
          ? `Item adicionado. ${result.notifications.sent} alerta(s) enviado(s).`
          : "Item adicionado.",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-5 sm:max-w-2xl">
      <header className="space-y-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
              Painel admin
            </p>
            <h1 className="break-words text-3xl font-black leading-tight text-neutral-950">
              {data.wishlist.title}
            </h1>
            <p className="text-sm font-semibold text-neutral-600">
              {items.length} item(ns) · {data.followersCount} acompanhando
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white shadow-soft">
            <ShoppingBag aria-hidden="true" className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a
            href={publicPath}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-black text-neutral-900"
          >
            <LinkIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            Abrir link publico
          </a>
          <button
            type="button"
            onClick={copyPublicLink}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-700 text-white"
            aria-label="Copiar link publico"
            title="Copiar link publico"
          >
            <Copy aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-soft"
      >
        <div className="flex items-center gap-2">
          <Plus aria-hidden="true" className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-black text-neutral-950">Adicionar item</h2>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-bold text-neutral-800">Nome</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            maxLength={120}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-bold text-neutral-800">Link de compra</span>
          <input
            value={purchaseUrl}
            onChange={(event) => setPurchaseUrl(event.target.value)}
            className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            inputMode="url"
            placeholder="https://..."
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-neutral-800">Preco</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              inputMode="decimal"
              placeholder="149,90"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold text-neutral-800">Categoria</span>
            <input
              list="wishlist-categories"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
              maxLength={60}
              required
            />
            <datalist id="wishlist-categories">
              {categories.map((itemCategory) => (
                <option key={itemCategory} value={itemCategory} />
              ))}
            </datalist>
          </label>
        </div>

        {message ? (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-5 w-5" />
          )}
          Adicionar
        </button>
      </form>

      <section className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-5 text-center">
            <p className="text-sm font-bold text-neutral-600">Nenhum item cadastrado ainda.</p>
          </div>
        ) : (
          items.map((item) => (
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
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-teal-700" />
                  Adquirido por {item.acquiredByEmail}
                </p>
              ) : null}

              <a
                href={item.purchaseUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm font-black text-neutral-900"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                Abrir compra
              </a>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
