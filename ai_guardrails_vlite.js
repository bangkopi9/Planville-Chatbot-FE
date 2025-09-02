// Lightweight AI guard + turn limiter + prompt + direct-to-form fallback
(function (global) {
  const AIGuard = {};
  let turns = 0;
  const MAX_QA_TURNS = 10;
  const RESPONSE_MIN_CHARS = 12; // anti-kosong

  // safe API helper
  const API = (p) => (typeof global._api === "function" ? global._api(p) : p);

  function getLang() {
    try { return document.getElementById("langSwitcher").value || "de"; }
    catch (_) { return "de"; }
  }

  const TXT = {
    de: {
      fallback: "Dazu habe ich keine gesicherte Information.",
      toForm: "Damit wir dir schnell helfen können, trag bitte unten kurz deine Kontaktdaten ein – wir melden uns zeitnah.",
      turnCap: "Wir haben schon vieles geklärt. Trag bitte unten kurz deine Kontaktdaten ein, dann melden wir uns mit einer konkreten Einschätzung."
    },
    en: {
      fallback: "I don't have verified information on that.",
      toForm: "To help you quickly, please leave your contact details below — our team will reach out shortly.",
      turnCap: "We’ve covered a lot already. Please leave your contact details below and we’ll follow up with a concrete assessment."
    }
  };

  // ===== Prompt pack: selalu akhiri 1 pertanyaan follow-up
  function buildSystemPrompt(lang) {
    const L = (lang === "en") ? "English" : "German";
    return [
      `You are Planville's assistant. Reply in ${L}.`,
      "Goals:",
      "1) Be concise and correct; use only provided context or widely-known basics.",
      "2) Always end with ONE short follow-up question to advance the product funnel (next missing slot).",
      "3) If unsure, respond EXACTLY with __LOW_CONFIDENCE__.",
      "No firm prices/timelines; no installation/safety instructions."
    ].join("\n");
  }

  // ===== utils
  AIGuard.reset = () => { turns = 0; };

  const okText = (s) => {
    if (typeof s !== "string") return null;
    const t = s.trim();
    if (!t) return null;
    if (t === "__LOW_CONFIDENCE__") return "__LOW_CONFIDENCE__";
    return (t.length >= RESPONSE_MIN_CHARS) ? t : null;
  };

  function getHistory(n = 6) {
    try {
      const hist = (global.chatHistory || []).slice(-n);
      return hist.map(h => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: String(h.message || "")
      }));
    } catch (_) { return []; }
  }

  function getFunnelHint() {
    const f = (global.Funnel && global.Funnel.state) ? global.Funnel.state : {};
    return { product: f.product || null, slots: f.data || {} };
  }

  function getProductLabel(lang) {
    if (global.Funnel?.state?.productLabel) return global.Funnel.state.productLabel;
    const sel = document.querySelector(".product-button.selected");
    if (sel) return sel.textContent.trim();
    return (lang === "en") ? "Photovoltaic" : "Photovoltaik";
  }

  function openFormNow(lang) {
    const L = TXT[lang] || TXT.de;

    // tampilkan summary jika ada data funnel
    try {
      const qualification = global.Funnel?.state?.data || null;
      if (qualification && typeof global.showSummaryFromFunnel === "function") {
        global.showSummaryFromFunnel(qualification);
      }
    } catch (_) {}

    // pesan pengantar → arahkan langsung ke form
    appendMessage?.(`${L.fallback} ${L.toForm}`, "bot");

    const productLabel = getProductLabel(lang);
    const qualification = global.Funnel?.state?.data ? { ...global.Funnel.state.data } : {};

    if (typeof global.injectLeadContactFormChat === "function") {
      global.injectLeadContactFormChat(productLabel, qualification);
    } else if (typeof global.askContact === "function") {
      // fallback terakhir kalau fungsi form belum ada (harusnya ada)
      global.askContact();
    } else {
      // last-resort: link
      appendMessage?.(
        lang === "de"
          ? 'Oder nutze <a class="cta-button" href="https://planville.de/kontakt" target="_blank" rel="noopener">Jetzt Kontakt aufnehmen</a>.'
          : 'Or use <a class="cta-button" href="https://planville.de/kontakt" target="_blank" rel="noopener">Contact us</a>.',
        "bot"
      );
    }
  }

  // ===== panggil RAG
  async function askRAG(question, lang) {
    try {
      const res = await fetch(API("/ai/answer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          lang,
          system: buildSystemPrompt(lang),
          history: getHistory(),
          funnel_hint: getFunnelHint()
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.low_confidence === true) return "__LOW_CONFIDENCE__";
      return okText(data?.text);
    } catch (_) { return null; }
  }

  // ===== fallback ke /chat
  async function askChat(question, lang) {
    try {
      const res = await fetch(API("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          lang,
          system: buildSystemPrompt(lang),
          history: getHistory(),
          funnel_hint: getFunnelHint()
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return okText(data?.answer ?? data?.reply);
    } catch (_) { return null; }
  }

  // ===== main
  AIGuard.ask = async (question, lang) => {
    lang = lang || getLang();

    // Stop setelah 10 tektokan → langsung ke form
    if (turns >= MAX_QA_TURNS) {
      appendMessage?.((TXT[lang] || TXT.de).turnCap, "bot");
      openFormNow(lang);
      return { stop: true };
    }

    // 1) coba RAG
    let txt = await askRAG(question, lang);
    if (txt === "__LOW_CONFIDENCE__") txt = null;

    // 2) coba /chat
    if (!txt) txt = await askChat(question, lang);

    // 3) kalau tetap kosong/pendek → langsung ke form (tanpa timeline)
    if (!txt) {
      openFormNow(lang);
      return { stop: true };
    }

    // ada jawaban layak
    turns += 1;
    return { text: txt };
  };

  AIGuard.maybeContinueFunnel = () => {
    // no-op; AI sudah diarahkan untuk selalu menutup dengan 1 pertanyaan
  };

  global.AIGuard = AIGuard;
})(window);

