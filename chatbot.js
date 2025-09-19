// ========================
// ✅ PLANVILLE CHATBOT – SAFE DROP-IN (2025-09-19)
// - Popup modal universal (desktop & mobile, auto-adjust)
// - Tidak ada inline form (semua via modal)
// - Tidak ada dark/light toggle (only light design handled via CSS)
// - Single nudgeToFormFromInterrupt
// - Full product funnels: pv, heatpump, aircon, roof, tenant, window
// - Ensure <meta name="viewport">
// - Auto-greeting guarded
// ========================

// ========================
// 🔧 Helpers & Config
// ========================
function _baseURL() {
  try {
    let b =
      typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL
        ? CONFIG.BASE_API_URL.trim()
        : "";
    if (!b) return "";
    if (!/^https?:\/\//i.test(b)) b = "https://" + b;
    return b.replace(/\/+$/, "");
  } catch (e) {
    return "";
  }
}
function _api(path = "") {
  const base = _baseURL();
  const p = String(path || "");
  return base + (p.startsWith("/") ? p : "/" + p);
}

// --- STREAMING UTIL (chunked fetch) ---
async function askAIStream({ question, lang, signal, onDelta, onDone }) {
  const res = await fetch(_api("/chat/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question, lang }),
    signal,
  });
  if (!res.ok) throw new Error(`Stream ${res.status}`);
  if (!res.body || !res.body.getReader) {
    const txt = await res.text();
    onDelta?.(txt, txt);
    onDone?.(txt);
    return txt;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    full += chunk;
    onDelta?.(chunk, full);
  }
  onDone?.(full);
  return full;
}

// retry sederhana utk 429/5xx
async function withRetry(fn, { retries = 1, baseDelay = 600 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, baseDelay * (i + 1)));
    }
  }
  throw lastErr;
}

function _getConsentState() {
  try {
    const raw = localStorage.getItem("consent_v1");
    if (raw) {
      const c = JSON.parse(raw);
      return {
        essential: true,
        analytics: !!c.analytics,
        marketing: !!c.marketing,
        personalization: !!c.personalization,
      };
    }
  } catch (_) {}
  const simple = localStorage.getItem("cookieConsent");
  return {
    essential: true,
    analytics: simple === "accepted",
    marketing: false,
    personalization: false,
  };
}
function _allowAnalytics() {
  return !!_getConsentState().analytics;
}
function track(eventName, props = {}, { essential = false } = {}) {
  if (typeof window.trackFE === "function") {
    return window.trackFE(eventName, props, { essential });
  }
  if (!essential && !_allowAnalytics()) return;
  try {
    window.dataLayer = window.dataLayer || [];
    const variant = localStorage.getItem("ab_variant") || "A";
    window.dataLayer.push(Object.assign({ event: eventName, variant }, props));
  } catch (e) {}
  try {
    fetch(_api("/track"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        props: Object.assign(
          { variant: localStorage.getItem("ab_variant") || "A" },
          props
        ),
      }),
    });
  } catch (e) {}
}

// ========================
// 🌍 i18n strings (UI)
// ========================
const I18N = {
  greeting: {
    de: "Hallo! 👋 Was kann ich für Sie tun?<br>Bitte wählen Sie ein Thema:",
    en: "Hello! 👋 What can I do for you?<br>Please choose a topic:",
  },
  header: {
    de: "Chatte mit Planville AI 🤖",
    en: "Chat with Planville AI 🤖",
  },
  robotBalloon: {
    de: "Hi! Ich bin dein Planville Assistent. Wobei darf ich helfen?",
    en: "Hi! I'm your Planville assistant. How can I help?",
  },
  ctaBook: { de: "Jetzt Beratung buchen 👉", en: "Book a consultation 👉" },
  priceMsg: {
    de: "Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:",
    en: "Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:",
  },
  unsure: {
    de: `Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 kontaktieren Sie unser Team hier</a>.`,
    en: `I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 contact our team here</a>.`,
  },
  askContactDone: (lang) =>
    lang === "de"
      ? "Danke! Unser Team meldet sich zeitnah. Möchtest du direkt einen Termin wählen?"
      : "Thanks! Our team will contact you soon. Would you like to pick a time now?",
};

// ====== i18n for questions/prompts ======
const Q = {
  owner_q: {
    de: "Bist du Eigentümer:in der Immobilie?",
    en: "Are you the owner of the property?",
  },
  occupy_q: {
    de: "Wohnst du selbst in der Immobilie?",
    en: "Do you live in the property yourself?",
  },
  city_q: {
    de: "In welchem Ort befindet sich das Objekt?",
    en: "In which city/town is the property located?",
  },
  plz_q: { de: "Wie lautet die PLZ?", en: "What is the ZIP code?" },
  prop_type_q: { de: "Welcher Gebäudetyp?", en: "What is the property type?" },
  sub_type_q: {
    de: "Bauform (EFH)?",
    en: "Construction subtype (detached/semi/row)?",
  },
  roof_form_q: { de: "Dachform?", en: "Roof form?" },
  area_q: { de: "Dachfläche (m²) ca.?", en: "Approx. roof area (m²)?" },
  orient_q: { de: "Dachausrichtung?", en: "Roof orientation?" },
  pitch_q: { de: "Neigungswinkel (°)?", en: "Roof pitch (°)?" },
  shade_q: { de: "Verschattung?", en: "Shading?" },
  cons_q: {
    de: "Jahresstromverbrauch (kWh)?",
    en: "Annual electricity usage (kWh)?",
  },
  battery_q: { de: "Batteriespeicher?", en: "Battery storage?" },
  battery_k_q: {
    de: "Kapazität Speicher (kWh)?",
    en: "Battery capacity (kWh)?",
  },
  timeline_q: {
    de: "Wann möchtest du das Projekt starten?",
    en: "When would you like to start the project?",
  },
  heatingType_q: { de: "Aktuelle Heizart?", en: "Current heating type?" },
  living_area_q: { de: "Wohnfläche (m²)?", en: "Living area (m²)?" },
  issues_q: { de: "Gibt es Probleme?", en: "Any current issues?" },

  // Perspective Quick-Check (PV)
  install_location_q: {
    de: "Worauf soll die Solaranlage installiert werden?",
    en: "Where should the PV system be installed?",
  },
  building_type_q: {
    de: "Um welchen Gebäudetyp handelt es sich?",
    en: "What is the building subtype?",
  },
  self_occupied_q: {
    de: "Bewohnst Du die Immobilie selbst?",
    en: "Do you live in the property yourself?",
  },
  ownership_q: {
    de: "Bist Du Eigentümer:in der Immobilie?",
    en: "Are you the owner of the property?",
  },
  roof_type_q: { de: "Was für ein Dach hast Du?", en: "What roof type do you have?" },
  storage_interest_q: {
    de: "Möchtest Du die Anlage durch einen Stromspeicher ergänzen?",
    en: "Would you like to add a battery storage?",
  },
  install_timeline_q: {
    de: "Wann soll deine Solaranlage installiert werden?",
    en: "When should the system be installed?",
  },
  property_street_q: {
    de: "Wo steht die Immobilie? (Straße + Hausnummer)",
    en: "Where is the property? (Street + No.)",
  },
  contact_time_q: {
    de: "Wann bist Du am besten zu erreichen?",
    en: "When are you best reachable?",
  },
};

