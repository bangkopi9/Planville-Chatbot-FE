// ===============================
// 🌍 Global Config (config.js)
// Last update: 2025-09-22
// ===============================
window.CONFIG = {
  // ===== Backend =====
  /** HARUS http/https TANPA slash di akhir */
  BASE_API_URL: "https://web-production-53b70.up.railway.app",

  // ===== Branding & UI =====
  CHATBOT_NAME: "Wattson",              // Nama yang dipakai di header & trigger
  CHATBOT_SHOW_COOKIE_BANNER: false,    // Cookie banner JANGAN tampil di dalam chatbot
  UI_FEEDBACK_ENABLED: false,           // Matikan 👍👎
  CHAT_VIRTUALIZE: true,                // Optimisasi render panjang (CSS content-visibility)
  AVATAR_ICON_PATH: "assets/wattson.svg", // Path ikon trigger (ubah jika perlu)

  // ===== Bahasa & Analytics =====
  LANG_DEFAULT: "de",
  GTM_ID: "G-YL8ECJ5V17",

  // ===== Streaming ke backend =====
  STREAMING: true,                      // aktifkan /chat/stream
  STREAM_TRANSPORT: "ndjson",           // "ndjson" | "sse" | "chunk" (fallback)
  STREAM_ABORT_ON_NEW_INPUT: true,      // abort stream lama saat user kirim pesan baru
  STREAM_TIMEOUT_MS: 60000,             // timeout fetch stream

  // ===== Booking (opsional) =====
  CALENDAR_URL: "",                     // iframe/modal setelah submit lead (kosongkan jika tidak dipakai)

  // ===== Misc =====
  RETRY_COUNT: 1,                       // retry ringan untuk request penting
  TRACK_ENDPOINT: "/track",             // relative ke BASE_API_URL
  LEAD_ENDPOINT: "/lead",               // relative ke BASE_API_URL
  CHAT_ENDPOINT: "/chat",               // non-stream fallback
  CHAT_STREAM_ENDPOINT: "/chat/stream"  // stream endpoint
};

/**
 * 🔗 API URL helper — aman terhadap slash ganda & path relatif.
 * Pakai: fetch(_api("/lead"), {...})
 */
window._api = function _api(path = "") {
  try {
    const base = (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/,"");
    const p = String(path || "");
    return base + (p.startsWith("/") ? p : "/" + p);
  } catch {
    return path; // fallback
  }
};

/**
 * (opsional) Headers helper — mudah untuk JSON POST.
 * Pakai: fetch(_api("/lead"), { method:"POST", headers:_jsonHeaders(), body: JSON.stringify(data) })
 */
window._jsonHeaders = function _jsonHeaders(extra = {}) {
  return Object.assign({ "Content-Type": "application/json" }, extra || {});
};

/** (opsional) Getter bahasa saat ini */
window.getCurrentLang = function getCurrentLang(){
  try {
    const el = document.getElementById("langSwitcher");
    if (el && el.value) return el.value;
  } catch {}
  return window.CONFIG?.LANG_DEFAULT || "de";
};
