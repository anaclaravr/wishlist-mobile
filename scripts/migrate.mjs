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
  prepare: false,
});

await sql`create extension if not exists pgcrypto`;

await sql`
  create table if not exists wishlists (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    owner_name text,
    owner_email text,
    owner_avatar_url text,
    slug text not null unique,
    admin_token text not null unique,
    created_at timestamptz not null default now()
  )
`;

await sql`
  alter table wishlists
  add column if not exists owner_email text
`;

await sql`
  alter table wishlists
  add column if not exists owner_avatar_url text
`;

await sql`
  create table if not exists followers (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    email text,
    follow_token text not null unique,
    created_at timestamptz not null default now(),
    last_notified_at timestamptz,
    unique (wishlist_id, email)
  )
`;

await sql`
  alter table followers
  alter column email drop not null
`;

await sql`
  alter table followers
  drop constraint if exists followers_wishlist_id_email_key
`;

await sql`
  create unique index if not exists followers_wishlist_email_unique_idx
  on followers (wishlist_id, email)
  where email is not null
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
    image_url text,
    priority text not null default 'media',
    repurchase_state text not null default 'nao_recompra',
    created_at timestamptz not null default now(),
    acquired_at timestamptz,
    acquired_by_follower_id uuid references followers(id) on delete set null,
    archived_at timestamptz
  )
`;

await sql`
  create table if not exists wishlist_favorites (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    wishlist_item_id uuid not null references wishlist_items(id) on delete cascade,
    follower_id uuid not null references followers(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (wishlist_item_id, follower_id)
  )
`;

await sql`
  create table if not exists personal_items (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    follower_id uuid not null references followers(id) on delete cascade,
    name text not null,
    purchase_url text not null,
    image_url text,
    price_cents integer not null default 0 check (price_cents >= 0),
    currency varchar(3) not null default 'BRL',
    category text not null default 'Geral',
    priority text not null default 'media',
    repurchase_state text not null default 'nao_recompra',
    visibility text not null default 'private',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`;

await sql`
  create table if not exists access_profiles (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    role text not null,
    access_key text not null,
    key_hash text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_regenerated_at timestamptz not null default now(),
    last_used_at timestamptz,
    unique (wishlist_id, role),
    unique (key_hash)
  )
`;

await sql`
  create table if not exists access_sessions (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    profile_id uuid not null references access_profiles(id) on delete cascade,
    session_hash text not null unique,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
  )
`;

await sql`
  create table if not exists profile_favorites (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    wishlist_item_id uuid not null references wishlist_items(id) on delete cascade,
    profile_id uuid not null references access_profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (wishlist_item_id, profile_id)
  )
`;

await sql`
  create table if not exists profile_personal_items (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    profile_id uuid not null references access_profiles(id) on delete cascade,
    name text not null,
    purchase_url text not null,
    image_url text,
    price_cents integer not null default 0 check (price_cents >= 0),
    currency varchar(3) not null default 'BRL',
    category text not null default 'Geral',
    priority text not null default 'media',
    repurchase_state text not null default 'nao_recompra',
    visibility text not null default 'private',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )
`;

await sql`
  create table if not exists admin_tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    notes text,
    status text not null default 'pending',
    priority text,
    tags text[] not null default '{}',
    due_at timestamptz,
    created_by_profile_id uuid references access_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
  )
`;

await sql`
  create table if not exists page_settings (
    id uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references wishlists(id) on delete cascade,
    page_key text not null,
    config jsonb not null default '{}'::jsonb,
    updated_by_profile_id uuid references access_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (wishlist_id, page_key)
  )
`;

await sql`
  alter table admin_tasks
  add column if not exists tags text[] not null default '{}'
`;

await sql`
  alter table admin_tasks
  add column if not exists category text not null default 'pessoal'
`;

await sql`
  do $$
  begin
    if exists (
      select 1 from pg_constraint where conname = 'admin_tasks_status_check'
    ) then
      alter table admin_tasks drop constraint admin_tasks_status_check;
    end if;
    alter table admin_tasks
    add constraint admin_tasks_status_check
    check (status in ('pending', 'in_progress', 'done'));

    if not exists (
      select 1 from pg_constraint where conname = 'admin_tasks_priority_check'
    ) then
      alter table admin_tasks
      add constraint admin_tasks_priority_check
      check (priority in ('low', 'medium', 'high') or priority is null);
    end if;

    if exists (
      select 1 from pg_constraint where conname = 'admin_tasks_category_check'
    ) then
      alter table admin_tasks drop constraint admin_tasks_category_check;
    end if;
  end
  $$;
`;

await sql`
  alter table personal_items
  add column if not exists repurchase_state text not null default 'nao_recompra'
`;

await sql`
  update personal_items
  set priority = 'media'
  where priority not in ('baixa', 'media', 'alta')
`;

await sql`
  update personal_items
  set visibility = 'private'
  where visibility not in ('private', 'public')
`;

await sql`
  update personal_items
  set repurchase_state = 'nao_recompra'
  where repurchase_state is null
     or repurchase_state not in ('nao_recompra', 'precisa_recompra', 'ainda_tem')
`;

