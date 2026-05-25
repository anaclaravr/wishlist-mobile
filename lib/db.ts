import postgres from "postgres";

import { getPrimaryWishlistSlug } from "@/lib/config";
import { PublicError } from "@/lib/errors";
import { makeToken } from "@/lib/tokens";

type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

export type Wishlist = {
  id: string;
  title: string;
  ownerName: string | null;
  slug: string;
  adminToken: string;
  createdAt: string;
};

export type PublicWishlist = Omit<Wishlist, "adminToken">;

export type WishlistItem = {
  id: string;
  wishlistId: string;
  name: string;
  purchaseUrl: string;
  priceCents: number;
  currency: string;
  category: string;
  createdAt: string;
  acquiredAt: string | null;
  acquiredByEmail: string | null;
};

export type Follower = {
  id: string;
  wishlistId: string;
  email: string;
  followToken: string;
  createdAt: string;
};

export type WishlistData = {
  wishlist: PublicWishlist;
  items: WishlistItem[];
  categories: string[];
  followersCount: number;
};

type WishlistRow = {
  id: string;
  title: string;
  ownerName: string | null;
  slug: string;
  adminToken: string;
  createdAt: Date | string;
};

type WishlistItemRow = Omit<WishlistItem, "createdAt" | "acquiredAt"> & {
  createdAt: Date | string;
  acquiredAt: Date | string | null;
};

