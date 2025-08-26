// js/ai_guardrails_vlite.js
// AI Q&A ringan: singkat, relevan, dan tetap selaras dengan funnel.
// - Tanpa "Quellen".
// - Fallback otomatis ke /chat jika /ai/answer tidak ada.
// - Setelah menjawab, bisa auto-lanjut ke step funnel berikutnya.

(function(){
  function sanitizeText(s) {
    try {
      // biar aman: potong panjang & strip script tag
      s = String(s || "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
      // batasi ~700 karakter biar ringkas
      if (s.length > 700) s = s.slice(0, 700) + " …";
      return s.trim();
    } catch(_) { return ""; }
  }

  async function callHTTP(endpoint, body) {
    const url = (typeof _baseURL === "function" ? _baseURL() : "") + endpoint;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body || {})
    });
    return res;
  }

  async function ask(message, lang) {
    const payload = { message, lang, max_sentences: 2, concise: true };

    // 1) coba /ai/answer
    try {
      const r = await callHTTP("/ai/answer", payload);
      if (r.ok) {
        const data = await r.json();
        let txt = data.answer || data.reply || "";
        txt = sanitizeText(txt);
        if (!txt) throw new Error("empty");
        return { text: txt, conf: data.confidence ?? null };
      }
    } catch(_) {}

    // 2) fallback /chat
    try {
      const r2 = await callHTTP("/chat", { message, lang });
      if (r2.ok) {
        const data2 = await r2.json();
        let txt2 = data2.answer || data2.reply || "";
        txt2 = sanitizeText(txt2);
        if (!txt2) throw new Error("empty2");
        return { text: txt2, conf: null };
      }
    } catch(_) {}

    // 3) fallback statis
    const alt = lang === "en"
      ? "Sorry, I don’t have enough info for that. Would you like to continue with a quick configuration?"
      : "Dazu habe ich gerade keine gesicherten Infos. Möchtest du mit einer kurzen Konfiguration fortfahren?";
    return { text: alt, conf: null };
  }

  function maybeContinueFunnel() {
    try {
      const f = window.Funnel && window.Funnel.state;
      if (!f || !f.product) return;                          // belum ada funnel
      if (document.getElementById("lead-contact-form-chat")) return; // sudah di form kontak
      if (document.querySelector(".quick-group")) return;    // masih ada pertanyaan aktif
      if (typeof window.askNext === "function") window.askNext();    // lanjut 1 step
    } catch(_) {}
  }

  // Expose
  window.AIGuard = {
    ask,
    maybeContinueFunnel
  };
})();
