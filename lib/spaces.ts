import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { getSql } from "@/lib/db";
import { PublicError } from "@/lib/errors";
import { makeToken } from "@/lib/tokens";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SPACE_SESSION_COOKIE = "space_session";
export const SPACE_SESSION_MAX_AGE = 60 * 60 * 24 * 365;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type SpaceData = {
  items: unknown[];
  books: unknown[];
  logs: unknown[];
  rgoal: Record<string, unknown> | null;
};

export type SpaceSnapshot = {
  name: string;
  slug: string;
  data: SpaceData;
};

type SpaceRow = {
  slug: string;
  name: string;
  pinHash: string;
  data: Partial<SpaceData> | null;
  failedAttempts: number;
  lockedUntil: Date | null;
};

export function spaceSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function emptyData(): SpaceData {
  return { items: [], books: [], logs: [], rgoal: { daily: 10, weeks: {}, months: {} } };
}

function normalizeData(data: Partial<SpaceData> | null | undefined): SpaceData {
  const base = emptyData();
  if (!data || typeof data !== "object") {
    return base;
  }
  return {
    items: Array.isArray(data.items) ? data.items : base.items,
    books: Array.isArray(data.books) ? data.books : base.books,
    logs: Array.isArray(data.logs) ? data.logs : base.logs,
    rgoal: data.rgoal && typeof data.rgoal === "object" ? data.rgoal : base.rgoal,
  };
}

function toJson(data: SpaceData) {
  return JSON.parse(JSON.stringify(data)) as Parameters<ReturnType<typeof getSql>["json"]>[0];
}

async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

async function verifyPin(pin: string, stored: string) {
  const [saltPart, hashPart] = stored.split(":");
  if (!saltPart || !hashPart) {
    return false;
  }
  const expected = Buffer.from(hashPart, "base64url");
  const actual = await scrypt(pin, Buffer.from(saltPart, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(slug: string) {
  const sql = getSql();
  const token = makeToken("sp");
  await sql`insert into space_sessions (token_hash, slug) values (${hashToken(token)}, ${slug})`;
  return token;
}

export async function enterSpace(rawName: string, pin: string) {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 80);
  const slug = spaceSlug(name);

  if (!name) {
    throw new PublicError("Digite seu nome.");
  }
  if (!slug) {
    throw new PublicError("Use letras ou números no nome.");
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new PublicError("O PIN precisa ter 4 dígitos.");
  }

  const sql = getSql();
  const pinHash = await hashPin(pin);
  const created = await sql<SpaceRow[]>`
    insert into spaces (slug, name, pin_hash, data)
    values (${slug}, ${name}, ${pinHash}, ${sql.json(toJson(emptyData()))})
    on conflict (slug) do nothing
    returning slug, name, pin_hash as "pinHash", data,
      failed_attempts as "failedAttempts", locked_until as "lockedUntil"
  `;

  if (created[0]) {
    const token = await createSession(slug);
    return { token, space: { name, slug, data: normalizeData(created[0].data) } };
  }

  const [row] = await sql<SpaceRow[]>`
    select slug, name, pin_hash as "pinHash", data,
      failed_attempts as "failedAttempts", locked_until as "lockedUntil"
    from spaces where slug = ${slug}
  `;

  if (!row) {
    throw new PublicError("Não foi possível abrir este espaço. Tente de novo.", 409);
  }

  if (row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()) {
    throw new PublicError(
      "Muitas tentativas com PIN errado. Tente de novo em alguns minutos.",
      429,
    );
  }

  if (!(await verifyPin(pin, row.pinHash))) {
    await sql`
      update spaces set
        failed_attempts = case when failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} then 0 else failed_attempts + 1 end,
        locked_until = case when failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS}
          then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
      where slug = ${slug}
    `;
    throw new PublicError("PIN incorreto para este nome.", 401);
  }

  if (row.failedAttempts || row.lockedUntil) {
    await sql`update spaces set failed_attempts = 0, locked_until = null where slug = ${slug}`;
  }

  const token = await createSession(slug);
  return { token, space: { name: row.name, slug, data: normalizeData(row.data) } };
}

export async function getSpaceBySession(token: string | undefined): Promise<SpaceSnapshot | null> {
  if (!token) {
    return null;
  }
  const sql = getSql();
  const [row] = await sql<{ slug: string; name: string; data: Partial<SpaceData> | null }[]>`
    update space_sessions ss set last_used_at = now()
    from spaces s
    where ss.token_hash = ${hashToken(token)} and s.slug = ss.slug
    returning s.slug, s.name, s.data
  `;
  if (!row) {
    return null;
  }
  return { name: row.name, slug: row.slug, data: normalizeData(row.data) };
}

export async function saveSpaceData(token: string | undefined, data: SpaceData) {
  if (!token) {
    throw new PublicError("Entre de novo para salvar.", 401);
  }
  const sql = getSql();
  const updated = await sql`
    update spaces s set data = ${sql.json(toJson(normalizeData(data)))}, updated_at = now()
    from space_sessions ss
    where ss.token_hash = ${hashToken(token)} and s.slug = ss.slug
    returning s.slug
  `;
  if (!updated.length) {
    throw new PublicError("Sua sessão expirou. Entre de novo.", 401);
  }
}

export async function endSession(token: string | undefined) {
  if (!token) {
    return;
  }
  const sql = getSql();
  await sql`delete from space_sessions where token_hash = ${hashToken(token)}`;
}
