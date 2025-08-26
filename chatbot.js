// ========================
// 🔧 Helpers & Config
// ========================
function _baseURL() {
  try {
    let b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL.trim() : "";
    if (!b) return "";
    if (!/^https?:\/\//i.test(b)) b = "https://" + b; // auto add scheme
    return b.endsWith("/") ? b.slice(0, -1) : b;
  } catch (e) { return ""; }
}

// ========================
// 🌍 i18n strings for UI
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
  miniFormThanks: (lang, name, email) =>
    lang === "de"
      ? `Vielen Dank ${name}! Unser Team wird Sie bald unter ${email} kontaktieren 🙌`
      : `Thank you ${name}! Our team will contact you soon at ${email} 🙌`,
  unsure: {
    de: `Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 kontaktieren Sie unser Team hier</a>.`,
    en: `I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 contact our team here</a>.`
  },
  followUp: (lang, label) =>
    lang === "de"
      ? `Was möchten Sie genau zu <b>${label}</b> wissen oder erreichen?`
      : `What exactly would you like to know or achieve about <b>${label}</b>?`,
  askContactDone: (lang) =>
    lang === "de"
      ? "Danke! Unser Team meldet sich zeitnah. Möchtest du direkt einen Termin wählen?"
      : "Thanks! Our team will contact you soon. Would you like to pick a time now?"
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

// robot intro elements
const pvHero = document.querySelector(".pv-hero");
const pvBalloon = document.querySelector(".pv-balloon span");

// ========================
// 🧠 Load Chat History
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
let chatStarted = false; // start chat only after robot clicked

function loadChatHistory() {
  chatHistory.forEach(entry => appendMessage(entry.message, entry.sender, false));
}

// ========================
// 🚀 Init on load
// ========================
window.addEventListener("load", () => {
  const selectedLang = localStorage.getItem("selectedLang") || (CONFIG.LANG_DEFAULT || "de");
  if (langSwitcher) langSwitcher.value = selectedLang;

  // Set initial robot balloon text to selected language
  if (pvBalloon) pvBalloon.textContent = I18N.robotBalloon[selectedLang];

  // Sidebar FAQ + header (chat UI stays hidden until robot is clicked)
  updateFAQ(selectedLang);
  updateHeaderOnly(selectedLang);

  // Cookie consent
  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    const banner = document.getElementById("cookie-banner");
    if (banner) banner.style.display = "block";
  } else if (consent === "accepted") {
    if (typeof enableGTM === "function") enableGTM();
  }

  // (Jika ingin chat muncul langsung, aktifkan dua baris di bawah)
  showChatArea();
  chatStarted = true;
  startGreetingFlow();

  // Hero click to start chat
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
  if (sidebar) sidebar.style.display = ""; // FAQ tetap tampil; set "none" kalau mau disembunyikan juga
}
function showChatArea() {
  const container = document.querySelector(".chatbot-container");
  if (container) container.style.display = "flex";
  if (pvHero) pvHero.style.display = "none"; // sembunyikan hero setelah diklik
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

    // Update robot balloon immediately
    if (pvBalloon) pvBalloon.textContent = I18N.robotBalloon[lang];

    // Update FAQ + header (greeting only if chat started)
    updateFAQ(lang);
    if (chatStarted) {
      updateUITexts(lang); // reset chat & greet
    } else {
      updateHeaderOnly(lang); // only header text before chat starts
    }

    if (typeof gtag !== "undefined") {
      gtag('event', 'language_switch', { event_category: 'chatbot', event_label: lang });
    }
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
      startGreetingFlow(false); // don't re-append greeting if user already typing
    }

    const question = (input.value || "").trim();
    const selectedLang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
    if (!question) return;

    appendMessage(question, "user");
    saveToHistory("user", question);
    input.value = "";

    if (typingBubble) typingBubble.style.display = "block";

    // local intent
    if (detectIntent(question)) {
      if (typingBubble) typingBubble.style.display = "none";
      return;
    }

    try {
      let finalReply = null;

      // gunakan AIGuard jika tersedia (ai_guardrails_vlite.js)
      if (window.AIGuard && typeof AIGuard.ask === "function") {
        const ai = await AIGuard.ask(question, selectedLang);
        finalReply = (ai && ai.text) ? ai.text : null;
      }

      // fallback ke /chat jika AIGuard tidak ada / gagal
      if (!finalReply) {
        const res = await fetch(`${_baseURL()}/chat`, {
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

      if (typeof trackChatEvent === "function") {
        trackChatEvent(question, selectedLang);
      }

      // lanjutkan funnel kalau lagi aktif & tidak ada pertanyaan terbuka
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
  // Header + chat greeting
  updateUITexts(lang); // resets chat & adds greeting + product options
  if (!withProducts) {
    const productBlock = document.getElementById("product-options-block");
    if (productBlock) productBlock.remove();
  }
}

// Update header only (no reset)
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

    // CTA only jika pesan cukup panjang
    const plain = (msg || "").replace(/<[^>]*>/g, "");
    if (plain.length > 100) {
      const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
      const cta = document.createElement("a");
      cta.href = "https://planville.de/kontakt/";
      cta.target = "_blank";
      cta.rel = "noopener";
      cta.className = "cta-button";
      cta.innerText = I18N.ctaBook[lang];
      msgDiv.appendChild(cta);
    }
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
    });
    list.appendChild(li);
  });
}

