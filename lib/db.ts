import postgres from "postgres";

import { getPrimaryWishlistSlug } from "@/lib/config";
import { PublicError } from "@/lib/errors";
import { makeToken } from "@/lib/tokens";

type Sql = ReturnType<typeof postgres>;

const globalForSql = globalThis as typeof globalThis & {
  __wishlistSqlClient?: Sql;
};

export const WISHLIST_ITEM_PRIORITIES = ["baixa", "media", "alta"] as const;
export const PERSONAL_ITEM_VISIBILITIES = ["private", "public"] as const;
export const ITEM_REPURCHASE_STATES = [
  "nao_recompra",
  "precisa_recompra",
  "ainda_tem",
] as const;

export type WishlistItemPriority = (typeof WISHLIST_ITEM_PRIORITIES)[number];
export type ItemRepurchaseState = (typeof ITEM_REPURCHASE_STATES)[number];

export type Wishlist = {
  id: string;
  title: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatarUrl: string | null;
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
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  createdAt: string;
  acquiredAt: string | null;
  acquiredByEmail: string | null;
  acquiredByFollowerId: string | null;
  acquiredByProfileId: string | null;
  archivedAt: string | null;
};

export type Follower = {
  id: string;
  wishlistId: string;
  email: string | null;
  followToken: string;
  createdAt: string;
};

export type FollowerSession = Pick<Follower, "id" | "wishlistId" | "email" | "followToken">;

export type FavoriteItem = {
  id: string;
  wishlistId: string;
  wishlistItemId: string;
  followerId: string;
  createdAt: string;
};

export type PersonalItemVisibility = "private" | "public";

export type PersonalItem = {
  id: string;
  wishlistId: string;
  followerId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
  createdAt: string;
  updatedAt: string;
};

export type PersonalItemSuggestion = PersonalItem & {
  followerEmail: string | null;
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
  ownerEmail: string | null;
  ownerAvatarUrl: string | null;
  slug: string;
  adminToken: string;
  createdAt: Date | string;
};

type WishlistItemRow = Omit<
  WishlistItem,
  "createdAt" | "acquiredAt" | "archivedAt" | "priority" | "repurchaseState"
> & {
  priority: string | null;
  repurchaseState: string | null;
  createdAt: Date | string;
  acquiredAt: Date | string | null;
  archivedAt: Date | string | null;
  acquiredByProfileId?: string | null;
};

type FollowerRow = Omit<Follower, "createdAt"> & {
  createdAt: Date | string;
};

type PersonalItemRow = Omit<
  PersonalItem,
  "createdAt" | "updatedAt" | "priority" | "visibility" | "repurchaseState"
> & {
  priority: string | null;
  visibility: string | null;
  repurchaseState: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type PersonalItemSuggestionRow = PersonalItemRow & {
  followerEmail: string | null;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new PublicError("Configure DATABASE_URL para acessar o banco de dados.", 500);
  }

  if (!globalForSql.__wishlistSqlClient) {
    const isLocal =
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1") ||
      databaseUrl.includes("sslmode=disable");

    globalForSql.__wishlistSqlClient = postgres(databaseUrl, {
      max: process.env.NODE_ENV === "production" ? 5 : 1,
      ssl: isLocal ? undefined : "require",
      prepare: false,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
    });
  }

  return globalForSql.__wishlistSqlClient;
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
    ownerEmail: wishlist.ownerEmail,
    ownerAvatarUrl: wishlist.ownerAvatarUrl,
    slug: wishlist.slug,
    createdAt: wishlist.createdAt,
  };
}

function normalizePriority(value: string | null): WishlistItemPriority {
  return value === "baixa" || value === "alta" ? value : "media";
}

function normalizePersonalItemVisibility(value: string | null): PersonalItemVisibility {
  return value === "public" ? "public" : "private";
}

function normalizeRepurchaseState(value: string | null): ItemRepurchaseState {
  if (value === "precisa_recompra") {
    return "precisa_recompra";
  }

  if (value === "ainda_tem") {
    return "ainda_tem";
  }

  return "nao_recompra";
}

function toItem(row: WishlistItemRow): WishlistItem {
  return {
    ...row,
    priority: normalizePriority(row.priority),
    repurchaseState: normalizeRepurchaseState(row.repurchaseState),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    acquiredAt: toIso(row.acquiredAt),
    acquiredByProfileId: row.acquiredByProfileId ?? null,
    archivedAt: toIso(row.archivedAt),
  };
}

