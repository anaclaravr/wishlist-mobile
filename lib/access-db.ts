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

const globalForSql = globalThis as typeof globalThis & {
  __wishlistAccessSqlClient?: Sql;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new PublicError("Configure DATABASE_URL para acessar o banco de dados.", 500);
  }

  if (!globalForSql.__wishlistAccessSqlClient) {
    const isLocal =
      databaseUrl.includes("localhost") ||
      databaseUrl.includes("127.0.0.1") ||
      databaseUrl.includes("sslmode=disable");

    globalForSql.__wishlistAccessSqlClient = postgres(databaseUrl, {
      max: process.env.NODE_ENV === "production" ? 5 : 1,
      ssl: isLocal ? undefined : "require",
      prepare: false,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
    });
  }

  return globalForSql.__wishlistAccessSqlClient;
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
export type StudyPriority = "low" | "medium" | "high" | null;
export type StudyTopicStatus = "not_started" | "in_progress" | "done";
export type StudyPendingStatus = "pending" | "in_progress" | "done";
export type StudyMaterialType = "link" | "image" | "file_reference" | "reference";

export type StudyNoteBlock = {
  id?: string;
  type?: string;
  text?: string;
  checked?: boolean;
  url?: string;
  [key: string]: unknown;
};

type AdminTaskRow = {
  id: string;
  title: string;
  notes: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  tags: string[] | null;
  dueAt: Date | string | null;
  sortOrder: number | null;
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

type StudyCourseRow = {
  id: string;
  wishlistId: string;
  title: string;
  description: string;
  category: string | null;
  coverImageUrl: string | null;
  priority: string | null;
  sortOrder: number | null;
  createdByProfileId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StudyModuleRow = {
  id: string;
  wishlistId: string;
  courseId: string | null;
  title: string;
  description: string;
  priority: string | null;
  sortOrder: number | null;
  createdByProfileId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StudyTopicRow = {
  id: string;
  wishlistId: string;
  moduleId: string;
  title: string;
  notes: unknown;
  status: string | null;
  priority: string | null;
  dueAt: Date | string | null;
  sortOrder: number | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StudyMaterialRow = {
  id: string;
  wishlistId: string;
  moduleId: string | null;
  topicId: string | null;
  type: string | null;
  title: string;
  url: string | null;
  description: string;
  metadata: string;
  sortOrder: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type StudyPendingItemRow = {
  id: string;
  wishlistId: string;
  moduleId: string | null;
  topicId: string | null;
  adminTaskId: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  dueAt: Date | string | null;
  syncToTasks: boolean;
  completedAt: Date | string | null;
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
  sortOrder: number;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type StudyMaterial = {
  id: string;
  wishlistId: string;
  moduleId: string | null;
  topicId: string | null;
  type: StudyMaterialType;
  title: string;
  url: string | null;
  description: string;
  metadata: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type StudyTopic = {
  id: string;
  wishlistId: string;
  moduleId: string;
  title: string;
  notes: StudyNoteBlock[];
  status: StudyTopicStatus;
  priority: StudyPriority;
  dueAt: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  materials: StudyMaterial[];
};

export type StudyModule = {
  id: string;
  wishlistId: string;
  courseId: string | null;
  title: string;
  description: string;
  priority: StudyPriority;
  sortOrder: number;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  topics: StudyTopic[];
  materials: StudyMaterial[];
  progress: number;
};

export type StudyCourse = {
  id: string;
  wishlistId: string;
  title: string;
  description: string;
  category: string;
  coverImageUrl: string;
  priority: StudyPriority;
  sortOrder: number;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  modules: StudyModule[];
  progress: number;
};

export type StudyPendingItem = {
  id: string;
  wishlistId: string;
  moduleId: string | null;
  topicId: string | null;
  adminTaskId: string | null;
  title: string;
  status: StudyPendingStatus;
  priority: StudyPriority;
  dueAt: string | null;
  syncToTasks: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudyDashboardData = {
  courses: StudyCourse[];
  modules: StudyModule[];
  pendingItems: StudyPendingItem[];
  stats: {
    modulesCount: number;
    topicsCount: number;
    completedTopicsCount: number;
    overallProgress: number;
    openPendingCount: number;
    dueSoonCount: number;
  };
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
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdByProfileId: row.createdByProfileId,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    completedAt: toIso(row.completedAt),
  };
}

function normalizeStudyPriority(value: string | null): StudyPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return null;
}

function normalizeStudyTopicStatus(value: string | null): StudyTopicStatus {
  if (value === "in_progress" || value === "done") {
    return value;
  }
  return "not_started";
}

function normalizeStudyPendingStatus(value: string | null): StudyPendingStatus {
  if (value === "in_progress" || value === "done") {
    return value;
  }
  return "pending";
}

function normalizeStudyMaterialType(value: string | null): StudyMaterialType {
  if (value === "image" || value === "file_reference" || value === "reference") {
    return value;
  }
  return "link";
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeStudyNotes(value: unknown): StudyNoteBlock[] {
  const parsedValue = typeof value === "string" ? safeJsonParse(value) : value;
  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue
    .map((block): StudyNoteBlock | null => {
      if (!block || typeof block !== "object") {
        return null;
      }

      const record = block as Record<string, unknown>;
      return {
        ...record,
        id: typeof record.id === "string" ? record.id : undefined,
        type: typeof record.type === "string" ? record.type : "paragraph",
        text: typeof record.text === "string" ? record.text : "",
        checked: typeof record.checked === "boolean" ? record.checked : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
      };
    })
    .filter((block): block is StudyNoteBlock => Boolean(block));
}

function toStudyMaterial(row: StudyMaterialRow): StudyMaterial {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    moduleId: row.moduleId,
    topicId: row.topicId,
    type: normalizeStudyMaterialType(row.type),
    title: row.title,
    url: row.url,
    description: row.description,
    metadata: row.metadata,
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toStudyTopic(row: StudyTopicRow, materials: StudyMaterial[] = []): StudyTopic {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    moduleId: row.moduleId,
    title: row.title,
    notes: normalizeStudyNotes(row.notes),
    status: normalizeStudyTopicStatus(row.status),
    priority: normalizeStudyPriority(row.priority),
    dueAt: toIso(row.dueAt),
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    completedAt: toIso(row.completedAt),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    materials,
  };
}

function toStudyModule(row: StudyModuleRow, topics: StudyTopic[] = [], materials: StudyMaterial[] = []): StudyModule {
  const completedTopics = topics.filter((topic) => topic.status === "done").length;
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    courseId: row.courseId,
    title: row.title,
    description: row.description,
    priority: normalizeStudyPriority(row.priority),
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdByProfileId: row.createdByProfileId,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    topics,
    materials,
    progress: topics.length ? Math.round((completedTopics / topics.length) * 100) : 0,
  };
}

function toStudyCourse(row: StudyCourseRow, modules: StudyModule[] = []): StudyCourse {
  const topics = modules.flatMap((module) => module.topics);
  const completedTopics = topics.filter((topic) => topic.status === "done").length;
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    title: row.title,
    description: row.description,
    category: row.category || "course",
    coverImageUrl: row.coverImageUrl || "",
    priority: normalizeStudyPriority(row.priority),
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdByProfileId: row.createdByProfileId,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    modules,
    progress: topics.length ? Math.round((completedTopics / topics.length) * 100) : 0,
  };
}

function toStudyPendingItem(row: StudyPendingItemRow): StudyPendingItem {
  return {
    id: row.id,
    wishlistId: row.wishlistId,
    moduleId: row.moduleId,
    topicId: row.topicId,
    adminTaskId: row.adminTaskId,
    title: row.title,
    status: normalizeStudyPendingStatus(row.status),
    priority: normalizeStudyPriority(row.priority),
    dueAt: toIso(row.dueAt),
    syncToTasks: row.syncToTasks,
    completedAt: toIso(row.completedAt),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
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
      sort_order as "sortOrder",
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
      sort_order asc,
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
  const status = input.status ?? "pending";

  const [row] = await sql<AdminTaskRow[]>`
    insert into admin_tasks (
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at,
      sort_order,
      created_by_profile_id
    )
    values (
      ${input.title.trim()},
      ${input.notes?.trim() || null},
      ${status},
      ${input.priority ?? null},
      ${input.category?.trim() || "pessoal"},
      ${normalizedTags},
      ${input.dueAt ? new Date(input.dueAt) : null},
      (select coalesce(max(sort_order), 0) + 1000 from admin_tasks where status = ${status}),
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
      sort_order as "sortOrder",
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
      sort_order as "sortOrder",
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
        sort_order = case
          when status = ${nextStatus} then sort_order
          else (select coalesce(max(sort_order), 0) + 1000 from admin_tasks where status = ${nextStatus})
        end,
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
        sort_order as "sortOrder",
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
      sort_order as "sortOrder",
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

async function rebalanceAdminTaskOrder(status: AdminTaskStatus) {
  const sql = getSql();
  await sql`
    with ordered as (
      select
        id,
        row_number() over (order by sort_order asc, created_at desc) * 1000 as next_sort_order
      from admin_tasks
      where status = ${status}
    )
    update admin_tasks
    set sort_order = ordered.next_sort_order
    from ordered
    where admin_tasks.id = ordered.id
  `;
}

async function getAdminTaskById(id: string) {
  const sql = getSql();
  const [row] = await sql<AdminTaskRow[]>`
    select
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
    from admin_tasks
    where id = ${id}
  `;

  if (!row) {
    throw new PublicError("Tarefa nao encontrada.", 404);
  }

  return toAdminTask(row);
}

export async function reorderAdminTask(input: {
  taskId: string;
  targetStatus: AdminTaskStatus;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  const sql = getSql();
  const task = await getAdminTaskById(input.taskId);
  const neighborIds = [input.beforeId, input.afterId].filter((id): id is string => Boolean(id));
  const neighbors = neighborIds.length
    ? await sql<Array<{ id: string; status: string | null; sortOrder: number | null }>>`
        select
          id,
          status,
          sort_order as "sortOrder"
        from admin_tasks
        where id in ${sql(neighborIds)}
      `
    : [];

  const before = input.beforeId ? neighbors.find((neighbor) => neighbor.id === input.beforeId) : null;
  const after = input.afterId ? neighbors.find((neighbor) => neighbor.id === input.afterId) : null;
  if (input.beforeId && !before) {
    throw new PublicError("Tarefa anterior nao encontrada.", 404);
  }
  if (input.afterId && !after) {
    throw new PublicError("Tarefa posterior nao encontrada.", 404);
  }
  if (
    (before && normalizeAdminTaskStatus(before.status) !== input.targetStatus) ||
    (after && normalizeAdminTaskStatus(after.status) !== input.targetStatus)
  ) {
    throw new PublicError("Destino de reordenacao invalido.");
  }

  let nextSortOrder = 1000;
  if (before && after) {
    nextSortOrder = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;
  } else if (before) {
    nextSortOrder = (before.sortOrder ?? 0) + 1000;
  } else if (after) {
    nextSortOrder = (after.sortOrder ?? 0) - 1000;
  } else {
    const [{ maxSortOrder }] = await sql<Array<{ maxSortOrder: number | null }>>`
      select max(sort_order) as "maxSortOrder"
      from admin_tasks
      where status = ${input.targetStatus}
        and id <> ${input.taskId}
    `;
    nextSortOrder = (maxSortOrder ?? 0) + 1000;
  }

  const [row] = await sql<AdminTaskRow[]>`
    update admin_tasks
    set
      status = ${input.targetStatus},
      sort_order = ${nextSortOrder},
      completed_at = case when ${input.targetStatus} = 'done' then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where id = ${input.taskId}
    returning
      id,
      title,
      notes,
      status,
      priority,
      category,
      tags,
      due_at as "dueAt",
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt",
      completed_at as "completedAt"
  `;

  if (!row) {
    throw new PublicError("Tarefa nao encontrada.", 404);
  }

  const gap = before && after ? Math.abs((after.sortOrder ?? 0) - (before.sortOrder ?? 0)) : 1000;
  if (gap < 1) {
    await rebalanceAdminTaskOrder(input.targetStatus);
    return getAdminTaskById(input.taskId);
  }

  if (task.status !== input.targetStatus) {
    await rebalanceAdminTaskOrder(task.status);
  }

  return toAdminTask(row);
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

export async function listStudyData(input: { wishlistId: string }): Promise<StudyDashboardData> {
  const sql = getSql();
  const [courseRows, moduleRows, topicRows, materialRows, pendingRows] = await Promise.all([
    sql<StudyCourseRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        title,
        description,
        category,
        cover_image_url as "coverImageUrl",
        priority,
        sort_order as "sortOrder",
        created_by_profile_id as "createdByProfileId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from study_courses
      where wishlist_id = ${input.wishlistId}
      order by sort_order asc, created_at desc
    `,
    sql<StudyModuleRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        course_id as "courseId",
        title,
        description,
        priority,
        sort_order as "sortOrder",
        created_by_profile_id as "createdByProfileId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from study_modules
      where wishlist_id = ${input.wishlistId}
      order by sort_order asc, created_at desc
    `,
    sql<StudyTopicRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        module_id as "moduleId",
        title,
        notes,
        status,
        priority,
        due_at as "dueAt",
        sort_order as "sortOrder",
        completed_at as "completedAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from study_topics
      where wishlist_id = ${input.wishlistId}
      order by module_id asc, sort_order asc, created_at desc
    `,
    sql<StudyMaterialRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        module_id as "moduleId",
        topic_id as "topicId",
        type,
        title,
        url,
        description,
        metadata,
        sort_order as "sortOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from study_materials
      where wishlist_id = ${input.wishlistId}
      order by sort_order asc, created_at desc
    `,
    sql<StudyPendingItemRow[]>`
      select
        id,
        wishlist_id as "wishlistId",
        module_id as "moduleId",
        topic_id as "topicId",
        admin_task_id as "adminTaskId",
        title,
        status,
        priority,
        due_at as "dueAt",
        sync_to_tasks as "syncToTasks",
        completed_at as "completedAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from study_pending_items
      where wishlist_id = ${input.wishlistId}
      order by
        case when status = 'done' then 1 else 0 end asc,
        due_at asc nulls last,
        created_at desc
    `,
  ]);

  const materials = materialRows.map(toStudyMaterial);
  const topics = topicRows.map((topic) =>
    toStudyTopic(
      topic,
      materials.filter((material) => material.topicId === topic.id),
    ),
  );
  const modules = moduleRows.map((module) =>
    toStudyModule(
      module,
      topics.filter((topic) => topic.moduleId === module.id),
      materials.filter((material) => material.moduleId === module.id && !material.topicId),
    ),
  );
  const courses = courseRows.map((course) =>
    toStudyCourse(
      course,
      modules.filter((module) => module.courseId === course.id),
    ),
  );
  const pendingItems = pendingRows.map(toStudyPendingItem);
  const topicsCount = topics.length;
  const completedTopicsCount = topics.filter((topic) => topic.status === "done").length;
  const dueSoonThreshold = Date.now() + 1000 * 60 * 60 * 24 * 7;

  return {
    courses,
    modules,
    pendingItems,
    stats: {
      modulesCount: modules.length,
      topicsCount,
      completedTopicsCount,
      overallProgress: topicsCount ? Math.round((completedTopicsCount / topicsCount) * 100) : 0,
      openPendingCount: pendingItems.filter((item) => item.status !== "done").length,
      dueSoonCount: pendingItems.filter((item) => {
        if (item.status === "done" || !item.dueAt) return false;
        const dueTime = new Date(item.dueAt).getTime();
        return Number.isFinite(dueTime) && dueTime <= dueSoonThreshold;
      }).length,
    },
  };
}

export async function createStudyCourse(input: {
  wishlistId: string;
  title: string;
  description?: string;
  category?: string;
  coverImageUrl?: string;
  priority?: StudyPriority;
  createdByProfileId: string;
}) {
  const sql = getSql();
  const [row] = await sql<StudyCourseRow[]>`
    insert into study_courses (
      wishlist_id,
      title,
      description,
      category,
      cover_image_url,
      priority,
      sort_order,
      created_by_profile_id
    )
    values (
      ${input.wishlistId},
      ${input.title.trim()},
      ${input.description?.trim() ?? ""},
      ${input.category?.trim() || "course"},
      ${input.coverImageUrl?.trim() ?? ""},
      ${input.priority ?? null},
      (select coalesce(max(sort_order), 0) + 1000 from study_courses where wishlist_id = ${input.wishlistId}),
      ${input.createdByProfileId}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      title,
      description,
      category,
      cover_image_url as "coverImageUrl",
      priority,
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return toStudyCourse(row);
}

export async function updateStudyCourse(input: {
  id: string;
  wishlistId: string;
  title: string;
  description?: string;
  category?: string;
  coverImageUrl?: string;
  priority?: StudyPriority;
}) {
  const sql = getSql();
  const [row] = await sql<StudyCourseRow[]>`
    update study_courses
    set
      title = ${input.title.trim()},
      description = ${input.description?.trim() ?? ""},
      category = ${input.category?.trim() || "course"},
      cover_image_url = ${input.coverImageUrl?.trim() ?? ""},
      priority = ${input.priority ?? null},
      updated_at = now()
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning
      id,
      wishlist_id as "wishlistId",
      title,
      description,
      category,
      cover_image_url as "coverImageUrl",
      priority,
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Curso nao encontrado.", 404);
  }

  return toStudyCourse(row);
}

export async function deleteStudyCourse(input: { id: string; wishlistId: string }) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from study_courses
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning id
  `;

  if (!row) {
    throw new PublicError("Curso nao encontrado.", 404);
  }

  return { ok: true };
}

export async function createStudyModule(input: {
  wishlistId: string;
  courseId: string;
  title: string;
  description?: string;
  priority?: StudyPriority;
  createdByProfileId: string;
}) {
  const sql = getSql();
  const [row] = await sql<StudyModuleRow[]>`
    insert into study_modules (
      wishlist_id,
      course_id,
      title,
      description,
      priority,
      sort_order,
      created_by_profile_id
    )
    select
      ${input.wishlistId},
      ${input.courseId},
      ${input.title.trim()},
      ${input.description?.trim() ?? ""},
      ${input.priority ?? null},
      (select coalesce(max(sort_order), 0) + 1000 from study_modules where wishlist_id = ${input.wishlistId} and course_id = ${input.courseId}),
      ${input.createdByProfileId}
    where exists (
      select 1
      from study_courses
      where id = ${input.courseId}
        and wishlist_id = ${input.wishlistId}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      course_id as "courseId",
      title,
      description,
      priority,
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Curso nao encontrado.", 404);
  return toStudyModule(row);
}

export async function updateStudyModule(input: {
  id: string;
  wishlistId: string;
  courseId?: string;
  title: string;
  description?: string;
  priority?: StudyPriority;
}) {
  const sql = getSql();
  const [row] = await sql<StudyModuleRow[]>`
    update study_modules
    set
      course_id = coalesce(${input.courseId ?? null}, course_id),
      title = ${input.title.trim()},
      description = ${input.description?.trim() ?? ""},
      priority = ${input.priority ?? null},
      updated_at = now()
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
      and (
        ${input.courseId ?? null}::uuid is null
        or exists (select 1 from study_courses where id = ${input.courseId ?? null} and wishlist_id = ${input.wishlistId})
      )
    returning
      id,
      wishlist_id as "wishlistId",
      course_id as "courseId",
      title,
      description,
      priority,
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Modulo de estudo nao encontrado.", 404);
  }

  return toStudyModule(row);
}

export async function deleteStudyModule(input: { id: string; wishlistId: string }) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from study_modules
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning id
  `;

  if (!row) {
    throw new PublicError("Modulo de estudo nao encontrado.", 404);
  }

  return { ok: true };
}

async function rebalanceStudyModuleOrder(wishlistId: string, courseId: string) {
  const sql = getSql();
  await sql`
    with ordered as (
      select id, row_number() over (order by sort_order asc, created_at desc) * 1000 as next_sort_order
      from study_modules
      where wishlist_id = ${wishlistId}
        and course_id = ${courseId}
    )
    update study_modules
    set sort_order = ordered.next_sort_order
    from ordered
    where study_modules.id = ordered.id
  `;
}

export async function reorderStudyModule(input: {
  wishlistId: string;
  moduleId: string;
  courseId: string;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  const sql = getSql();
  const neighborIds = [input.beforeId, input.afterId].filter((id): id is string => Boolean(id));
  const neighbors = neighborIds.length
    ? await sql<Array<{ id: string; sortOrder: number | null }>>`
        select id, sort_order as "sortOrder"
        from study_modules
        where wishlist_id = ${input.wishlistId}
          and course_id = ${input.courseId}
          and id in ${sql(neighborIds)}
      `
    : [];
  const before = input.beforeId ? neighbors.find((neighbor) => neighbor.id === input.beforeId) : null;
  const after = input.afterId ? neighbors.find((neighbor) => neighbor.id === input.afterId) : null;
  if (input.beforeId && !before) throw new PublicError("Modulo anterior nao encontrado.", 404);
  if (input.afterId && !after) throw new PublicError("Modulo posterior nao encontrado.", 404);

  let nextSortOrder = 1000;
  if (before && after) {
    nextSortOrder = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;
  } else if (before) {
    nextSortOrder = (before.sortOrder ?? 0) + 1000;
  } else if (after) {
    nextSortOrder = (after.sortOrder ?? 0) - 1000;
  } else {
    const [{ maxSortOrder }] = await sql<Array<{ maxSortOrder: number | null }>>`
      select max(sort_order) as "maxSortOrder"
      from study_modules
      where wishlist_id = ${input.wishlistId}
        and course_id = ${input.courseId}
        and id <> ${input.moduleId}
    `;
    nextSortOrder = (maxSortOrder ?? 0) + 1000;
  }

  const [row] = await sql<StudyModuleRow[]>`
    update study_modules
    set course_id = ${input.courseId}, sort_order = ${nextSortOrder}, updated_at = now()
    where id = ${input.moduleId}
      and wishlist_id = ${input.wishlistId}
      and exists (select 1 from study_courses where id = ${input.courseId} and wishlist_id = ${input.wishlistId})
    returning
      id,
      wishlist_id as "wishlistId",
      course_id as "courseId",
      title,
      description,
      priority,
      sort_order as "sortOrder",
      created_by_profile_id as "createdByProfileId",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Modulo de estudo nao encontrado.", 404);
  if (before && after && Math.abs((after.sortOrder ?? 0) - (before.sortOrder ?? 0)) < 1) {
    await rebalanceStudyModuleOrder(input.wishlistId, input.courseId);
  }

  return toStudyModule(row);
}

export async function createStudyTopic(input: {
  wishlistId: string;
  moduleId: string;
  title: string;
  notes?: StudyNoteBlock[];
  status?: StudyTopicStatus;
  priority?: StudyPriority;
  dueAt?: string | null;
}) {
  const sql = getSql();
  const status = input.status ?? "not_started";
  const [row] = await sql<StudyTopicRow[]>`
    insert into study_topics (
      wishlist_id,
      module_id,
      title,
      notes,
      status,
      priority,
      due_at,
      sort_order,
      completed_at
    )
    select
      ${input.wishlistId},
      ${input.moduleId},
      ${input.title.trim()},
      ${JSON.stringify(input.notes ?? [])}::jsonb,
      ${status},
      ${input.priority ?? null},
      ${input.dueAt ? new Date(input.dueAt) : null},
      (select coalesce(max(sort_order), 0) + 1000 from study_topics where module_id = ${input.moduleId}),
      case when ${status} = 'done' then now() else null end
    where exists (
      select 1 from study_modules where id = ${input.moduleId} and wishlist_id = ${input.wishlistId}
    )
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      title,
      notes,
      status,
      priority,
      due_at as "dueAt",
      sort_order as "sortOrder",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Modulo de estudo nao encontrado.", 404);
  return toStudyTopic(row);
}

export async function updateStudyTopic(input: {
  id: string;
  wishlistId: string;
  moduleId?: string;
  title: string;
  notes?: StudyNoteBlock[];
  status?: StudyTopicStatus;
  priority?: StudyPriority;
  dueAt?: string | null;
}) {
  const sql = getSql();
  const status = input.status ?? "not_started";
  const [row] = await sql<StudyTopicRow[]>`
    update study_topics
    set
      module_id = coalesce(${input.moduleId ?? null}, module_id),
      title = ${input.title.trim()},
      notes = ${JSON.stringify(input.notes ?? [])}::jsonb,
      status = ${status},
      priority = ${input.priority ?? null},
      due_at = ${input.dueAt ? new Date(input.dueAt) : null},
      completed_at = case when ${status} = 'done' then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
      and (
        ${input.moduleId ?? null}::uuid is null
        or exists (select 1 from study_modules where id = ${input.moduleId ?? null} and wishlist_id = ${input.wishlistId})
      )
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      title,
      notes,
      status,
      priority,
      due_at as "dueAt",
      sort_order as "sortOrder",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) {
    throw new PublicError("Topico de estudo nao encontrado.", 404);
  }

  return toStudyTopic(row);
}

export async function deleteStudyTopic(input: { id: string; wishlistId: string }) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from study_topics
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning id
  `;

  if (!row) throw new PublicError("Topico de estudo nao encontrado.", 404);
  return { ok: true };
}

async function rebalanceStudyTopicOrder(moduleId: string) {
  const sql = getSql();
  await sql`
    with ordered as (
      select id, row_number() over (order by sort_order asc, created_at desc) * 1000 as next_sort_order
      from study_topics
      where module_id = ${moduleId}
    )
    update study_topics
    set sort_order = ordered.next_sort_order
    from ordered
    where study_topics.id = ordered.id
  `;
}

export async function reorderStudyTopic(input: {
  wishlistId: string;
  topicId: string;
  moduleId: string;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  const sql = getSql();
  const neighborIds = [input.beforeId, input.afterId].filter((id): id is string => Boolean(id));
  const neighbors = neighborIds.length
    ? await sql<Array<{ id: string; sortOrder: number | null }>>`
        select id, sort_order as "sortOrder"
        from study_topics
        where wishlist_id = ${input.wishlistId}
          and module_id = ${input.moduleId}
          and id in ${sql(neighborIds)}
      `
    : [];
  const before = input.beforeId ? neighbors.find((neighbor) => neighbor.id === input.beforeId) : null;
  const after = input.afterId ? neighbors.find((neighbor) => neighbor.id === input.afterId) : null;
  if (input.beforeId && !before) throw new PublicError("Topico anterior nao encontrado.", 404);
  if (input.afterId && !after) throw new PublicError("Topico posterior nao encontrado.", 404);

  let nextSortOrder = 1000;
  if (before && after) {
    nextSortOrder = ((before.sortOrder ?? 0) + (after.sortOrder ?? 0)) / 2;
  } else if (before) {
    nextSortOrder = (before.sortOrder ?? 0) + 1000;
  } else if (after) {
    nextSortOrder = (after.sortOrder ?? 0) - 1000;
  } else {
    const [{ maxSortOrder }] = await sql<Array<{ maxSortOrder: number | null }>>`
      select max(sort_order) as "maxSortOrder"
      from study_topics
      where module_id = ${input.moduleId}
        and id <> ${input.topicId}
    `;
    nextSortOrder = (maxSortOrder ?? 0) + 1000;
  }

  const [row] = await sql<StudyTopicRow[]>`
    update study_topics
    set module_id = ${input.moduleId}, sort_order = ${nextSortOrder}, updated_at = now()
    where id = ${input.topicId}
      and wishlist_id = ${input.wishlistId}
      and exists (select 1 from study_modules where id = ${input.moduleId} and wishlist_id = ${input.wishlistId})
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      title,
      notes,
      status,
      priority,
      due_at as "dueAt",
      sort_order as "sortOrder",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Topico de estudo nao encontrado.", 404);
  if (before && after && Math.abs((after.sortOrder ?? 0) - (before.sortOrder ?? 0)) < 1) {
    await rebalanceStudyTopicOrder(input.moduleId);
  }
  return toStudyTopic(row);
}

export async function createStudyMaterial(input: {
  wishlistId: string;
  moduleId?: string | null;
  topicId?: string | null;
  type: StudyMaterialType;
  title: string;
  url?: string | null;
  description?: string;
  metadata?: string;
}) {
  const sql = getSql();
  const [row] = await sql<StudyMaterialRow[]>`
    insert into study_materials (
      wishlist_id,
      module_id,
      topic_id,
      type,
      title,
      url,
      description,
      metadata,
      sort_order
    )
    select
      ${input.wishlistId},
      ${input.moduleId ?? null},
      ${input.topicId ?? null},
      ${input.type},
      ${input.title.trim()},
      ${input.url?.trim() || null},
      ${input.description?.trim() ?? ""},
      ${input.metadata?.trim() ?? ""},
      (select coalesce(max(sort_order), 0) + 1000 from study_materials where coalesce(topic_id, module_id) = coalesce(${input.topicId ?? null}, ${input.moduleId ?? null}))
    where (
      (${input.topicId ?? null}::uuid is not null and exists (select 1 from study_topics where id = ${input.topicId ?? null} and wishlist_id = ${input.wishlistId}))
      or (${input.topicId ?? null}::uuid is null and ${input.moduleId ?? null}::uuid is not null and exists (select 1 from study_modules where id = ${input.moduleId ?? null} and wishlist_id = ${input.wishlistId}))
    )
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      topic_id as "topicId",
      type,
      title,
      url,
      description,
      metadata,
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Destino do material nao encontrado.", 404);
  return toStudyMaterial(row);
}

export async function updateStudyMaterial(input: {
  id: string;
  wishlistId: string;
  type: StudyMaterialType;
  title: string;
  url?: string | null;
  description?: string;
  metadata?: string;
}) {
  const sql = getSql();
  const [row] = await sql<StudyMaterialRow[]>`
    update study_materials
    set
      type = ${input.type},
      title = ${input.title.trim()},
      url = ${input.url?.trim() || null},
      description = ${input.description?.trim() ?? ""},
      metadata = ${input.metadata?.trim() ?? ""},
      updated_at = now()
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      topic_id as "topicId",
      type,
      title,
      url,
      description,
      metadata,
      sort_order as "sortOrder",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  if (!row) throw new PublicError("Material nao encontrado.", 404);
  return toStudyMaterial(row);
}

export async function deleteStudyMaterial(input: { id: string; wishlistId: string }) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from study_materials
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning id
  `;

  if (!row) throw new PublicError("Material nao encontrado.", 404);
  return { ok: true };
}

async function syncStudyPendingTask(input: {
  existingTaskId?: string | null;
  title: string;
  status: StudyPendingStatus;
  priority: StudyPriority;
  dueAt?: string | null;
  createdByProfileId: string;
}) {
  const taskStatus: AdminTaskStatus = input.status === "done" ? "done" : input.status === "in_progress" ? "in_progress" : "pending";
  if (input.existingTaskId) {
    return updateAdminTask({
      id: input.existingTaskId,
      title: input.title,
      notes: "Pendencia de estudos sincronizada.",
      status: taskStatus,
      priority: input.priority,
      category: "estudos",
      tags: ["estudos"],
      dueAt: input.dueAt ?? null,
    });
  }

  return createAdminTask({
    title: input.title,
    notes: "Pendencia de estudos sincronizada.",
    status: taskStatus,
    priority: input.priority,
    category: "estudos",
    tags: ["estudos"],
    dueAt: input.dueAt ?? null,
    createdByProfileId: input.createdByProfileId,
  });
}

export async function createStudyPendingItem(input: {
  wishlistId: string;
  moduleId?: string | null;
  topicId?: string | null;
  title: string;
  status?: StudyPendingStatus;
  priority?: StudyPriority;
  dueAt?: string | null;
  syncToTasks?: boolean;
  createdByProfileId: string;
}) {
  const sql = getSql();
  const status = input.status ?? "pending";
  const syncedTask = input.syncToTasks
    ? await syncStudyPendingTask({
        title: input.title.trim(),
        status,
        priority: input.priority ?? null,
        dueAt: input.dueAt ?? null,
        createdByProfileId: input.createdByProfileId,
      })
    : null;

  const [row] = await sql<StudyPendingItemRow[]>`
    insert into study_pending_items (
      wishlist_id,
      module_id,
      topic_id,
      admin_task_id,
      title,
      status,
      priority,
      due_at,
      sync_to_tasks,
      completed_at
    )
    values (
      ${input.wishlistId},
      ${input.moduleId ?? null},
      ${input.topicId ?? null},
      ${syncedTask?.id ?? null},
      ${input.title.trim()},
      ${status},
      ${input.priority ?? null},
      ${input.dueAt ? new Date(input.dueAt) : null},
      ${Boolean(input.syncToTasks)},
      case when ${status} = 'done' then now() else null end
    )
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      topic_id as "topicId",
      admin_task_id as "adminTaskId",
      title,
      status,
      priority,
      due_at as "dueAt",
      sync_to_tasks as "syncToTasks",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return toStudyPendingItem(row);
}

export async function updateStudyPendingItem(input: {
  id: string;
  wishlistId: string;
  moduleId?: string | null;
  topicId?: string | null;
  title: string;
  status?: StudyPendingStatus;
  priority?: StudyPriority;
  dueAt?: string | null;
  syncToTasks?: boolean;
  createdByProfileId: string;
}) {
  const sql = getSql();
  const [current] = await sql<StudyPendingItemRow[]>`
    select
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      topic_id as "topicId",
      admin_task_id as "adminTaskId",
      title,
      status,
      priority,
      due_at as "dueAt",
      sync_to_tasks as "syncToTasks",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from study_pending_items
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
  `;

  if (!current) throw new PublicError("Pendencia de estudo nao encontrada.", 404);

  const status = input.status ?? "pending";
  const syncedTask = input.syncToTasks
    ? await syncStudyPendingTask({
        existingTaskId: current.adminTaskId,
        title: input.title.trim(),
        status,
        priority: input.priority ?? null,
        dueAt: input.dueAt ?? null,
        createdByProfileId: input.createdByProfileId,
      })
    : null;

  const [row] = await sql<StudyPendingItemRow[]>`
    update study_pending_items
    set
      module_id = ${input.moduleId ?? null},
      topic_id = ${input.topicId ?? null},
      admin_task_id = ${input.syncToTasks ? syncedTask?.id ?? current.adminTaskId : null},
      title = ${input.title.trim()},
      status = ${status},
      priority = ${input.priority ?? null},
      due_at = ${input.dueAt ? new Date(input.dueAt) : null},
      sync_to_tasks = ${Boolean(input.syncToTasks)},
      completed_at = case when ${status} = 'done' then coalesce(completed_at, now()) else null end,
      updated_at = now()
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning
      id,
      wishlist_id as "wishlistId",
      module_id as "moduleId",
      topic_id as "topicId",
      admin_task_id as "adminTaskId",
      title,
      status,
      priority,
      due_at as "dueAt",
      sync_to_tasks as "syncToTasks",
      completed_at as "completedAt",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;

  return toStudyPendingItem(row);
}

export async function deleteStudyPendingItem(input: { id: string; wishlistId: string }) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    delete from study_pending_items
    where id = ${input.id}
      and wishlist_id = ${input.wishlistId}
    returning id
  `;

  if (!row) throw new PublicError("Pendencia de estudo nao encontrada.", 404);
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