const productLabels = {
  heatpump: { en: "Heat Pump 🔥", de: "Wärmepumpe 🔥" },
  aircon: { en: "Air Conditioner ❄️", de: "Klimaanlage ❄️" },
  pv: { en: "Photovoltaic System ☀️", de: "Photovoltaikanlage ☀️" },
  roof: { en: "Roof Renovation 🛠️", de: "Dachsanierung 🛠️" },
  tenant: { en: "Tenant Power 🏠", de: "Mieterstrom 🏠" },
  window: { en: "Windows 🪟", de: "Fenster 🪟" },
};

// ========================
// 📚 FAQ Multilingual Data
// ========================
const faqTexts = {
  en: [
    "How much does photovoltaics service cost?",
    "What areas does Planville serve?",
    "Can I book a consultation?",
  ],
  de: [
    "Wie viel kostet eine Photovoltaikanlage?",
    "Welche Regionen deckt Planville ab?",
    "Kann ich eine Beratung buchen?",
  ],
};

// ========================
// 🎯 Element Selectors
// ========================
const chatLog = document.getElementById("chatbot-log");
const form = document.getElementById("chatbot-form");
const input = document.getElementById("chatbot-input");
const typingBubble = document.getElementById("typing-bubble");
const langSwitcher = document.getElementById("langSwitcher");

const pvHero = document.querySelector(".pv-hero");
const pvBalloon = document.querySelector(".pv-balloon span");

// ========================
// 🧠 Load Chat History
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
let chatStarted = false;
let __lastOrigin = "chat"; // 'chat' | 'faq'

// ========================
// 📱 Ensure mobile viewport (if missing)
// ========================
function ensureViewportMeta() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    document.head.appendChild(m);
  }
}

/** Selalu gunakan modal popup universal */
function openLeadForm(productLabel, qualification) {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  return openLeadFloatForm(productLabel, qualification, lang);
}

// ========================
// 🚀 Init on load
// ========================
window.addEventListener("load", () => {
  ensureViewportMeta();

  const selectedLang =
    localStorage.getItem("selectedLang") || (CONFIG?.LANG_DEFAULT || "de");
  if (langSwitcher) langSwitcher.value = selectedLang;

  const oldBalloon = document.querySelector(".pv-balloon");
  if (oldBalloon) oldBalloon.remove();

  if (pvBalloon) pvBalloon.textContent = I18N.robotBalloon[selectedLang];

  updateFAQ(selectedLang);
  updateHeaderOnly(selectedLang);

  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    const banner = document.getElementById("cookie-banner");
    if (banner) banner.style.display = "block";
  } else if (consent === "accepted") {
    if (typeof enableGTM === "function") enableGTM();
  }

  showChatArea();
  chatStarted = true;

  // Auto-greeting, but avoid duplicates if anything is already in the log
  const hasContent = chatLog && chatLog.children && chatLog.children.length > 0;
  const hasProducts = document.getElementById("product-options-block");
  if (!hasContent && !hasProducts) {
    startGreetingFlow(true);
  }
});

// Show/Hide chat area helpers
function hideChatArea() {
  const container = document.querySelector(".chatbot-container");
  const sidebar = document.querySelector(".faq-sidebar");
  if (container) container.style.display = "none";
  if (sidebar) sidebar.style.display = "";
}
function showChatArea() {
  const container = document.querySelector(".chatbot-container");
  if (container) container.style.display = "flex";
  if (pvHero) pvHero.style.display = "none";
}

// ========================
// 🌐 Language Switcher
// ========================
if (langSwitcher) {
  langSwitcher.addEventListener("change", () => {
    const lang = langSwitcher.value;
    localStorage.setItem("selectedLang", lang);
    if (pvBalloon) pvBalloon.textContent = I18N.robotBalloon[lang];
    updateFAQ(lang);
    if (chatStarted) updateUITexts(lang);
    else updateHeaderOnly(lang);
    track("language_switch", { lang });
  });
}