function toFollower(row: FollowerRow): Follower {
  return {
    ...row,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toPersonalItem(row: PersonalItemRow): PersonalItem {
  return {
    ...row,
    priority: normalizePriority(row.priority),
    repurchaseState: normalizeRepurchaseState(row.repurchaseState),
    visibility: normalizePersonalItemVisibility(row.visibility),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toPersonalItemSuggestion(row: PersonalItemSuggestionRow): PersonalItemSuggestion {
  return {
    ...toPersonalItem(row),
    followerEmail: row.followerEmail,
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

function normalizeImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim();
  return trimmed || null;
}

async function getFollowerByTokenOnly(sql: Sql, followToken: string) {
  const [follower] = await sql<FollowerRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
    from followers
    where follow_token = ${followToken}
    limit 1
  `;

  return follower;
}

async function getFollowerBySlugAndToken(sql: Sql, input: { slug: string; followToken: string }) {
  const [follower] = await sql<FollowerRow[]>`
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
    limit 1
  `;

  return follower;
}

async function getWishlistByAdminToken(adminToken: string) {
  const sql = getSql();
  const [wishlistRow] = await sql<WishlistRow[]>`
    select
      id,
      title,
      owner_name as "ownerName",
      owner_email as "ownerEmail",
      owner_avatar_url as "ownerAvatarUrl",
      slug,
      admin_token as "adminToken",
      created_at as "createdAt"
    from wishlists
    where admin_token = ${adminToken}
  `;

  return wishlistRow ? toWishlist(wishlistRow) : null;
}

export async function getWishlistDataBySlug(slug: string): Promise<WishlistData | null> {
  const sql = getSql();
  const [wishlistRow] = await sql<WishlistRow[]>`
    select
      id,
      title,
      owner_name as "ownerName",
      owner_email as "ownerEmail",
      owner_avatar_url as "ownerAvatarUrl",
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
  const wishlist = await getWishlistByAdminToken(adminToken);

  if (!wishlist) {
    return null;
  }

  const items = await getItems(wishlist.id, { includeArchived: true });
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from followers
    where wishlist_id = ${wishlist.id}
  `;

  return {
    wishlist,
    items,
    categories: getCategories(items),
    followersCount: count,
  };
}

export async function getItems(
  wishlistId: string,
  options: { includeArchived?: boolean } = {},
) {
  const sql = getSql();
  const rows = options.includeArchived
    ? await sql<WishlistItemRow[]>`
        select
          wi.id,
          wi.wishlist_id as "wishlistId",
          wi.name,
          wi.purchase_url as "purchaseUrl",
          wi.image_url as "imageUrl",
          wi.price_cents as "priceCents",
          wi.currency,
          wi.category,
          wi.priority,
          wi.repurchase_state as "repurchaseState",
          wi.created_at as "createdAt",
          wi.acquired_at as "acquiredAt",
          f.email as "acquiredByEmail",
          wi.acquired_by_follower_id as "acquiredByFollowerId",
          wi.acquired_by_profile_id as "acquiredByProfileId",
          wi.archived_at as "archivedAt"
        from wishlist_items wi
        left join followers f on f.id = wi.acquired_by_follower_id
        where wi.wishlist_id = ${wishlistId}
        order by wi.archived_at nulls first, wi.created_at desc
      `
    : await sql<WishlistItemRow[]>`
        select
          wi.id,
          wi.wishlist_id as "wishlistId",
          wi.name,
          wi.purchase_url as "purchaseUrl",
          wi.image_url as "imageUrl",
          wi.price_cents as "priceCents",
          wi.currency,
          wi.category,
          wi.priority,
          wi.repurchase_state as "repurchaseState",
          wi.created_at as "createdAt",
          wi.acquired_at as "acquiredAt",
          f.email as "acquiredByEmail",
          wi.acquired_by_follower_id as "acquiredByFollowerId",
          wi.acquired_by_profile_id as "acquiredByProfileId",
          wi.archived_at as "archivedAt"
        from wishlist_items wi
        left join followers f on f.id = wi.acquired_by_follower_id
        where wi.wishlist_id = ${wishlistId}
          and wi.archived_at is null
        order by wi.created_at desc
      `;

  return rows.map(toItem);
}

export async function addWishlistItem(input: {
  adminToken: string;
  name: string;
  purchaseUrl: string;
  imageUrl?: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
}) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(input.adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const [row] = await sql<WishlistItemRow[]>`
    insert into wishlist_items (
      wishlist_id,
      name,
      purchase_url,
      image_url,
      price_cents,
      category,
      priority,
      repurchase_state
    )
    values (
      ${wishlist.id},
      ${input.name.trim()},
      ${input.purchaseUrl.trim()},
      ${normalizeImageUrl(input.imageUrl)},
      ${input.priceCents},
      ${input.category.trim() || "Geral"},
      ${input.priority},
      ${input.repurchaseState}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      null::text as "acquiredByEmail",
      null::uuid as "acquiredByFollowerId",
      null::uuid as "acquiredByProfileId",
      archived_at as "archivedAt"
  `;

  return {
    wishlist,
    item: toItem(row),
  };
}

export async function updateWishlistItem(input: {
  adminToken: string;
  itemId: string;
  name: string;
  purchaseUrl: string;
  imageUrl?: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
}) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(input.adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const [row] = await sql<WishlistItemRow[]>`
    update wishlist_items
    set
      name = ${input.name.trim()},
      purchase_url = ${input.purchaseUrl.trim()},
      image_url = ${normalizeImageUrl(input.imageUrl)},
      price_cents = ${input.priceCents},
      category = ${input.category.trim() || "Geral"},
      priority = ${input.priority},
      repurchase_state = ${input.repurchaseState}
    where id = ${input.itemId}
      and wishlist_id = ${wishlist.id}
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      (
        select email
        from followers
        where id = wishlist_items.acquired_by_follower_id
      ) as "acquiredByEmail",
      acquired_by_follower_id as "acquiredByFollowerId",
      acquired_by_profile_id as "acquiredByProfileId",
      archived_at as "archivedAt"
  `;

  if (!row) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  return toItem(row);
}

export async function archiveWishlistItem(input: {
  adminToken: string;
  itemId: string;
  archived: boolean;
}) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(input.adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const [row] = await sql<WishlistItemRow[]>`
    update wishlist_items
    set archived_at = ${input.archived ? sql`now()` : null}
    where id = ${input.itemId}
      and wishlist_id = ${wishlist.id}
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      (
        select email
        from followers
        where id = wishlist_items.acquired_by_follower_id
      ) as "acquiredByEmail",
      acquired_by_follower_id as "acquiredByFollowerId",
      acquired_by_profile_id as "acquiredByProfileId",
      archived_at as "archivedAt"
  `;

  if (!row) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  return toItem(row);
}

export async function deleteWishlistItem(input: { adminToken: string; itemId: string }) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(input.adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const [row] = await sql<{ id: string }[]>`
    delete from wishlist_items
    where id = ${input.itemId}
      and wishlist_id = ${wishlist.id}
    returning id
  `;

  if (!row) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  return row;
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
      and email is not null
    order by created_at asc
  `;

  return rows.map(toFollower);
}

export async function followWishlist(input: { slug: string; email?: string | null }) {
  const sql = getSql();
  const data = await getWishlistDataBySlug(input.slug);

  if (!data) {
    throw new PublicError("Wishlist nao encontrada.", 404);
  }

  const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
  let row: FollowerRow | undefined;

  if (normalizedEmail) {
    const [existingFollower] = await sql<FollowerRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        email,
        follow_token as "followToken",
        created_at as "createdAt"
      from followers
      where wishlist_id = ${data.wishlist.id}
        and email = ${normalizedEmail}
      limit 1
    `;

    if (existingFollower) {
      row = existingFollower;
    } else {
      [row] = await sql<FollowerRow[]>`
        insert into followers (wishlist_id, email, follow_token)
        values (${data.wishlist.id}, ${normalizedEmail}, ${makeToken("follow")})
        returning
          id,
          wishlist_id as "wishlistId",
          email,
          follow_token as "followToken",
          created_at as "createdAt"
      `;
    }
  } else {
    [row] = await sql<FollowerRow[]>`
      insert into followers (wishlist_id, email, follow_token)
      values (${data.wishlist.id}, null, ${makeToken("follow")})
      returning
        id,
        wishlist_id as "wishlistId",
        email,
        follow_token as "followToken",
        created_at as "createdAt"
    `;
  }

  if (!row) {
    throw new PublicError("Nao foi possivel iniciar o acompanhamento agora.", 500);
  }

  return {
    wishlist: data.wishlist,
    follower: toFollower(row),
  };
}

export async function setFollowerEmail(input: { slug: string; followToken: string; email: string }) {
  const sql = getSql();
  const email = normalizeEmail(input.email);
  const [follower] = await sql<FollowerRow[]>`
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
    limit 1
  `;

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const [existingFollowerByEmail] = await sql<FollowerRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
    from followers
    where wishlist_id = ${follower.wishlistId}
      and email = ${email}
    limit 1
  `;

  if (existingFollowerByEmail) {
    return toFollower(existingFollowerByEmail);
  }

  const [updatedFollower] = await sql<FollowerRow[]>`
    update followers
    set email = ${email}
    where id = ${follower.id}
    returning
      id,
      wishlist_id as "wishlistId",
      email,
      follow_token as "followToken",
      created_at as "createdAt"
  `;

  if (!updatedFollower) {
    throw new PublicError("Nao foi possivel salvar o e-mail agora.", 500);
  }

  return toFollower(updatedFollower);
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
  const follower = await getFollowerByTokenOnly(sql, input.followToken);

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
      and archived_at is null
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      ${follower.email}::text as "acquiredByEmail",
      ${follower.id}::uuid as "acquiredByFollowerId",
      null::uuid as "acquiredByProfileId",
      archived_at as "archivedAt"
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
      wi.image_url as "imageUrl",
      wi.price_cents as "priceCents",
      wi.currency,
      wi.category,
      wi.priority,
      wi.repurchase_state as "repurchaseState",
      wi.created_at as "createdAt",
      wi.acquired_at as "acquiredAt",
      f.email as "acquiredByEmail",
      wi.acquired_by_follower_id as "acquiredByFollowerId",
      wi.acquired_by_profile_id as "acquiredByProfileId",
      wi.archived_at as "archivedAt"
    from wishlist_items wi
    left join followers f on f.id = wi.acquired_by_follower_id
    where wi.id = ${input.itemId}
      and wi.wishlist_id = ${follower.wishlistId}
      and wi.archived_at is null
  `;

  if (existing?.acquiredAt) {
    throw new PublicError("Este item ja foi marcado como adquirido.", 409);
  }

  throw new PublicError("Item nao encontrado para esta wishlist.", 404);
}

export async function unmarkItemAcquired(input: { itemId: string; followToken: string }) {
  const sql = getSql();
  const follower = await getFollowerByTokenOnly(sql, input.followToken);

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 401);
  }

  const [updated] = await sql<WishlistItemRow[]>`
    update wishlist_items
    set
      acquired_at = null,
      acquired_by_follower_id = null
    where id = ${input.itemId}
      and wishlist_id = ${follower.wishlistId}
      and acquired_by_follower_id = ${follower.id}
      and archived_at is null
    returning
      id,
      wishlist_id as "wishlistId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      created_at as "createdAt",
      acquired_at as "acquiredAt",
      null::text as "acquiredByEmail",
      null::uuid as "acquiredByFollowerId",
      null::uuid as "acquiredByProfileId",
      archived_at as "archivedAt"
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
      wi.image_url as "imageUrl",
      wi.price_cents as "priceCents",
      wi.currency,
      wi.category,
      wi.priority,
      wi.repurchase_state as "repurchaseState",
      wi.created_at as "createdAt",
      wi.acquired_at as "acquiredAt",
      f.email as "acquiredByEmail",
      wi.acquired_by_follower_id as "acquiredByFollowerId",
      wi.acquired_by_profile_id as "acquiredByProfileId",
      wi.archived_at as "archivedAt"
    from wishlist_items wi
    left join followers f on f.id = wi.acquired_by_follower_id
    where wi.id = ${input.itemId}
      and wi.wishlist_id = ${follower.wishlistId}
      and wi.archived_at is null
  `;

  if (!existing) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  if (!existing.acquiredAt) {
    throw new PublicError("Este item ainda nao foi marcado como adquirido.", 409);
  }

  throw new PublicError("Somente quem marcou este item pode desfazer.", 403);
}

export async function listWishlistFavoriteItemIds(input: { slug: string; followToken: string }) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, input);

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const rows = await sql<{ wishlistItemId: string }[]>`
    select wf.wishlist_item_id as "wishlistItemId"
    from wishlist_favorites wf
    join wishlist_items wi on wi.id = wf.wishlist_item_id
    where wf.follower_id = ${follower.id}
      and wf.wishlist_id = ${follower.wishlistId}
      and wi.archived_at is null
    order by wf.created_at desc
  `;

  return rows.map((row) => row.wishlistItemId);
}

export async function favoriteWishlistItem(input: {
  slug: string;
  followToken: string;
  itemId: string;
}) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, input);

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const [item] = await sql<{ id: string }[]>`
    select id
    from wishlist_items
    where id = ${input.itemId}
      and wishlist_id = ${follower.wishlistId}
      and archived_at is null
  `;

  if (!item) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  await sql`
    insert into wishlist_favorites (wishlist_id, wishlist_item_id, follower_id)
    values (${follower.wishlistId}, ${input.itemId}, ${follower.id})
    on conflict (wishlist_item_id, follower_id) do nothing
  `;

  return { ok: true };
}

export async function unfavoriteWishlistItem(input: {
  slug: string;
  followToken: string;
  itemId: string;
}) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, input);

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  await sql`
    delete from wishlist_favorites
    where follower_id = ${follower.id}
      and wishlist_id = ${follower.wishlistId}
      and wishlist_item_id = ${input.itemId}
  `;

  return { ok: true };
}

export async function listPersonalItems(input: { slug: string; followToken: string }) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, input);

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const rows = await sql<PersonalItemRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      follower_id as "followerId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      visibility,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from personal_items
    where wishlist_id = ${follower.wishlistId}
      and follower_id = ${follower.id}
    order by created_at desc
  `;

  return rows.map(toPersonalItem);
}

export async function addPersonalItem(input: {
  slug: string;
  followToken: string;
  name: string;
  purchaseUrl: string;
  imageUrl?: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
}) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, {
    slug: input.slug,
    followToken: input.followToken,
  });

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const [row] = await sql<PersonalItemRow[]>`
    insert into personal_items (
      wishlist_id,
      follower_id,
      name,
      purchase_url,
      image_url,
      price_cents,
      category,
      priority,
      repurchase_state,
      visibility
    )
    values (
      ${follower.wishlistId},
      ${follower.id},
      ${input.name.trim()},
      ${input.purchaseUrl.trim()},
      ${normalizeImageUrl(input.imageUrl)},
      ${input.priceCents},
      ${input.category.trim() || "Geral"},
      ${input.priority},
      ${input.repurchaseState},
      ${input.visibility}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      follower_id as "followerId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      visibility,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return toPersonalItem(row);
}

export async function updatePersonalItem(input: {
  slug: string;
  followToken: string;
  itemId: string;
  name: string;
  purchaseUrl: string;
  imageUrl?: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
}) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, {
    slug: input.slug,
    followToken: input.followToken,
  });

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const [row] = await sql<PersonalItemRow[]>`
    update personal_items
    set
      name = ${input.name.trim()},
      purchase_url = ${input.purchaseUrl.trim()},
      image_url = ${normalizeImageUrl(input.imageUrl)},
      price_cents = ${input.priceCents},
      category = ${input.category.trim() || "Geral"},
      priority = ${input.priority},
      repurchase_state = ${input.repurchaseState},
      visibility = ${input.visibility},
      updated_at = now()
    where id = ${input.itemId}
      and wishlist_id = ${follower.wishlistId}
      and follower_id = ${follower.id}
    returning
      id,
      wishlist_id as "wishlistId",
      follower_id as "followerId",
      name,
      purchase_url as "purchaseUrl",
      image_url as "imageUrl",
      price_cents as "priceCents",
      currency,
      category,
      priority,
      repurchase_state as "repurchaseState",
      visibility,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Item pessoal nao encontrado.", 404);
  }

  return toPersonalItem(row);
}

export async function deletePersonalItem(input: {
  slug: string;
  followToken: string;
  itemId: string;
}) {
  const sql = getSql();
  const follower = await getFollowerBySlugAndToken(sql, {
    slug: input.slug,
    followToken: input.followToken,
  });

  if (!follower) {
    throw new PublicError("Acompanhamento nao encontrado para esta wishlist.", 404);
  }

  const [row] = await sql<{ id: string }[]>`
    delete from personal_items
    where id = ${input.itemId}
      and wishlist_id = ${follower.wishlistId}
      and follower_id = ${follower.id}
    returning id
  `;

  if (!row) {
    throw new PublicError("Item pessoal nao encontrado.", 404);
  }

  return row;
}

export async function listPublicPersonalSuggestionsByAdminToken(input: { adminToken: string }) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(input.adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const rows = await sql<PersonalItemSuggestionRow[]>`
    select
      pi.id,
      pi.wishlist_id as "wishlistId",
      pi.follower_id as "followerId",
      pi.name,
      pi.purchase_url as "purchaseUrl",
      pi.image_url as "imageUrl",
      pi.price_cents as "priceCents",
      pi.currency,
      pi.category,
      pi.priority,
      pi.repurchase_state as "repurchaseState",
      pi.visibility,
      pi.created_at as "createdAt",
      pi.updated_at as "updatedAt",
      f.email as "followerEmail"
    from personal_items pi
    left join followers f on f.id = pi.follower_id
    where pi.wishlist_id = ${wishlist.id}
      and pi.visibility = 'public'
    order by pi.created_at desc
  `;

  return rows.map(toPersonalItemSuggestion);
}