function sendFAQ(text) {
  input.value = text;
  form.dispatchEvent(new Event("submit"));
  if (typeof trackFAQClick === "function") trackFAQClick(text);
}

// ========================
// 👍👎 Feedback
// ========================
function feedbackClick(type) {
  alert(type === "up" ? "Thanks for your feedback! 👍" : "We'll improve. 👎");
  if (typeof gtag !== "undefined") {
    gtag('event', 'chat_feedback', { event_category: 'chatbot', event_label: type });
  }
}

// ========================
// 🧭 Update Header & Greeting
// ========================
function updateUITexts(lang) {
  const h = document.querySelector('.chatbot-header h1');
  if (h) h.innerText = I18N.header[lang];

  // Full reset + greeting
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
    button.onclick = () => handleProductSelection(key);
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

  // price intent
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

    if (typeof gtag !== "undefined") {
      gtag('event', 'intent_preisinfo', { event_category: 'intent', event_label: text, language: lang });
    }
    return true;
  }

  // interested intent
  if (lower.includes("tertarik") || lower.includes("interested")) {
    const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
    appendMessage(lang === "de" ? "Super! Bitte füllen Sie dieses kurze Formular aus:" : "Great! Please fill out this short form:", "bot");
    injectLeadMiniForm();
    return true;
  }

  return false;
}

// ========================
// 🧾 Mini Lead Form
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

    appendMessage(I18N.miniFormThanks(lang, name, email), "bot");

    if (typeof gtag !== "undefined") {
      gtag('event', 'mini_form_submit', { event_category: 'leadform', event_label: email });
    }
  });
}

