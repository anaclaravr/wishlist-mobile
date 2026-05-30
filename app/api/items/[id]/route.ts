import { NextResponse } from "next/server";
import { z } from "zod";

import { getWishlistAdminTokenById } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { deleteWishlistItem, updateWishlistItem } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/format";

const prioritySchema = z.enum(["baixa", "media", "alta"]);
const repurchaseStateSchema = z.enum(["nao_recompra", "precisa_recompra", "ainda_tem"]);

const updateItemSchema = z.object({
  adminToken: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Informe o nome do item.").max(120),
  purchaseUrl: z.string().trim().min(1, "Informe um link de compra valido.").max(2048),
  imageUrl: z.string().trim().max(2048).optional(),
  price: z.union([z.string(), z.number()]),
  category: z.string().trim().min(1, "Informe uma categoria.").max(60),
  priority: prioritySchema.default("media"),
  repurchaseState: repurchaseStateSchema.default("nao_recompra"),
});

const deleteItemSchema = z.object({
  adminToken: z.string().trim().min(1).optional(),
});

function parseHttpUrl(value: string, message: string) {
  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }

    return url.toString();
  } catch {
    throw new PublicError(message);
  }
}

function parseOptionalHttpUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return parseHttpUrl(trimmed, "Informe uma URL de imagem valida.");
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = updateItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const priceCents = parsePriceToCents(parsed.data.price);

    if (priceCents === null) {
      throw new PublicError("Informe um preco valido.");
    }
    const adminToken =
      parsed.data.adminToken ??
      (await (async () => {
        const session = await requireAccessSession({
          role: "admin",
          permission: "wishlist.official.edit",
        });

        return getWishlistAdminTokenById(session.wishlistId);
      })());

    const { id } = await context.params;
    const item = await updateWishlistItem({
      adminToken,
      itemId: id,
      name: parsed.data.name,
      purchaseUrl: parseHttpUrl(
        parsed.data.purchaseUrl,
        "O link de compra precisa comecar com http ou https.",
      ),
      imageUrl: parseOptionalHttpUrl(parsed.data.imageUrl),
      priceCents,
      category: parsed.data.category,
      priority: parsed.data.priority,
      repurchaseState: parsed.data.repurchaseState,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = deleteItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Link admin invalido.", 401);
    }
    const adminToken =
      parsed.data.adminToken ??
      (await (async () => {
        const session = await requireAccessSession({
          role: "admin",
          permission: "wishlist.official.delete",
        });

        return getWishlistAdminTokenById(session.wishlistId);
      })());

    const { id } = await context.params;
    const item = await deleteWishlistItem({
      adminToken,
      itemId: id,
    });

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
