import { NextRequest, NextResponse } from "next/server";

import {
  listLegacyPublicSuggestionsByWishlistId,
  listPublicProfileSuggestionsByWishlistId,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { listPublicPersonalSuggestionsByAdminToken } from "@/lib/db";
import { getErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.nextUrl.searchParams.get("adminToken")?.trim();

    if (!adminToken) {
      const session = await requireAccessSession({
        role: "admin",
        permission: "admin.suggestions.read",
      });
      const [profileSuggestions, legacySuggestions] = await Promise.all([
        listPublicProfileSuggestionsByWishlistId(session.wishlistId),
        listLegacyPublicSuggestionsByWishlistId(session.wishlistId),
      ]);

      const suggestions = [
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

      return NextResponse.json({ suggestions });
    }

    const suggestions = await listPublicPersonalSuggestionsByAdminToken({ adminToken });
    return NextResponse.json({
      suggestions: suggestions.map((suggestion) => ({
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
    });

  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
