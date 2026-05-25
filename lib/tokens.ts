import { randomBytes } from "node:crypto";

export function makeToken(prefix: string) {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function makeShortToken(length = 6) {
  return randomBytes(8).toString("base64url").slice(0, length).toLowerCase();
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "wishlist";
}
