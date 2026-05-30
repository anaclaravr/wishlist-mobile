import type { AccessProfile, LegacySuggestion, ProfileSuggestion } from "@/lib/access-db";
import { hasPermission, PERMISSION_KEYS } from "@/lib/rbac";

export type AdminSuggestion = {
  id: string;
  name: string;
  purchaseUrl: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  priority: "baixa" | "media" | "alta";
  repurchaseState: "nao_recompra" | "precisa_recompra" | "ainda_tem";
  visibility: "private" | "public";
  createdAt: string;
  updatedAt: string;
  sourceType: "profile" | "legacy";
  sourceLabel: string;
};

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

export function mapSuggestions(profileSuggestions: ProfileSuggestion[], legacySuggestions: LegacySuggestion[]) {
  return [
    ...profileSuggestions.map((suggestion) => ({
      id: suggestion.id,
      name: suggestion.name,
      purchaseUrl: suggestion.purchaseUrl,
      imageUrl: suggestion.imageUrl,
      priceCents: suggestion.priceCents,
      currency: suggestion.currency,
      category: suggestion.category,
      priority: suggestion.priority,
      repurchaseState: suggestion.repurchaseState,
      visibility: suggestion.visibility,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
      sourceType: "profile" as const,
      sourceLabel: suggestion.profileRole ?? "perfil",
    })),
    ...legacySuggestions.map((suggestion) => ({
      id: suggestion.id,
      name: suggestion.name,
      purchaseUrl: suggestion.purchaseUrl,
      imageUrl: suggestion.imageUrl,
      priceCents: suggestion.priceCents,
      currency: suggestion.currency,
      category: suggestion.category,
      priority: suggestion.priority,
      repurchaseState: suggestion.repurchaseState,
      visibility: suggestion.visibility,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
      sourceType: "legacy" as const,
      sourceLabel: suggestion.followerEmail ?? "anonimo",
    })),
  ];
}

export function summarizePermissions(profile: AccessProfile) {
  const allPermissions = PERMISSION_KEYS.filter((permission) => hasPermission(profile.role, permission));

  if (profile.role === "admin") {
    return ["Acesso total", `Permissoes: ${allPermissions.length}`];
  }

  const wishlistPermissions = allPermissions.filter((permission) => permission.startsWith("wishlist."));
  return [`Wishlist: ${wishlistPermissions.length}`, `Total: ${allPermissions.length}`];
}
