const productLabels = {
  heatpump: { en: "Heat Pump 🔥", de: "Wärmepumpe 🔥" },
  aircon: { en: "Air Conditioner ❄️", de: "Klimaanlage ❄️" },
  pv: { en: "Photovoltaic System ☀️", de: "Photovoltaikanlage ☀️" },
  roof: { en: "Roof Renovation 🛠️", de: "Dachsanierung 🛠️" },
  tenant: { en: "Tenant Power 🏠", de: "Mieterstrom 🏠" },
};

// Helper: normalize base URL
function _baseURL() {
  try {
    const b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL) ? CONFIG.BASE_API_URL : "";
    return b.endsWith("/") ? b.slice(0, -1) : b;
  } catch(e) { return ""; }
}

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

// ========================
// 🧠 Load Chat History from localStorage
// ========================
let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];

function loadChatHistory() {
  chatHistory.forEach(entry => {
    appendMessage(entry.message, entry.sender, false);
  });
}

window.onload = () => {
  const selectedLang = localStorage.getItem("selectedLang") || "de";
  langSwitcher.value = selectedLang;
  updateFAQ(selectedLang);
  updateUITexts("de");
  loadChatHistory();
  
  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    document.getElementById("cookie-banner").style.display = "block";
  } else if (consent === "accepted") {
    if (typeof enableGTM === "function") enableGTM();
  }
};

// ========================
// 🌗 Mode Switcher
// ========================
toggle.addEventListener("change", () => {
  document.body.style.background = toggle.checked ? "var(--bg-light)" : "var(--bg-dark)";
  document.body.style.color = toggle.checked ? "var(--text-light)" : "var(--text-dark)";
});

// ========================
// 🌐 Language Switcher
// ========================
langSwitcher.addEventListener("change", () => {
  const lang = langSwitcher.value;
  localStorage.setItem("selectedLang", lang);
  updateFAQ(lang);
  updateUITexts(lang);

  if (typeof gtag !== "undefined") {
    gtag('event', 'language_switch', {
      event_category: 'chatbot',
      event_label: lang
    });
  }
});

// ========================
// 📩 Form Submit Handler
// ========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  const selectedLang = langSwitcher.value;

  if (!question) return;

  appendMessage(question, "user");
  saveToHistory("user", question);
  input.value = "";
  typingBubble.style.display = "block";

  // Intent detection
  if (detectIntent(question)) {
    typingBubble.style.display = "none";
    return;
  }

  try {
    const res = await fetch(`${_baseURL()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, lang: selectedLang })
    });

    const data = await res.json();
    typingBubble.style.display = "none";

    const replyRaw = data.answer ?? data.reply;
    const reply = (typeof replyRaw === "string" ? replyRaw.trim() : "");
    const fallbackMsg = selectedLang === "de"
      ? `Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank">📞 kontaktieren Sie unser Team hier</a>.`
      : `I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank">📞 contact our team here</a>.`;

    const finalReply = reply && reply !== "" ? reply : fallbackMsg;
    appendMessage(finalReply, "bot");
    saveToHistory("bot", finalReply);

    if (typeof trackChatEvent === "function") {
      trackChatEvent(question, selectedLang);
    }
  } catch (err) {
    typingBubble.style.display = "none";
    appendMessage("Error while connecting to GPT API.", "bot");
  }
});


// ========================
// 💬 Append Message
// ========================
function appendMessage(msg, sender, scroll = true) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `chatbot-message ${sender}-message`;
  msgDiv.innerHTML = msg;

  if (sender === "bot") {
    const feedback = document.createElement("div");
    feedback.className = "feedback-btns";
    feedback.innerHTML = `
      <button onclick="feedbackClick('up')">👍</button>
      <button onclick="feedbackClick('down')">👎</button>
    `;
    msgDiv.appendChild(feedback);

    if (msg.length > 100) {
      const lang = langSwitcher.value;
      const cta = document.createElement("a");
      cta.href = "https://planville.de/kontakt/";
      cta.target = "_blank";
      cta.className = "cta-button";
      cta.innerText = lang === "de" ? "Jetzt Beratung buchen 👉" : "Book a consultation 👉";
      msgDiv.appendChild(cta);
    }
  }

  chatLog.appendChild(msgDiv);
  if (scroll) chatLog.scrollTop = chatLog.scrollHeight;
}