// ========================
// 📨 Form Submit Handler  (→ streaming /chat/stream, fallback ke /chat)
// ========================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    __lastOrigin = __lastOrigin || "chat";

    if (!chatStarted) {
      chatStarted = true;
      showChatArea();
    }

    const question = (input.value || "").trim();
    const selectedLang =
      (langSwitcher && langSwitcher.value) || (CONFIG?.LANG_DEFAULT || "de");
    if (!question) return;

    appendMessage(question, "user");
    saveToHistory("user", question);
    input.value = "";

    if (typingBubble) typingBubble.style.display = "block";

    // Price/FAQ intent → answer + CTA
    if (detectIntent(question)) {
      if (typingBubble) typingBubble.style.display = "none";
      const inFunnel =
        !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
      if (inFunnel) offerContinueOrForm(selectedLang);
      else maybeOfferStartCTA(selectedLang);
      __lastOrigin = "chat";
      return;
    }

    // --- mulai alur AI ---
    let finalReply = null;
    const botLive = appendMessage("...", "bot"); // wadah live-stream

    try {
      // 1) AIGuard (jika menginterupsi alur)
      if (window.AIGuard && typeof AIGuard.ask === "function") {
        const ai = await AIGuard.ask(question, selectedLang);
        if (ai && ai.stop) {
          if (typingBubble) typingBubble.style.display = "none";
          if (botLive) botLive.firstChild && (botLive.firstChild.textContent = "");
          nudgeToFormFromInterrupt(selectedLang);
          __lastOrigin = "chat";
          return;
        }
        if (ai && ai.text) {
          finalReply = String(ai.text).trim();
          if (typingBubble) typingBubble.style.display = "none";
          if (botLive) {
            const fb = botLive.querySelector(".feedback-btns");
            botLive.innerHTML = finalReply;
            if (fb) botLive.appendChild(fb);
          }
          saveToHistory("bot", finalReply);
        }
      }

      // 2) Kalau guard tidak jawab → STREAM dari backend
      if (!finalReply) {
        const controller = new AbortController();
        window.__chatAbortController = controller; // opsional: tombol Stop

        let gotFirstChunk = false;
        await withRetry(
          () =>
            askAIStream({
              question,
              lang: selectedLang,
              signal: controller.signal,
              onDelta: (_chunk, acc) => {
                if (!gotFirstChunk && typingBubble) {
                  typingBubble.style.display = "none";
                  gotFirstChunk = true;
                }
                if (botLive) {
                  const fb = botLive.querySelector(".feedback-btns");
                  botLive.innerHTML = acc;
                  if (fb) botLive.appendChild(fb);
                  chatLog.scrollTop = chatLog.scrollHeight;
                }
              },
              onDone: (full) => {
                finalReply =
                  (full || "").trim() || I18N.unsure[selectedLang];
              },
            }),
          { retries: 1 }
        );

        if (!gotFirstChunk && typingBubble) typingBubble.style.display = "none";
        saveToHistory("bot", finalReply);
      }
    } catch (err) {
      // 3) Fallback terakhir → non-stream /chat
      try {
        const res = await fetch(_api("/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, lang: selectedLang }),
        });
        const data = await res.json();
        const replyRaw = data.answer ?? data.reply;
        finalReply =
          (typeof replyRaw === "string" ? replyRaw.trim() : "") ||
          I18N.unsure[selectedLang];

        if (botLive) {
          const fb = botLive.querySelector(".feedback-btns");
          botLive.innerHTML = finalReply;
          if (fb) botLive.appendChild(fb);
        } else {
          appendMessage(finalReply, "bot");
        }
        saveToHistory("bot", finalReply);
      } catch (_) {
        if (botLive) {
          const fb = botLive.querySelector(".feedback-btns");
          botLive.innerHTML = "Error while connecting to the API.";
          if (fb) botLive.appendChild(fb);
        } else {
          appendMessage("Error while connecting to the API.", "bot");
        }
      } finally {
        if (typingBubble) typingBubble.style.display = "none";
      }
    } finally {
      // CTA / funnel follow-ups
      const inFunnel =
        !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
      const formAlreadyShown =
        !!document.getElementById("lead-float-overlay");

      if (inFunnel) {
        offerContinueOrForm(selectedLang);
      } else if (!formAlreadyShown) {
        maybeOfferStartCTA(selectedLang);
      }

      track("chat_message", { q_len: question.length, lang: selectedLang });
      if (
        window.AIGuard &&
        typeof AIGuard.maybeContinueFunnel === "function"
      ) {
        AIGuard.maybeContinueFunnel();
      }
      __lastOrigin = "chat";
    }
  });
}

// ========================
// 🧰 Greeting flow
// ========================
function startGreetingFlow(withProducts = true) {
  const lang =
    (langSwitcher && langSwitcher.value) || (CONFIG?.LANG_DEFAULT || "de");
  updateUITexts(lang);
  if (!withProducts) {
    const productBlock = document.getElementById("product-options-block");
    if (productBlock) productBlock.remove();
  }
}
function updateHeaderOnly(lang) {
  const h = document.querySelector(".chatbot-header h1");
  if (h) h.innerText = I18N.header[lang];
}

// ========================
// 💬 Append Message
// ========================
function appendMessage(msg, sender, scroll = true) {
  if (!chatLog) return null;
  const msgDiv = document.createElement("div");
  msgDiv.className = `chatbot-message ${sender}-message`;
  msgDiv.innerHTML = msg;

  if (sender === "bot") {
    const feedback = document.createElement("div");
    feedback.className = "feedback-btns";
    feedback.innerHTML = `
      <button onclick="feedbackClick('up')" aria-label="thumbs up">👍</button>
      <button onclick="feedbackClick('down')" aria-label="thumbs down">👎</button>
    `;
    msgDiv.appendChild(feedback);
  }

  chatLog.appendChild(msgDiv);
  if (scroll) chatLog.scrollTop = chatLog.scrollHeight;
  return msgDiv; // penting untuk live update
}

// ========================
// 💾 Save Chat
// ========================
function saveToHistory(sender, message) {
  chatHistory.push({ sender, message });
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}

// ========================
// ♻️ Reset Chat
// ========================
function resetChat() {
  localStorage.removeItem("chatHistory");
  chatHistory = [];
  if (chatLog) chatLog.innerHTML = "";
  const productBlock = document.getElementById("product-options-block");
  if (productBlock) productBlock.remove();
}

// ========================
// 📌 FAQ Updater
// ========================
function updateFAQ(lang) {
  const list = document.getElementById("faq-list");
  const sidebar = document.querySelector(".faq-sidebar");
  if (!list || !sidebar) return;

  list.innerHTML = "";
  const items = (faqTexts[lang] || faqTexts["de"]) || [];
  items.forEach((txt) => {
    const li = document.createElement("li");
    li.innerText = txt;
    li.addEventListener("click", () => {
      __lastOrigin = "faq";
      input.value = txt;
      form.dispatchEvent(new Event("submit"));
      track("faq_click", { text: txt });
    });
    list.appendChild(li);
  });
}
function sendFAQ(text) {
  __lastOrigin = "faq";
  input.value = text;
  form.dispatchEvent(new Event("submit"));
  track("faq_click", { text });
}

// ========================
// 👍👎 Feedback
// ========================
function feedbackClick(type) {
  alert(type === "up" ? "Thanks for your feedback! 👍" : "We'll improve. 👎");
  track("chat_feedback", { type });
}

// ========================
// 🧭 Update Header & Greeting
// ========================
function updateUITexts(lang) {
  const h = document.querySelector(".chatbot-header h1");
  if (h) h.innerText = I18N.header[lang];

  resetChat();
  appendMessage(I18N.greeting[lang], "bot");
  showProductOptions();
}

