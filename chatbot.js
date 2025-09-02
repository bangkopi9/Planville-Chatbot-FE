// ========================
// 🔧 Helpers & Config
// ========================
function _baseURL() {
  try {
    let b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL.trim() : "";
    if (!b) return "";
    if (!/^https?:\/\//i.test(b)) b = "https://" + b;
    return b.replace(/\/+$/,"");
  } catch (e) { return ""; }
}
function _api(path = "") {
  const base = _baseURL();
  const p = String(path || "");
  return base + (p.startsWith("/") ? p : "/" + p);
}
function _getConsentState(){
  try {
    const raw = localStorage.getItem("consent_v1");
    if (raw) {
      const c = JSON.parse(raw);
      return { essential: true, analytics: !!c.analytics, marketing: !!c.marketing, personalization: !!c.personalization };
    }
  } catch(_) {}
  const simple = localStorage.getItem("cookieConsent");
  return { essential: true, analytics: simple === "accepted", marketing: false, personalization: false };
}
function _allowAnalytics(){ return !!_getConsentState().analytics; }
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
    fetch(_api('/track'), {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ event: eventName, props: Object.assign({ variant: localStorage.getItem("ab_variant") || "A" }, props) })
    });
  } catch (e) {}
}

// ========================
// 🌍 i18n strings (UI)
// ========================
const I18N = {
  greeting: {
    de: "Hallo! 👋 Was kann ich für Sie tun?<br>Bitte wählen Sie ein Thema:",
    en: "Hello! 👋 What can I do for you?<br>Please choose a topic:"
  },
  header: {
    de: "Chatte mit Planville AI 🤖",
    en: "Chat with Planville AI 🤖"
  },
  robotBalloon: {
    de: "Hi! Ich bin dein Planville Assistent. Wobei darf ich helfen?",
    en: "Hi! I'm your Planville assistant. How can I help?"
  },
  ctaBook: {
    de: "Jetzt Beratung buchen 👉",
    en: "Book a consultation 👉"
  },
  priceMsg: {
    de: "Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:",
    en: "Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:"
  },
  unsure: {
    de: `Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 kontaktieren Sie unser Team hier</a>.`,
    en: `I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 contact our team here</a>.`
  },
  askContactDone: (lang) =>
    lang === "de"
      ? "Danke! Unser Team meldet sich zeitnah. Möchtest du direkt einen Termin wählen?"
      : "Thanks! Our team will contact you soon. Would you like to pick a time now?",
  // 👉 NEW: CTA & overlay texts
  startNow: { de: "Jetzt starten", en: "Start now" },
  contactOverlay: {
    de: {
      title:"Schnellkontakt",
      name:"Name",
      addr:"Adresse (Straße + Nr.)",
      plz:"PLZ",
      phone:"Telefonnummer",
      best:"Am besten erreichbar",
      submit:"Absenden",
      cancel:"Abbrechen"
    },
    en: {
      title:"Quick contact",
      name:"Name",
      addr:"Address (Street + No.)",
      plz:"ZIP",
      phone:"Phone number",
      best:"Best time to reach",
      submit:"Submit",
      cancel:"Cancel"
    }
  }
};