// ========================
// 🧠 Save Chat to localStorage
// ========================
function saveToHistory(sender, message) {
  chatHistory.push({ sender, message });
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}

// ========================
// 🗑️ Reset Chat
// ========================
function resetChat() {
  localStorage.removeItem("chatHistory");
  chatHistory = [];
  chatLog.innerHTML = "";
  const productBlock = document.getElementById("product-options-block");
if (productBlock) productBlock.remove();
}

// ========================
// 📌 FAQ Updater
// ========================
function updateFAQ(lang) {
  const faqList = document.getElementById("faq-list");
  faqList.innerHTML = "";

  faqTexts[lang].forEach((text) => {
    const li = document.createElement("li");
    li.innerText = text;
    li.onclick = () => sendFAQ(text);
    faqList.appendChild(li);
  });
}

// ========================
// 📤 FAQ Click → Input
// ========================
function sendFAQ(text) {
  input.value = text;
  form.dispatchEvent(new Event("submit"));

  if (typeof trackFAQClick === "function") {
    trackFAQClick(text);
  }
}

// ========================
// 👍👎 Feedback
// ========================
function feedbackClick(type) {
  alert(type === "up" ? "Thanks for your feedback! 👍" : "We'll improve. 👎");

  if (typeof gtag !== "undefined") {
    gtag('event', 'chat_feedback', {
      event_category: 'chatbot',
      event_label: type,
    });
  }
}

// ========================
// 🌐 Update Header & Greeting
// ========================
function updateUITexts(lang) {
  document.querySelector('.chatbot-header h1').innerText =
    lang === "de" ? "Chatte mit Planville AI 🤖" : "Chat with Planville AI 🤖";

  resetChat();

  const greeting = lang === "de"
    ? "Hallo! 👋 Was kann ich für Sie tun?<br>Bitte wählen Sie ein Thema:"
    : "Hello! 👋 What can I do for you?<br>Please choose a topic:";

  appendMessage(greeting, "bot");
  
  showProductOptions(); // 
}

// ========================
// 🔘 Show Product Bubble
// ========================
function showProductOptions() {
  const lang = langSwitcher.value;
  const keys = ["pv", "aircon", "heatpump", "tenant", "roof"];

  const existing = document.getElementById("product-options-block");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.className = "product-options";
  container.id = "product-options-block";

  keys.forEach((key) => {
    const button = document.createElement("button");
    button.innerText = productLabels[key][lang];
    button.className = "product-button";
    button.dataset.key = key; // ✅ gunakan key
    button.onclick = () => handleProductSelection(key);
    container.appendChild(button);
  });

  chatLog.appendChild(container);
  chatLog.scrollTop = chatLog.scrollHeight;
}


// ========================
// 🧩 Product Click
// ========================
function handleProductSelection(key) {
  const lang = langSwitcher.value;
  const label = productLabels[key][lang];

  appendMessage(label, "user");

  if (typeof gtag !== "undefined") {
    gtag('event', 'select_product', {
      event_category: 'chatbot_interaction',
      event_label: key,
      language: lang
    });
  }

  setTimeout(() => {
    const followUp = lang === "de"
      ? `Was möchten Sie genau zu <b>${label}</b> wissen oder erreichen?`
      : `What exactly would you like to know or achieve about <b>${label}</b>?`;
    appendMessage(followUp, "bot");
  }, 500);
}

// ========================
// 🎯 Intent Detection
// ========================
function detectIntent(text) {
  const lower = text.toLowerCase();

  // Intent: Harga
  if (lower.includes("harga") || lower.includes("kosten") || lower.includes("cost")) {
    const lang = langSwitcher.value;
    const msg = lang === "de"
      ? "Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:"
      : "Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:";

    appendMessage(msg, "bot");

    const cta = document.createElement("a");
    cta.href = "https://planville.de/kontakt/";
    cta.target = "_blank";
    cta.className = "cta-button";
    cta.innerText = lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉";
    chatLog.appendChild(cta);

    if (typeof gtag !== "undefined") {
      gtag('event', 'intent_preisinfo', {
        event_category: 'intent',
        event_label: text,
        language: lang
      });
    }
    return true;
  }

  // Intent: Tertarik
  if (lower.includes("tertarik") || lower.includes("interested")) {
    const lang = langSwitcher.value;
    const msg = lang === "de"
      ? "Super! Bitte füllen Sie dieses kurze Formular aus:"
      : "Great! Please fill out this short form:";

    appendMessage(msg, "bot");
    injectLeadMiniForm();
    return true;
  }

  return false;
}