// ========================
// 🔘 Show Product Bubble
// ========================
function showProductOptions() {
  const lang =
    (langSwitcher && langSwitcher.value) || (CONFIG?.LANG_DEFAULT || "de");
  const keys = ["pv", "aircon", "heatpump", "tenant", "roof", "window"];
  const existing = document.getElementById("product-options-block");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.className = "product-options";
  container.id = "product-options-block";

  keys.forEach((key) => {
    const label = productLabels[key] && productLabels[key][lang];
    if (!label) return;
    const button = document.createElement("button");
    button.innerText = label;
    button.className = "product-button";
    button.dataset.key = key;
    button.onclick = () => {
      document
        .querySelectorAll(".product-button.selected")
        .forEach((b) => b.classList.remove("selected"));
      button.classList.add("selected");
      handleProductSelection(key);
    };
    container.appendChild(button);
  });

  if (chatLog) {
    chatLog.appendChild(container);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

// ========================
// 🧩 Product Click -> router
// ========================
function handleProductSelection(key) {
  const lang =
    (langSwitcher && langSwitcher.value) || (CONFIG?.LANG_DEFAULT || "de");

  Funnel.reset();
  Funnel.state.product = key;
  Funnel.state.productLabel =
    (productLabels[key] && productLabels[key][lang]) || key;

  appendMessage(Funnel.state.productLabel, "user");

  // Start flow sesuai produk
  askNext();
}

// ========================
// 🎯 Intent Detection (simple)
// ========================
function detectIntent(text) {
  const lower = (text || "").toLowerCase();
  const lang =
    (langSwitcher && langSwitcher.value) || (CONFIG?.LANG_DEFAULT || "de");

  // Price intent → short answer + CTA
  if (
    lower.includes("harga") ||
    lower.includes("kosten") ||
    lower.includes("cost") ||
    lower.includes("price")
  ) {
    appendMessage(I18N.priceMsg[lang], "bot");

    const cta = document.createElement("a");
    cta.href = "https://planville.de/kontakt/";
    cta.target = "_blank";
    cta.rel = "noopener";
    cta.className = "cta-button";
    cta.innerText =
      lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉";
    if (chatLog) chatLog.appendChild(cta);

    offerFAQFollowup(lang);
    track("intent_preisinfo", { text, language: lang });
    return true;
  }

  // Interest intent → langsung buka modal (tidak ada inline form)
  if (lower.includes("tertarik") || lower.includes("interested")) {
    appendMessage(
      lang === "de"
        ? "Super! Bitte füllen Sie dieses kurze Formular aus:"
        : "Great! Please fill out this short form:",
      "bot"
    );
    const label = window.Funnel?.state?.productLabel || "Beratung";
    const qual = window.Funnel?.state?.data || {};
    openLeadForm(label, qual);
    offerFAQFollowup(lang);
    return true;
  }

  return false;
}

// ========================
// 🔳 Quick buttons + Cards + Inputs
// ========================
function askQuick(text, options, fieldKey) {
  appendMessage(text, "bot");

  const group = document.createElement("div");
  group.className = "quick-group";

  options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "quick-btn";
    b.type = "button";
    b.innerText = opt.label;
    b.onclick = () => {
      appendMessage(opt.label, "user");
      Funnel.state.data[fieldKey] = opt.value;

      if (fieldKey === "timeline") {
        if (typeof window.onTimelineSelected === "function") {
          window.onTimelineSelected(opt.value);
        }
        group.remove();
        return;
      }

      askNext();
      group.remove();
    };
    group.appendChild(b);
  });

  if (chatLog) {
    chatLog.appendChild(group);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}
function askCards(text, options, fieldKey) {
  appendMessage(text, "bot");
  const grid = document.createElement("div");
  grid.className = "pv-card-grid";

  options.forEach((opt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pv-card";
    b.innerHTML = `
      ${opt.emoji ? `<div class="pv-card__emoji">${opt.emoji}</div>` : ""}
      <div class="pv-card__label">${opt.label}</div>
    `;
    b.onclick = () => {
      appendMessage(opt.label, "user");
      Funnel.state.data[fieldKey] = opt.value;
      askNext();
      grid.remove();
    };
    grid.appendChild(b);
  });

  if (chatLog) {
    chatLog.appendChild(grid);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}
function askInput(text, fieldKey, validator) {
  appendMessage(text, "bot");

  const inp = document.createElement("input");
  inp.className = "text-input";
  inp.placeholder = "Antwort eingeben...";

  const btn = document.createElement("button");
  btn.className = "quick-btn";
  btn.type = "button";
  btn.innerText = "Weiter";

  const wrap = document.createElement("div");
  wrap.className = "quick-group";
  wrap.appendChild(inp);
  wrap.appendChild(btn);

  btn.onclick = () => {
    const val = (inp.value || "").trim();
    if (validator && !validator(val)) {
      alert("Bitte gültige Eingabe.");
      return;
    }
    appendMessage(val, "user");
    Funnel.state.data[fieldKey] = val;
    askNext();
    wrap.remove();
  };

  if (chatLog) {
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

function askContact() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const opts = (lang === "de"
    ? ["0–3 Monate", "3–6 Monate", "6–12 Monate"]
    : ["0–3 months", "3–6 months", "6–12 months"]
  ).map((t, i) => ({ label: t, value: i === 0 ? "0-3" : i === 1 ? "3-6" : "6-12" }));
  askQuick(Q.timeline_q[lang], opts, "timeline");
}

function exitWith(reason) {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  track("lead.exit", { product: Funnel.state.product, reason });
  Funnel.state.data.qualified = false;
  Funnel.state.data.disqualifyReason = reason;

  const txt =
    {
      de: "Danke für dein Interesse! Aufgrund deiner Antworten können wir dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!",
      en: "Thanks for your interest! Based on your answers we currently have no matching service. Feel free to check our website!",
    }[lang || "de"];

  const div = document.createElement("div");
  div.className = "exit-bubble";
  div.innerText = txt;
  if (chatLog) {
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  if (typeof window.sendDisqualifiedLead === "function") {
    window.sendDisqualifiedLead(reason);
  }
}

// ========================
// 🚦 Conversational Funnel (Multi-product)
// ========================
const Funnel = {
  state: { product: null, productLabel: null, data: {} },
  reset() {
    this.state = { product: null, productLabel: null, data: {} };
  },
  progressByFields() {
    const d = this.state.data || {};
    const mapNeeded = {
      pv: [
        "install_location",
        "building_type",
        "self_occupied",
        "ownership",
        "roof_type",
        "storage_interest",
        "install_timeline",
        "property_street_number",
        "contact_time_window",
      ],
      heatpump: [
        "building_type",
        "living_area",
        "heating_type",
        "insulation",
        "install_timeline",
        "property_street_number",
        "contact_time_window",
      ],
      aircon: [
        "building_type",
        "rooms_count",
        "cool_area",
        "install_timeline",
        "property_street_number",
        "contact_time_window",
      ],
      roof: [
        "roof_type",
        "area_sqm",
        "issues",
        "install_timeline",
        "property_street_number",
        "contact_time_window",
      ],
      tenant: [
        "building_type",
        "units",
        "ownership",
        "install_timeline",
        "property_street_number",
        "contact_time_window",
      ],
      window: [
        "window_type",
        "window_count",
        "needs_balcony_door",
        "window_accessory",
        "install_timeline",
        "plz",
        "contact_time_window",
      ],
    };
    const needed = mapNeeded[this.state.product] || [];
    const answered = needed.filter(
      (k) => d[k] !== undefined && d[k] !== null && d[k] !== ""
    ).length;
    const percent = needed.length
      ? Math.min(100, Math.round((answered / needed.length) * 100))
      : 0;
    this.progress(percent);
  },
  progress(percent) {
    let bar = document.getElementById("funnel-progress-bar");
    if (!bar) {
      const wrap = document.createElement("div");
      wrap.className = "funnel-progress";
      const inner = document.createElement("div");
      inner.className = "funnel-progress__bar";
      inner.id = "funnel-progress-bar";
      wrap.appendChild(inner);
      if (chatLog) chatLog.appendChild(wrap);
    }
    requestAnimationFrame(() => {
      const el = document.getElementById("funnel-progress-bar");
      if (el) el.style.width = Math.min(100, Math.max(0, percent)) + "%";
    });
  },
};
window.Funnel = Funnel;

// Dispatcher
function askNext() {
  switch (Funnel.state.product) {
    case "pv":
      return askNextPV();
    case "heatpump":
      return askNextHP();
    case "aircon":
      return askNextAC();
    case "roof":
      return askNextRoof();
    case "tenant":
      return askNextTenant();
    case "window":
      return askNextWindow();
    default:
      return;
  }
}

// ===== PV flow =====
function askNextPV() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.install_location === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Einfamilienhaus", value: "einfamilienhaus", emoji: "🏠" },
            { label: "Mehrfamilienhaus", value: "mehrfamilienhaus", emoji: "🏢" },
            { label: "Gewerbeimmobilie", value: "gewerbeimmobilie", emoji: "🏭" },
            { label: "Sonstiges", value: "sonstiges", emoji: "✨" },
          ]
        : [
            { label: "Single-family", value: "einfamilienhaus", emoji: "🏠" },
            { label: "Multi-family", value: "mehrfamilienhaus", emoji: "🏢" },
            { label: "Commercial", value: "gewerbeimmobilie", emoji: "🏭" },
            { label: "Other", value: "sonstiges", emoji: "✨" },
          ];
    return askCards(Q.install_location_q[lang], opts, "install_location");
  }
  if (d.install_location === "einfamilienhaus" && d.building_type === undefined) {
    const opts = (lang === "de"
      ? ["Freistehendes Haus", "Doppelhaushälfte", "Reihenmittelhaus", "Reihenendhaus"]
      : ["Detached", "Semi-detached", "Mid-terrace", "End-terrace"]
    ).map((t) => ({ label: t, value: t.toLowerCase().replace(/\s/g, "_"), emoji: "🏡" }));
    return askCards(Q.building_type_q[lang], opts, "building_type");
  }
  if (d.self_occupied === undefined) {
    const opts = (lang === "de" ? ["Ja", "Nein"] : ["Yes", "No"]).map(
      (t, i) => ({ label: t, value: i === 0, emoji: i === 0 ? "✅" : "🚫" })
    );
    return askCards(Q.self_occupied_q[lang], opts, "self_occupied");
  }
  if (d.ownership === undefined) {
    const opts = (lang === "de" ? ["Ja", "Nein"] : ["Yes", "No"]).map(
      (t, i) => ({ label: t, value: i === 0, emoji: i === 0 ? "🔑" : "🚫" })
    );
    return askCards(Q.ownership_q[lang], opts, "ownership");
  }
  if (d.roof_type === undefined) {
    const opts = (lang === "de" ? ["Flachdach", "Spitzdach", "Andere"] : ["Flat", "Pitched", "Other"]).map(
      (t) => ({ label: t, value: t.toLowerCase(), emoji: "🏚️" })
    );
    return askCards(Q.roof_type_q[lang], opts, "roof_type");
  }
  if (d.storage_interest === undefined) {
    const opts = (lang === "de" ? ["Ja", "Nein", "Unsicher"] : ["Yes", "No", "Unsure"]).map(
      (t) => ({ label: t, value: t.toLowerCase(), emoji: "🔋" })
    );
    return askCards(Q.storage_interest_q[lang], opts, "storage_interest");
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "So schnell wie möglich", value: "asap" },
            { label: "In 1–3 Monaten", value: "1-3" },
            { label: "In 4–6 Monaten", value: "4-6" },
            { label: "In mehr als 6 Monaten", value: ">6" },
          ]
        : [
            { label: "As soon as possible", value: "asap" },
            { label: "In 1–3 months", value: "1-3" },
            { label: "In 4–6 months", value: "4-6" },
            { label: "In more than 6 months", value: ">6" },
          ];
    return askCards(Q.install_timeline_q[lang], opts, "install_timeline");
  }
  if (d.property_street_number === undefined) {
    return askInput(
      Q.property_street_q[lang],
      "property_street_number",
      (v) => (v || "").trim().length > 3
    );
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__done_perspective_summary) {
    d.__done_perspective_summary = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Photovoltaik", d);
  }
}

