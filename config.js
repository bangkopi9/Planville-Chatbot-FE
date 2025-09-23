// 🌍 Global Config for Deployment & Local Testing
window.CONFIG = {
  // ✅ Backend Railway (HARUS http/https)
  BASE_API_URL: "https://web-production-53b70.up.railway.app",

  // 🌐 Optional: kalender booking (iframe/modal setelah lead submit)
  CALENDAR_URL: "",

  // 🌏 Default language & analytics
  LANG_DEFAULT: "de",
  GTM_ID: "G-YL8ECJ5V17",

  // 🔴 Streaming ke backend (kalau /chat/stream dipakai)
  STREAMING: true,
  STREAM_TRANSPORT: "chunk" // "chunk" | "sse"
};

/**
 * 🔗 Helper untuk membentuk URL API yang aman.
 * Pakai: fetch(_api("/lead"), {...})
 */
window._api = function(path = "") {
  try {
    const base = (window.CONFIG?.BASE_API_URL || "").replace(/\/+$/,"");
    const p = String(path || "");
    return base + (p.startsWith("/") ? p : "/" + p);
  } catch (e) {
    return path; // fallback kalau ada error
  }
};

/** (opsional) Getter bahasa saat ini */
window.getCurrentLang = function(){
  try {
    if (typeof langSwitcher !== "undefined" && langSwitcher.value) return langSwitcher.value;
  } catch(e){}
  return window.CONFIG.LANG_DEFAULT || "de";
};
