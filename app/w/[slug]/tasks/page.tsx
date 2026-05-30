import { redirect } from "next/navigation";

import { WishlistAccessGate } from "@/components/wishlist-access-gate";
import { getCurrentAccessSession } from "@/lib/access-session";

export const dynamic = "force-dynamic";

export default async function WishlistTasksCompatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getCurrentAccessSession();

  if (!session || session.wishlistSlug !== slug || session.role !== "admin") {
    return <WishlistAccessGate slug={slug} />;
  }

  redirect("/tasks");
}
