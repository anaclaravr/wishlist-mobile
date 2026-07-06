import { Resend } from "resend";

import { getWishlistPublicPath } from "@/lib/config";
import type { Follower, PublicWishlist, Wishlist, WishlistItem } from "@/lib/db";
import { formatPrice } from "@/lib/format";

let resend: Resend | null = null;

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return null;
  }

  resend ??= new Resend(apiKey);
  return resend;
}

export function getFollowUrl(
  wishlist: Pick<PublicWishlist, "slug">,
  follower: Pick<Follower, "followToken">,
) {
  const publicPath = getWishlistPublicPath(wishlist.slug);

  return `${getBaseUrl()}${publicPath}?follow=${encodeURIComponent(follower.followToken)}`;
}

export async function sendFollowerWelcomeEmail(input: {
  wishlist: PublicWishlist;
  follower: Follower;
}) {
  const client = getResend();
  const from = process.env.EMAIL_FROM;
  const followerEmail = input.follower.email;

  if (!followerEmail) {
    return { skipped: true };
  }

  if (!client || !from) {
    console.info("Email skipped: configure RESEND_API_KEY and EMAIL_FROM.");
    return { skipped: true };
  }

  const followUrl = getFollowUrl(input.wishlist, input.follower);
  const title = escapeHtml(input.wishlist.title);

  await client.emails.send({
    from,
    to: followerEmail,
    subject: `Voce esta acompanhando ${input.wishlist.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <h1 style="font-size: 22px;">Workspace acompanhado</h1>
        <p>Voce agora acompanha <strong>${title}</strong>.</p>
        <p>Use este link para voltar com permissao para marcar itens como adquiridos:</p>
        <p><a href="${followUrl}" style="color: #0f766e;">Abrir workspace</a></p>
      </div>
    `,
  });

  return { skipped: false };
}

export async function sendNewItemEmail(input: {
  wishlist: Wishlist;
  item: WishlistItem;
  followers: Follower[];
}) {
  const client = getResend();
  const from = process.env.EMAIL_FROM;
  const followersWithEmail = input.followers.filter(
    (follower): follower is Follower & { email: string } => Boolean(follower.email),
  );

  if (!client || !from || followersWithEmail.length === 0) {
    if (followersWithEmail.length > 0) {
      console.info("New item email skipped: configure RESEND_API_KEY and EMAIL_FROM.");
    }

    return {
      sent: 0,
      skipped: input.followers.length,
    };
  }

  const safeWishlist = escapeHtml(input.wishlist.title);
  const safeItem = escapeHtml(input.item.name);
  const safeCategory = escapeHtml(input.item.category);
  const price = formatPrice(input.item.priceCents, input.item.currency);

  const results = await Promise.allSettled(
    followersWithEmail.map((follower) => {
      const followUrl = getFollowUrl(input.wishlist, follower);

      return client.emails.send({
        from,
        to: follower.email,
        subject: `Novo item no workspace: ${input.item.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
            <h1 style="font-size: 22px;">Novo item adicionado</h1>
            <p><strong>${safeItem}</strong> entrou no workspace <strong>${safeWishlist}</strong>.</p>
            <p>Categoria: ${safeCategory}<br />Preco: ${price}</p>
            <p><a href="${followUrl}" style="color: #0f766e;">Ver workspace</a></p>
          </div>
        `,
      });
    }),
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;

  return {
    sent,
    skipped: input.followers.length - sent,
  };
}