// ===== Heat Pump flow =====
function askNextHP() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.building_type === undefined) {
    const opts = (lang === "de"
      ? ["Einfamilienhaus", "Doppelhaushälfte", "Reihenhaus", "Mehrfamilienhaus", "Gewerbe"]
      : ["Single-family", "Semi-detached", "Terraced", "Multi-family", "Commercial"]
    ).map((t, i) => ({
      label: t,
      value: t.toLowerCase().replace(/\s/g, "_"),
      emoji: ["🏠", "🏠", "🏘️", "🏢", "🏭"][i],
    }));
    return askCards(lang === "de" ? "Welcher Gebäudetyp?" : "What building type?", opts, "building_type");
  }
  if (d.living_area === undefined) {
    const opts = (lang === "de"
      ? ["bis 100 m²", "101–200 m²", "201–300 m²", "über 300 m²"]
      : ["up to 100 m²", "101–200 m²", "201–300 m²", "over 300 m²"]
    ).map((t, i) => ({ label: t, value: ["<=100", "101-200", "201-300", ">300"][i] }));
    return askCards(lang === "de" ? "Wohnfläche?" : "Living area?", opts, "living_area");
  }
  if (d.heating_type === undefined) {
    const opts = (lang === "de" ? ["Gas", "Öl", "Stromdirekt", "Andere"] : ["Gas", "Oil", "Direct electric", "Other"]).map(
      (t) => ({ label: t, value: t.toLowerCase(), emoji: "🔥" })
    );
    return askCards(Q.heatingType_q[lang], opts, "heating_type");
  }
  if (d.insulation === undefined) {
    const opts = (lang === "de" ? ["Gut", "Mittel", "Schlecht", "Unbekannt"] : ["Good", "Average", "Poor", "Unknown"]).map(
      (t) => ({ label: t, value: t.toLowerCase(), emoji: "🧱" })
    );
    return askCards(
      lang === "de" ? "Wärmedämmung des Gebäudes?" : "Building insulation level?",
      opts,
      "insulation"
    );
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Schnellstmöglich", value: "asap" },
            { label: "1–3 Monate", value: "1-3" },
            { label: "4–6 Monate", value: "4-6" },
            { label: ">6 Monate", value: ">6" },
          ]
        : [
            { label: "ASAP", value: "asap" },
            { label: "1–3 months", value: "1-3" },
            { label: "4–6 months", value: "4-6" },
            { label: ">6 months", value: ">6" },
          ];
    return askCards(Q.install_timeline_q[lang], opts, "install_timeline");
  }
  if (d.property_street_number === undefined) {
    return askInput(
      Q.property_street_q[lang],
      "property_street_number",
      (v) => (v || "").trim().length > 3
    );
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__hp_done) {
    d.__hp_done = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Wärmepumpe", d);
  }
}