await sql`
  do $$
  begin
    if not exists (
      select 1 from pg_constraint where conname = 'personal_items_priority_check'
    ) then
      alter table personal_items
      add constraint personal_items_priority_check
      check (priority in ('baixa', 'media', 'alta'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'personal_items_visibility_check'
    ) then
      alter table personal_items
      add constraint personal_items_visibility_check
      check (visibility in ('private', 'public'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'personal_items_repurchase_state_check'
    ) then
      alter table personal_items
      add constraint personal_items_repurchase_state_check
      check (repurchase_state in ('nao_recompra', 'precisa_recompra', 'ainda_tem'));
    end if;
  end
  $$;
`;

await sql`
  alter table wishlist_items
  add column if not exists image_url text
`;

await sql`
  alter table wishlist_items
  add column if not exists priority text not null default 'media'
`;

await sql`
  alter table wishlist_items
  add column if not exists archived_at timestamptz
`;

await sql`
  alter table wishlist_items
  add column if not exists repurchase_state text not null default 'nao_recompra'
`;

await sql`
  alter table wishlist_items
  add column if not exists acquired_by_profile_id uuid references access_profiles(id) on delete set null
`;

await sql`
  update wishlist_items
  set priority = 'media'
  where priority is null
     or priority not in ('baixa', 'media', 'alta')
`;

await sql`
  update wishlist_items
  set repurchase_state = 'nao_recompra'
  where repurchase_state is null
     or repurchase_state not in ('nao_recompra', 'precisa_recompra', 'ainda_tem')
`;

await sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlist_items_priority_check'
    ) then
      alter table wishlist_items
      add constraint wishlist_items_priority_check
      check (priority in ('baixa', 'media', 'alta'));
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'wishlist_items_repurchase_state_check'
    ) then
      alter table wishlist_items
      add constraint wishlist_items_repurchase_state_check
      check (repurchase_state in ('nao_recompra', 'precisa_recompra', 'ainda_tem'));
    end if;
  end
  $$;
`;

await sql`
  do $$
  begin
    if not exists (
      select 1 from pg_constraint where conname = 'access_profiles_role_check'
    ) then
      alter table access_profiles
      add constraint access_profiles_role_check
      check (role in ('admin', 'editor', 'viewer'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'profile_personal_items_priority_check'
    ) then
      alter table profile_personal_items
      add constraint profile_personal_items_priority_check
      check (priority in ('baixa', 'media', 'alta'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'profile_personal_items_visibility_check'
    ) then
      alter table profile_personal_items
      add constraint profile_personal_items_visibility_check
      check (visibility in ('private', 'public'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'profile_personal_items_repurchase_state_check'
    ) then
      alter table profile_personal_items
      add constraint profile_personal_items_repurchase_state_check
      check (repurchase_state in ('nao_recompra', 'precisa_recompra', 'ainda_tem'));
    end if;
  end
  $$;
`;

await sql`
  create index if not exists wishlist_items_wishlist_created_idx
  on wishlist_items (wishlist_id, created_at desc)
`;

await sql`
  create index if not exists wishlist_items_wishlist_active_idx
  on wishlist_items (wishlist_id, archived_at, created_at desc)
`;

await sql`
  create index if not exists followers_wishlist_created_idx
  on followers (wishlist_id, created_at asc)
`;

await sql`
  create index if not exists wishlist_favorites_follower_created_idx
  on wishlist_favorites (follower_id, created_at desc)
`;

await sql`
  create index if not exists wishlist_favorites_item_idx
  on wishlist_favorites (wishlist_item_id)
`;

await sql`
  create index if not exists personal_items_follower_created_idx
  on personal_items (follower_id, created_at desc)
`;

await sql`
  create index if not exists personal_items_wishlist_visibility_idx
  on personal_items (wishlist_id, visibility, created_at desc)
`;

await sql`
  create index if not exists access_profiles_wishlist_role_idx
  on access_profiles (wishlist_id, role)
`;

await sql`
  create index if not exists access_sessions_profile_expiry_idx
  on access_sessions (profile_id, expires_at desc)
`;

await sql`
  create index if not exists access_sessions_session_hash_idx
  on access_sessions (session_hash)
`;

await sql`
  create index if not exists profile_favorites_profile_created_idx
  on profile_favorites (profile_id, created_at desc)
`;

await sql`
  create index if not exists profile_personal_items_profile_created_idx
  on profile_personal_items (profile_id, created_at desc)
`;

await sql`
  create index if not exists profile_personal_items_wishlist_visibility_idx
  on profile_personal_items (wishlist_id, visibility, created_at desc)
`;

await sql`
  create index if not exists admin_tasks_status_idx
  on admin_tasks (status, created_at desc)
`;

await sql`
  create index if not exists admin_tasks_due_idx
  on admin_tasks (due_at)
`;

await sql`
  create index if not exists admin_tasks_created_idx
  on admin_tasks (created_at desc)
`;

await sql`
  create index if not exists page_settings_wishlist_page_idx
  on page_settings (wishlist_id, page_key)
`;

await sql.end();

console.log("Database migrated.");
