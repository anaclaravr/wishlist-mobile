import postgres from "postgres";

import {
  ACCESS_SESSION_MAX_AGE_SECONDS,
  type AccessRole,
  generateAccessKey,
  generateSessionToken,
  hashSecret,
  isAccessRole,
} from "@/lib/access";
import type {
  ItemRepurchaseState,
  PersonalItemVisibility,
  Wishlist,
  WishlistItem,
  WishlistItemPriority,
} from "@/lib/db";
import { PublicError } from "@/lib/errors";
import { getRolePermissions } from "@/lib/rbac";
import {
  DEFAULT_TASK_PAGE_SETTINGS,
  normalizeTaskPageSettings,
  type TaskPageSettings,
} from "@/lib/task-page-settings";
import {
  DEFAULT_PORTFOLIO_PAGE_SETTINGS,
  normalizePortfolioPageSettings,
  type PortfolioPageSettings,
} from "@/lib/portfolio-page-settings";

type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

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

function normalizePriority(value: string | null): WishlistItemPriority {
  return value === "baixa" || value === "alta" ? value : "media";
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

function normalizeVisibility(value: string | null): PersonalItemVisibility {
  return value === "public" ? "public" : "private";
}

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

type AccessProfileRow = {
  id: string;
  wishlistId: string;
  role: string;
  accessKey: string;
  keyHash: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastRegeneratedAt: Date | string;
  lastUsedAt: Date | string | null;
};

type AccessSessionRow = {
  id: string;
  wishlistId: string;
  profileId: string;
  role: string;
  sessionHash: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  lastSeenAt: Date | string;
  wishlistSlug: string;
  wishlistTitle: string;
  profileActive: boolean;
};

type WishlistItemRow = {
  id: string;
  wishlistId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: string | null;
  repurchaseState: string | null;
  createdAt: Date | string;
  acquiredAt: Date | string | null;
  acquiredByEmail: string | null;
  acquiredByFollowerId: string | null;
  acquiredByProfileId: string | null;
  archivedAt: Date | string | null;
};

type ProfilePersonalItemRow = {
  id: string;
  wishlistId: string;
  profileId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: string | null;
  repurchaseState: string | null;
  visibility: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ProfileSuggestionRow = ProfilePersonalItemRow & {
  profileRole: string | null;
};

type LegacySuggestionRow = {
  id: string;
  wishlistId: string;
  followerId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: string | null;
  repurchaseState: string | null;
  visibility: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  followerEmail: string | null;
};

type AdminTaskStatus = "pending" | "in_progress" | "done";
type AdminTaskPriority = "low" | "medium" | "high" | null;
type AdminTaskCategory = string;

type AdminTaskRow = {
  id: string;
  title: string;
  notes: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  tags: string[] | null;
  dueAt: Date | string | null;
  createdByProfileId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
};

type PageSettingsRow = {
  id: string;
  wishlistId: string;
  pageKey: string;
  config: unknown;
  updatedByProfileId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AccessProfile = {
  id: string;
  wishlistId: string;
  role: AccessRole;
  accessKey: string;
  keyHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastRegeneratedAt: string;
  lastUsedAt: string | null;
};

export type AccessSessionContext = {
  sessionId: string;
  wishlistId: string;
  wishlistSlug: string;
  wishlistTitle: string;
  profileId: string;
  role: AccessRole;
  expiresAt: string;
  permissions: string[];
};

export type ProfilePersonalItem = {
  id: string;
  wishlistId: string;
  profileId: string;
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

export type ProfileSuggestion = ProfilePersonalItem & {
  profileRole: AccessRole | null;
};

export type LegacySuggestion = {
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
  followerEmail: string | null;
};

export type AdminTask = {
  id: string;
  title: string;
  notes: string | null;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: AdminTaskCategory;
  tags: string[];
  dueAt: string | null;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type PageSettings = {
  id: string;
  wishlistId: string;
  pageKey: string;
  config: unknown;
  updatedByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

function toWishlist(row: WishlistRow): Wishlist {
  return {
    id: row.id,
    title: row.title,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    ownerAvatarUrl: row.ownerAvatarUrl,
    slug: row.slug,
    adminToken: row.adminToken,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toAccessProfile(row: AccessProfileRow): AccessProfile {
  if (!isAccessRole(row.role)) {
    throw new PublicError("Perfil de acesso invalido.", 500);
  }

  return {
    id: row.id,
    wishlistId: row.wishlistId,
    role: row.role,
    accessKey: row.accessKey,
    keyHash: row.keyHash,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    lastRegeneratedAt: toIso(row.lastRegeneratedAt) ?? new Date().toISOString(),
    lastUsedAt: toIso(row.lastUsedAt),
  };
}

function toWishlistItem(row: WishlistItemRow): WishlistItem {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    name: row.name,
    purchaseUrl: row.purchaseUrl,
    imageUrl: row.imageUrl,
    priceCents: row.priceCents,
    currency: row.currency,
    category: row.category,
    priority: normalizePriority(row.priority),
    repurchaseState: normalizeRepurchaseState(row.repurchaseState),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    acquiredAt: toIso(row.acquiredAt),
    acquiredByEmail: row.acquiredByEmail,
    acquiredByFollowerId: row.acquiredByFollowerId,
    acquiredByProfileId: row.acquiredByProfileId,
    archivedAt: toIso(row.archivedAt),
  };
}

function toProfilePersonalItem(row: ProfilePersonalItemRow): ProfilePersonalItem {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    profileId: row.profileId,
    name: row.name,
    purchaseUrl: row.purchaseUrl,
    imageUrl: row.imageUrl,
    priceCents: row.priceCents,
    currency: row.currency,
    category: row.category,
    priority: normalizePriority(row.priority),
    repurchaseState: normalizeRepurchaseState(row.repurchaseState),
    visibility: normalizeVisibility(row.visibility),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toProfileSuggestion(row: ProfileSuggestionRow): ProfileSuggestion {
  return {
    ...toProfilePersonalItem(row),
    profileRole: row.profileRole && isAccessRole(row.profileRole) ? row.profileRole : null,
  };
}

function toLegacySuggestion(row: LegacySuggestionRow): LegacySuggestion {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    followerId: row.followerId,
    name: row.name,
    purchaseUrl: row.purchaseUrl,
    imageUrl: row.imageUrl,
    priceCents: row.priceCents,
    currency: row.currency,
    category: row.category,
    priority: normalizePriority(row.priority),
    repurchaseState: normalizeRepurchaseState(row.repurchaseState),
    visibility: normalizeVisibility(row.visibility),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    followerEmail: row.followerEmail,
  };
}

function normalizeAdminTaskStatus(value: string | null): AdminTaskStatus {
  if (value === "done" || value === "in_progress") {
    return value;
  }
  return "pending";
}

function normalizeAdminTaskPriority(value: string | null): AdminTaskPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return null;
}

function normalizeAdminTaskCategory(value: string | null): AdminTaskCategory {
  return value?.trim() || "pessoal";
}

function toAdminTask(row: AdminTaskRow): AdminTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: normalizeAdminTaskStatus(row.status),
    priority: normalizeAdminTaskPriority(row.priority),
    category: normalizeAdminTaskCategory(row.category),
    tags: (row.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    dueAt: toIso(row.dueAt),
    createdByProfileId: row.createdByProfileId,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    completedAt: toIso(row.completedAt),
  };
}

function toPageSettings(row: PageSettingsRow): PageSettings {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    pageKey: row.pageKey,
    config: row.config,
    updatedByProfileId: row.updatedByProfileId,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeTaskTags(tags: string[] | null | undefined) {
  if (!tags?.length) return [];

  const unique = new Set<string>();
  for (const rawTag of tags) {
    const normalized = rawTag.trim();
    if (normalized) {
      unique.add(normalized.slice(0, 32));
    }
    if (unique.size >= 8) break;
  }

  return Array.from(unique);
}

async function getWishlistById(sql: Sql, wishlistId: string) {
  const [row] = await sql<WishlistRow[]>`
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
    where id = ${wishlistId}
    limit 1
  `;

  return row ? toWishlist(row) : null;
}

async function getWishlistBySlug(sql: Sql, slug: string) {
  const [row] = await sql<WishlistRow[]>`
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
    limit 1
  `;

  return row ? toWishlist(row) : null;
}

async function getWishlistByAdminToken(sql: Sql, adminToken: string) {
  const [row] = await sql<WishlistRow[]>`
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
    limit 1
  `;

  return row ? toWishlist(row) : null;
}

export async function ensureAccessProfilesForWishlistId(wishlistId: string) {
  const sql = getSql();

  for (const role of ["admin", "editor", "viewer"] as const) {
    const key = generateAccessKey(role);
    const keyHash = hashSecret(key);

    await sql`
      insert into access_profiles (
        wishlist_id,
        role,
        access_key,
        key_hash,
        is_active
      )
      values (
        ${wishlistId},
        ${role},
        ${key},
        ${keyHash},
        true
      )
      on conflict (wishlist_id, role) do nothing
    `;
  }

  const rows = await sql<AccessProfileRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      role,
      access_key as "accessKey",
      key_hash as "keyHash",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_regenerated_at as "lastRegeneratedAt",
      last_used_at as "lastUsedAt"
    from access_profiles
    where wishlist_id = ${wishlistId}
    order by case role when 'admin' then 1 when 'editor' then 2 else 3 end
  `;

  return rows.map(toAccessProfile);
}

export async function bootstrapAdminProfileByToken(adminToken: string) {
  const sql = getSql();
  const wishlist = await getWishlistByAdminToken(sql, adminToken);

  if (!wishlist) {
    throw new PublicError("Link admin invalido.", 404);
  }

  const profiles = await ensureAccessProfilesForWishlistId(wishlist.id);
  const adminProfile = profiles.find((profile) => profile.role === "admin");

  if (!adminProfile) {
    throw new PublicError("Nao foi possivel preparar o perfil admin.", 500);
  }

  return {
    wishlist,
    profile: adminProfile,
  };
}

export async function findAccessProfileByKey(input: { key: string; slug?: string }) {
  const sql = getSql();
  const keyHash = hashSecret(input.key.trim());
  const rows = await sql<(AccessProfileRow & { wishlistSlug: string; wishlistTitle: string })[]>`
    select
      ap.id,
      ap.wishlist_id as "wishlistId",
      ap.role,
      ap.access_key as "accessKey",
      ap.key_hash as "keyHash",
      ap.is_active as "isActive",
      ap.created_at as "createdAt",
      ap.updated_at as "updatedAt",
      ap.last_regenerated_at as "lastRegeneratedAt",
      ap.last_used_at as "lastUsedAt",
      w.slug as "wishlistSlug",
      w.title as "wishlistTitle"
    from access_profiles ap
    join wishlists w on w.id = ap.wishlist_id
    where ap.key_hash = ${keyHash}
      and ap.is_active = true
      ${input.slug ? sql`and w.slug = ${input.slug}` : sql``}
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  const profile = toAccessProfile(row);

  return {
    profile,
    wishlistSlug: row.wishlistSlug,
    wishlistTitle: row.wishlistTitle,
  };
}

export async function createSessionForProfile(profile: AccessProfile) {
  const sql = getSql();
  const sessionToken = generateSessionToken();
  const sessionHash = hashSecret(sessionToken);

  await sql`
    insert into access_sessions (
      wishlist_id,
      profile_id,
      session_hash,
      expires_at
    )
    values (
      ${profile.wishlistId},
      ${profile.id},
      ${sessionHash},
      now() + interval '7 days'
    )
  `;

  await sql`
    update access_profiles
    set last_used_at = now()
    where id = ${profile.id}
  `;

  return {
    sessionToken,
    expiresAt: new Date(Date.now() + ACCESS_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  };
}

export async function getAccessSessionFromToken(sessionToken: string) {
  const sql = getSql();
  const sessionHash = hashSecret(sessionToken);

  const [row] = await sql<AccessSessionRow[]>`
    select
      s.id,
      s.wishlist_id as "wishlistId",
      s.profile_id as "profileId",
      ap.role,
      s.session_hash as "sessionHash",
      s.expires_at as "expiresAt",
      s.created_at as "createdAt",
      s.last_seen_at as "lastSeenAt",
      w.slug as "wishlistSlug",
      w.title as "wishlistTitle",
      ap.is_active as "profileActive"
    from access_sessions s
    join access_profiles ap on ap.id = s.profile_id
    join wishlists w on w.id = s.wishlist_id
    where s.session_hash = ${sessionHash}
      and s.expires_at > now()
    limit 1
  `;

  if (!row) {
    return null;
  }

  if (!isAccessRole(row.role)) {
    return null;
  }

  if (!row.profileActive) {
    return null;
  }

  await sql`
    update access_sessions
    set last_seen_at = now()
    where id = ${row.id}
  `;

  return {
    sessionId: row.id,
    wishlistId: row.wishlistId,
    wishlistSlug: row.wishlistSlug,
    wishlistTitle: row.wishlistTitle,
    profileId: row.profileId,
    role: row.role,
    expiresAt: toIso(row.expiresAt) ?? new Date().toISOString(),
    permissions: getRolePermissions(row.role),
  } satisfies AccessSessionContext;
}

export async function deleteAccessSession(sessionToken: string) {
  const sql = getSql();
  const sessionHash = hashSecret(sessionToken);

  await sql`
    delete from access_sessions
    where session_hash = ${sessionHash}
  `;
}

export async function listAccessProfilesByWishlistId(wishlistId: string) {
  const sql = getSql();
  const rows = await sql<AccessProfileRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      role,
      access_key as "accessKey",
      key_hash as "keyHash",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_regenerated_at as "lastRegeneratedAt",
      last_used_at as "lastUsedAt"
    from access_profiles
    where wishlist_id = ${wishlistId}
    order by case role when 'admin' then 1 when 'editor' then 2 else 3 end
  `;

  return rows.map(toAccessProfile);
}

export async function regenerateAccessProfileKey(input: {
  wishlistId: string;
  role: AccessRole;
}) {
  const sql = getSql();
  const nextKey = generateAccessKey(input.role);
  const nextKeyHash = hashSecret(nextKey);

  const [row] = await sql<AccessProfileRow[]>`
    update access_profiles
    set
      access_key = ${nextKey},
      key_hash = ${nextKeyHash},
      last_regenerated_at = now(),
      updated_at = now()
    where wishlist_id = ${input.wishlistId}
      and role = ${input.role}
    returning
      id,
      wishlist_id as "wishlistId",
      role,
      access_key as "accessKey",
      key_hash as "keyHash",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_regenerated_at as "lastRegeneratedAt",
      last_used_at as "lastUsedAt"
  `;

  if (!row) {
    throw new PublicError("Perfil nao encontrado para regenerar a chave.", 404);
  }

  return toAccessProfile(row);
}

export async function setAccessProfileActiveState(input: {
  wishlistId: string;
  role: AccessRole;
  isActive: boolean;
}) {
  if (input.role === "admin" && !input.isActive) {
    throw new PublicError("Nao e permitido desativar a chave admin.", 400);
  }

  const sql = getSql();
  const [row] = await sql<AccessProfileRow[]>`
    update access_profiles
    set
      is_active = ${input.isActive},
      updated_at = now()
    where wishlist_id = ${input.wishlistId}
      and role = ${input.role}
    returning
      id,
      wishlist_id as "wishlistId",
      role,
      access_key as "accessKey",
      key_hash as "keyHash",
      is_active as "isActive",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_regenerated_at as "lastRegeneratedAt",
      last_used_at as "lastUsedAt"
  `;

  if (!row) {
    throw new PublicError("Perfil nao encontrado para atualizacao.", 404);
  }

  return toAccessProfile(row);
}

export async function updateWishlistSettingsById(input: {
  wishlistId: string;
  title: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatarUrl: string | null;
  slug: string;
}) {
  const sql = getSql();

  try {
    const [row] = await sql<WishlistRow[]>`
      update wishlists
      set
        title = ${input.title.trim()},
        owner_name = ${input.ownerName?.trim() || null},
        owner_email = ${input.ownerEmail?.trim() || null},
        owner_avatar_url = ${input.ownerAvatarUrl?.trim() || null},
        slug = ${input.slug.trim()}
      where id = ${input.wishlistId}
      returning
        id,
        title,
        owner_name as "ownerName",
        owner_email as "ownerEmail",
        owner_avatar_url as "ownerAvatarUrl",
        slug,
        admin_token as "adminToken",
        created_at as "createdAt"
    `;

    if (!row) {
      throw new PublicError("Wishlist nao encontrada.", 404);
    }

    return toWishlist(row);
  } catch (error) {
    if (error instanceof PublicError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new PublicError("Este slug ja esta em uso.", 409);
    }

    throw error;
  }
}

export async function getWishlistAdminTokenById(wishlistId: string) {
  const sql = getSql();
  const wishlist = await getWishlistById(sql, wishlistId);

  if (!wishlist) {
    throw new PublicError("Wishlist nao encontrada.", 404);
  }

  return wishlist.adminToken;
}

export async function getWishlistBySlugForAccess(slug: string) {
  const sql = getSql();
  return getWishlistBySlug(sql, slug);
}

async function getItemById(wishlistId: string, itemId: string) {
  const sql = getSql();
  const [row] = await sql<WishlistItemRow[]>`
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
      coalesce(
        f.email,
        case when ap.role is null then null else 'Perfil ' || ap.role end
      ) as "acquiredByEmail",
      wi.acquired_by_follower_id as "acquiredByFollowerId",
      wi.acquired_by_profile_id as "acquiredByProfileId",
      wi.archived_at as "archivedAt"
    from wishlist_items wi
    left join followers f on f.id = wi.acquired_by_follower_id
    left join access_profiles ap on ap.id = wi.acquired_by_profile_id
    where wi.wishlist_id = ${wishlistId}
      and wi.id = ${itemId}
    limit 1
  `;

  return row ? toWishlistItem(row) : null;
}

export async function markItemAcquiredByProfile(input: {
  wishlistId: string;
  profileId: string;
  itemId: string;
}) {
  const sql = getSql();

  const [updated] = await sql<{ id: string }[]>`
    update wishlist_items
    set
      acquired_at = now(),
      acquired_by_follower_id = null,
      acquired_by_profile_id = ${input.profileId}
    where id = ${input.itemId}
      and wishlist_id = ${input.wishlistId}
      and archived_at is null
      and acquired_at is null
    returning id
  `;

  if (updated) {
    const item = await getItemById(input.wishlistId, input.itemId);

    if (!item) {
      throw new PublicError("Item nao encontrado para esta wishlist.", 404);
    }

    return item;
  }

  const existingItem = await getItemById(input.wishlistId, input.itemId);

  if (!existingItem || existingItem.archivedAt) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  if (existingItem.acquiredAt) {
    throw new PublicError("Este item ja foi marcado como adquirido.", 409);
  }

  throw new PublicError("Nao foi possivel marcar este item agora.", 409);
}

export async function unmarkItemAcquiredByProfile(input: {
  wishlistId: string;
  profileId: string;
  role: AccessRole;
  itemId: string;
}) {
  const sql = getSql();

  const [updated] =
    input.role === "admin"
      ? await sql<{ id: string }[]>`
          update wishlist_items
          set
            acquired_at = null,
            acquired_by_follower_id = null,
            acquired_by_profile_id = null
          where id = ${input.itemId}
            and wishlist_id = ${input.wishlistId}
            and archived_at is null
            and acquired_at is not null
          returning id
        `
      : await sql<{ id: string }[]>`
          update wishlist_items
          set
            acquired_at = null,
            acquired_by_follower_id = null,
            acquired_by_profile_id = null
          where id = ${input.itemId}
            and wishlist_id = ${input.wishlistId}
            and archived_at is null
            and acquired_by_profile_id = ${input.profileId}
          returning id
        `;

  if (updated) {
    const item = await getItemById(input.wishlistId, input.itemId);

    if (!item) {
      throw new PublicError("Item nao encontrado para esta wishlist.", 404);
    }

    return item;
  }

  const existingItem = await getItemById(input.wishlistId, input.itemId);

  if (!existingItem || existingItem.archivedAt) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  if (!existingItem.acquiredAt) {
    throw new PublicError("Este item ainda nao foi marcado como adquirido.", 409);
  }

  if (input.role !== "admin" && existingItem.acquiredByProfileId !== input.profileId) {
    throw new PublicError("Somente quem marcou este item pode desfazer.", 403);
  }

  throw new PublicError("Nao foi possivel desfazer a marcacao agora.", 409);
}

export async function listProfileFavoriteItemIds(input: {
  wishlistId: string;
  profileId: string;
}) {
  const sql = getSql();
  const rows = await sql<{ wishlistItemId: string }[]>`
    select pf.wishlist_item_id as "wishlistItemId"
    from profile_favorites pf
    join wishlist_items wi on wi.id = pf.wishlist_item_id
    where pf.wishlist_id = ${input.wishlistId}
      and pf.profile_id = ${input.profileId}
      and wi.archived_at is null
    order by pf.created_at desc
  `;

  return rows.map((row) => row.wishlistItemId);
}

export async function favoriteWishlistItemByProfile(input: {
  wishlistId: string;
  profileId: string;
  itemId: string;
}) {
  const sql = getSql();
  const [item] = await sql<{ id: string }[]>`
    select id
    from wishlist_items
    where id = ${input.itemId}
      and wishlist_id = ${input.wishlistId}
      and archived_at is null
  `;

  if (!item) {
    throw new PublicError("Item nao encontrado para esta wishlist.", 404);
  }

  await sql`
    insert into profile_favorites (wishlist_id, wishlist_item_id, profile_id)
    values (${input.wishlistId}, ${input.itemId}, ${input.profileId})
    on conflict (wishlist_item_id, profile_id) do nothing
  `;

  return { ok: true };
}

export async function unfavoriteWishlistItemByProfile(input: {
  wishlistId: string;
  profileId: string;
  itemId: string;
}) {
  const sql = getSql();

  await sql`
    delete from profile_favorites
    where wishlist_id = ${input.wishlistId}
      and profile_id = ${input.profileId}
      and wishlist_item_id = ${input.itemId}
  `;

  return { ok: true };
}

export async function listProfilePersonalItems(input: { wishlistId: string; profileId: string }) {
  const sql = getSql();
  const rows = await sql<ProfilePersonalItemRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      profile_id as "profileId",
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
    from profile_personal_items
    where wishlist_id = ${input.wishlistId}
      and profile_id = ${input.profileId}
    order by created_at desc
  `;

  return rows.map(toProfilePersonalItem);
}

export async function addProfilePersonalItem(input: {
  wishlistId: string;
  profileId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
}) {
  const sql = getSql();

  const [row] = await sql<ProfilePersonalItemRow[]>`
    insert into profile_personal_items (
      wishlist_id,
      profile_id,
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
      ${input.wishlistId},
      ${input.profileId},
      ${input.name.trim()},
      ${input.purchaseUrl.trim()},
      ${input.imageUrl},
      ${input.priceCents},
      ${input.category.trim() || "Geral"},
      ${input.priority},
      ${input.repurchaseState},
      ${input.visibility}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      profile_id as "profileId",
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

  return toProfilePersonalItem(row);
}

export async function updateProfilePersonalItem(input: {
  wishlistId: string;
  profileId: string;
  itemId: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  category: string;
  priority: WishlistItemPriority;
  repurchaseState: ItemRepurchaseState;
  visibility: PersonalItemVisibility;
}) {
  const sql = getSql();

  const [row] = await sql<ProfilePersonalItemRow[]>`
    update profile_personal_items
    set
      name = ${input.name.trim()},
      purchase_url = ${input.purchaseUrl.trim()},
      image_url = ${input.imageUrl},
      price_cents = ${input.priceCents},
      category = ${input.category.trim() || "Geral"},
      priority = ${input.priority},
      repurchase_state = ${input.repurchaseState},
      visibility = ${input.visibility},
      updated_at = now()
    where id = ${input.itemId}
      and wishlist_id = ${input.wishlistId}
      and profile_id = ${input.profileId}
    returning
      id,
      wishlist_id as "wishlistId",
      profile_id as "profileId",
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

  return toProfilePersonalItem(row);
}

export async function deleteProfilePersonalItem(input: {
  wishlistId: string;
  profileId: string;
  itemId: string;
}) {
  const sql = getSql();

  const [row] = await sql<{ id: string }[]>`
    delete from profile_personal_items
    where id = ${input.itemId}
      and wishlist_id = ${input.wishlistId}
      and profile_id = ${input.profileId}
    returning id
  `;

  if (!row) {
    throw new PublicError("Item pessoal nao encontrado.", 404);
  }

  return { ok: true };
}

export async function listPublicProfileSuggestionsByWishlistId(wishlistId: string) {
  const sql = getSql();
  const rows = await sql<ProfileSuggestionRow[]>`
    select
      ppi.id,
      ppi.wishlist_id as "wishlistId",
      ppi.profile_id as "profileId",
      ppi.name,
      ppi.purchase_url as "purchaseUrl",
      ppi.image_url as "imageUrl",
      ppi.price_cents as "priceCents",
      ppi.currency,
      ppi.category,
      ppi.priority,
      ppi.repurchase_state as "repurchaseState",
      ppi.visibility,
      ppi.created_at as "createdAt",
      ppi.updated_at as "updatedAt",
      ap.role as "profileRole"
    from profile_personal_items ppi
    left join access_profiles ap on ap.id = ppi.profile_id
    where ppi.wishlist_id = ${wishlistId}
      and ppi.visibility = 'public'
    order by ppi.created_at desc
  `;

  return rows.map(toProfileSuggestion);
}

export async function listLegacyPublicSuggestionsByWishlistId(wishlistId: string) {
  const sql = getSql();
  const rows = await sql<LegacySuggestionRow[]>`
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
    where pi.wishlist_id = ${wishlistId}
      and pi.visibility = 'public'
    order by pi.created_at desc
  `;

  return rows.map(toLegacySuggestion);
}

export async function getAdminHubDataByWishlistId(wishlistId: string) {
  const sql = getSql();
  const wishlist = await getWishlistById(sql, wishlistId);

  if (!wishlist) {
    throw new PublicError("Wishlist nao encontrada.", 404);
  }

  const [{ followersCount }] = await sql<{ followersCount: number }[]>`
    select count(*)::int as "followersCount"
    from followers
    where wishlist_id = ${wishlistId}
  `;
  const [{ officialItemsCount }] = await sql<{ officialItemsCount: number }[]>`
    select count(*)::int as "officialItemsCount"
    from wishlist_items
    where wishlist_id = ${wishlistId}
      and archived_at is null
  `;

  return {
    wishlist,
    followersCount,
    officialItemsCount,
  };
}

export async function listAdminTasks(input?: {
  page?: number;
  pageSize?: number;
  filter?: "all" | "pending" | "in_progress" | "done";
  query?: string;
}) {
  const sql = getSql();
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const filter = input?.filter ?? "all";
  const query = input?.query?.trim() ?? "";

  const whereFilter =
    filter === "all"
      ? sql`true`
      : filter === "in_progress"
        ? sql`status = 'in_progress'`
        : sql`status = ${filter}`;
  const whereQuery = query
    ? sql`and (
        title ilike ${`%${query}%`}
        or coalesce(notes, '') ilike ${`%${query}%`}
        or coalesce(category, '') ilike ${`%${query}%`}
      )`
    : sql``;

  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from admin_tasks
    where ${whereFilter}
    ${whereQuery}
  `;

  const rows = await sql<AdminTaskRow[]>`
    select
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
    from admin_tasks
    where ${whereFilter}
    ${whereQuery}
    order by
      case
        when status = 'pending' then 0
        when status = 'in_progress' then 1
        else 2
      end asc,
      case
        when status in ('pending', 'in_progress') and due_at is not null and due_at < now() then 0
        when status in ('pending', 'in_progress') and due_at is not null and due_at::date = now()::date then 1
        when status in ('pending', 'in_progress') and due_at is not null then 2
        else 3
      end asc,
      created_at desc
    limit ${pageSize}
    offset ${offset}
  `;

  return {
    tasks: rows.map(toAdminTask),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function createAdminTask(input: {
  title: string;
  notes?: string | null;
  status?: AdminTaskStatus;
  priority?: AdminTaskPriority;
  category?: AdminTaskCategory;
  tags?: string[];
  dueAt?: string | null;
  createdByProfileId: string;
}) {
  const sql = getSql();
  const normalizedTags = normalizeTaskTags(input.tags);

  const [row] = await sql<AdminTaskRow[]>`
    insert into admin_tasks (
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at,
      created_by_profile_id
    )
    values (
      ${input.title.trim()},
      ${input.notes?.trim() || null},
      ${input.status ?? "pending"},
      ${input.priority ?? null},
      ${input.category?.trim() || "pessoal"},
      ${normalizedTags},
      ${input.dueAt ? new Date(input.dueAt) : null},
      ${input.createdByProfileId}
    )
    returning
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
  `;

  return toAdminTask(row);
}

export async function updateAdminTask(input: {
  id: string;
  title: string;
  notes?: string | null;
  status?: AdminTaskStatus;
  priority?: AdminTaskPriority;
  category?: AdminTaskCategory;
  tags?: string[];
  dueAt?: string | null;
}) {
  const sql = getSql();
  const normalizedTags = normalizeTaskTags(input.tags);
  const [row] = await sql<AdminTaskRow[]>`
    update admin_tasks
    set
      title = ${input.title.trim()},
      notes = ${input.notes?.trim() || null},
      status = ${input.status ?? "pending"},
      priority = ${input.priority ?? null},
      category = ${input.category?.trim() || "pessoal"},
      tags = ${normalizedTags},
      due_at = ${input.dueAt ? new Date(input.dueAt) : null},
      completed_at = case when ${input.status ?? "pending"} = 'done' then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where id = ${input.id}
    returning
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
  `;

  if (!row) {
    throw new PublicError("Tarefa nao encontrada.", 404);
  }

  return toAdminTask(row);
}

export async function toggleAdminTaskStatus(id: string, nextStatus?: AdminTaskStatus) {
  const sql = getSql();
  if (nextStatus) {
    const [row] = await sql<AdminTaskRow[]>`
      update admin_tasks
      set
        status = ${nextStatus},
        completed_at = case when ${nextStatus} = 'done' then now() else null end,
        updated_at = now()
      where id = ${id}
      returning
        id,
        title,
        notes,
        status,
        priority,
        category,
        tags,
        due_at as "dueAt",
        created_by_profile_id as "createdByProfileId",
        created_at as "createdAt",
        updated_at as "updatedAt",
        completed_at as "completedAt"
    `;

    if (!row) {
      throw new PublicError("Tarefa nao encontrada.", 404);
    }

    return toAdminTask(row);
  }

  const [fallback] = await sql<AdminTaskRow[]>`
    update admin_tasks
    set
      status = case when status = 'done' then 'pending' else 'done' end,
      completed_at = case when status = 'done' then null else now() end,
      updated_at = now()
    where id = ${id}
    returning
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
  `;

  if (!fallback) {
    throw new PublicError("Tarefa nao encontrada.", 404);
  }

  return toAdminTask(fallback);
}

export async function deleteAdminTask(id: string) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from admin_tasks
    where id = ${id}
    returning id
  `;

  if (!row) {
    throw new PublicError("Tarefa nao encontrada.", 404);
  }

  return { ok: true };
}

export async function getTaskPageSettingsByWishlistId(wishlistId: string) {
  const sql = getSql();
  const [row] = await sql<PageSettingsRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      page_key as "pageKey",
      config,
      updated_by_profile_id as "updatedByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from page_settings
    where wishlist_id = ${wishlistId}
      and page_key = 'tasks'
    limit 1
  `;

  if (!row) {
    return DEFAULT_TASK_PAGE_SETTINGS;
  }

  return normalizeTaskPageSettings(row.config);
}

export async function upsertTaskPageSettingsByWishlistId(input: {
  wishlistId: string;
  profileId: string;
  settings: TaskPageSettings;
}) {
  const sql = getSql();
  const [row] = await sql<PageSettingsRow[]>`
    insert into page_settings (
      wishlist_id,
      page_key,
      config,
      updated_by_profile_id
    )
    values (
      ${input.wishlistId},
      'tasks',
      ${JSON.stringify(input.settings)}::jsonb,
      ${input.profileId}
    )
    on conflict (wishlist_id, page_key)
    do update set
      config = excluded.config,
      updated_by_profile_id = excluded.updated_by_profile_id,
      updated_at = now()
    returning
      id,
      wishlist_id as "wishlistId",
      page_key as "pageKey",
      config,
      updated_by_profile_id as "updatedByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Nao foi possivel salvar configuracoes de Tasks.", 500);
  }

  const normalized = normalizeTaskPageSettings(toPageSettings(row).config);
  return normalized;
}

export async function getPortfolioPageSettingsByWishlistId(wishlistId: string) {
  const sql = getSql();
  const [row] = await sql<PageSettingsRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      page_key as "pageKey",
      config,
      updated_by_profile_id as "updatedByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from page_settings
    where wishlist_id = ${wishlistId}
      and page_key = 'portfolio'
    limit 1
  `;

  if (!row) {
    return DEFAULT_PORTFOLIO_PAGE_SETTINGS;
  }

  return normalizePortfolioPageSettings(row.config);
}

export async function upsertPortfolioPageSettingsByWishlistId(input: {
  wishlistId: string;
  profileId: string;
  settings: PortfolioPageSettings;
}) {
  const sql = getSql();
  const [row] = await sql<PageSettingsRow[]>`
    insert into page_settings (
      wishlist_id,
      page_key,
      config,
      updated_by_profile_id
    )
    values (
      ${input.wishlistId},
      'portfolio',
      ${JSON.stringify(input.settings)}::jsonb,
      ${input.profileId}
    )
    on conflict (wishlist_id, page_key)
    do update set
      config = excluded.config,
      updated_by_profile_id = excluded.updated_by_profile_id,
      updated_at = now()
    returning
      id,
      wishlist_id as "wishlistId",
      page_key as "pageKey",
      config,
      updated_by_profile_id as "updatedByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Nao foi possivel salvar configuracoes de Portfolio.", 500);
  }

  return normalizePortfolioPageSettings(toPageSettings(row).config);
}
