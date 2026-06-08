import type { AccessRole } from "@/lib/access";

export const PERMISSION_KEYS = [
  "wishlist.read",
  "wishlist.favorites.manage",
  "wishlist.acquire.toggle",
  "wishlist.personal.create",
  "wishlist.personal.edit",
  "wishlist.personal.delete",
  "wishlist.official.create",
  "wishlist.official.edit",
  "wishlist.official.archive",
  "wishlist.official.delete",
  "admin.access",
  "admin.profiles.manage",
  "admin.wishlist.update",
  "admin.suggestions.read",
  "admin.tasks.manage",
  "admin.studies.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const ROLE_PERMISSIONS: Record<AccessRole, PermissionKey[]> = {
  admin: [
    "wishlist.read",
    "wishlist.acquire.toggle",
    "wishlist.official.create",
    "wishlist.official.edit",
    "wishlist.official.archive",
    "wishlist.official.delete",
    "admin.access",
    "admin.profiles.manage",
    "admin.wishlist.update",
    "admin.suggestions.read",
    "admin.tasks.manage",
    "admin.studies.manage",
  ],
  editor: [
    "wishlist.read",
    "wishlist.favorites.manage",
    "wishlist.acquire.toggle",
    "wishlist.personal.create",
    "wishlist.personal.edit",
    "wishlist.personal.delete",
  ],
  viewer: ["wishlist.read", "wishlist.favorites.manage"],
};

export function getRolePermissions(role: AccessRole) {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: AccessRole, permission: PermissionKey) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
