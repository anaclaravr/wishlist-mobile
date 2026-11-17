import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { PublicError } from "@/lib/errors";

export const PRODUCT_CATEGORIES = ["Skincare", "Clothing", "Home", "Tech", "Books", "Other"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductDetails = {
  title: string;
  price: string;
  store: string;
  variant: string;
  category: ProductCategory | "";
  image: string;
};

const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;

/* ---------- helpers (também usados por /api/link-preview) ---------- */

export function parseHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }

    return url;
  } catch {
    throw new PublicError("Informe um link valido com http ou https.");
  }
}

function fromCodePoint(code: number) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

export function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMetaContent(html: string, name: string) {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*itemprop=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*itemprop=["']${name}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

export function getDocumentTitle(html: string) {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

export function normalizeImageUrl(baseUrl: URL, candidate: string | null) {
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizePrice(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value.toFixed(2) : null;
  }

  const cleaned = value.replace(/[^\d.,]/g, "").trim();

  if (!cleaned) {
    return null;
  }

  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (commaIndex > dotIndex) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dotIndex > commaIndex) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(",", ".");
  }

  const valueNumber = Number(normalized);

  if (!Number.isFinite(valueNumber) || valueNumber <= 0) {
    return null;
  }

  return valueNumber.toFixed(2);
}

/* ---------- fetch seguro ---------- */

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) {
    return isPrivateIPv4(ip);
  }

  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);

  if (mapped) {
    return isPrivateIPv4(mapped[1]);
  }

  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new PublicError("Esse link não pode ser lido.");
  }

  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new PublicError("Esse link não pode ser lido.");
  }
}

function pickCharset(contentType: string, head: Uint8Array) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];

  if (fromHeader) {
    return fromHeader;
  }

  const sniff = new TextDecoder("latin1").decode(head.slice(0, 4096));
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1] ?? "utf-8";
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    return new Uint8Array();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();

    if (done || !value) {
      break;
    }

    chunks.push(value);
    total += value.length;
  }

  await reader.cancel().catch(() => undefined);

  const out = new Uint8Array(Math.min(total, MAX_HTML_BYTES));
  let offset = 0;

  for (const chunk of chunks) {
    const slice = chunk.slice(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.length;

    if (offset >= out.length) {
      break;
    }
  }

  return out;
}

/** Baixa o HTML de uma página pública. Retorna null se a loja recusar ou não for HTML. */
export async function fetchProductHtml(start: URL) {
  let url = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url);

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        return null;
      }

      url = parseHttpUrl(new URL(location, url).toString());
      continue;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (!response.ok || !contentType.includes("html")) {
      return null;
    }

    const bytes = await readLimited(response);
    let html: string;

    try {
      html = new TextDecoder(pickCharset(contentType, bytes)).decode(bytes);
    } catch {
      html = new TextDecoder("utf-8").decode(bytes);
    }

    return { html, url };
  }

  return null;
}

/* ---------- JSON-LD ---------- */

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return decodeHtml(value);
  }
  if (typeof value === "number") {
    return String(value);
  }
  const obj = asObject(value);
  if (obj) {
    return text(obj.name ?? obj["@value"] ?? "");
  }
  if (Array.isArray(value)) {
    return text(value[0]);
  }
  return "";
}

function hasType(node: Json, type: string) {
  return asArray(node["@type"]).some((t) => typeof t === "string" && t.toLowerCase() === type);
}

function collectNodes(html: string) {
  const nodes: Json[] = [];
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  const walk = (value: unknown, depth: number) => {
    if (depth > 6) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    const obj = asObject(value);
    if (!obj) {
      return;
    }
    nodes.push(obj);
    if (obj["@graph"]) {
      walk(obj["@graph"], depth + 1);
    }
    if (obj.mainEntity) {
      walk(obj.mainEntity, depth + 1);
    }
  };

  for (const match of scripts) {
    try {
      walk(JSON.parse(match[1].trim()), 0);
    } catch {
      // JSON-LD inválido em algumas lojas: ignora o bloco.
    }
  }

  return nodes;
}

