// ================================
// WATTSON — Global Config (FINAL)
// Same-origin: BASE_API_URL kosong → /chat,/lead lewat vercel.json
// ================================
window.CONFIG = {
  // ✅ Backend base (biarkan kosong agar lewat rewrites Vercel)
  BASE_API_URL: "",

  // 🌐 Kalender booking (opsional)
  CALENDAR_URL: "",

  // 🌏 Bahasa & analytics
  LANG_DEFAULT: "de",
  GTM_ID: "G-YL8ECJ5V17",

  // 🤖 Identitas bot & aset
  BOT_NAME: "Wattson",
  BRAND: {
    title: "Wattson — Planville AI",
    logo_svg: "wattson.svg",
    icon_192: "wattson-192.png",
    icon_512: "wattson-512.png",
    maskable_192: "wattson-maskable-192.png",
    maskable_512: "wattson-maskable-512.png"
  },

  // 🧪 Fitur UI
  FEATURES: {
    cookie_banner: false,  // cookie banner dihapus
    rating_ui: false,      // 👍👎 dihapus
    streaming: true
  },

  // ⚡ Streaming
  STREAMING: true,
  STREAM_TRANSPORT: "chunk", // "chunk" | "sse"
  FETCH_DEFAULTS: {
    cache: "no-store",
    keepalive: true
  },

  // 🔌 Endpoint map (digabung dengan _api())
  ENDPOINTS: {
    chat: "/chat",
    chat_stream: "/chat/stream",
    lead: "/lead",
    track: "/track"
  },

  // 🛡️ Opsi rewrite guard (dipakai patched guardrails)
  API_REWRITE_ALLOW: [
    "^/?(ai)(/|$)",
    "^/?(chat)(/|$)",
    "^/?(lead)(/|$)",
    "^/?(track)(/|$)"
  ],
  API_REWRITE_DENY: [
    "^/?(assets|static|img|images|icons)(/|$)"
  ]
};

/**
 * 🔗 Helper URL API aman.
 * Pakai: fetch(_api("/lead"), {...})
 * - Jika BASE_API_URL kosong → hasil "/lead" (same-origin; lewat vercel.json)
 * - Jika diisi http(s) → hasil "https://host/lead"
 */
window._api = window._api || function(path = "") {
  try {
    const base = (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/, "");
    const p = String(path || "");
    return base
      ? base + (p.startsWith("/") ? p : "/" + p)
      : (p.startsWith("/") ? p : "/" + p);
  } catch {
    return path;
  }
};

/** 🌐 Getter bahasa aktif (aman) */
window.getCurrentLang = window.getCurrentLang || function(){
  try {
    if (typeof langSwitcher !== "undefined" && langSwitcher && langSwitcher.value) {
      return langSwitcher.value;
    }
  } catch {}
  return window.CONFIG?.LANG_DEFAULT || "de";
};

/** 🧩 Sinkron judul halaman dengan brand */
(function syncBranding(){
  try{
    const t = window.CONFIG?.BRAND?.title || `${window.CONFIG?.BOT_NAME || "Chatbot"} — Planville`;
    if (document && document.title) document.title = t;
  }catch{}
})();
