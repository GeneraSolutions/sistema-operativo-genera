import type {
  ContentFormat,
  ContentNetwork,
  ContentObjective,
} from "@/lib/content";

export type SpokenSource =
  | "subtitulos-youtube"
  | "voz-whisper"
  | "texto-del-post"
  | "";

export type LinkPreview = {
  url: string;
  platform: string;
  title: string;
  author: string;
  description: string;
  fetched: boolean;
  note: string;
  spokenText: string;
  spokenSource: SpokenSource;
  mediaUrl: string;
};

export const SPOKEN_SOURCE_LABELS: Record<Exclude<SpokenSource, "">, string> = {
  "subtitulos-youtube": "Subtítulos del video (YouTube)",
  "voz-whisper": "Voz a texto automática",
  "texto-del-post": "Texto público del post",
};

export type LinkAnalysis = {
  audiovisual: string[];
  speech: string[];
  claims: string[];
  keep: string[];
  saidSummary: string;
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

const MEDIA_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "googlevideo.com",
  "gvt1.com",
];

const emptyPreview = (): LinkPreview => ({
  url: "",
  platform: "",
  title: "",
  author: "",
  description: "",
  fetched: false,
  note: "",
  spokenText: "",
  spokenSource: "",
  mediaUrl: "",
});

function hostMatches(host: string, allowed: string[]) {
  const h = host.toLowerCase().replace(/^www\./, "");
  return allowed.some((d) => h === d || h.endsWith(`.${d}`));
}

function hostAllowed(host: string) {
  return hostMatches(host, SOCIAL_HOSTS);
}

export function mediaHostAllowed(host: string) {
  return hostMatches(host, MEDIA_HOSTS);
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

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id || null;
  }
  const v = url.searchParams.get("v");
  if (v) return v;
  const m = url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/);
  return m?.[1] || null;
}

function parseCaptionXml(xml: string): string {
  const bits = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((m) =>
    decodeEntities(
      m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    )
  );
  return bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function extractJsonArray(html: string, key: string): string {
  const needle = `"${key}":`;
  const start = html.indexOf(needle);
  if (start < 0) return "";
  const i = html.indexOf("[", start);
  if (i < 0) return "";
  let depth = 0;
  const max = Math.min(html.length, i + 80_000);
  for (let j = i; j < max; j++) {
    const c = html[j];
    if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return html.slice(i, j + 1);
    }
  }
  return "";
}

function pickCaptionTrack(json: string): string {
  try {
    const tracks = JSON.parse(json) as {
      baseUrl?: string;
      languageCode?: string;
      kind?: string;
    }[];
    if (!Array.isArray(tracks)) return "";
    const score = (t: (typeof tracks)[0]) => {
      const lang = (t.languageCode || "").toLowerCase();
      const asr = t.kind === "asr" ? 2 : 0;
      if (lang.startsWith("es")) return 10 + asr;
      if (lang.startsWith("en")) return 3 + asr;
      return asr;
    };
    const best = [...tracks].sort((a, b) => score(b) - score(a))[0];
    return best?.baseUrl || "";
  } catch {
    return "";
  }
}

async function youtubeSpokenText(videoId: string): Promise<string> {
  const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
  const blob = extractJsonArray(html, "captionTracks");
  const trackUrl = blob ? pickCaptionTrack(blob) : "";
  if (!trackUrl) return "";
  const join = trackUrl.includes("?") ? "&" : "?";
  const xml = await fetchText(`${trackUrl}${join}fmt=srv3`);
  return parseCaptionXml(xml).slice(0, 8000);
}

function jsonLdCaption(html: string): string {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!blocks) return "";
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "");
    try {
      const data = JSON.parse(inner) as {
        caption?: string;
        description?: string;
        name?: string;
      };
      const text = String(data.caption || data.description || "").trim();
      if (text.length > 40) return decodeEntities(text);
    } catch {
      /* siguiente */
    }
  }
  return "";
}

function firstMediaUrl(...candidates: string[]) {
  for (const raw of candidates) {
    const value = decodeEntities(raw).replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    if (!value.startsWith("http")) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") continue;
      if (!mediaHostAllowed(url.hostname)) continue;
      if (url.pathname.endsWith(".m3u8")) continue;
      return url.toString();
    } catch {
      /* siguiente */
    }
  }
  return "";
}

export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  const url = parsePublicVideoUrl(raw);
  if (!url) {
    return {
      ...emptyPreview(),
      url: raw.trim(),
      note: "Pegue un enlace https de Instagram, TikTok, YouTube, Facebook o LinkedIn.",
    };
  }

  const href = url.toString();
  const platform = platformOf(url.hostname);
  const preview: LinkPreview = {
    ...emptyPreview(),
    url: href,
    platform,
  };

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
        thumbnail_url?: string;
      };
      if (json.title) {
        preview.platform = json.provider_name || platform;
        preview.title = json.title;
        preview.author = json.author_name || "";
        preview.fetched = true;
        if (platform === "TikTok" && json.title.length > 20) {
          preview.spokenText = json.title.slice(0, 8000);
          preview.spokenSource = "texto-del-post";
        }
      }
    } catch {
      /* siguiente */
    }
  }

  const html = await fetchText(href);
  if (html) {
    preview.title =
      preview.title ||
      meta(html, "og:title") ||
      meta(html, "twitter:title") ||
      decodeEntities(
        (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim()
      );
    preview.description =
      preview.description ||
      meta(html, "og:description") ||
      meta(html, "twitter:description");
    preview.author = preview.author || meta(html, "og:site_name");
    preview.mediaUrl = firstMediaUrl(
      meta(html, "og:video:secure_url"),
      meta(html, "og:video:url"),
      meta(html, "og:video")
    );
    const caption = jsonLdCaption(html) || preview.description;
    if (!preview.spokenText && caption.length > 40) {
      preview.spokenText = caption.slice(0, 8000);
      preview.spokenSource = "texto-del-post";
    }
    if (preview.title || preview.description || preview.mediaUrl) {
      preview.fetched = true;
    }
  }

  const yt = youtubeId(url);
  if (yt) {
    const captions = await youtubeSpokenText(yt);
    if (captions.length > 20) {
      preview.spokenText = captions;
      preview.spokenSource = "subtitulos-youtube";
      preview.fetched = true;
    }
  }

  if (preview.spokenSource === "subtitulos-youtube") {
    preview.note = "Daniela leyó los subtítulos del video. No transcriban nada.";
  } else if (preview.mediaUrl) {
    preview.note = "Hay audio público: Daniela pasa voz a texto sola.";
  } else if (preview.spokenSource === "texto-del-post") {
    preview.note =
      "La red no suelta el audio; Daniela usa el texto del post (suele ser lo que dicen).";
  } else if (preview.fetched) {
    preview.note = "La red bloqueó el audio. Peguen YouTube si pueden, o un Reel que deje leerse.";
  } else {
    preview.note = "La red no dejó leer el enlace.";
  }

  preview.description = preview.description.slice(0, 500);
  return preview;
}

export type PublicLinkPreview = ReturnType<typeof publicLinkPreview>;

export function publicLinkPreview(preview: LinkPreview) {
  const { spokenText, mediaUrl: _m, ...rest } = preview;
  return {
    ...rest,
    spokenChars: spokenText.length,
    spokenPreview: spokenText.slice(0, 220),
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
