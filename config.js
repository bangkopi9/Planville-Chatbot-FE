// ================================
// WATTSON — Global Config
// ================================
window.CONFIG = {
  // ✅ Backend base (HARUS http/https)
  BASE_API_URL: "https://web-production-53b70.up.railway.app",

  // 🌐 Kalender booking (opsional, dibuka setelah submit lead)
  CALENDAR_URL: "",

  // 🌏 Bahasa & analytics
  LANG_DEFAULT: "de",
  GTM_ID: "G-YL8ECJ5V17",

  // 🤖 Identitas bot
  BOT_NAME: "Wattson",
  BRAND: {
    title: "Wattson — Planville AI",
    // ikon yang sudah ada di repo (sesuai yang kamu sebut)
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
  STREAMING: true,                 // aktifkan streaming
  STREAM_TRANSPORT: "chunk",       // "chunk" | "sse"
  // default fetch untuk request AI
  FETCH_DEFAULTS: {
    cache: "no-store",
    keepalive: true
  },

  // 🔌 Endpoint map (dipakai helper & guardrails)
  ENDPOINTS: {
    chat: "/chat",
    chat_stream: "/chat/stream",
    lead: "/lead",
    track: "/track"
  },

  // 🛡️ Opsi untuk ai_guardrails_vlite.patched.js (URL rewrite allow/deny)
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
 * 🔗 Helper untuk membentuk URL API yang aman.
 * Pakai: fetch(_api("/lead"), {...})
 */
window._api = window._api || function(path = "") {
  try {
    const base = (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/,"");
    const p = String(path || "");
    return base + (p.startsWith("/") ? p : "/" + p);
  } catch (e) {
    return path; // fallback kalau ada error
  }
};

/** 🌐 Getter bahasa aktif (aman) */
window.getCurrentLang = window.getCurrentLang || function(){
  try {
    if (typeof langSwitcher !== "undefined" && langSwitcher && langSwitcher.value) {
      return langSwitcher.value;
    }
  } catch(e){}
  return window.CONFIG?.LANG_DEFAULT || "de";
};

/** 🧩 Title/helper kecil (opsional dipakai di header) */
(function syncBranding(){
  try{
    const t = window.CONFIG?.BRAND?.title || `${window.CONFIG?.BOT_NAME || "Chatbot"} — Planville`;
    if (document && document.title) document.title = t;
  }catch(_){}
})();