// ========================
// 🧾 Form Mini Wizard
// ========================
function injectLeadMiniForm() {
  const lang = langSwitcher.value;
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

  chatLog.appendChild(container);

  document.getElementById("lead-mini-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("leadName").value;
    const email = document.getElementById("leadEmail").value;

    // ✅ Validasi Email Sederhana
    if (!email.includes("@") || !email.includes(".")) {
      alert(lang === "de" ? "Bitte geben Sie eine gültige E-Mail-Adresse ein." : "Please enter a valid email address.");
      return;
    }

    appendMessage(
      lang === "de"
        ? `Vielen Dank ${name}! Unser Team wird Sie bald unter ${email} kontaktieren 🙌`
        : `Thank you ${name}! Our team will contact you soon at ${email} 🙌`,
      "bot"
    );

    if (typeof gtag !== "undefined") {
      gtag('event', 'mini_form_submit', {
        event_category: 'leadform',
        event_label: email
      });
    }
  });
}

// ========================
// 🚦 Conversational Funnel Engine (Multi-Produkt)
// ========================
const Funnel = {
  state: {
    product: null,
    step: 0,
    data: {},
    progressMax: 8
  },
  reset() { this.state = { product: null, step: 0, data: {}, progressMax: 8 }; },
  progress(percent) {
    let bar = document.getElementById('funnel-progress-bar');
    if (!bar) {
      const wrap = document.createElement('div');
      wrap.className = 'funnel-progress';
      const inner = document.createElement('div');
      inner.className = 'funnel-progress__bar';
      inner.id = 'funnel-progress-bar';
      wrap.appendChild(inner);
      chatLog.appendChild(wrap);
    }
    requestAnimationFrame(() => {
      document.getElementById('funnel-progress-bar').style.width = Math.min(100, Math.max(0, percent)) + '%';
    });
  }
};

function startFunnel(productKey) {
  track('funnel.start', {product: productKey});
  Funnel.reset();
  Funnel.state.product = productKey;
  appendMessage(productLabels[productKey][langSwitcher.value], 'user');
  askNext();
}

function askQuick(text, options, fieldKey) {
  appendMessage(text, 'bot');
  const group = document.createElement('div');
  group.className = 'quick-group';
  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'quick-btn';
    b.innerText = opt.label;
    b.onclick = () => {
      appendMessage(opt.label, 'user');
      Funnel.state.data[fieldKey] = opt.value;
      askNext();
      group.remove();
    };
    group.appendChild(b);
  });
  chatLog.appendChild(group);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function askInput(text, fieldKey, validator) {
  appendMessage(text, 'bot');
  const input = document.createElement('input');
  input.className = 'text-input';
  input.placeholder = 'Antwort eingeben...';
  const btn = document.createElement('button');
  btn.className = 'quick-btn';
  btn.innerText = 'Weiter';
  const wrap = document.createElement('div');
  wrap.className = 'quick-group';
  wrap.appendChild(input); wrap.appendChild(btn);
  btn.onclick = () => {
    const val = input.value.trim();
    if (validator && !validator(val)) {
      alert('Bitte gültige Eingabe.');
      return;
    }
    appendMessage(val, 'user');
    Funnel.state.data[fieldKey] = val;
    askNext();
    wrap.remove();
  };
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function exitWith(reason) {
  track('lead.exit', {product: Funnel.state.product, reason});
  Funnel.state.data.qualified = false;
  Funnel.state.data.disqualifyReason = reason;
  const txt = 'Danke für dein Interesse! Aufgrund deiner Antworten können wir dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!';
  const div = document.createElement('div');
  div.className = 'exit-bubble';
  div.innerText = txt;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  // send disqualified lead (without contact)
  try {
    fetch(_baseURL() + '/lead', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        leadSource:'chatbot', product: Funnel.state.product,
        qualified:false, disqualifyReason: reason,
        contact:{ firstName:'-', email:'no@email.invalid' }
      })
    });
  } catch(e){}
}

