import { randomBytes } from "node:crypto";

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

function token(prefix) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

let [wishlist] = await sql`
  select id, slug, admin_token
  from wishlists
  where slug = 'wishlist-demo'
`;

if (!wishlist) {
  [wishlist] = await sql`
    insert into wishlists (title, owner_name, slug, admin_token)
    values ('Wishlist de exemplo', 'Demo', 'wishlist-demo', ${token("admin")})
    returning id, slug, admin_token
  `;
}

const [{ count }] = await sql`
  select count(*)::int as count
  from wishlist_items
  where wishlist_id = ${wishlist.id}
`;

if (count === 0) {
  await sql`
    insert into wishlist_items (wishlist_id, name, purchase_url, price_cents, category)
    values
      (${wishlist.id}, 'Fone bluetooth', 'https://example.com/fone', 19990, 'Tecnologia'),
      (${wishlist.id}, 'Livro especial', 'https://example.com/livro', 7990, 'Livros'),
      (${wishlist.id}, 'Mochila para viagem', 'https://example.com/mochila', 24990, 'Viagem')
  `;
}

await sql.end();

console.log("Seed ready.");
console.log(`Public: /w/${wishlist.slug}`);
console.log(`Admin: /admin/${wishlist.admin_token}`);