// ========================
// 🚦 Conversational Funnel (Multi-Product)
// ========================
const Funnel = {
  state: { product: null, productLabel: null, step: 0, data: {}, progressMax: 8 },
  reset() { this.state = { product: null, productLabel: null, step: 0, data: {}, progressMax: 8 }; },
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
window.Funnel = Funnel; // expose for other modules

function startFunnel(productKey) {
  track('funnel.start', { product: productKey });
  Funnel.reset();
  Funnel.state.product = productKey;

  const lang = (langSwitcher && langSwitcher.value) || (CONFIG.LANG_DEFAULT || "de");
  const label = productLabels[productKey][lang] || productKey; // keep label
  Funnel.state.productLabel = label; // simpan label untuk payload
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

      // end funnel on 'timeline' → show mini contact form (index.html)
      if (fieldKey === 'timeline') {
        if (typeof window.onTimelineSelected === "function") {
          window.onTimelineSelected(opt.value);
        }
        group.remove();
        return; // stop auto-continue; contact form is the last step
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
  track('lead.exit', { product: Funnel.state.product, reason });
  Funnel.state.data.qualified = false;
  Funnel.state.data.disqualifyReason = reason;

  const txt = 'Danke für dein Interesse! Aufgrund deiner Antworten können wir dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!';
  const div = document.createElement('div');
  div.className = 'exit-bubble';
  div.innerText = txt;
  if (chatLog) {
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // kirim disqualified lead pakai helper standar (index.html)
  if (typeof window.sendDisqualifiedLead === "function") {
    window.sendDisqualifiedLead(reason);
  }
}

function askNext() {
  const p = Funnel.state.product;
  const s = Funnel.state.step++;

  track('funnel.step', { product: p, step: Funnel.state.step });
  Funnel.progress(((s) / Funnel.state.progressMax) * 100);

  // 0: owner
  if (s === 0) return askQuick(T('owner_q'), [{ label: 'Ja', value: true }, { label: 'Nein', value: false }], 'owner');

  // owner check
  if (s === 1 && Funnel.state.data.owner === false) return exitWith('kein_eigentümer');

  // 1: occupant
  if (s === 1) return askQuick(T('occupy_q'), [{ label: 'Ja', value: true }, { label: 'Nein', value: false }], 'occupant');

  // occupant check (not for tenant)
  if (s === 2 && Funnel.state.data.occupant === false && p !== 'tenant') return exitWith('nicht_bewohnt');

  // Branching
  if (p === 'pv') {
    if (s === 2) return askQuick('Welcher Gebäudetyp?', [
      { label: 'Einfamilienhaus', value: 'einfamilienhaus' },
      { label: 'Mehrfamilienhaus', value: 'mehrfamilienhaus' },
      { label: 'Gewerbe', value: 'gewerbe' }
    ], 'prop_type');

    if (s === 3) return askQuick('Bauform (EFH)?', [
      { label: 'Freistehend', value: 'freistehend' },
      { label: 'Doppelhaushälfte', value: 'doppelhaus' },
      { label: 'Reihenhaus', value: 'reihenhaus' }
    ], 'sub_type');

    if (s === 4) return askInput('Wie groß ist die Dachfläche (m²) ca.?', 'area_sqm', v => /^[0-9]+(\.[0-9]+)?$/.test(v));

    if (s === 5) {
      const area = parseFloat(Funnel.state.data.area_sqm || 0);
      if (area && area < 10) return exitWith('dachfläche_zu_klein');
      return askQuick('Dachausrichtung?', [
        { label: 'Süd', value: 'sued' }, { label: 'West', value: 'west' },
        { label: 'Ost', value: 'ost' },  { label: 'Nord', value: 'nord' },
        { label: 'Kombination', value: 'kombination' }
      ], 'orientation');
    }

    if (s === 6) return askInput('Jahresstromverbrauch (kWh)?', 'consumption_kwh', v => /^[0-9]{3,6}$/.test(v));
    if (s === 7) return askQuick('Zusatzoptionen?', [
      { label: 'Speicher', value: 'speicher' },
      { label: 'Wallbox', value: 'wallbox' },
      { label: 'Keine', value: 'none' }
    ], 'addons');

    if (s === 8) return askContact();
  }

  if (p === 'roof') {
    if (s === 2) return askQuick('Gebäudetyp?', [
      { label: 'Einfamilienhaus', value: 'einfamilienhaus' },
      { label: 'Mehrfamilienhaus', value: 'mehrfamilienhaus' },
      { label: 'Gewerbe', value: 'gewerbe' }
    ], 'prop_type');

    if (s === 3) return askQuick('Dachmaterial?', [
      { label: 'Ziegel', value: 'ziegel' },
      { label: 'Bitumen', value: 'bitumen' },
      { label: 'Blech', value: 'blech' }
    ], 'material');

    if (s === 4) return askQuick('Gibt es Probleme?', [
      { label: 'Undichtigkeiten', value: 'undicht' },
      { label: 'Dämmung', value: 'daemmung' },
      { label: 'Keine', value: 'none' }
    ], 'issues');

    if (s === 5) return askInput('Dachfläche (m²)?', 'area_sqm', v => /^[0-9]+(\.[0-9]+)?$/.test(v));

    if (s === 6) return askQuick('Zusatzoptionen?', [
      { label: 'Dämmung', value: 'daemmung' },
      { label: 'Dachfenster', value: 'dachfenster' },
      { label: 'Keine', value: 'none' }
    ], 'addons');

    if (s === 7) return askContact();
  }

  if (p === 'heatpump') {
    if (s === 2) return askQuick('Gebäudetyp?', [
      { label: 'Einfamilienhaus', value: 'einfamilienhaus' },
      { label: 'Mehrfamilienhaus', value: 'mehrfamilienhaus' },
      { label: 'Gewerbe', value: 'gewerbe' }
    ], 'prop_type');

    if (s === 3) return askQuick('Aktuelle Heizart?', [
      { label: 'Gas', value: 'gas' },
      { label: 'Öl', value: 'öl' },
      { label: 'Fernwärme', value: 'fernwärme' }
    ], 'heatingType');

    if (s === 4) return askInput('Wohnfläche (m²)?', 'living_area', v => /^[0-9]+(\.[0-9]+)?$/.test(v));

    if (s === 5) {
      const la = parseFloat(Funnel.state.data.living_area || 0);
      if (la && la < 30) return exitWith('wohnfläche_zu_klein');
      return askQuick('Kombi mit PV?', [{ label: 'Ja', value: true }, { label: 'Nein', value: false }], 'pv_combo');
    }

    if (s === 6) return askContact();
  }

  if (p === 'tenant') {
    if (s === 2) return askQuick('Immobilientyp?', [
      { label: 'Mehrfamilienhaus', value: 'mehrfamilienhaus' },
      { label: 'Gewerbe', value: 'gewerbe' }
    ], 'prop_type');

    if (s === 3) return askInput('Anzahl Wohneinheiten?', 'units', v => /^[0-9]+$/.test(v));

    if (s === 4) {
      const u = parseInt(Funnel.state.data.units || '0', 10);
      if (u && u < 3) return exitWith('einheiten_zu_wenig');
      return askQuick('Bist du Eigentümer/Verwalter?', [{ label: 'Ja', value: true }, { label: 'Nein', value: false }], 'owner2');
    }

    if (s === 5 && Funnel.state.data.owner2 === false) return exitWith('kein_eigentümer');
    if (s === 5) return askQuick('Interesse?', [
      { label: 'PV', value: 'pv' },
      { label: 'Wärmepumpe', value: 'wp' },
      { label: 'Dach', value: 'dach' }
    ], 'interest');

    if (s === 6) return askContact();
  }
}
window.askNext = askNext; // expose for AIGuard.maybeContinueFunnel

// ------------------------
// 📇 Contact + CRM submit
// ------------------------
function askContact() {
  // Hanya ajukan timeline; mini-form kontak muncul saat opsi timeline dipilih (lihat hook di askQuick)
  askQuick(T('timeline_q'), [
    { label: '0–3 Monate',  value: '0-3'  },
    { label: '3–6 Monate',  value: '3-6'  },
    { label: '6–12 Monate', value: '6-12' }
  ], 'timeline');
  // (Auto-CTA setelah timeline dipindah ke onTimelineSelected di index.html)
}

// ========================
// 🧪 A/B Variant + Tracking
// ========================
const AB = {
  variant: (localStorage.getItem('ab_variant') || (Math.random() < 0.5 ? 'A' : 'B'))
};
localStorage.setItem('ab_variant', AB.variant);

function track(eventName, props = {}) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: eventName, variant: AB.variant }, props));
  } catch (e) {}
  try {
    fetch(_baseURL() + '/track', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ event: eventName, props: Object.assign({ variant: AB.variant }, props) })
    });
  } catch (e) {}
}

// Text variants (fixed: no recursion)
function T(key) {
  const v = AB.variant;
  const dict = {
    owner_q:   { A: 'Bist du Eigentümer:in der Immobilie?', B: 'Bist du Eigentümer/in der Immobilie?' },
    occupy_q:  { A: 'Bewohnst du die Immobilie selbst?',     B: 'Wohnst du selbst in der Immobilie?' },
    roof_area: { A: 'Wie groß ist die Dachfläche (m²) ca.?', B: 'Wie groß ist die Dachfläche (m²) ca.?' },
    timeline_q:{ A: 'Wann planst du die Umsetzung?',         B: 'Wann möchtest du das Projekt starten?' },
    contact_q: { A: 'Super! Wie ist dein Name, E-Mail und Telefonnummer?', B: 'Top – nenn mir bitte Name, E-Mail und Telefon.' }
  };
  return (dict[key] && dict[key][v]) || key;
}