// ===== Air Conditioner flow =====
function askNextAC() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.building_type === undefined) {
    const opts = (lang === "de"
      ? ["Einfamilienhaus", "Wohnung", "Büro", "Gewerbehalle"]
      : ["Single-family", "Apartment", "Office", "Commercial hall"]
    ).map((t, i) => ({
      label: t,
      value: t.toLowerCase().replace(/\s/g, "_"),
      emoji: ["🏠", "🏢", "💼", "🏭"][i],
    }));
    return askCards(lang === "de" ? "Welcher Gebäudetyp?" : "What building type?", opts, "building_type");
  }
  if (d.rooms_count === undefined) {
    const opts = (lang === "de" ? ["1 Raum", "2 Räume", "3 Räume", "mehr als 3"] : ["1 room", "2 rooms", "3 rooms", "more than 3"]).map(
      (t, i) => ({ label: t, value: ["1", "2", "3", ">3"][i] })
    );
    return askCards(lang === "de" ? "Wie viele Räume?" : "How many rooms?", opts, "rooms_count");
  }
  if (d.cool_area === undefined) {
    const opts = (lang === "de"
      ? ["bis 30 m²", "31–60 m²", "61–100 m²", "über 100 m²"]
      : ["up to 30 m²", "31–60 m²", "61–100 m²", "over 100 m²"]
    ).map((t, i) => ({ label: t, value: ["<=30", "31-60", "61-100", ">100"][i] }));
    return askCards(lang === "de" ? "Zu kühlende Fläche?" : "Cooling area?", opts, "cool_area");
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Schnellstmöglich", value: "asap" },
            { label: "1–3 Monate", value: "1-3" },
            { label: "4–6 Monate", value: "4-6" },
            { label: ">6 Monate", value: ">6" },
          ]
        : [
            { label: "ASAP", value: "asap" },
            { label: "1–3 months", value: "1-3" },
            { label: "4–6 months", value: "4-6" },
            { label: ">6 months", value: ">6" },
          ];
    return askCards(Q.install_timeline_q[lang], opts, "install_timeline");
  }
  if (d.property_street_number === undefined) {
    return askInput(
      Q.property_street_q[lang],
      "property_street_number",
      (v) => (v || "").trim().length > 3
    );
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__ac_done) {
    d.__ac_done = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Klimaanlage", d);
  }
}

// ===== Roof Renovation flow =====
function askNextRoof() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.roof_type === undefined) {
    const opts = (lang === "de" ? ["Flachdach", "Satteldach", "Walmdach", "Andere"] : ["Flat", "Gabled", "Hipped", "Other"]).map(
      (t) => ({ label: t, value: t.toLowerCase(), emoji: "🏚️" })
    );
    return askCards(lang === "de" ? "Dachform?" : "Roof type?", opts, "roof_type");
  }
  if (d.area_sqm === undefined) {
    const opts = (lang === "de"
      ? ["bis 50 m²", "51–100 m²", "101–200 m²", "über 200 m²"]
      : ["up to 50 m²", "51–100 m²", "101–200 m²", "over 200 m²"]
    ).map((t, i) => ({ label: t, value: ["<=50", "51-100", "101-200", ">200"][i] }));
    return askCards(lang === "de" ? "Dachfläche (ca.)?" : "Approx. roof area?", opts, "area_sqm");
  }
  if (d.issues === undefined) {
    const opts = (lang === "de" ? ["Undicht", "Beschädigt", "Alterung", "Nur Inspektion"] : ["Leaking", "Damaged", "Aged", "Inspection only"]).map(
      (t) => ({ label: t, value: t.toLowerCase().replace(/\s/g, "_"), emoji: "🛠️" })
    );
    return askCards(Q.issues_q[lang], opts, "issues");
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Schnellstmöglich", value: "asap" },
            { label: "1–3 Monate", value: "1-3" },
            { label: "4–6 Monate", value: "4-6" },
            { label: ">6 Monate", value: ">6" },
          ]
        : [
            { label: "ASAP", value: "asap" },
            { label: "1–3 months", value: "1-3" },
            { label: "4–6 months", value: "4-6" },
            { label: ">6 months", value: ">6" },
          ];
    return askCards(Q.install_timeline_q[lang], opts, "install_timeline");
  }
  if (d.property_street_number === undefined) {
    return askInput(
      Q.property_street_q[lang],
      "property_street_number",
      (v) => (v || "").trim().length > 3
    );
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__roof_done) {
    d.__roof_done = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Dachsanierung", d);
  }
}

// ===== Tenant Power flow =====
function askNextTenant() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.building_type === undefined) {
    const opts = (lang === "de" ? ["Mehrfamilienhaus", "Gewerbeimmobilie"] : ["Multi-family", "Commercial"]).map(
      (t, i) => ({ label: t, value: t.toLowerCase().replace(/\s/g, "_"), emoji: ["🏢", "🏭"][i] })
    );
    return askCards(Q.building_type_q[lang], opts, "building_type");
  }
  if (d.units === undefined) {
    const opts = (lang === "de"
      ? ["1–3", "4–10", "11–20", "über 20"]
      : ["1–3", "4–10", "11–20", "over 20"]
    ).map((t, i) => ({ label: t, value: ["1-3", "4-10", "11-20", ">20"][i] }));
    return askCards(lang === "de" ? "Anzahl Wohneinheiten?" : "Number of units?", opts, "units");
  }
  if (d.ownership === undefined) {
    const opts = (lang === "de" ? ["Ja", "Nein"] : ["Yes", "No"]).map(
      (t, i) => ({ label: t, value: i === 0, emoji: i === 0 ? "🔑" : "🚫" })
    );
    return askCards(Q.ownership_q[lang], opts, "ownership");
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Schnellstmöglich", value: "asap" },
            { label: "1–3 Monate", value: "1-3" },
            { label: "4–6 Monate", value: "4-6" },
            { label: ">6 Monate", value: ">6" },
          ]
        : [
            { label: "ASAP", value: "asap" },
            { label: "1–3 months", value: "1-3" },
            { label: "4–6 months", value: "4-6" },
            { label: ">6 months", value: ">6" },
          ];
    return askCards(Q.install_timeline_q[lang], opts, "install_timeline");
  }
  if (d.property_street_number === undefined) {
    return askInput(
      Q.property_street_q[lang],
      "property_street_number",
      (v) => (v || "").trim().length > 3
    );
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__tenant_done) {
    d.__tenant_done = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Mieterstrom", d);
  }
}