function askNext() {
  const p = Funnel.state.product;
  const s = Funnel.state.step++;
  track('funnel.step', {product: Funnel.state.product, step: Funnel.state.step});

  // progress
  Funnel.progress(((s)/Funnel.state.progressMax)*100);

  // universal checks first if not set yet
  if (s === 0) {
    return askQuick(
      T('owner_q'),
      [{label:'Ja', value:true},{label:'Nein', value:false}],
      'owner'
    );
  }
  if (s === 1 && Funnel.state.data.owner === false) {
    return exitWith('kein_eigentümer');
  }
  if (s === 1) {
    return askQuick(
      T('occupy_q'),
      [{label:'Ja', value:true},{label:'Nein', value:false}],
      'occupant'
    );
  }
  if (s === 2 && Funnel.state.data.occupant === false && p !== 'tenant') {
    return exitWith('nicht_bewohnt');
  }

  // Branching by product
  if (p === 'pv') {
    if (s === 2) return askQuick('Welcher Gebäudetyp?', [
      {label:'Einfamilienhaus', value:'einfamilienhaus'},
      {label:'Mehrfamilienhaus', value:'mehrfamilienhaus'},
      {label:'Gewerbe', value:'gewerbe'}
    ], 'prop_type');
    if (s === 3) return askQuick('Bauform (EFH)?', [
      {label:'Freistehend', value:'freistehend'},
      {label:'Doppelhaushälfte', value:'doppelhaus'},
      {label:'Reihenhaus', value:'reihenhaus'}
    ], 'sub_type');
    if (s === 4) return askInput(T('roof_area'), 'area_sqm', v=>/^[0-9]+(\.[0-9]+)?$/.test(v));
    if (s === 5) {
      const area = parseFloat(Funnel.state.data.area_sqm||0);
      if (area && area < 10) return exitWith('dachfläche_zu_klein');
      return askQuick('Dachausrichtung?', [
        {label:'Süd', value:'sued'},{label:'West', value:'west'},
        {label:'Ost', value:'ost'},{label:'Nord', value:'nord'},
        {label:'Kombination', value:'kombination'}
      ], 'orientation');
    }
    if (s === 6) return askInput('Jahresstromverbrauch (kWh)?', 'consumption_kwh', v=>/^[0-9]{3,6}$/.test(v));
    if (s === 7) return askQuick('Zusatzoptionen?', [
      {label:'Speicher', value:'speicher'},
      {label:'Wallbox', value:'wallbox'},
      {label:'Keine', value:'none'}
    ], 'addons');
    if (s === 8) return askContact();
  }

  if (p === 'roof') {
    if (s === 2) return askQuick('Gebäudetyp?', [
      {label:'Einfamilienhaus', value:'einfamilienhaus'},
      {label:'Mehrfamilienhaus', value:'mehrfamilienhaus'},
      {label:'Gewerbe', value:'gewerbe'}
    ], 'prop_type');
    if (s === 3) return askQuick('Dachmaterial?', [
      {label:'Ziegel', value:'ziegel'},
      {label:'Bitumen', value:'bitumen'},
      {label:'Blech', value:'blech'}
    ], 'material');
    if (s === 4) return askQuick('Gibt es Probleme?', [
      {label:'Undichtigkeiten', value:'undicht'},
      {label:'Dämmung', value:'daemmung'},
      {label:'Keine', value:'keine'}
    ], 'issues');
    if (s === 5) return askInput('Dachfläche (m²)?', 'area_sqm', v=>/^[0-9]+(\.[0-9]+)?$/.test(v));
    if (s === 6) return askQuick('Zusatzoptionen?', [
      {label:'Dämmung', value:'daemmung'},
      {label:'Dachfenster', value:'dachfenster'},
      {label:'Keine', value:'none'}
    ], 'addons');
    if (s === 7) return askContact();
  }

  if (p === 'heatpump') {
    if (s === 2) return askQuick('Gebäudetyp?', [
      {label:'Einfamilienhaus', value:'einfamilienhaus'},
      {label:'Mehrfamilienhaus', value:'mehrfamilienhaus'},
      {label:'Gewerbe', value:'gewerbe'}
    ], 'prop_type');
    if (s === 3) return askQuick('Aktuelle Heizart?', [
      {label:'Gas', value:'gas'},
      {label:'Öl', value:'öl'},
      {label:'Fernwärme', value:'fernwärme'}
    ], 'heatingType');
    if (s === 4) return askInput('Wohnfläche (m²)?', 'living_area', v=>/^[0-9]+(\.[0-9]+)?$/.test(v));
    if (s === 5) {
      const la = parseFloat(Funnel.state.data.living_area||0);
      if (la && la < 30) return exitWith('wohnfläche_zu_klein');
      return askQuick('Kombi mit PV?', [{label:'Ja', value:true},{label:'Nein', value:false}], 'pv_combo');
    }
    if (s === 6) return askContact();
  }

  if (p === 'tenant') {
    if (s === 2) return askQuick('Immobilientyp?', [
      {label:'Mehrfamilienhaus', value:'mehrfamilienhaus'},
      {label:'Gewerbe', value:'gewerbe'}
    ], 'prop_type');
    if (s === 3) return askInput('Anzahl Wohneinheiten?', 'units', v=>/^[0-9]+$/.test(v));
    if (s === 4) {
      const u = parseInt(Funnel.state.data.units||'0',10);
      if (u && u < 3) return exitWith('einheiten_zu_wenig');
      return askQuick('Bist du Eigentümer/Verwalter?', [{label:'Ja', value:true},{label:'Nein', value:false}], 'owner2');
    }
    if (s === 5 && Funnel.state.data.owner2 === false) return exitWith('kein_eigentümer');
    if (s === 5) return askQuick('Interesse?', [
      {label:'PV', value:'pv'},
      {label:'Wärmepumpe', value:'wp'},
      {label:'Dach', value:'dach'}
    ], 'interest');
    if (s === 6) return askContact();
  }

  // default end
  return;
}

