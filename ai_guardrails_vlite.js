// Lightweight AI guard + turn limiter
// - Hard-stop setelah 10 tanya-jawab (Q/A) -> arahkan ke langkah "timeline" + form
// - Tidak fallback ke /chat ketika limit tercapai (mengirim {stop:true})
// - Bahasa mengikuti langSwitcher

(function(global){
  const AIGuard = {};
  let turns = 0;
  const MAX_QA_TURNS = 10;

  function getLang(){
    try { return document.getElementById("langSwitcher").value || "de"; }
    catch(_) { return (global.CONFIG?.LANG_DEFAULT || "de"); }
  }

  // gunakan apiURL() dari index.html kalau ada (sudah auto-rewrite via patchFetch juga)
  function _api(path){
    if (typeof global.apiURL === "function") return global.apiURL(path);
    const base = (global.CONFIG?.BASE_API_URL || "").replace(/\/$/,"");
    return base ? `${base}${path}` : path;
  }

  const SAFE_FALLBACK = {
    de: "Dazu habe ich keine gesicherte Information. Ich kann dich gern mit unserem Team verbinden oder dir mit dem Konfigurator helfen.",
    en: "I don't have verified information on that. I can connect you with our team or help you proceed with the configurator."
  };

  // Call backend /ai/answer jika ada, kalau gagal -> null (chatbot.js boleh fallback ke /chat KALAU belum limit)
  async function tryAiEndpoint(question, lang){
    try {
      const res = await fetch(_api("/ai/answer"), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message: question, lang })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data.text === "string" && data.text.trim()) {
        return { text: data.text.trim() };
      }
      return null;
    } catch(_) { return null; }
  }

  // ====== PUBLIC: panggil dari chatbot.js ======
  AIGuard.ask = async (question, lang) => {
    lang = lang || getLang();

    // stop setelah MAX_QA_TURNS → tampilkan instruksi & arahkan ke langkah timeline+form
    if (turns >= MAX_QA_TURNS) {
      const msg = (lang==="de")
        ? "Damit wir dich konkret beraten können, wähle bitte deinen Zeitraum – danach erfassen wir kurz deine Kontaktdaten."
        : "To help you concretely, please choose your timeline – then we’ll quickly collect your contact details.";

      // tampilkan pesan pendek
      global.appendMessage?.(msg, "bot");

      // kalau funnel sudah aktif → langsung munculkan langkah timeline (tombol 0–3 / 3–6 / 6–12)
      if (typeof global.askContact === "function") {
        global.askContact();           // fungsi global dari chatbot.js yang menanyakan 'timeline'
      }

      // beri sinyal ke chatbot.js untuk TIDAK fallback ke /chat dan TIDAK menambahkan balasan lagi
      return { stop: true };
    }

    // belum mencapai limit → coba endpoint AI ringan
    const ai = await tryAiEndpoint(question, lang);
    turns += 1;

    if (ai && ai.text) return { text: ai.text };

    // fallback aman (tetap hitung sebagai satu turn)
    return { text: SAFE_FALLBACK[lang] || SAFE_FALLBACK.de };
  };

  // optional util
  AIGuard.reset = () => { turns = 0; };
  AIGuard.turns = () => turns;

  // Tidak auto-continue apa-apa di sini; funnel lanjut via tombol/askNext dkk.
  AIGuard.maybeContinueFunnel = () => {};

  global.AIGuard = AIGuard;
})(window);
