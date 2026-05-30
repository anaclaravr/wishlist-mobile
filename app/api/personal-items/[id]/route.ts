import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteProfilePersonalItem,
  updateProfilePersonalItem,
} from "@/lib/access-db";
import { requireAccessSession } from "@/lib/access-session";
import { deletePersonalItem, updatePersonalItem } from "@/lib/db";
import { getErrorResponse, PublicError } from "@/lib/errors";
import { parsePriceToCents } from "@/lib/format";

const prioritySchema = z.enum(["baixa", "media", "alta"]);
const repurchaseStateSchema = z.enum(["nao_recompra", "precisa_recompra", "ainda_tem"]);
const visibilitySchema = z.enum(["private", "public"]);

const updatePersonalItemSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  followToken: z.string().trim().min(1).optional(),
  name: z.string().trim().min(2, "Informe o nome do item.").max(120),
  purchaseUrl: z.string().trim().min(1, "Informe um link de compra valido.").max(2048),
  imageUrl: z.string().trim().max(2048).optional(),
  price: z.union([z.string(), z.number()]),
  category: z.string().trim().min(1, "Informe uma categoria.").max(60),
  priority: prioritySchema.default("media"),
  repurchaseState: repurchaseStateSchema.default("nao_recompra"),
  visibility: visibilitySchema.default("private"),
});

const deletePersonalItemSchema = z.object({
  slug: z.string().trim().min(1).optional(),
  followToken: z.string().trim().min(1).optional(),
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
    const parsed = updatePersonalItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError(parsed.error.issues[0]?.message ?? "Dados invalidos.");
    }

    const priceCents = parsePriceToCents(parsed.data.price);

    if (priceCents === null) {
      throw new PublicError("Informe um preco valido.");
    }

    const { id } = await context.params;
    const purchaseUrl = parseHttpUrl(
      parsed.data.purchaseUrl,
      "O link de compra precisa comecar com http ou https.",
    );
    const imageUrl = parseOptionalHttpUrl(parsed.data.imageUrl);
    const item =
      parsed.data.slug && parsed.data.followToken
        ? await updatePersonalItem({
            slug: parsed.data.slug,
            followToken: parsed.data.followToken,
            itemId: id,
            name: parsed.data.name,
            purchaseUrl,
            imageUrl,
            priceCents,
            category: parsed.data.category,
            priority: parsed.data.priority,
            repurchaseState: parsed.data.repurchaseState,
            visibility: parsed.data.visibility,
          })
        : await (async () => {
            const session = await requireAccessSession({
              permission: "wishlist.personal.edit",
            });

            return updateProfilePersonalItem({
              wishlistId: session.wishlistId,
              profileId: session.profileId,
              itemId: id,
              name: parsed.data.name,
              purchaseUrl,
              imageUrl,
              priceCents,
              category: parsed.data.category,
              priority: parsed.data.priority,
              repurchaseState: parsed.data.repurchaseState,
              visibility: parsed.data.visibility,
            });
          })();

    return NextResponse.json({ item });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const parsed = deletePersonalItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new PublicError("Dados invalidos.", 401);
    }

    const { id } = await context.params;
    if (parsed.data.slug && parsed.data.followToken) {
      await deletePersonalItem({
        slug: parsed.data.slug,
        followToken: parsed.data.followToken,
        itemId: id,
      });
    } else {
      const session = await requireAccessSession({
        permission: "wishlist.personal.delete",
      });
      await deleteProfilePersonalItem({
        wishlistId: session.wishlistId,
        profileId: session.profileId,
        itemId: id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