function askContact() {
  // timeline
  askQuick(T('timeline_q'), [
    {label:'0–3 Monate', value:'0-3'},
    {label:'3–6 Monate', value:'3-6'},
    {label:'6–12 Monate', value:'6-12'}
  ], 'timeline');

  // then contact form inline
  setTimeout(() => {
    appendMessage(T('contact_q'), 'bot');
    const wrap = document.createElement('div'); wrap.className='quick-group';
    const name = document.createElement('input'); name.placeholder='Name';
    const email = document.createElement('input'); email.placeholder='E-Mail';
    const phone = document.createElement('input'); phone.placeholder='Telefon';
    const btn = document.createElement('button'); btn.className='quick-btn'; btn.innerText='Absenden';
    wrap.append(name,email,phone,btn);
    btn.onclick = async () => {
      appendMessage(`${name.value} • ${email.value} • ${phone.value}`,'user');
      // assemble payload & POST
      const payload = {
        leadSource:'chatbot',
        product: Funnel.state.product,
        qualified:true,
        contact:{ firstName: name.value?.split(' ')[0] || name.value, lastName: name.value?.split(' ').slice(1).join(' ') || '', email: email.value, phone: phone.value },
        property:{
          type: Funnel.state.data.prop_type || null,
          subType: Funnel.state.data.sub_type || null,
          area_sqm: parseFloat(Funnel.state.data.area_sqm || 0) || null,
          roofType: Funnel.state.data.roofType || null,
          roofOrientation: Funnel.state.data.orientation || null,
          material: Funnel.state.data.material || null
        },
        energy:{
          consumption_kwh: parseFloat(Funnel.state.data.consumption_kwh || 0) || null,
          heatingType: Funnel.state.data.heatingType || null
        },
        timeline: Funnel.state.data.timeline || null,
        addons: Array.isArray(Funnel.state.data.addons) ? Funnel.state.data.addons : [Funnel.state.data.addons].filter(Boolean),
        consent:{ accepted: true, timestamp: new Date().toISOString(), version: 'v1.0' }
      };
      try {
        const res = await fetch(_baseURL() + '/lead', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
        const out = await res.json().catch(()=>({}));
        appendMessage(langSwitcher.value==='de' ? 'Danke! Unser Team meldet sich zeitnah. Möchtest du direkt einen Termin wählen?' : 'Thanks! Our team will contact you soon. Would you like to pick a time now?', 'bot');
      track('lead.created', {product: Funnel.state.product});
      try{
        if (typeof CONFIG !== 'undefined' && CONFIG.CALENDAR_URL){
          const cta = document.createElement('div');
          cta.className='quick-group';
          const btn = document.createElement('button');
          btn.className='quick-btn';
          btn.innerText = 'Termin buchen';
          btn.onclick = () => {
            track('calendar.cta_click', {product: Funnel.state.product});
            const modal = document.createElement('div');
            modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.5)';
            modal.onclick = e => { if (e.target === modal) document.body.removeChild(modal); };
            const frame = document.createElement('iframe');
            frame.src = CONFIG.CALENDAR_URL;
            frame.style.width='min(900px, 94vw)';
            frame.style.height='min(700px, 88vh)';
            frame.style.border='0';
            frame.style.background='#fff';
            const box = document.createElement('div');
            box.style.position='absolute'; box.style.top='50%'; box.style.left='50%'; box.style.transform='translate(-50%,-50%)';
            box.style.borderRadius='12px'; box.style.overflow='hidden'; box.appendChild(frame);
            modal.appendChild(box); document.body.appendChild(modal);
          };
          cta.appendChild(btn); chatLog.appendChild(cta);
        }
      } catch(e){}

      track('lead.created', {product: Funnel.state.product});
      try{
        if (typeof CONFIG !== 'undefined' && CONFIG.CALENDAR_URL){
          const cta = document.createElement('div');
          cta.className='quick-group';
          const btn = document.createElement('button'); btn.className='quick-btn'; btn.innerText='Termin buchen';
          btn.onclick = ()=>{ track('calendar.cta_click', {product: Funnel.state.product}); window.open(CONFIG.CALENDAR_URL, '_blank'); };
          cta.appendChild(btn);
          // optional inline embed
          const iframe = document.createElement('iframe'); iframe.style.width='100%'; iframe.style.height='620px'; iframe.style.border='0'; iframe.loading='lazy'; iframe.referrerPolicy='no-referrer-when-downgrade'; iframe.src = CONFIG.CALENDAR_URL;
          chatLog.appendChild(cta);
          chatLog.appendChild(iframe);
        }
      }catch(e){}
      } catch(e) {
        appendMessage('Es gab ein Problem beim Speichern des Leads. Bitte versuche es später erneut.', 'bot');
      }
      wrap.remove();
    };
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }, 400);
}

