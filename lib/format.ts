export function formatPrice(priceCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}

export function parsePriceToCents(value: string | number) {
  const normalized =
    typeof value === "number" ? String(value) : value.trim().replace(/\./g, "").replace(",", ".");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function isRecent(createdAt: string, days = 7) {
  const created = new Date(createdAt).getTime();
  const maxAge = days * 24 * 60 * 60 * 1000;

  return Number.isFinite(created) && Date.now() - created <= maxAge;
}
