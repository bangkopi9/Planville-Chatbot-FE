// ===============================
// 🌍 Global Config (config.js)
// Last update: 2025-09-23
// ===============================
(function () {
  "use strict";

  window.CONFIG = {
    // ===== Backend =====
    /** HARUS http/https TANPA slash di akhir */
    BASE_API_URL: "https://web-production-53b70.up.railway.app",

    // ===== Branding & UI =====
    CHATBOT_NAME: "Wattson",                // Nama di header & trigger
    CHATBOT_SHOW_COOKIE_BANNER: false,      // Jangan tampilkan cookie banner di widget
    UI_FEEDBACK_ENABLED: false,             // Matikan 👍👎 dalam widget
    CHAT_VIRTUALIZE: true,                  // Optimisasi render panjang (CSS content-visibility)
    AVATAR_ICON_PATH: "wattson.svg",        // <-- semua file di root

    // A/B testing (opsional)
    /** "", "A", atau "B" — kalau kosong, random & disimpan di localStorage */
    AB_FORCE_VARIANT: "",

    // ===== Bahasa & Analytics =====
    LANG_DEFAULT: "de",
    GTM_ID: "G-YL8ECJ5V17",

    // ===== Streaming ke backend =====
    /** Catatan: Chatbot 2025-09-23 pakai NDJSON stream + fallback non-stream */
    STREAMING: true,                         // aktifkan /chat/stream
    STREAM_TRANSPORT: "ndjson",              // "ndjson" | "sse" | "chunk" (fallback)
    STREAM_ABORT_ON_NEW_INPUT: true,         // abort stream lama saat user kirim pesan baru

    // Timeouts & heartbeat (sinkron dengan script chatbot terbaru)
    REQUEST_TIMEOUT_MS: 20000,               // hard-timeout per request (ms)
    SSE_HEARTBEAT_MS: 15000,                 // watchdog: bila 2× interval tanpa data → abort agar auto-retry
    STREAM_TIMEOUT_MS: 60000,                // legacy/opsional

    // Auto-retry ringan (dipakai di askAIStream & withRetry)
    RETRY: {
      MAX_TRIES: 2,                          // total percobaan (1 utama + 1 retry)
      BASE_DELAY_MS: 800                     // backoff dasar (ms); delay = BASE_DELAY_MS * attempt
    },

    // ===== Booking (opsional) =====
    CALENDAR_URL: "",                        // iframe/modal setelah submit lead (kosongkan jika tidak dipakai)

    // ===== Endpoints (relative ke BASE_API_URL) =====
    TRACK_ENDPOINT: "/track",
    LEAD_ENDPOINT: "/lead",
    CHAT_ENDPOINT: "/chat",                  // non-stream fallback
    CHAT_STREAM_ENDPOINT: "/chat/stream",    // endpoint streaming

    // ===== Guardrails (rewriter) =====
    /** Allow/Deny berupa array string RegExp (tanpa delimiter /…/). */
    API_REWRITE_ALLOW: [
      "^(?:ai)(?:/|$)",
      "^(?:chat)(?:/|$)",
      "^(?:lead)(?:/|$)",
      "^(?:track)(?:/|$)"
    ],
    API_REWRITE_DENY: [
      "^(?:assets|img|images|static|public)/",
      "\\.svg(?:\\?|#|$)", "\\.png(?:\\?|#|$)", "\\.jpg(?:\\?|#|$)", "\\.jpeg(?:\\?|#|$)", "\\.webp(?:\\?|#|$)", "\\.ico(?:\\?|#|$)",
      "\\.css(?:\\?|#|$)", "\\.js(?:\\?|#|$)", "\\.map(?:\\?|#|$)",
      "^(?:manifest\\.json|site\\.webmanifest)(?:\\?|#|$)"
    ],
    API_REWRITE_DEBUG: false,                // true → log rewrite di console

    // ===== Feature flags (opsional) =====
    ENABLE_GUARDRAILS: true                  // gampang matiin/nyalain via ENV
  };

  /**
   * 🔗 API URL helper — aman terhadap slash ganda & path relatif.
   * Pakai: fetch(_api(CONFIG.LEAD_ENDPOINT), {...})
   */
  window._api = function _api(path = "") {
    try {
      const base = (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/, "");
      const p = String(path || "");
      return base + (p.startsWith("/") ? p : "/" + p);
    } catch {
      return path; // fallback
    }
  };

  /** (opsional) Base URL getter (dipakai guardrails patched) */
  window._baseURL = function _baseURL() {
    try {
      return (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/, "");
    } catch { return ""; }
  };

  /**
   * (opsional) Headers helper — mudah untuk JSON POST.
   * Pakai: fetch(_api(CONFIG.LEAD_ENDPOINT), { method:"POST", headers:_jsonHeaders(), body: JSON.stringify(data) })
   */
  window._jsonHeaders = function _jsonHeaders(extra = {}) {
    return Object.assign({ "Content-Type": "application/json" }, extra || {});
  };

  /** (opsional) Getter bahasa saat ini */
  window.getCurrentLang = function getCurrentLang() {
    try {
      const el = document.getElementById("langSwitcher");
      if (el && el.value) return el.value;
    } catch {}
    return window.CONFIG?.LANG_DEFAULT || "de";
  };

  /** A/B variant sticky (hormati AB_FORCE_VARIANT) */
  (function ensureABVariant() {
    try {
      const forced = (window.CONFIG?.AB_FORCE_VARIANT || "").toUpperCase();
      if (forced === "A" || forced === "B") {
        localStorage.setItem("ab_variant", forced);
        return;
      }
      let v = localStorage.getItem("ab_variant");
      if (!v) {
        v = Math.random() < 0.5 ? "A" : "B";
        localStorage.setItem("ab_variant", v);
      }
    } catch {}
  })();

})();