// Hook: override product selection to start funnel
const _oldHandleProductSelection = typeof handleProductSelection === 'function' ? handleProductSelection : null;
handleProductSelection = function(key) {
  startFunnel(key);
};


// ========================
// 🧪 A/B Variant + Tracking
// ========================
const AB = { variant: (localStorage.getItem('ab_variant') || (Math.random() < 0.5 ? 'A' : 'B')) };
localStorage.setItem('ab_variant', AB.variant);

function track(eventName, props={}){
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({event: eventName, variant: AB.variant}, props));
  } catch(e){}
  try {
    fetch(_baseURL() + '/track', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({event: eventName, props: Object.assign({variant: AB.variant}, props)})
    });
  } catch(e){}
}

// Text variants
function T(key){
  const v = AB.variant;
  const dict = {
    owner_q: { A: 'Bist du Eigentümer:in der Immobilie?', B: 'Bist du Eigentümer/in der Immobilie?' },
    occupy_q:{ A: 'Bewohnst du die Immobilie selbst?', B: 'Wohnst du selbst in der Immobilie?' },
    roof_area:{ A: T('roof_area'), B: 'Wie groß ist die Dachfläche (m²) ca.?' },
    timeline_q:{ A: T('timeline_q'), B: 'Wann planst du die Umsetzung?' },
    contact_q:{ A: 'Super! Wie ist dein Name, E-Mail und Telefonnummer?', B: 'Top – nenn mir bitte Name, E‑Mail und Telefon.' }
  };
  return (dict[key] && dict[key][v]) || key;
}