// ====== i18n for questions/prompts (legacy + perspective) ======
const Q = {
  owner_q: { de: 'Bist du Eigentümer:in der Immobilie?', en: 'Are you the owner of the property?' },
  occupy_q:{ de: 'Wohnst du selbst in der Immobilie?',    en: 'Do you live in the property yourself?' },

  city_q:  { de: 'In welchem Ort befindet sich das Objekt?', en: 'In which city/town is the property located?' },
  plz_q:   { de: 'Wie lautet die PLZ?',                     en: 'What is the ZIP code?' },

  prop_type_q: { de: 'Welcher Gebäudetyp?', en:'What is the property type?' },
  sub_type_q:  { de: 'Bauform (EFH)?',      en:'Construction subtype (detached/semi/row)?' },
  roof_form_q: { de: 'Dachform?',           en:'Roof form?' },
  area_q:      { de: 'Dachfläche (m²) ca.?',en:'Approx. roof area (m²)?' },
  orient_q:    { de: 'Dachausrichtung?',    en:'Roof orientation?' },
  pitch_q:     { de: 'Neigungswinkel (°)?', en:'Roof pitch (°)?' },
  shade_q:     { de: 'Verschattung?',       en:'Shading?' },
  cons_q:      { de: 'Jahresstromverbrauch (kWh)?', en:'Annual electricity usage (kWh)?' },
  battery_q:   { de: 'Batteriespeicher?',   en:'Battery storage?' },
  battery_k_q: { de: 'Kapazität Speicher (kWh)?', en:'Battery capacity (kWh)?' },
  timeline_q:  { de: 'Wann möchtest du das Projekt starten?', en:'When would you like to start the project?' },

  heatingType_q: { de:'Aktuelle Heizart?', en:'Current heating type?' },
  living_area_q: { de:'Wohnfläche (m²)?',  en:'Living area (m²)?' },

  issues_q: { de:'Gibt es Probleme?', en:'Any current issues?' },

  // ===== Perspective Quick-Check (PV) =====
  install_location_q: { de: 'Worauf soll die Solaranlage installiert werden?', en: 'Where should the PV system be installed?' },
  building_type_q:    { de: 'Um welchen Gebäudetyp handelt es sich?',           en: 'What is the building subtype?' },
  self_occupied_q:    { de: 'Bewohnst Du die Immobilie selbst?',                en: 'Do you live in the property yourself?' },
  ownership_q:        { de: 'Bist Du Eigentümer:in der Immobilie?',             en: 'Are you the owner of the property?' },
  roof_type_q:        { de: 'Was für ein Dach hast Du?',                        en: 'What roof type do you have?' },
  storage_interest_q: { de: 'Möchtest Du die Anlage durch einen Stromspeicher ergänzen?', en: 'Would you like to add a battery storage?' },
  install_timeline_q: { de: 'Wann soll deine Solaranlage installiert werden?',  en: 'When should the system be installed?' },
  property_street_q:  { de: 'Wo steht die Immobilie? (Straße + Hausnummer)',    en: 'Where is the property? (Street + No.)' },
  contact_time_q:     { de: 'Wann bist Du am besten zu erreichen?',             en: 'When are you best reachable?' }
};

const productLabels = {
  heatpump: { en: "Heat Pump 🔥",       de: "Wärmepumpe 🔥" },
  aircon:   { en: "Air Conditioner ❄️", de: "Klimaanlage ❄️" },
  pv:       { en: "Photovoltaic System ☀️", de: "Photovoltaikanlage ☀️" },
  roof:     { en: "Roof Renovation 🛠️", de: "Dachsanierung 🛠️" },
  tenant:   { en: "Tenant Power 🏠",    de: "Mieterstrom 🏠" },
};

// ========================
// 📚 FAQ Multilingual Data
// ========================
const faqTexts = {
  en: [
    "How much does photovoltaics service cost?",
    "What areas does Planville serve?",
    "Can I book a consultation?"
  ],
  de: [
    "Wie viel kostet eine Photovoltaikanlage?",
    "Welche Regionen deckt Planville ab?",
    "Kann ich eine Beratung buchen?"
  ]
};

// ========================
// 🎯 Element Selectors
// ========================
const chatLog = document.getElementById("chatbot-log");
const form = document.getElementById("chatbot-form");
const input = document.getElementById("chatbot-input");
const toggle = document.getElementById("modeToggle");
const typingBubble = document.getElementById("typing-bubble");
const langSwitcher = document.getElementById("langSwitcher");

const pvHero = document.querySelector(".pv-hero");
const pvBalloon = document.querySelector(".pv-balloon span");

// ========================
// 🧠 Load Chat History
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
let chatStarted = false;

function loadChatHistory() {
  chatHistory.forEach(entry => appendMessage(entry.message, entry.sender, false));
}

