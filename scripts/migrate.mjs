import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const isLocal =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1") ||
  databaseUrl.includes("sslmode=disable");

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: isLocal ? undefined : "require",
});

await sql`create extension if not exists pgcrypto`;

await sql`
  create table if not exists wishlists (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    owner_name text,
    slug text not null unique,
    admin_token text not null unique,
    created_at timestamptz not null default now()
  )
`;

await sql`
  create table if not exists followers (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    email text not null,
    follow_token text not null unique,
    created_at timestamptz not null default now(),
    last_notified_at timestamptz,
    unique (wishlist_id, email)
  )
`;

await sql`
  create table if not exists wishlist_items (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    name text not null,
    purchase_url text not null,
    price_cents integer not null check (price_cents >= 0),
    currency varchar(3) not null default 'BRL',
    category text not null default 'Geral',
    created_at timestamptz not null default now(),
    acquired_at timestamptz,
    acquired_by_follower_id uuid references followers(id) on delete set null
  )
`;

await sql`
  create index if not exists wishlist_items_wishlist_created_idx
  on wishlist_items (wishlist_id, created_at desc)
`;

await sql`
  create index if not exists followers_wishlist_created_idx
  on followers (wishlist_id, created_at asc)
`;

await sql.end();

console.log("Database migrated.");