function offerPrice(offers: unknown): string | null {
  for (const entry of asArray(offers)) {
    const offer = asObject(entry);
    if (!offer) {
      continue;
    }
    const spec = asObject(asArray(offer.priceSpecification)[0]);
    const candidate =
      normalizePrice(offer.price as string | number | undefined) ??
      normalizePrice(offer.lowPrice as string | number | undefined) ??
      normalizePrice(spec?.price as string | number | undefined);
    if (candidate) {
      return candidate;
    }
    const nested = offerPrice(offer.offers);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function offerSeller(offers: unknown) {
  for (const entry of asArray(offers)) {
    const seller = text(asObject(entry)?.seller);
    if (seller) {
      return seller;
    }
  }
  return "";
}

function imageFrom(value: unknown): string | null {
  for (const entry of asArray(value)) {
    if (typeof entry === "string") {
      return entry;
    }
    const obj = asObject(entry);
    const url = obj?.url ?? obj?.contentUrl;
    if (typeof url === "string") {
      return url;
    }
  }
  return null;
}

/* ---------- categoria ---------- */

const CATEGORY_WORDS: Record<Exclude<ProductCategory, "Other">, string[]> = {
  Skincare: [
    "skincare", "skin care", "serum", "hidratante", "protetor solar", "filtro solar", "sunscreen",
    "moisturizer", "cleanser", "sabonete facial", "limpeza facial", "tonico", "toner", "retinol",
    "niacinamida", "acido hialuronico", "hyaluronic", "dermocosmetico", "beleza", "beauty",
    "maquiagem", "makeup", "batom", "base liquida", "perfume", "creme facial", "esfoliante",
  ],
  Clothing: [
    "camiseta", "camisa", "blusa", "vestido", "calca", "saia", "jaqueta", "casaco", "moletom",
    "tenis", "sapato", "sandalia", "bota", "bolsa", "roupa", "shirt", "t-shirt", "dress", "pants",
    "jeans", "jacket", "sneaker", "sneakers", "shoe", "shoes", "hoodie", "sweater", "moda",
    "fashion", "cropped", "short", "bermuda", "lingerie", "biquini", "pijama",
  ],
  Home: [
    "luminaria", "lamp", "pendant", "pendente", "sofa", "cadeira", "poltrona", "mesa", "almofada",
    "tapete", "cortina", "decoracao", "panela", "cozinha", "lencol", "toalha", "vaso", "furniture",
    "rug", "kitchen", "cushion", "quadro", "espelho", "prateleira", "estante", "jogo de cama",
    "edredom", "utensilio", "airfryer", "cafeteira", "organizador",
  ],
  Tech: [
    "fone", "headphone", "headphones", "earbuds", "celular", "smartphone", "iphone", "notebook",
    "laptop", "tablet", "ipad", "monitor", "teclado", "keyboard", "mouse", "camera", "smartwatch",
    "kindle", "console", "playstation", "xbox", "nintendo", "carregador", "charger", "speaker",
    "caixa de som", "eletronico", "eletronicos", "electronics", "ssd", "airpods", "galaxy",
    "macbook", "bluetooth", "usb",
  ],
  Books: [
    "livro", "livros", "book", "books", "romance", "capa comum", "capa dura", "paperback",
    "hardcover", "editora", "ebook", "e-book", "literatura", "isbn",
  ],
};

function normalizeWords(value: string) {
  return ` ${value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")} `;
}

export function guessCategory(...sources: string[]): ProductCategory | "" {
  const haystack = normalizeWords(sources.filter(Boolean).join(" "));
  let best: ProductCategory | "" = "";
  let bestScore = 0;

  for (const [category, words] of Object.entries(CATEGORY_WORDS)) {
    const score = words.reduce(
      (sum, word) => sum + (haystack.includes(` ${word} `) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      best = category as ProductCategory;
      bestScore = score;
    }
  }

  return best;
}

/* ---------- extração ---------- */

function cleanTitle(title: string, store: string) {
  let out = title.trim();

  if (store) {
    const pattern = new RegExp(
      `\\s*[|\\-–—:]\\s*${store.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`,
      "i",
    );
    out = out.replace(pattern, "").trim();
  }

  return out.slice(0, 200);
}

function priceFromText(html: string) {
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const match = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/.exec(decodeHtml(visible));
  return match ? normalizePrice(match[1]) : null;
}

const GENERIC_TITLES = new Set([
  "products", "produtos", "produto", "home", "inicio", "pagina inicial", "just a moment",
  "access denied", "acesso negado", "robot check", "attention required", "page not found",
  "pagina nao encontrada", "404", "erro", "error",
]);

function plain(value: string) {
  return normalizeWords(value).trim().replace(/-/g, " ");
}

function isGenericTitle(title: string, store: string, pageUrl: URL) {
  const t = plain(title);
  const hostName = plain(pageUrl.hostname.replace(/^www\./, "").replace(/\./g, " "));
  const brandName = plain(pageUrl.hostname.replace(/^www\./, "").split(".")[0] ?? "");
  return !t || GENERIC_TITLES.has(t) || t === plain(store) || t === hostName || t === brandName;
}

export type ProductPage = { details: ProductDetails; confident: boolean };

export function extractProductPage(html: string, pageUrl: URL): ProductPage {
  const nodes = collectNodes(html);
  const product =
    nodes.find((node) => hasType(node, "product")) ??
    nodes.find((node) => hasType(node, "productgroup")) ??
    null;
  const variantNode = product && hasType(product, "productgroup")
    ? asObject(asArray(product.hasVariant)[0])
    : null;
  const breadcrumb = nodes.find((node) => hasType(node, "breadcrumblist"));
  const crumbs = asArray(breadcrumb?.itemListElement)
    .map((entry) => text(asObject(entry)?.name ?? asObject(asObject(entry)?.item)?.name))
    .filter(Boolean)
    .join(" ");

  const siteName =
    getMetaContent(html, "og:site_name") ??
    text(nodes.find((node) => hasType(node, "website") || hasType(node, "organization"))?.name);
  const brand = text(product?.brand);
  const store = (siteName || offerSeller(product?.offers) || brand || "").slice(0, 80);

  const rawTitle =
    text(product?.name) ||
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title") ||
    getDocumentTitle(html) ||
    "";
  const title = cleanTitle(rawTitle, store);

  const structuredPrice =
    offerPrice(product?.offers) ??
    offerPrice(variantNode?.offers) ??
    normalizePrice(getMetaContent(html, "product:price:amount")) ??
    normalizePrice(getMetaContent(html, "og:price:amount")) ??
    normalizePrice(getMetaContent(html, "price")) ??
    normalizePrice(getMetaContent(html, "price:amount"));
  const isProductPage =
    Boolean(product) || /product/i.test(getMetaContent(html, "og:type") ?? "") || Boolean(structuredPrice);
  // Preço achado no texto só vale em página de produto; numa home ele pega qualquer oferta.
  const price = structuredPrice ?? (isProductPage ? priceFromText(html) : null) ?? "";

  const variant = [text(product?.size ?? variantNode?.size), text(product?.color ?? variantNode?.color)]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 80);

  const image =
    normalizeImageUrl(
      pageUrl,
      imageFrom(product?.image) ??
        getMetaContent(html, "og:image") ??
        getMetaContent(html, "twitter:image") ??
        getMetaContent(html, "image"),
    ) ?? "";

  const category = guessCategory(
    text(product?.category),
    crumbs,
    title,
    getMetaContent(html, "description") ?? "",
  );

  const isHome = pageUrl.pathname.replace(/\/+$/, "") === "";
  const confident =
    !isGenericTitle(title, store, pageUrl) && (isProductPage || (!isHome && Boolean(image)));

  return { details: { title, price, store, variant, category, image }, confident };
}

export function extractProductDetails(html: string, pageUrl: URL): ProductDetails {
  return extractProductPage(html, pageUrl).details;
}

/** Lê uma página de produto. Retorna null quando a loja bloqueia ou a página não parece de produto. */
export async function readProductDetails(url: URL): Promise<ProductDetails | null> {
  const page = await fetchProductHtml(url);

  if (!page) {
    return null;
  }

  const { details, confident } = extractProductPage(page.html, page.url);
  return confident ? details : null;
}