type FollowerRow = Omit<Follower, "createdAt"> & {
  createdAt: Date | string;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new PublicError("Configure DATABASE_URL para acessar o banco de dados.", 500);
  }

  if (!client) {
    const isLocal =
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1") ||
      databaseUrl.includes("sslmode=disable");

    client = postgres(databaseUrl, {
      max: 5,
      ssl: isLocal ? undefined : "require",
      prepare: false,
    });
  }

  return client;
}

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toWishlist(row: WishlistRow): Wishlist {
  return {
    ...row,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toPublicWishlist(row: WishlistRow): PublicWishlist {
  const wishlist = toWishlist(row);

  return {
    id: wishlist.id,
    title: wishlist.title,
    ownerName: wishlist.ownerName,
    slug: wishlist.slug,
    createdAt: wishlist.createdAt,
  };
}

function toItem(row: WishlistItemRow): WishlistItem {
  return {
    ...row,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    acquiredAt: toIso(row.acquiredAt),
  };
}

function toFollower(row: FollowerRow): Follower {
  return {
    ...row,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function getCategories(items: WishlistItem[]) {
  return Array.from(new Set(items.map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getWishlistDataBySlug(slug: string): Promise<WishlistData | null> {
  const sql = getSql();
  const [wishlistRow] = await sql<WishlistRow[]>`
    select
      id,
      title,
      owner_name as "ownerName",
      slug,
      admin_token as "adminToken",
      created_at as "createdAt"
    from wishlists
    where slug = ${slug}
  `;

  if (!wishlistRow) {
    return null;
  }

  const items = await getItems(wishlistRow.id);
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from followers
    where wishlist_id = ${wishlistRow.id}
  `;

  return {
    wishlist: toPublicWishlist(wishlistRow),
    items,
    categories: getCategories(items),
    followersCount: count,
  };
}

export async function getPrimaryWishlistData() {
  const slug = getPrimaryWishlistSlug();

  if (!slug) {
    return {
      slug: null,
      data: null,
    };
  }

  return {
    slug,
    data: await getWishlistDataBySlug(slug),
  };
}

export async function getWishlistDataByAdminToken(adminToken: string) {
  const sql = getSql();
  const [wishlistRow] = await sql<WishlistRow[]>`
    select
      id,
      title,
      owner_name as "ownerName",
      slug,
      admin_token as "adminToken",
      created_at as "createdAt"
    from wishlists
    where admin_token = ${adminToken}
  `;

  if (!wishlistRow) {
    return null;
  }

  const items = await getItems(wishlistRow.id);
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from followers
    where wishlist_id = ${wishlistRow.id}
  `;

  return {
    wishlist: toWishlist(wishlistRow),
    items,
    categories: getCategories(items),
    followersCount: count,
  };
}

export async function getItems(wishlistId: string) {
  const sql = getSql();
  const rows = await sql<WishlistItemRow[]>`
    select
      wi.id,
      wi.wishlist_id as "wishlistId",
      wi.name,
      wi.purchase_url as "purchaseUrl",
      wi.price_cents as "priceCents",
      wi.currency,
      wi.category,
      wi.created_at as "createdAt",
      wi.acquired_at as "acquiredAt",
      f.email as "acquiredByEmail"
    from wishlist_items wi
    left join followers f on f.id = wi.acquired_by_follower_id
    where wi.wishlist_id = ${wishlistId}
    order by wi.created_at desc
  `;

  return rows.map(toItem);
}

export async function addWishlistItem(input: {
  adminToken: string;
  name: string;
  purchaseUrl: string;
  priceCents: number;
  category: string;
}) {
  const sql = getSql();
  const data = await getWishlistDataByAdminToken(input.adminToken);

  if (!data) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const [row] = await sql<WishlistItemRow[]>`
    insert into wishlist_items (wishlist_id, name, purchase_url, price_cents, category)
    values (
      ${data.wishlist.id},
      ${input.name.trim()},
      ${input.purchaseUrl.trim()},
      ${input.priceCents},
      ${input.category.trim() || "Geral"}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      price_cents as "priceCents",
      currency,
      category,
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      null::text as "acquiredByEmail"
  `;

  return {
    wishlist: data.wishlist,
    item: toItem(row),
  };
}

export async function getFollowersForWishlist(wishlistId: string) {
  const sql = getSql();
  const rows = await sql<FollowerRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
    from followers
    where wishlist_id = ${wishlistId}
    order by created_at asc
  `;

  return rows.map(toFollower);
}

export async function followWishlist(input: { slug: string; email: string }) {
  const sql = getSql();
  const data = await getWishlistDataBySlug(input.slug);

  if (!data) {
    throw new PublicError("Wishlist nao encontrada.", 404);
  }

  const email = normalizeEmail(input.email);
  const [row] = await sql<FollowerRow[]>`
    insert into followers (wishlist_id, email, follow_token)
    values (${data.wishlist.id}, ${email}, ${makeToken("follow")})
    on conflict (wishlist_id, email)
    do update set email = excluded.email
    returning
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
  `;

  return {
    wishlist: data.wishlist,
    follower: toFollower(row),
  };
}

export async function getFollowerByToken(input: { slug: string; followToken: string }) {
  const sql = getSql();
  const [row] = await sql<FollowerRow[]>`
    select
      f.id,
      f.wishlist_id as "wishlistId",
      f.email,
      f.follow_token as "followToken",
      f.created_at as "createdAt"
    from followers f
    join wishlists w on w.id = f.wishlist_id
    where w.slug = ${input.slug}
      and f.follow_token = ${input.followToken}
  `;

  return row ? toFollower(row) : null;
}

export async function markItemAcquired(input: { itemId: string; followToken: string }) {
  const sql = getSql();
  const [follower] = await sql<FollowerRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
    from followers
    where follow_token = ${input.followToken}
  `;

  if (!follower) {
    throw new PublicError("Acompanhe a wishlist antes de marcar como adquirido.", 401);
  }

  const [updated] = await sql<WishlistItemRow[]>`
    update wishlist_items
    set
      acquired_at = now(),
      acquired_by_follower_id = ${follower.id}
    where id = ${input.itemId}
      and wishlist_id = ${follower.wishlistId}
      and acquired_at is null
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      price_cents as "priceCents",
      currency,
      category,
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      ${follower.email}::text as "acquiredByEmail"
  `;

  if (updated) {
    return toItem(updated);
  }

  const [existing] = await sql<WishlistItemRow[]>`
    select
      wi.id,
      wi.wishlist_id as "wishlistId",
      wi.name,
      wi.purchase_url as "purchaseUrl",
      wi.price_cents as "priceCents",
      wi.currency,
      wi.category,
      wi.created_at as "createdAt",
      wi.acquired_at as "acquiredAt",
      f.email as "acquiredByEmail"
    from wishlist_items wi
    left join followers f on f.id = wi.acquired_by_follower_id
    where wi.id = ${input.itemId}
      and wi.wishlist_id = ${follower.wishlistId}
  `;

  if (existing?.acquiredAt) {
    throw new PublicError("Este item ja foi marcado como adquirido.", 409);
  }

  throw new PublicError("Item nao encontrado para esta wishlist.", 404);
}
