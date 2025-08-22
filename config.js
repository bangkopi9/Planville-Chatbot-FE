// 🌍 Global Config for Deployment & Local Testing
const CONFIG = {
  // ✅ Pakai URL Railway-mu (HARUS pakai skema http/https)
  BASE_API_URL: "https://web-production-53b70.up.railway.app",

  // 🌐 Optional: kalender booking (iframe/modal setelah lead submit)
  // Misal: "https://calendly.com/planville/beratung-30min"
  CALENDAR_URL: "",

  LANG_DEFAULT: "de",
  GTM_ID: "G-YL8ECJ5V17",

  // 🔴 Streaming ke backend (kalau /chat/stream dipakai)
  STREAMING: true,
  STREAM_TRANSPORT: "chunk" // "chunk" | "sse"
};