// ===== Window (Fenster) flow =====
function askNextWindow() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const d = Funnel.state.data;
  Funnel.progressByFields();

  if (d.window_type === undefined) {
    const opts = (lang === "de"
      ? ["Standardfenster", "Dachfenster", "Schiebefenster", "Andere"]
      : ["Standard window", "Roof window", "Sliding window", "Other"]
    ).map((t) => ({
      label: t,
      value: t.toLowerCase().replace(/\s/g, "_"),
      emoji: "🪟",
    }));
    return askCards(
      lang === "de" ? "Welche Art von Fenster?" : "Which type of window?",
      opts,
      "window_type"
    );
  }
  if (d.window_count === undefined) {
    const opts = (lang === "de" ? ["1–3", "4–7", "8+"] : ["1–3", "4–7", "8+"]).map((t) => ({
      label: t,
      value: t.replace(/\s/g, ""),
    })));
    return askCards(
      lang === "de" ? "Wie viele Fenster?" : "How many windows?",
      opts,
      "window_count"
    );
  }
  if (d.needs_balcony_door === undefined) {
    const opts = (lang === "de" ? ["Ja", "Nein"] : ["Yes", "No"]).map(
      (t, i) => ({ label: t, value: i === 0, emoji: i === 0 ? "🚪" : "❌" })
    );
    return askCards(
      lang === "de"
        ? "Brauchst du eine Balkon-/Schiebetür?"
        : "Do you need a balcony/sliding door?",
      opts,
      "needs_balcony_door"
    );
  }
  if (d.window_accessory === undefined) {
    const opts = (lang === "de"
      ? ["Rollladen", "Insektenschutz", "Keins", "Sonstiges"]
      : ["Roller shutter", "Insect screen", "None", "Other"]
    ).map((t) => ({ label: t, value: t.toLowerCase().replace(/\s/g, "_") }));
    return askCards(
      lang === "de" ? "Zubehör benötigt?" : "Any accessories needed?",
      opts,
      "window_accessory"
    );
  }
  if (d.install_timeline === undefined) {
    const opts =
      lang === "de"
        ? [
            { label: "Schnellstmöglich", value: "asap" },
            { label: "4–6 Monate", value: "4-6" },
            { label: ">6 Monate", value: ">6" },
          ]
        : [
            { label: "ASAP", value: "asap" },
            { label: "4–6 months", value: "4-6" },
            { label: ">6 months", value: ">6" },
          ];
    return askCards(
      lang === "de" ? "Zeitplan für das Projekt?" : "Project timeline?",
      opts,
      "install_timeline"
    );
  }
  if (d.plz === undefined) {
    return askInput(Q.plz_q[lang], "plz", (v) => /^\d{4,5}$/.test(String(v || "").trim()));
  }
  if (d.contact_time_window === undefined) {
    const opts = (lang === "de"
      ? ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Egal / zu jeder Zeit"]
      : ["08:00–12:00", "12:00–16:00", "16:00–20:00", "Any time"]
    ).map((t) => ({ label: t, value: t }));
    return askCards(Q.contact_time_q[lang], opts, "contact_time_window");
  }
  if (!d.__window_done) {
    d.__window_done = true;
    appendMessage(
      lang === "de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );
    if (typeof window.showSummaryFromFunnel === "function")
      window.showSummaryFromFunnel(d);
    openLeadForm(Funnel.state.productLabel || "Fenster", d);
  }
}

// ========================
// ✅ NUDGE / Interrupt handling (single source of truth)
// ========================
function nudgeToFormFromInterrupt(lang) {
  try {
    if (document.getElementById("lead-float-overlay")) return;

    const productLabel = window.Funnel?.state?.productLabel || "Photovoltaik";
    const qualification = window.Funnel?.state?.data || {};

    const msg =
      lang === "de"
        ? "Alles klar! Dann bräuchten wir nur noch deine Kontaktdaten:"
        : "All right! We just need your contact details:";
    appendMessage(msg, "bot");

    if (typeof window.showSummaryFromFunnel === "function") {
      window.showSummaryFromFunnel(qualification);
    }

    openLeadForm(productLabel, qualification);
  } catch (_) {}
}

// ========================
// ✨ CTA helpers (FAQ / Interrupt)
// ========================
function maybeOfferStartCTA(lang) {
  removeInlineOptions();
  const wrap = document.createElement("div");
  wrap.className = "quick-group";
  wrap.id = "cta-start-wrap";
  const btnStart = document.createElement("button");
  btnStart.className = "quick-btn";
  btnStart.textContent = lang === "de" ? "Jetzt starten" : "Start now";
  btnStart.onclick = () => {
    const label = window.Funnel?.state?.productLabel || "Beratung";
    const qual = window.Funnel?.state?.data || {};
    openLeadForm(label, qual);
    wrap.remove();
  };
  const btnMore = document.createElement("button");
  btnMore.className = "quick-btn";
  btnMore.textContent =
    lang === "de" ? "Weitere Frage stellen" : "Ask another question";
  btnMore.onclick = () => wrap.remove();

  wrap.appendChild(btnStart);
  wrap.appendChild(btnMore);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function offerFAQFollowup(lang) {
  maybeOfferStartCTA(lang);
}
function offerContinueOrForm(lang) {
  removeInlineOptions();
  const wrap = document.createElement("div");
  wrap.className = "quick-group";
  wrap.id = "continue-or-form";
  const cont = document.createElement("button");
  cont.className = "quick-btn";
  cont.textContent = lang === "de" ? "Weiter im Check" : "Continue the check";
  cont.onclick = () => {
    wrap.remove();
    askNext();
  };
  const formBtn = document.createElement("button");
  formBtn.className = "quick-btn";
  formBtn.textContent = lang === "de" ? "Formular ausfüllen" : "Fill the form";
  formBtn.onclick = () => {
    const label = window.Funnel?.state?.productLabel || "Beratung";
    const qual = window.Funnel?.state?.data || {};
    openLeadForm(label, qual);
    wrap.remove();
  };
  wrap.appendChild(cont);
  wrap.appendChild(formBtn);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function removeInlineOptions() {
  const ids = ["cta-start-wrap", "continue-or-form"];
  ids.forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.remove();
  });
}