// ========================
// 🚀 Init on load
// ========================
window.addEventListener("load", () => {
  const selectedLang = localStorage.getItem("selectedLang") || (CONFIG.LANG_DEFAULT || "de");
  if (langSwitcher) langSwitcher.value = selectedLang;

  // kill old left balloon if exists (remove white area)
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
  // (no auto greeting here; index.html already appends one)

  if (pvHero) {
    pvHero.style.cursor = "pointer";
    pvHero.addEventListener("click", () => {
      if (!chatStarted) {
        chatStarted = true;
        showChatArea();
        const __sb = document.querySelector('.faq-sidebar');
        if (__sb) __sb.style.display = 'none';
        const __fl = document.getElementById('faq-list');
        if (__fl) __fl.innerHTML = '';
      }
    });
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
// 🌗 Mode Switcher
// ========================
if (toggle) {
  toggle.addEventListener("change", () => {
    document.body.classList.toggle("light-mode", toggle.checked);
    document.body.style.background = toggle.checked ? "var(--bg-light)" : "var(--bg-dark)";
    document.body.style.color = toggle.checked ? "var(--text-light)" : "var(--text-dark)";
  });
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
    if (chatStarted) {
      updateUITexts(lang);
    } else {
      updateHeaderOnly(lang);
    }

    track('language_switch', { lang });
  });
}

// ========================
// 📨 Form Submit Handler  (→ AIGuard.ask)
// ========================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!chatStarted) {
      chatStarted = true;
      showChatArea();
    }

    const question = (input.value || "").trim();
    const selectedLang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
    if (!question) return;

    appendMessage(question, "user");
    saveToHistory("user", question);
    input.value = "";

    if (typingBubble) typingBubble.style.display = "block";

    if (detectIntent(question)) {
      if (typingBubble) typingBubble.style.display = "none";
      return;
    }

    try {
      let finalReply = null;

      if (window.AIGuard && typeof AIGuard.ask === "function") {
        const ai = await AIGuard.ask(question, selectedLang);

        // jika guard minta stop → dorong ke form, jangan fallback ke /chat
        if (ai && ai.stop) {
          if (typingBubble) typingBubble.style.display = "none";
          nudgeToFormFromInterrupt(selectedLang);
          return;
        }

        finalReply = (ai && ai.text) ? ai.text : null;
      }

      if (!finalReply) {
        const res = await fetch(_api('/chat'), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: question, lang: selectedLang })
        });
        const data = await res.json();
        const replyRaw = data.answer ?? data.reply;
        const reply = (typeof replyRaw === "string" ? replyRaw.trim() : "");
        finalReply = reply || I18N.unsure[selectedLang];
      }

      if (typingBubble) typingBubble.style.display = "none";
      appendMessage(finalReply, "bot");
      saveToHistory("bot", finalReply);

      // Jika user mengetik saat funnel aktif → anggap interrupt dan dorong ke form
      const inFunnel = !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
      const formAlreadyShown = !!document.getElementById("lead-contact-form-chat");
      if (inFunnel && !formAlreadyShown) {
        nudgeToFormFromInterrupt(selectedLang);
      } else if (!inFunnel) {
        // 👉 NEW: chat bebas → tampilkan CTA "Jetzt starten"
        maybeShowStartCTA(selectedLang);
      }

      track('chat_message', { q_len: question.length, lang: selectedLang });

      if (window.AIGuard && typeof AIGuard.maybeContinueFunnel === "function") {
        AIGuard.maybeContinueFunnel();
      }
    } catch (err) {
      if (typingBubble) typingBubble.style.display = "none";
      appendMessage("Error while connecting to the API.", "bot");
    }
  });
}

// ========================
// 🧰 Greeting flow
// ========================
function startGreetingFlow(withProducts = true) {
  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
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
  if (!chatLog) return;
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
  const list = document.getElementById('faq-list');
  const sidebar = document.querySelector('.faq-sidebar');
  if (!list || !sidebar) return;

  list.innerHTML = '';
  const items = (faqTexts[lang] || faqTexts['de']) || [];
  items.forEach(txt => {
    const li = document.createElement('li');
    li.innerText = txt;
    li.addEventListener('click', () => {
      input.value = txt;
      form.dispatchEvent(new Event('submit'));
      track('faq_click', { text: txt });
    });
    list.appendChild(li);
  });
}
function sendFAQ(text) {
  input.value = text;
  form.dispatchEvent(new Event("submit"));
  track('faq_click', { text });
}

