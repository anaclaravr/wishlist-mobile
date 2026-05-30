import { createHash, randomBytes } from "node:crypto";

export const ACCESS_COOKIE_NAME = "wishlist_access";
export const ACCESS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const ACCESS_ROLES = ["admin", "editor", "viewer"] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateAccessKey(role: AccessRole) {
  return `wk_${role}_${randomBytes(12).toString("base64url")}`;
}

export function generateSessionToken() {
  return `ws_${randomBytes(24).toString("base64url")}`;
}

export function isAccessRole(value: string): value is AccessRole {
  return ACCESS_ROLES.includes(value as AccessRole);
}
