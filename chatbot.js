// ========================
// 🔧 Helpers & Config
// ========================
function _baseURL() {
  try {
    let b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL.trim() : "";
    if (!b) return "";
    if (!/^https?:\/\//i.test(b)) b = "https://" + b;
    return b.endsWith("/") ? b.slice(0, -1) : b;
  } catch (e) { return ""; }
}
function _api(path) {
  if (typeof apiURL === "function") return apiURL(path);
  return _baseURL() + path;
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
      : "Thanks! Our team will contact you soon. Would you like to pick a time now?"
};

// ====== i18n for questions/prompts (funnel) ======
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

  disq_txt: { 
    de:'Danke für dein Interesse! Aufgrund deiner Antworten können wir dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!',
    en:'Thanks for your interest! Based on your answers we currently have no matching service. Feel free to check our website!'
  }
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
  startGreetingFlow();

  if (pvHero) {
    pvHero.style.cursor = "pointer";
    pvHero.addEventListener("click", () => {
      if (!chatStarted) {
        chatStarted = true;
        showChatArea();
        startGreetingFlow();
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
      startGreetingFlow(false);
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

        // jika guard minta stop (10 tektokan/low-confidence) → dorong ke form, jangan fallback ke /chat
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

      // Jika user mengetik saat funnel aktif → anggap "interrupt" dan dorong ke form (tanpa timeline)
      const inFunnel = !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
      const formAlreadyShown = !!document.getElementById("lead-contact-form-chat");
      if (inFunnel && !formAlreadyShown) {
        nudgeToFormFromInterrupt(selectedLang);
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
    // Tidak menambahkan CTA "Jetzt buchen" otomatis di sini (sudah dihapus sesuai revisi)
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
// 🧩 Product Click -> start funnel
// ========================
function handleProductSelection(key) {
  startFunnel(key);
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
// 🚦 Conversational Funnel (state-machine by missing field)
// ========================
const Funnel = {
  state: { product: null, productLabel: null, step: 0, data: {}, progressMax: 12 },
  reset() { this.state = { product: null, productLabel: null, step: 0, data: {}, progressMax: 12 }; },
  progressByFields() {
    const d = this.state.data || {};
    const p = this.state.product;

    const common = ['owner', ...(p!=='tenant' ? ['occupant'] : []), 'city', 'plz'];
    let productFields = [];
    if (p==='pv') productFields = ['prop_type','roof_form','area_sqm','orientation','neigung_deg','verschattung','consumption_kwh','battery_jn','battery_kwh','timeline'];
    if (p==='roof') productFields = ['prop_type','material','issues','area_sqm','addons','timeline'];
    if (p==='heatpump') productFields = ['prop_type','heatingType','living_area','pv_combo','timeline'];
    if (p==='tenant') productFields = ['prop_type','units','owner2','interest','timeline'];

    const needed = [...common, ...productFields];
    const answered = needed.filter(k => d[k] !== undefined && d[k] !== null).length;
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

function startFunnel(productKey) {
  track('funnel.start', { product: productKey });
  Funnel.reset();
  Funnel.state.product = productKey;

  // reset counter Q/A di guard supaya sesi fresh
  if (window.AIGuard && typeof AIGuard.reset === "function") AIGuard.reset();

  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
  const label = productLabels[productKey][lang] || productKey;
  Funnel.state.productLabel = label;
  appendMessage(label, 'user');
  askNext();
}

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
        return; // stop here (summary + form akan muncul via onTimelineSelected)
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

// Optional helper: tanya timeline langsung (agar kompatibel dengan AIGuard)
function askContact() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const opts = (lang==="de"
    ? ['0–3 Monate','3–6 Monate','6–12 Monate']
    : ['0–3 months','3–6 months','6–12 months'])
    .map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
  askQuick(Q.timeline_q[lang], opts, 'timeline');
}

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

function exitWith(reason) {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  track('lead.exit', { product: Funnel.state.product, reason });
  Funnel.state.data.qualified = false;
  Funnel.state.data.disqualifyReason = reason;

  const txt = Q.disq_txt[lang];
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

// Core "next unanswered field" flow
function askNext() {
  const lang = (langSwitcher && langSwitcher.value) || "de";
  const p = Funnel.state.product;
  const d = Funnel.state.data;

  Funnel.progressByFields();

  // Gates
  if (d.owner === undefined) {
    return askQuick(Q.owner_q[lang], [{label: (lang==="de"?"Ja":"Yes"), value:true}, {label:(lang==="de"?"Nein":"No"), value:false}], 'owner');
  }
  if (d.owner === false) return exitWith('kein_eigentümer');

  if (p !== 'tenant' && d.occupant === undefined) {
    return askQuick(Q.occupy_q[lang], [{label: (lang==="de"?"Ja":"Yes"), value:true}, {label:(lang==="de"?"Nein":"No"), value:false}], 'occupant');
  }
  if (p !== 'tenant' && d.occupant === false) return exitWith('nicht_bewohnt');

  // Ort → PLZ
  if (d.city === undefined) {
    return askInput(Q.city_q[lang], 'city', v => v.trim().length > 0);
  }
  if (d.plz === undefined) {
    return askInput(Q.plz_q[lang], 'plz', v => v.trim().length > 0);
  }

  // Product-specific
  if (p === 'pv') {
    if (d.prop_type === undefined) {
      const opts = (lang==="de"
        ? ['Einfamilienhaus','Mehrfamilienhaus','Gewerbe','Sonstiges']
        : ['Single-family','Multi-family','Commercial','Other']).map(t => ({label:t, value: t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.prop_type_q[lang], opts, 'prop_type');
    }
    if (d.roof_form === undefined) {
      const opts = (lang==="de"
        ? ['Satteldach','Walmdach','Flachdach','Pultdach','Sonstiges']
        : ['Gable','Hip','Flat','Mono-pitch','Other']).map(t => ({label:t, value: t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.roof_form_q[lang], opts, 'roof_form');
    }
    if (d.area_sqm === undefined) {
      return askInput(Q.area_q[lang], 'area_sqm', v => v.trim().length>0); // flexible
    }
    if (d.orientation === undefined) {
      const opts = (lang==="de"
        ? ['Süd','Süd-Ost','Süd-West','Ost','West','Nord','Gemischt']
        : ['South','South-East','South-West','East','West','North','Mixed'])
        .map(t => ({label:t, value: t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.orient_q[lang], opts, 'orientation');
    }
    if (d.neigung_deg === undefined) {
      return askInput(Q.pitch_q[lang], 'neigung_deg', v => v.trim().length>0); // flexible
    }
    if (d.verschattung === undefined) {
      const opts = (lang==="de"
        ? ['Keine','Leicht','Mittel','Stark']
        : ['None','Light','Medium','Heavy']).map(t => ({label:t, value:t.toLowerCase()}));
      return askQuick(Q.shade_q[lang], opts, 'verschattung');
    }
    if (d.consumption_kwh === undefined) {
      return askInput(Q.cons_q[lang], 'consumption_kwh', v => v.trim().length>0); // flexible
    }
    if (d.battery_jn === undefined) {
      return askQuick(Q.battery_q[lang], [{label:(lang==="de"?'Ja':'Yes'), value:true},{label:(lang==="de"?'Nein':'No'), value:false}], 'battery_jn');
    }
    if (d.battery_jn === true && d.battery_kwh === undefined) {
      return askInput(Q.battery_k_q[lang], 'battery_kwh', v => v.trim().length>0);
    }
    if (d.timeline === undefined) {
      const opts = (lang==="de"
        ? ['0–3 Monate','3–6 Monate','6–12 Monate']
        : ['0–3 months','3–6 months','6–12 months']).map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
      return askQuick(Q.timeline_q[lang], opts, 'timeline'); // will trigger summary+form
    }
    return; // done
  }

  if (p === 'roof') {
    if (d.prop_type === undefined) {
      const opts = (lang==="de"
        ? ['Einfamilienhaus','Mehrfamilienhaus','Gewerbe']
        : ['Single-family','Multi-family','Commercial']).map(t=>({label:t,value:t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.prop_type_q[lang], opts, 'prop_type');
    }
    if (d.material === undefined) {
      const opts = (lang==="de" ? ['Ziegel','Bitumen','Blech'] : ['Tile','Bitumen','Metal'])
        .map(t=>({label:t,value:t.toLowerCase()}));
      return askQuick('Dachmaterial?', opts, 'material');
    }
    if (d.issues === undefined) {
      const opts = (lang==="de"
        ? ['Undichtigkeiten','Dämmung','Keine']
        : ['Leaks','Insulation','None']).map(t=>({label:t,value:t.toLowerCase()}));
      return askQuick(Q.issues_q[lang], opts, 'issues');
    }
    if (d.area_sqm === undefined) {
      return askInput('Dachfläche (m²)?', 'area_sqm', v => v.trim().length>0);
    }
    if (d.addons === undefined) {
      const opts = (lang==="de"
        ? ['Dämmung','Dachfenster','Keine']
        : ['Insulation','Roof windows','None']).map(t=>({label:t,value:t.toLowerCase()}));
      return askQuick('Zusatzoptionen?', opts, 'addons');
    }
    if (d.timeline === undefined) {
      const opts = (lang==="de"
        ? ['0–3 Monate','3–6 Monate','6–12 Monate']
        : ['0–3 months','3–6 months','6–12 months']).map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
      return askQuick(Q.timeline_q[lang], opts, 'timeline');
    }
    return;
  }

  if (p === 'heatpump') {
    if (d.prop_type === undefined) {
      const opts = (lang==="de"
        ? ['Einfamilienhaus','Mehrfamilienhaus','Gewerbe']
        : ['Single-family','Multi-family','Commercial']).map(t=>({label:t,value:t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.prop_type_q[lang], opts, 'prop_type');
    }
    if (d.heatingType === undefined) {
      const opts = (lang==="de" ? ['Gas','Öl','Fernwärme'] : ['Gas','Oil','District heating'])
        .map(t=>({label:t,value:t.toLowerCase()}));
      return askQuick(Q.heatingType_q[lang], opts, 'heatingType');
    }
    if (d.living_area === undefined) {
      return askInput(Q.living_area_q[lang], 'living_area', v => v.trim().length>0);
    }
    if (d.pv_combo === undefined) {
      return askQuick('Kombi mit PV?', [{label:(lang==="de"?'Ja':'Yes'), value:true},{label:(lang==="de"?'Nein':'No'), value:false}], 'pv_combo');
    }
    if (d.timeline === undefined) {
      const opts = (lang==="de"
        ? ['0–3 Monate','3–6 Monate','6–12 Monate']
        : ['0–3 months','3–6 months','6–12 months']).map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
      return askQuick(Q.timeline_q[lang], opts, 'timeline');
    }
    return;
  }

  if (p === 'tenant') {
    if (d.prop_type === undefined) {
      const opts = (lang==="de" ? ['Mehrfamilienhaus','Gewerbe'] : ['Multi-family','Commercial'])
        .map(t=>({label:t,value:t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick(Q.prop_type_q[lang], opts, 'prop_type');
    }
    if (d.units === undefined) {
      return askInput(lang==="de"?'Anzahl Wohneinheiten?':'Number of units?', 'units', v => v.trim().length>0);
    }
    if (d.owner2 === undefined) {
      return askQuick(lang==="de"?'Bist du Eigentümer/Verwalter?':'Are you the owner/manager?',
        [{label:(lang==="de"?'Ja':'Yes'), value:true},{label:(lang==="de"?'Nein':'No'), value:false}], 'owner2');
    }
    if (d.owner2 === false) return exitWith('kein_eigentümer');
    if (d.interest === undefined) {
      const opts = (lang==="de" ? ['PV','Wärmepumpe','Dach'] : ['PV','Heat pump','Roof'])
        .map(t=>({label:t,value:t.toLowerCase().replace(/\s/g,'_')}));
      return askQuick('Interesse?', opts, 'interest');
    }
    if (d.timeline === undefined) {
      const opts = (lang==="de"
        ? ['0–3 Monate','3–6 Monate','6–12 Monate']
        : ['0–3 months','3–6 months','6–12 months']).map((t,i)=>({label:t, value:(i===0?'0-3':i===1?'3-6':'6-12')}));
      return askQuick(Q.timeline_q[lang], opts, 'timeline');
    }
    return;
  }
}
window.askNext = askNext;

// ========================
// ✅ NUDGE: kalau user motong funnel / guard stop → tampilkan summary & form
// ========================
function nudgeToFormFromInterrupt(lang) {
  try {
    if (document.getElementById("lead-contact-form-chat")) return; // already shown

    const productLabel = (window.Funnel?.state?.productLabel) || "Photovoltaik";
    const qualification = (window.Funnel?.state?.data) || {};

    if (typeof window.showSummaryFromFunnel === "function") {
      window.showSummaryFromFunnel(qualification);
    }

    const msg = (lang === "de")
      ? "Alles klar! Dann bräuchten wir nur noch deine Kontaktdaten:"
      : "All right! We just need your contact details:";
    appendMessage(msg, "bot");

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
// 🧪 A/B Variant (sticky)
// ========================
const AB = { variant: (localStorage.getItem('ab_variant') || (Math.random() < 0.5 ? 'A' : 'B')) };
localStorage.setItem('ab_variant', AB.variant);