// ========================
// 👍👎 Feedback
// ========================
function feedbackClick(type) {
  alert(type === "up" ? "Thanks for your feedback! 👍" : "We'll improve. 👎");
  track('chat_feedback', { type });
}

// ========================
// 🧭 Update Header & Greeting
// ========================
function updateUITexts(lang) {
  const h = document.querySelector('.chatbot-header h1');
  if (h) h.innerText = I18N.header[lang];

  resetChat();
  appendMessage(I18N.greeting[lang], "bot");
  showProductOptions();
}

// ========================
// 🔘 Show Product Bubble
// ========================
function showProductOptions() {
  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
  const keys = ["pv", "aircon", "heatpump", "tenant", "roof"];
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
      document.querySelectorAll('.product-button.selected').forEach(b => b.classList.remove('selected'));
      button.classList.add('selected');
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
  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");

  // bersihkan CTA/modal ketika user pindah ke funnel
  try {
    const overlay = document.getElementById("contact-overlay");
    if (overlay) overlay.remove();
    const cta = document.getElementById("start-cta");
    if (cta) cta.remove();
  } catch(_){}

  // set state dasar
  Funnel.reset();
  Funnel.state.product = key;
  Funnel.state.productLabel = (productLabels[key] && productLabels[key][lang]) || key;

  appendMessage(Funnel.state.productLabel, 'user');

  if (key === 'pv') {
    // hanya PV yang pakai flow Perspective
    askNext();
    return;
  }

  // produk lain → langsung form kontak
  appendMessage(
    lang === 'de'
      ? 'Für dieses Thema melden wir uns am besten persönlich. Bitte hinterlasse kurz deine Kontaktdaten.'
      : 'For this topic, we’ll get back to you personally. Please leave your contact details.',
    'bot'
  );
  if (typeof window.injectLeadContactFormChat === 'function') {
    window.injectLeadContactFormChat(Funnel.state.productLabel, Funnel.state.data);
  }
}

// ========================
// 🎯 Intent Detection (simple)
// ========================
function detectIntent(text) {
  const lower = (text || "").toLowerCase();

  if (lower.includes("harga") || lower.includes("kosten") || lower.includes("cost") || lower.includes("price")) {
    const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
    appendMessage(I18N.priceMsg[lang], "bot");

    const cta = document.createElement("a");
    cta.href = "https://planville.de/kontakt/";
    cta.target = "_blank";
    cta.rel = "noopener";
    cta.className = "cta-button";
    cta.innerText = (lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉");

    if (chatLog) chatLog.appendChild(cta);

    track('intent_preisinfo', { text, language: lang });
    return true;
  }

  if (lower.includes("tertarik") || lower.includes("interested")) {
    const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
    appendMessage(lang === "de" ? "Super! Bitte füllen Sie dieses kurze Formular aus:" : "Great! Please fill out this short form:", "bot");
    injectLeadMiniForm();
    return true;
  }

  return false;
}

// ========================
// 🧾 Mini Lead Form (quick)
// ========================
function injectLeadMiniForm() {
  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");

  const container = document.createElement("div");
  container.className = "chatbot-message bot-message";
  container.innerHTML = `
    <form id="lead-mini-form">
      <label>👤 ${lang === "de" ? "Name" : "Name"}:</label><br>
      <input type="text" id="leadName" required style="margin-bottom:6px; width:100%;" /><br>
      <label>📧 ${lang === "de" ? "E-Mail" : "Email"}:</label><br>
      <input type="email" id="leadEmail" required style="margin-bottom:6px; width:100%;" /><br>
      <button type="submit" style="padding:6px 14px; margin-top:4px;">
        ${lang === "de" ? "Absenden" : "Submit"}
      </button>
    </form>
  `;
  if (chatLog) chatLog.appendChild(container);

  const formEl = document.getElementById("lead-mini-form");
  if (!formEl) return;

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("leadName").value || "").trim();
    const email = (document.getElementById("leadEmail").value || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert(lang === "de" ? "Bitte geben Sie eine gültige E-Mail-Adresse ein." : "Please enter a valid email address.");
      return;
    }

    appendMessage(
      (lang === "de"
        ? `Vielen Dank ${name}! Unser Team wird Sie bald unter ${email} kontaktieren 🙌`
        : `Thank you ${name}! Our team will contact you soon at ${email} 🙌`)
      , "bot"
    );
    track('mini_form_submit', { email });
  });
}

