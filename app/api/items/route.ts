import { NextResponse } from "next/server";
import { z } from "zod";

import { addWishlistItem, getFollowersForWishlist } from "@/lib/db";
import { sendNewItemEmail } from "@/lib/email";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/format";

const addItemSchema = z.object({
  adminToken: z.string().trim().min(1),
  name: z.string().trim().min(2, "Informe o nome do item.").max(120),
  purchaseUrl: z.string().trim().url("Informe um link de compra valido."),
  price: z.union([z.string(), z.number()]),
  category: z.string().trim().min(1, "Informe uma categoria.").max(60),
});

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

    const url = new URL(parsed.data.purchaseUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new PublicError("O link de compra precisa comecar com http ou https.");
    }

    const { wishlist, item } = await addWishlistItem({
      adminToken: parsed.data.adminToken,
      name: parsed.data.name,
      purchaseUrl: url.toString(),
      priceCents,
      category: parsed.data.category,
    });
    const followers = await getFollowersForWishlist(wishlist.id);
    const notifications = await sendNewItemEmail({ wishlist, item, followers });

    return NextResponse.json({ item, notifications });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
