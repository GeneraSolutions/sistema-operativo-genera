import type {
  ContentFormat,
  ContentNetwork,
  ContentObjective,
} from "@/lib/content";

export type LinkPreview = {
  url: string;
  platform: string;
  title: string;
  author: string;
  description: string;
  fetched: boolean;
  note: string;
};

export type LinkAnalysis = {
  audiovisual: string[];
  speech: string[];
  claims: string[];
  keep: string[];
  trends: string[];
  retention: string[];
  location: string;
  nextIdeas: string[];
  note: string;
  limited: boolean;
  piece: {
    title: string;
    hook: string;
    script: string;
    format: ContentFormat;
    network: ContentNetwork;
    durationSec: number;
    cta: string;
    objective: ContentObjective;
    location: string;
  };
};

const SOCIAL_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.watch",
  "x.com",
  "twitter.com",
  "linkedin.com",
];

function hostAllowed(host: string) {
  const h = host.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

function platformOf(host: string) {
  const h = host.toLowerCase();
  if (h.includes("youtube") || h.includes("youtu.be")) return "YouTube";
  if (h.includes("tiktok")) return "TikTok";
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("facebook") || h.includes("fb.")) return "Facebook";
  if (h.includes("linkedin")) return "LinkedIn";
  if (h === "x.com" || h.includes("twitter")) return "X";
  return host;
}

export function parsePublicVideoUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!hostAllowed(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return "";
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GeneraSolutionsBot/1.0; +https://www.generasolutions.com.co)",
        Accept: "application/json, text/html;q=0.9",
      },
    });
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 400_000 ? buf.slice(0, 400_000) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  const url = parsePublicVideoUrl(raw);
  if (!url) {
    return {
      url: raw.trim(),
      platform: "",
      title: "",
      author: "",
      description: "",
      fetched: false,
      note: "Pegue un enlace https de Instagram, TikTok, YouTube, Facebook o LinkedIn.",
    };
  }

  const href = url.toString();
  const platform = platformOf(url.hostname);
  const oembedCandidates = [
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(href)}`,
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(href)}`,
  ];

  for (const endpoint of oembedCandidates) {
    const body = await fetchText(endpoint);
    if (!body.startsWith("{")) continue;
    try {
      const json = JSON.parse(body) as {
        title?: string;
        author_name?: string;
        provider_name?: string;
      };
      if (json.title) {
        return {
          url: href,
          platform: json.provider_name || platform,
          title: json.title,
          author: json.author_name || "",
          description: "",
          fetched: true,
          note: "Metadatos públicos (oEmbed). Daniela no descarga el archivo del video.",
        };
      }
    } catch {
      /* siguiente */
    }
  }

  const html = await fetchText(href);
  const title =
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim();
  const description =
    meta(html, "og:description") || meta(html, "twitter:description");
  const author = meta(html, "og:site_name");

  if (title || description) {
    return {
      url: href,
      platform,
      title: decodeEntities(title),
      author,
      description: decodeEntities(description).slice(0, 500),
      fetched: true,
      note: "Título y descripción públicos. Para crítica fina, anoten qué se ve y qué se dice.",
    };
  }

  return {
    url: href,
    platform,
    title: "",
    author: "",
    description: "",
    fetched: false,
    note: "La red no dejó leer el enlace. Anoten debajo qué dice y qué se ve; Daniela trabaja con eso.",
  };
}

export function emptyAnalysisPiece(): LinkAnalysis["piece"] {
  return {
    title: "",
    hook: "",
    script: "",
    format: "reel",
    network: "instagram",
    durationSec: 30,
    cta: "",
    objective: "educar",
    location: "",
  };
}