// ========================
// 🔳 Quick buttons + Cards + Inputs
// ========================
function askQuick(text, options, fieldKey) {
  appendMessage(text, 'bot');

  const group = document.createElement('div');
  group.className = 'quick-group';

  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'quick-btn';
    b.type = 'button';
    b.innerText = opt.label;
    b.onclick = () => {
      appendMessage(opt.label, 'user');
      Funnel.state.data[fieldKey] = opt.value;

      if (fieldKey === 'timeline') {
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

// Kartu ala Perspective
function askCards(text, options, fieldKey) {
  appendMessage(text, 'bot');

  const grid = document.createElement('div');
  grid.className = 'pv-card-grid';

  options.forEach(opt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pv-card';
    b.innerHTML = `
      ${opt.emoji ? `<div class="pv-card__emoji">${opt.emoji}</div>` : ''}
      <div class="pv-card__label">${opt.label}</div>
    `;
    b.onclick = () => {
      appendMessage(opt.label, 'user');
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

// Input text satu kolom
function askInput(text, fieldKey, validator) {
  appendMessage(text, 'bot');

  const inp = document.createElement('input');
  inp.className = 'text-input';
  inp.placeholder = 'Antwort eingeben...';

  const btn = document.createElement('button');
  btn.className = 'quick-btn';
  btn.type = 'button';
  btn.innerText = 'Weiter';

  const wrap = document.createElement('div');
  wrap.className = 'quick-group';
  wrap.appendChild(inp);
  wrap.appendChild(btn);

  btn.onclick = () => {
    const val = (inp.value || "").trim();
    if (validator && !validator(val)) {
      alert('Bitte gültige Eingabe.');
      return;
    }
    appendMessage(val, 'user');
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
  const opts = (lang==="de"
    ? ['0–3 Monate','3–6 Monate','6–12 Monate']
    : ['0–3 months','3–6 months','6–12 months'])
    .map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
  askQuick(Q.timeline_q[lang], opts, 'timeline');
}

function exitWith(reason) {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  track('lead.exit', { product: Funnel.state.product, reason });
  Funnel.state.data.qualified = false;
  Funnel.state.data.disqualifyReason = reason;

  const txt = Q.disq_txt && Q.disq_txt[lang]
    ? Q.disq_txt[lang]
    : (lang==="de"
        ? 'Danke für dein Interesse! Leider können wir dir basierend auf deinen Angaben keine passende Dienstleistung anbieten.'
        : 'Thanks for your interest! Based on your answers we currently have no matching service.');

  const div = document.createElement('div');
  div.className = 'exit-bubble';
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
// 🚦 Conversational Funnel (Perspective-only)
// ========================
const Funnel = {
  state: { product: null, productLabel: null, data: {} },
  reset() { this.state = { product: null, productLabel: null, data: {} }; },
  progressByFields() {
    const d = this.state.data || {};
    const needed = [
      'install_location','building_type','self_occupied','ownership',
      'roof_type','storage_interest','install_timeline',
      'property_street_number','contact_time_window'
    ];
    const answered = needed.filter(k => d[k] !== undefined && d[k] !== null && d[k] !== '').length;
    const percent = Math.min(100, Math.round((answered/needed.length)*100));
    this.progress(percent);
  },
  progress(percent) {
    let bar = document.getElementById('funnel-progress-bar');
    if (!bar) {
      const wrap = document.createElement('div');
      wrap.className = 'funnel-progress';
      const inner = document.createElement('div');
      inner.className = 'funnel-progress__bar';
      inner.id = 'funnel-progress-bar';
      wrap.appendChild(inner);
      if (chatLog) chatLog.appendChild(wrap);
    }
    requestAnimationFrame(() => {
      const el = document.getElementById('funnel-progress-bar');
      if (el) el.style.width = Math.min(100, Math.max(0, percent)) + '%';
    });
  }
};
window.Funnel = Funnel;

// Mulai flow (tetap ada untuk kompatibilitas)
function startFunnel(productKey) {
  track('funnel.start', { product: productKey });
  Funnel.reset();
  Funnel.state.product = productKey;

  if (window.AIGuard && typeof AIGuard.reset === "function") AIGuard.reset();

  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
  const label = productLabels[productKey][lang] || productKey;
  Funnel.state.productLabel = label;
  appendMessage(label, 'user');
  askNext();
}

// Inti: flow Perspective PV
function askNext() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const p = Funnel.state.product;
  const d = Funnel.state.data;

  if (p !== 'pv') return; // hanya PV

  Funnel.progressByFields();

  // 1) Install location
  if (d.install_location === undefined) {
    const opts = (lang==="de"
      ? [
        {label:'Einfamilienhaus', value:'einfamilienhaus', emoji:'🏠'},
        {label:'Mehrfamilienhaus', value:'mehrfamilienhaus', emoji:'🏢'},
        {label:'Gewerbeimmobilie', value:'gewerbeimmobilie', emoji:'🏭'},
        {label:'Sonstiges', value:'sonstiges', emoji:'✨'}
      ]
      : [
        {label:'Single-family', value:'einfamilienhaus', emoji:'🏠'},
        {label:'Multi-family', value:'mehrfamilienhaus', emoji:'🏢'},
        {label:'Commercial', value:'gewerbeimmobilie', emoji:'🏭'},
        {label:'Other', value:'sonstiges', emoji:'✨'}
      ]);
    return askCards(Q.install_location_q[lang], opts, 'install_location');
  }

  // 2) Subtype (EFH only)
  if (d.install_location === 'einfamilienhaus' && d.building_type === undefined) {
    const opts = (lang==="de"
      ? ['Freistehendes Haus','Doppelhaushälfte','Reihenmittelhaus','Reihenendhaus']
      : ['Detached','Semi-detached','Mid-terrace','End-terrace'])
      .map(t => ({ label:t, value:t.toLowerCase().replace(/\s/g,'_'), emoji:'🏡' }));
    return askCards(Q.building_type_q[lang], opts, 'building_type');
  }

  // 3) Self occupied
  if (d.self_occupied === undefined) {
    const opts = (lang==="de" ? ['Ja','Nein'] : ['Yes','No'])
      .map((t,i)=>({label:t, value:i===0, emoji:i===0?'✅':'🚫'}));
    return askCards(Q.self_occupied_q[lang], opts, 'self_occupied');
  }

  // 4) Ownership
  if (d.ownership === undefined) {
    const opts = (lang==="de" ? ['Ja','Nein'] : ['Yes','No'])
      .map((t,i)=>({label:t, value:i===0, emoji:i===0?'🔑':'🚫'}));
    return askCards(Q.ownership_q[lang], opts, 'ownership');
  }

  // 5) Roof type
  if (d.roof_type === undefined) {
    const opts = (lang==="de" ? ['Flachdach','Spitzdach','Andere'] : ['Flat','Pitched','Other'])
      .map(t => ({label:t, value:t.toLowerCase(), emoji:'🏚️'}));
    return askCards(Q.roof_type_q[lang], opts, 'roof_type');
  }

  // 6) Battery interest
  if (d.storage_interest === undefined) {
    const opts = (lang==="de" ? ['Ja','Nein','Unsicher'] : ['Yes','No','Unsure'])
      .map(t => ({label:t, value:t.toLowerCase(), emoji:'🔋'}));
    return askCards(Q.storage_interest_q[lang], opts, 'storage_interest');
  }

  // 7) Install timeline
  if (d.install_timeline === undefined) {
    const opts = (lang==="de"
      ? [
        {label:'So schnell wie möglich', value:'asap'},
        {label:'In 1–3 Monaten', value:'1-3'},
        {label:'In 4–6 Monaten', value:'4-6'},
        {label:'In mehr als 6 Monaten', value:'>6'}
      ]
      : [
        {label:'As soon as possible', value:'asap'},
        {label:'In 1–3 months', value:'1-3'},
        {label:'In 4–6 months', value:'4-6'},
        {label:'In more than 6 months', value:'>6'}
      ]);
    return askCards(Q.install_timeline_q[lang], opts, 'install_timeline');
  }

  // 8) Street + Nr.
  if (d.property_street_number === undefined) {
    return askInput(Q.property_street_q[lang], 'property_street_number', v => (v||"").trim().length > 3);
  }

  // 9) Best contact time
  if (d.contact_time_window === undefined) {
    const opts = (lang==="de"
      ? ['08:00–12:00','12:00–16:00','16:00–20:00','Egal / zu jeder Zeit']
      : ['08:00–12:00','12:00–16:00','16:00–20:00','Any time'])
      .map(t => ({label:t, value:t}));
    return askCards(Q.contact_time_q[lang], opts, 'contact_time_window');
  }

  // 10) PESAN BIRU → SUMMARY → FORM
  if (!d.__done_perspective_summary) {
    d.__done_perspective_summary = true;

    appendMessage(
      lang==="de"
        ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:"
        : "Almost done! We just need your contact details:",
      "bot"
    );

    if (typeof window.showSummaryFromFunnel === "function") {
      window.showSummaryFromFunnel(d);
    }

    if (typeof window.injectLeadContactFormChat === "function") {
      window.injectLeadContactFormChat(Funnel.state.productLabel || "Photovoltaik", d);
    }
  }
}
window.askNext = askNext;

// ========================
// ✅ NUDGE: guard stop / user interrupt
// ========================
function nudgeToFormFromInterrupt(lang) {
  try {
    if (document.getElementById("lead-contact-form-chat")) return; // already shown

    const productLabel = (window.Funnel?.state?.productLabel) || "Photovoltaik";
    const qualification = (window.Funnel?.state?.data) || {};

    const msg = (lang === "de")
      ? "Alles klar! Dann bräuchten wir nur noch deine Kontaktdaten:"
      : "All right! We just need your contact details:";
    appendMessage(msg, "bot");

    if (typeof window.showSummaryFromFunnel === "function") {
      window.showSummaryFromFunnel(qualification);
    }

    if (typeof window.injectLeadContactFormChat === "function") {
      window.injectLeadContactFormChat(productLabel, qualification);
    } else {
      appendMessage(
        (lang === "de")
          ? 'Bitte nutze die <a href="https://planville.de/kontakt" target="_blank" rel="noopener">Kontaktseite</a>.'
          : 'Please use our <a href="https://planville.de/kontakt" target="_blank" rel="noopener">contact page</a>.',
        "bot"
      );
    }
  } catch(_) {}
}

// ========================
// ✨ NEW: CTA "Jetzt starten" + Floating overlay
// ========================
function maybeShowStartCTA(lang){
  try{
    if (document.getElementById("start-cta")) return; // already there
    const btn = document.createElement("button");
    btn.id = "start-cta";
    btn.className = "cta-button start-cta";
    btn.type = "button";
    btn.textContent = (I18N.startNow?.[lang]) || I18N.startNow.de;
    btn.onclick = () => {
      const productLabel =
        (window.Funnel?.state?.productLabel) ||
        (document.querySelector(".product-button.selected")?.textContent?.trim()) ||
        (lang==="en" ? "Photovoltaic" : "Photovoltaik");
      const qualification = window.Funnel?.state?.data ? { ...window.Funnel.state.data } : {};
      showFloatingContactOverlay(productLabel, qualification, lang);
      track("cta_start_click", { from:"generic_chat", lang });
    };
    chatLog.appendChild(btn);
    chatLog.scrollTop = chatLog.scrollHeight;
    track("cta_start_shown", { from:"generic_chat", lang });
  }catch(_){}
}

function ensureOverlayStyles(){
  if (document.getElementById("contact-overlay-styles")) return;
  const css = `
  #contact-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
  #contact-overlay .contact-modal{position:relative;background:#111b16;color:#e9f1ed;width:min(520px,92vw);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.4);border:1px solid #2e4b3f}
  #contact-overlay h3{margin:0 0 10px;font-size:1.1rem}
  #contact-overlay .contact-close{position:absolute;top:10px;right:14px;font-size:22px;line-height:1;background:transparent;border:none;color:#e9f1ed;cursor:pointer}
  #contact-overlay input,#contact-overlay select{width:100%;margin:6px 0;padding:10px 12px;border-radius:10px;border:1px solid #29473c;background:#0f1a15;color:#e9f1ed}
  #contact-overlay .contact-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
  #contact-overlay .btn-cancel{background:#2a2f2d;color:#e9f1ed;border:none;padding:10px 14px;border-radius:10px;cursor:pointer}
  #contact-overlay .btn-submit{background:#ff9f1c;color:#111;border:none;padding:10px 14px;border-radius:10px;cursor:pointer}
  .start-cta{display:inline-block;margin:8px 0 0}
  `;
  const s = document.createElement("style");
  s.id = "contact-overlay-styles";
  s.textContent = css;
  document.head.appendChild(s);
}

function showFloatingContactOverlay(productLabel, qualification={}, lang){
  ensureOverlayStyles();

  const old = document.getElementById("contact-overlay");
  if (old) old.remove();

  const L = (I18N.contactOverlay?.[lang]) || I18N.contactOverlay.de;
  const overlay = document.createElement("div");
  overlay.id = "contact-overlay";
  overlay.innerHTML = `
    <div class="contact-modal">
      <button class="contact-close" aria-label="Close">×</button>
      <h3>${L.title}</h3>
      <form id="contact-float-form">
        <input type="text" id="f_name"  placeholder="${L.name}" required />
        <input type="text" id="f_addr"  placeholder="${L.addr}" required />
        <input type="text" id="f_plz"   placeholder="${L.plz}" required />
        <input type="tel"  id="f_phone" placeholder="${L.phone}" required />
        <select id="f_best" required>
          ${(lang==="de"
              ? ["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]
              : ["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]
            ).map(t=>`<option value="${t}">${t}</option>`).join("")}
        </select>
        <div class="contact-actions">
          <button type="button" class="btn-cancel">${L.cancel}</button>
          <button type="submit" class="btn-submit">${L.submit}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  // Prefill
  try{
    if (qualification?.property_street_number) overlay.querySelector("#f_addr").value = qualification.property_street_number;
    if (qualification?.plz) overlay.querySelector("#f_plz").value = qualification.plz;
    if (qualification?.contact_time_window) overlay.querySelector("#f_best").value = qualification.contact_time_window;
  }catch(_){}

  const close = () => overlay.remove();
  overlay.querySelector(".contact-close").onclick = close;
  overlay.querySelector(".btn-cancel").onclick = close;
  overlay.addEventListener("click", (e)=>{ if (e.target.id==="contact-overlay") close(); });

  const form = overlay.querySelector("#contact-float-form");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const name  = form.querySelector("#f_name").value.trim();
    const addr  = form.querySelector("#f_addr").value.trim();
    const plz   = form.querySelector("#f_plz").value.trim();
    const phone = form.querySelector("#f_phone").value.trim();
    const best  = form.querySelector("#f_best").value;

    const q = { ...(qualification||{}) };
    q.property_street_number = addr;
    q.plz = plz;
    q.contact_time_window = best;

    try{
      track("contact_overlay_submit", { product: productLabel, lang });
      if (typeof window.sendLeadToBackend === "function") {
        await window.sendLeadToBackend({
          productLabel,
          name,
          address: addr,
          email: "web@lead.invalid",
          phone,
          origin: "floating-cta",
          qualification: q
        });
      }
      appendMessage(lang==="de" ? "Danke! Wir melden uns in Kürze." : "Thank you! We’ll contact you shortly.", "bot");
      close();
      const cta = document.getElementById("start-cta");
      if (cta) cta.remove();
    }catch(err){
      console.error(err);
      appendMessage(lang==="de" ? "Senden fehlgeschlagen. Bitte später erneut versuchen." : "Submission failed. Please try again later.", "bot");
    }
  });
}

// ========================
// 🧪 A/B Variant (sticky)
// ========================
const AB = { variant: (localStorage.getItem('ab_variant') || (Math.random() < 0.5 ? 'A' : 'B')) };
localStorage.setItem('ab_variant', AB.variant);