// ========================
// 🧊 Popup Lead Form (modal, centered for all devices)
// ========================
function openLeadFloatForm(productLabel, qualification, lang) {
  if (document.getElementById("lead-float-overlay")) return;

  const ov = document.createElement("div");
  ov.id = "lead-float-overlay";
  ov.innerHTML = `
    <style>
      #lead-float-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999}
      #lead-float{position:relative;background:#fff;color:#111;max-width:min(520px,95vw);width:92%;border-radius:16px;padding:18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
      #lead-float h3{margin:0 0 10px 0;font-size:18px}
      #lead-float form{display:grid;gap:10px}
      #lead-float input, #lead-float select{
        padding:12px 14px;border-radius:12px;border:1px solid #ccc;width:100%;min-height:48px;font-size:16px;background:#fff;color:#111;
      }
      #lead-float .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
      #lead-float .cta{padding:12px 16px;border-radius:12px;border:none;background:#0f766e;color:#fff;cursor:pointer}
      #lead-float .ghost{padding:12px 16px;border-radius:12px;border:1px solid #ddd;background:#fafafa;cursor:pointer}
      #lf_close{position:absolute;right:10px;top:10px;background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer}
    </style>
    <div id="lead-float" role="dialog" aria-modal="true" aria-label="Lead form">
      <button type="button" id="lf_close" aria-label="Close">×</button>
      <h3>${lang==="de"?"Kurzes Formular":"Quick form"}</h3>
      <form id="lead-float-form">
        <input type="text" id="lf_name" placeholder="${lang==="de"?"Name":"Name"}" required>
        <input type="text" id="lf_addr" placeholder="${lang==="de"?"Adresse (Straße + Nr.)":"Address (Street + No.)"}" required>
        <input type="text" id="lf_plz" placeholder="${lang==="de"?"PLZ":"ZIP"}" required>
        <input type="tel" id="lf_phone" placeholder="${lang==="de"?"Telefonnummer":"Phone number"}" required>
        <select id="lf_best" required>
          <option value="">${lang==="de"?"Am besten erreichbar":"Best time to reach"}</option>
          <option>08:00–12:00</option>
          <option>12:00–16:00</option>
          <option>16:00–20:00</option>
          <option>${lang==="de"?"Egal / zu jeder Zeit":"Any time"}</option>
        </select>
        <label style="display:flex;gap:.6rem;align-items:flex-start;font-size:12px;line-height:1.35">
          <input type="checkbox" id="lf_ok" checked required style="margin-top:2px">
          <span>${lang==="de"
            ? 'Ich stimme der Kontaktaufnahme und Verarbeitung meiner Daten gemäß <a href="https://planville.de/datenschutz/" target="_blank">Datenschutzerklärung</a> zu.'
            : 'I agree to be contacted and for my data to be processed according to the <a href="https://planville.de/datenschutz/" target="_blank">privacy policy</a>.'}
          </span>
        </label>
        <div class="actions">
          <button type="button" class="ghost" id="lf_cancel">${lang==="de"?"Abbrechen":"Cancel"}</button>
          <button type="submit" class="cta" id="lf_submit">${lang==="de"?"Absenden":"Submit"}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(ov);

  // Lock scroll while open
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // Prefill from qualification when possible
  try {
    if (qualification?.property_street_number)
      ov.querySelector("#lf_addr").value = String(
        qualification.property_street_number
      );
    if (qualification?.plz)
      ov.querySelector("#lf_plz").value = String(qualification.plz);
    if (qualification?.contact_time_window)
      ov.querySelector("#lf_best").value = String(
        qualification.contact_time_window
      );
  } catch (_) {}

  const close = () => {
    document.body.style.overflow = prevOverflow || "";
    ov.remove();
  };

  ov.querySelector("#lf_close").onclick = close;
  ov.querySelector("#lf_cancel").onclick = close;
  ov.addEventListener("click", (e) => {
    if (e.target.id === "lead-float-overlay") close();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  });

  ov.querySelector("#lead-float-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = ov.querySelector("#lf_name").value.trim();
    const addr = ov.querySelector("#lf_addr").value.trim();
    const plz = ov.querySelector("#lf_plz").value.trim();
    const phone = ov.querySelector("#lf_phone").value.trim();
    const best = ov.querySelector("#lf_best").value.trim();
    const ok = ov.querySelector("#lf_ok").checked;

    if (!ok) {
      alert(lang === "de" ? "Bitte Zustimmung erteilen." : "Please give consent.");
      return;
    }

    const qual = Object.assign({}, qualification || {}, {
      property_street_number: addr,
      plz,
      contact_time_window: best,
    });

    try {
      if (typeof window.sendLeadToBackend === "function") {
        await window.sendLeadToBackend({
          productLabel: productLabel || "Beratung",
          name,
          address: addr,
          email: "—",
          phone,
          origin: (__lastOrigin || "chat") + "-float",
          qualification: qual,
        });
      }
      close(); // tutup form dulu
      showThanksModal(lang);
    } catch (err) {
      console.error(err);
      close();
      showThanksModal(lang, /*error*/ true);
    }
  });
}

// ========================
// 🙏 Thank-you Modal
// ========================
function showThanksModal(lang, isError) {
  if (document.getElementById("lead-thanks-overlay")) return;
  const tov = document.createElement("div");
  tov.id = "lead-thanks-overlay";
  tov.innerHTML = `
    <style>
      #lead-thanks-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10000}
      #lead-thanks{background:#fff;color:#111;max-width:min(520px,95vw);border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center}
      #lead-thanks h3{margin:0 0 8px 0;font-size:20px}
      #lead-thanks p{margin:0 0 12px 0;line-height:1.5}
      #lead-thanks .cta{padding:10px 16px;border-radius:12px;border:none;background:#0f766e;color:#fff;cursor:pointer}
    </style>
    <div id="lead-thanks" role="dialog" aria-modal="true" aria-label="${isError ? "Error" : "Thank you"}">
      <h3>${isError
        ? (lang==="de" ? "Senden fehlgeschlagen" : "Submission failed")
        : (lang==="de" ? "Danke!" : "Thank you!")}</h3>
      <p>${isError
        ? (lang==="de" ? "Bitte später erneut versuchen." : "Please try again later.")
        : (lang==="de" ? "Wir melden uns in Kürze." : "We’ll contact you shortly.")}</p>
      <button class="cta" id="thanks_ok">${lang==="de"?"Schließen":"Close"}</button>
    </div>`;
  document.body.appendChild(tov);
  const cls = () => { try { document.body.removeChild(tov);} catch(_){} };
  document.getElementById("thanks_ok").addEventListener("click", cls);
  tov.addEventListener("click", (e)=>{ if(e.target===tov) cls(); });
  document.addEventListener("keydown", function esc(e){
    if(e.key==="Escape"){ cls(); document.removeEventListener("keydown", esc); }
  });
}

// ========================
// 🧪 A/B Variant (sticky)
// ========================
const AB = {
  variant: localStorage.getItem("ab_variant") || (Math.random() < 0.5 ? "A" : "B"),
};
localStorage.setItem("ab_variant", AB.variant);
