import { NextResponse } from "next/server";
import { z } from "zod";

import { getWishlistAdminTokenById } from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { addWishlistItem, getFollowersForWishlist } from "@/lib/db";
import { sendNewItemEmail } from "@/lib/email";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/format";

const prioritySchema = z.enum(["baixa", "media", "alta"]);
const repurchaseStateSchema = z.enum(["nao_recompra", "precisa_recompra", "ainda_tem"]);

const addItemSchema = z.object({
  adminToken: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Informe o nome do item.").max(120),
  purchaseUrl: z.string().trim().min(1, "Informe um link de compra valido.").max(2048),
  imageUrl: z.string().trim().max(2048).optional(),
  price: z.union([z.string(), z.number()]),
  category: z.string().trim().min(1, "Informe uma categoria.").max(60),
  priority: prioritySchema.default("media"),
  repurchaseState: repurchaseStateSchema.default("nao_recompra"),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const priceCents = parsePriceToCents(parsed.data.price);

    if (priceCents === null) {
      throw new PublicError("Informe um preco valido.");
    }

    const purchaseUrl = parseHttpUrl(
      parsed.data.purchaseUrl,
      "O link de compra precisa comecar com http ou https.",
    );
    const adminToken =
      parsed.data.adminToken ??
      (await (async () => {
        const session = await requireAccessSession({
          role: "admin",
          permission: "wishlist.official.create",
        });

        return getWishlistAdminTokenById(session.wishlistId);
      })());

    const { wishlist, item } = await addWishlistItem({
      adminToken,
      name: parsed.data.name,
      purchaseUrl,
      imageUrl: parseOptionalHttpUrl(parsed.data.imageUrl),
      priceCents,
      category: parsed.data.category,
      priority: parsed.data.priority,
      repurchaseState: parsed.data.repurchaseState,
    });
    const followers = await getFollowersForWishlist(wishlist.id);
    const notifications = await sendNewItemEmail({ wishlist, item, followers });

    return NextResponse.json({ item, notifications });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
