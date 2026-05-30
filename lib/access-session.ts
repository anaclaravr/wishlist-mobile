import { cookies } from "next/headers";

import { ACCESS_COOKIE_NAME, type AccessRole } from "@/lib/access";
import { getAccessSessionFromToken } from "@/lib/access-db";
import { PublicError } from "@/lib/errors";
import { hasPermission, type PermissionKey } from "@/lib/rbac";

export async function getCurrentAccessSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return getAccessSessionFromToken(sessionToken);
}

export async function requireAccessSession(input: {
  slug?: string;
  role?: AccessRole;
  permission?: PermissionKey;
}) {
  const session = await getCurrentAccessSession();

  if (!session) {
    throw new PublicError("Acesso nao autenticado.", 401);
  }

  if (input.slug && input.slug !== session.wishlistSlug) {
    throw new PublicError("Sessao valida para outra wishlist.", 403);
  }

  if (input.role && session.role !== input.role) {
    throw new PublicError("Permissao insuficiente para esta acao.", 403);
  }

  if (input.permission && !hasPermission(session.role, input.permission)) {
    throw new PublicError("Permissao insuficiente para esta acao.", 403);
  }

  return session;
}
