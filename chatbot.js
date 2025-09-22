
/* === PLANVILLE CHATBOT — LIGHT-ONLY (2025-09-23, full update) ===
   - Fast streaming (NDJSON) + watchdog heartbeat + auto-retry
   - No in-widget cookie banner / no 👍👎
   - Universal popup modal (desktop & mobile)
   - Funnels: pv, heatpump, aircon, roof, tenant, window
   - Auto-greeting + FAQ + product options
   - Guardrails compatible (optional) + robust fallbacks
*/

(function(){
  "use strict";

  /* ---------------------------
     Base URL & helpers
  ----------------------------*/
  function _baseURL(){
    try{
      let b = (typeof CONFIG !== "undefined" && CONFIG.BASE_API_URL)
        ? String(CONFIG.BASE_API_URL).trim() : "";
      if (!b) return "";
      if (!/^https?:\/\//i.test(b)) b = "https://" + b;
      return b.replace(/\/+$/,"");
    }catch(_){ return ""; }
  }
  function _api(path){
    const base = _baseURL();
    const p = String(path || "");
    return base + (p.startsWith("/") ? p : "/" + p);
  }

  /* ---------------------------
     Streaming util (NDJSON)
  ----------------------------*/
  let __currentController = null;

  function abortCurrentStream(){
    try { __currentController?.abort(); } catch {}
    __currentController = null;
  }

  // askAIStream({ question, lang, signal, onDelta, onDone })
  // Watchdog heartbeat + light auto-retry → anti "Network connection lost"
  async function askAIStream({ question, lang, signal, onDelta, onDone }){
    abortCurrentStream();

    let attempts = 0;
    const maxAttempts =
      (window.CONFIG && CONFIG.RETRY && Number(CONFIG.RETRY.MAX_TRIES)) || 2;

    async function once(){
      const controller = new AbortController();
      __currentController = controller;

      if (signal){
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", () => controller.abort(), { once:true });
      }

      // Hard-timeout to prevent hanging requests
      const timeoutMs =
        (window.CONFIG && Number(CONFIG.REQUEST_TIMEOUT_MS)) || 20000;
      const to = setTimeout(() => { try { controller.abort(); } catch {} }, timeoutMs);

      let res;
      try{
        res = await fetch(_api("/chat/stream"), {
          method:"POST",
          mode:"cors",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ message: question, lang }),
          signal: controller.signal,
          keepalive: true
        });
      } finally {
        clearTimeout(to);
      }

      if (!res.ok) throw new Error("Stream " + res.status);

      // Not a stream? just return text
      if (!res.body || !res.body.getReader){
        const txt = await res.text();
        onDelta?.(txt, txt);
        onDone?.(txt);
        __currentController = null;
        return txt;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let acc = "";
      let lastChunkAt = Date.now();

      // Heartbeat watchdog: if 2× interval without data → abort (trigger retry)
      const hbMs = (window.CONFIG && Number(CONFIG.SSE_HEARTBEAT_MS)) || 15000;
      const watchdog = setInterval(() => {
        if (Date.now() - lastChunkAt > hbMs * 2){
          try { controller.abort(); } catch {}
        }
      }, hbMs);

      try{
        for(;;){
          const { value, done } = await reader.read();
          if (done) break;

          lastChunkAt = Date.now();
          buf += decoder.decode(value, { stream:true });

          // NDJSON per line; if not JSON, forward as-is
          let idx;
          while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line) continue;

            let piece = "";
            try {
              const obj = JSON.parse(line);
              piece = (obj.delta ?? obj.text ?? "");
            } catch {
              piece = line;
            }
            if (piece) {
              acc += piece;
              onDelta?.(piece, acc);
            }
          }
        }

        // tail
        const tail = buf.trim();
        if (tail) {
          let piece = "";
          try {
            const obj = JSON.parse(tail);
            piece = (obj.delta ?? obj.text ?? "");
          } catch {
            piece = tail;
          }
          if (piece) {
            acc += piece;
            onDelta?.(piece, acc);
          }
        }

        onDone?.(acc);
        __currentController = null;
        return acc;
      } finally {
        clearInterval(watchdog);
      }
    }

    // Light retry with simple backoff
    for (;;) {
      try {
        return await once();
      } catch (e) {
        attempts += 1;
        if (attempts > maxAttempts) throw e;
        const delay =
          (window.CONFIG && CONFIG.RETRY && Number(CONFIG.RETRY.BASE_DELAY_MS)) || 800;
        await new Promise(r => setTimeout(r, delay * attempts));
      }
    }
  }

  async function withRetry(fn, { retries=1, baseDelay=600 } = {}){
    let last;
    for (let i=0;i<=retries;i++){
      try{ return await fn(); }
      catch(e){ last = e; await new Promise(r=>setTimeout(r, baseDelay*(i+1))); }
    }
    throw last;
  }

  function _getConsentState(){
    try{
      const raw = localStorage.getItem("consent_v1");
      if (raw){
        const c = JSON.parse(raw);
        return {
          essential:true,
          analytics:!!c.analytics,
          marketing:!!c.marketing,
          personalization:!!c.personalization
        };
      }
    }catch(_){}
    const simple = localStorage.getItem("cookieConsent");
    return { essential:true, analytics: simple==="accepted", marketing:false, personalization:false };
  }
  function _allowAnalytics(){ return !!_getConsentState().analytics; }
  function track(eventName, props={}, { essential=false } = {}){
    try{
      if (typeof window.trackFE === "function"){
        window.trackFE(eventName, props, { essential });
        return;
      }
      if (!essential && !_allowAnalytics()) return;
      window.dataLayer = window.dataLayer || [];
      const variant = localStorage.getItem("ab_variant") || "A";
      window.dataLayer.push(Object.assign({ event: eventName, variant }, props));
      // lightweight backend track (best-effort)
      fetch(_api("/track"), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          event: eventName,
          props: Object.assign({ variant }, props)
        })
      }).catch(()=>{});
    }catch(_){}
  }

  /* ---------------------------
     i18n
  ----------------------------*/
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
    ctaBook: { de:"Jetzt Beratung buchen 👉", en:"Book a consultation 👉" },
    priceMsg: {
      de:"Die Preise für Photovoltaik beginnen bei etwa 7.000€ bis 15.000€, abhängig von Größe & Standort. Für ein genaues Angebot:",
      en:"Prices for photovoltaics typically range from €7,000 to €15,000 depending on size & location. For an exact quote:"
    },
    unsure: {
      de:`Ich bin mir nicht sicher. Bitte <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 kontaktieren Sie unser Team hier</a>.`,
      en:`I'm not sure about that. Please <a href="https://planville.de/kontakt" target="_blank" rel="noopener">📞 contact our team here</a>.`
    },
    askContactDone: (lang) => lang==="de"
      ? "Danke! Unser Team meldet sich zeitnah. Möchtest du direkt einen Termin wählen?"
      : "Thanks! Our team will contact you soon. Would you like to pick a time now?"
  };

  const Q = {
    install_location_q: { de:"Worauf soll die Solaranlage installiert werden?", en:"Where should the PV system be installed?" },
    building_type_q:    { de:"Um welchen Gebäudetyp handelt es sich?",       en:"What is the building subtype?" },
    self_occupied_q:    { de:"Bewohnst Du die Immobilie selbst?",            en:"Do you live in the property yourself?" },
    ownership_q:        { de:"Bist Du Eigentümer:in der Immobilie?",         en:"Are you the owner of the property?" },
    roof_type_q:        { de:"Was für ein Dach hast Du?",                    en:"What roof type do you have?" },
    storage_interest_q: { de:"Möchtest Du einen Stromspeicher?",             en:"Would you like to add a battery storage?" },
    install_timeline_q: { de:"Wann soll deine Anlage installiert werden?",   en:"When should the system be installed?" },
    property_street_q:  { de:"Wo steht die Immobilie? (Straße + Hausnummer)",en:"Where is the property? (Street + No.)" },
    contact_time_q:     { de:"Wann bist Du am besten zu erreichen?",         en:"When are you best reachable?" },
    plz_q:              { de:"Wie lautet die PLZ?",                           en:"What is the ZIP code?" },
    issues_q:           { de:"Gibt es Probleme?",                             en:"Any current issues?" },
    heatingType_q:      { de:"Aktuelle Heizart?",                             en:"Current heating type?" }
  };

  const productLabels = {
    heatpump: { en:"Heat Pump 🔥", de:"Wärmepumpe 🔥" },
    aircon:   { en:"Air Conditioner ❄️", de:"Klimaanlage ❄️" },
    pv:       { en:"Photovoltaic System ☀️", de:"Photovoltaikanlage ☀️" },
    roof:     { en:"Roof Renovation 🛠️", de:"Dachsanierung 🛠️" },
    tenant:   { en:"Tenant Power 🏠", de:"Mieterstrom 🏠" },
    window:   { en:"Windows 🪟", de:"Fenster 🪟" }
  };

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

  /* ---------------------------
     Element selectors (+ guards)
  ----------------------------*/
  const chatLog      = document.getElementById("chatbot-log");
  const form         = document.getElementById("chatbot-form");
  const input        = document.getElementById("chatbot-input");
  let typingBubble   = document.getElementById("typing-bubble");
  const langSwitcher = document.getElementById("langSwitcher");
  const pvHero       = document.querySelector(".pv-hero");
  const pvBalloon    = document.querySelector(".pv-balloon span");

  // Create a hidden typing bubble if missing (prevents NPEs)
  if (!typingBubble && chatLog){
    typingBubble = document.createElement("div");
    typingBubble.id = "typing-bubble";
    typingBubble.className = "typing-bubble bot-message chatbot-message";
    typingBubble.style.display = "none";
    typingBubble.textContent = "…";
    chatLog.appendChild(typingBubble);
  }

  let chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
  let chatStarted = false;
  let __lastOrigin = "chat"; // 'chat' | 'faq'

  function ensureViewportMeta(){
    if (!document.querySelector('meta[name="viewport"]')){
      const m = document.createElement("meta");
      m.name = "viewport";
      m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
      document.head.appendChild(m);
    }
  }
  function openLeadForm(productLabel, qualification){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    return openLeadFloatForm(productLabel, qualification, lang);
  }

  /* ---------------------------
     Init on load
  ----------------------------*/
  window.addEventListener("load", function(){
    ensureViewportMeta();

    const selectedLang = localStorage.getItem("selectedLang") || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
    if (langSwitcher) langSwitcher.value = selectedLang;

    // remove any old hero balloon fragment (defensive)
    const oldBalloon = document.querySelector(".pv-balloon");
    if (oldBalloon && oldBalloon.parentNode) oldBalloon.remove();
    if (pvBalloon && I18N.robotBalloon[selectedLang]) pvBalloon.textContent = I18N.robotBalloon[selectedLang];

    updateFAQ(selectedLang);
    updateHeaderOnly(selectedLang);

    // show chat area
    showChatArea();
    chatStarted = true;

    // Auto-greeting only when log empty and no product options yet
    const hasContent  = !!(chatLog && chatLog.children && chatLog.children.length > 0);
    const hasProducts = !!document.getElementById("product-options-block");
    if (!hasContent && !hasProducts){
      startGreetingFlow(true);
    }
  });

  // Reconnect helpers (UX anti-blank)
  window.addEventListener("online", () => {
    // optional: show "Back online" toast/snackbar
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      const tb = document.getElementById("typing-bubble");
      if (tb && tb.style.display !== "none") {
        // Offer a CTA instead of hanging bubble
        maybeOfferStartCTA((langSwitcher && langSwitcher.value) || "de");
      }
    }
  });

  function hideChatArea(){
    const container = document.querySelector(".chatbot-container");
    const sidebar   = document.querySelector(".faq-sidebar");
    if (container) container.style.display = "none";
    if (sidebar) sidebar.style.display = "";
  }
  function showChatArea(){
    const container = document.querySelector(".chatbot-container");
    if (container) container.style.display = "flex";
    if (pvHero) pvHero.style.display = "none";
  }

  // Language switcher
  if (langSwitcher){
    langSwitcher.addEventListener("change", function(){
      const lang = langSwitcher.value;
      localStorage.setItem("selectedLang", lang);
      if (pvBalloon && I18N.robotBalloon[lang]) pvBalloon.textContent = I18N.robotBalloon[lang];
      updateFAQ(lang);
      if (chatStarted) updateUITexts(lang); else updateHeaderOnly(lang);
      track("language_switch", { lang: lang });
    });
  }

  // Submit handler (streaming + abort)
  if (form){
    form.addEventListener("submit", async function(e){
      e.preventDefault();
      __lastOrigin = __lastOrigin || "chat";
      if (!chatStarted){ chatStarted = true; showChatArea(); }

      if (!input) return; // nothing to read
      const question = (input.value || "").trim();
      const selectedLang = (langSwitcher && langSwitcher.value) || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
      if (!question) return;

      abortCurrentStream();

      appendMessage(escapeHTML(question), "user");
      saveToHistory("user", question);
      input.value = "";
      if (typingBubble) typingBubble.style.display = "block";

      // quick intents
      if (detectIntent(question)){
        if (typingBubble) typingBubble.style.display = "none";
        const inFunnel = !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
        if (inFunnel) offerContinueOrForm(selectedLang); else maybeOfferStartCTA(selectedLang);
        __lastOrigin = "chat";
        return;
      }

      let finalReply = null;
      const botLive = appendMessage("...", "bot");

      try{
        // Guardrails (optional)
        if (window.AIGuard && typeof window.AIGuard.ask === "function"){
          const ai = await window.AIGuard.ask(question, selectedLang);
          if (ai && ai.stop){
            if (typingBubble) typingBubble.style.display = "none";
            if (botLive && botLive.firstChild) botLive.firstChild.textContent = "";
            nudgeToFormFromInterrupt(selectedLang);
            __lastOrigin = "chat";
            return;
          }
          if (ai && ai.text){
            finalReply = String(ai.text).trim();
            if (typingBubble) typingBubble.style.display = "none";
            if (botLive) botLive.innerHTML = finalReply;
            saveToHistory("bot", finalReply);
          }
        }

        if (!finalReply){
          const controller = new AbortController();
          window.__chatAbortController = controller;

          let gotFirst = false;
          await withRetry(() => askAIStream({
            question,
            lang: selectedLang,
            signal: controller.signal,
            onDelta: function(piece, acc){
              if (!gotFirst && typingBubble) { typingBubble.style.display = "none"; gotFirst = true; }
              if (botLive){
                botLive.innerHTML = acc;
                if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
              }
            },
            onDone: function(full){
              finalReply = (full || "").trim() || I18N.unsure[selectedLang];
            }
          }), { retries: 1 });

          if (!gotFirst && typingBubble) typingBubble.style.display = "none";
          saveToHistory("bot", finalReply);
        }
      }catch(err){
        // Fallback non-stream endpoint
        try{
          const res = await fetch(_api("/chat"), {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ message: question, lang: selectedLang })
          });
          const data = await res.json().catch(()=> ({}));
          const replyRaw = data && (data.answer ?? data.reply);
          finalReply = (typeof replyRaw === "string" ? replyRaw.trim() : "") || I18N.unsure[selectedLang];
          if (botLive) botLive.innerHTML = finalReply;
          else appendMessage(finalReply, "bot");
          saveToHistory("bot", finalReply);
        }catch(_){
          if (botLive) botLive.innerHTML = "Error while connecting to the API.";
          else appendMessage("Error while connecting to the API.", "bot");
        }finally{
          if (typingBubble) typingBubble.style.display = "none";
        }
      }finally{
        const inFunnel = !!(window.Funnel && window.Funnel.state && window.Funnel.state.product);
        const formShown = !!document.getElementById("lead-contact-form-chat") || !!document.getElementById("lead-float-overlay");
        if (inFunnel){ offerContinueOrForm(selectedLang); }
        else if (!formShown){ maybeOfferStartCTA(selectedLang); }
        track("chat_message", { q_len: question.length, lang: selectedLang });
        if (window.AIGuard && typeof window.AIGuard.maybeContinueFunnel === "function"){
          window.AIGuard.maybeContinueFunnel();
        }
        __lastOrigin = "chat";
      }
    });
  }

  /* ---------------------------
     Greeting / Header
  ----------------------------*/
  function startGreetingFlow(withProducts){
    const lang = (langSwitcher && langSwitcher.value) || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
    updateUITexts(lang);
    if (!withProducts){
      const productBlock = document.getElementById("product-options-block");
      if (productBlock) productBlock.remove();
    }
  }
  function updateHeaderOnly(lang){
    const h = document.querySelector(".chatbot-header h1");
    if (h && I18N.header[lang]) h.innerText = I18N.header[lang];
  }

  /* ---------------------------
     Append / Save / Reset
  ----------------------------*/
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function appendMessage(msg, sender, scroll){
    if (!chatLog) return null;
    const msgDiv = document.createElement("div");
    msgDiv.className = "chatbot-message " + (sender === "user" ? "user-message" : "bot-message");
    if (sender === "user") msgDiv.textContent = String(msg); else msgDiv.innerHTML = msg;
    chatLog.appendChild(msgDiv);
    if (scroll === undefined || scroll) chatLog.scrollTop = chatLog.scrollHeight;
    return msgDiv;
  }
  function saveToHistory(sender, message){
    try{
      chatHistory.push({ sender: sender, message: message });
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }catch(_){}
  }
  function resetChat(){
    try{ localStorage.removeItem("chatHistory"); }catch(_){}
    chatHistory = [];
    if (chatLog) chatLog.innerHTML = "";
    const productBlock = document.getElementById("product-options-block");
    if (productBlock) productBlock.remove();
  }

  /* ---------------------------
     FAQ
  ----------------------------*/
  function updateFAQ(lang){
    const list = document.getElementById("faq-list");
    const sidebar = document.querySelector(".faq-sidebar");
    if (!list || !sidebar) return;
    list.innerHTML = "";
    const items = (faqTexts[lang] || faqTexts.de);
    items.forEach(function(txt){
      const li = document.createElement("li");
      li.innerText = txt;
      li.addEventListener("click", function(){
        __lastOrigin = "faq";
        if (input) input.value = txt;
        if (form){
          form.dispatchEvent(new Event("submit"));
        }else{
          // fallback: just echo and trigger intent/system response
          appendMessage(escapeHTML(txt), "user");
        }
        track("faq_click", { text: txt });
      });
      list.appendChild(li);
    });
  }
  function sendFAQ(text){
    __lastOrigin = "faq";
    if (input) input.value = text;
    if (form) form.dispatchEvent(new Event("submit"));
    track("faq_click", { text: text });
  }

  /* ---------------------------
     UI Texts / Product options
  ----------------------------*/
  function updateUITexts(lang){
    const h = document.querySelector(".chatbot-header h1");
    if (h && I18N.header[lang]) h.innerText = I18N.header[lang];
    resetChat();
    appendMessage(I18N.greeting[lang], "bot");
    showProductOptions();
  }

  function showProductOptions(){
    const lang = (langSwitcher && langSwitcher.value) || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
    const keys = ["pv", "aircon", "heatpump", "tenant", "roof", "window"];
    const existing = document.getElementById("product-options-block");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "product-options";
    container.id = "product-options-block";

    keys.forEach(function(key){
      const label = productLabels[key] && productLabels[key][lang];
      if (!label) return;
      const button = document.createElement("button");
      button.innerText = label;
      button.className = "product-button";
      button.dataset.key = key;
      button.onclick = function(){
        document.querySelectorAll(".product-button.selected").forEach(function(b){ b.classList.remove("selected"); });
        button.classList.add("selected");
        handleProductSelection(key);
      };
      container.appendChild(button);
    });

    if (chatLog){
      chatLog.appendChild(container);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  function handleProductSelection(key){
    const lang = (langSwitcher && langSwitcher.value) || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
    Funnel.reset();
    Funnel.state.product = key;
    Funnel.state.productLabel = (productLabels[key] && productLabels[key][lang]) || key;
    appendMessage(Funnel.state.productLabel, "user");
    askNext();
  }

  /* ---------------------------
     Intent detection (shortcuts)
  ----------------------------*/
  function detectIntent(text){
    const lower = (text || "").toLowerCase();
    const lang = (langSwitcher && langSwitcher.value) || (window.CONFIG && CONFIG.LANG_DEFAULT) || "de";
    if (lower.includes("harga") || lower.includes("kosten") || lower.includes("cost") || lower.includes("price")){
      appendMessage(I18N.priceMsg[lang], "bot");
      const cta = document.createElement("a");
      cta.href = "https://planville.de/kontakt/";
      cta.target = "_blank"; cta.rel = "noopener";
      cta.className = "cta-button";
      cta.innerText = (lang === "de" ? "Jetzt Preis anfragen 👉" : "Request Price 👉");
      if (chatLog) chatLog.appendChild(cta);
      offerFAQFollowup(lang);
      track("intent_preisinfo", { text: text, language: lang });
      return true;
    }
    if (lower.includes("tertarik") || lower.includes("interested")){
      appendMessage(lang==="de" ? "Super! Bitte füllen Sie dieses kurze Formular aus:" : "Great! Please fill out this short form:", "bot");
      const label = window.Funnel && Funnel.state && Funnel.state.productLabel ? Funnel.state.productLabel : "Beratung";
      const qual = window.Funnel && Funnel.state ? (Funnel.state.data || {}) : {};
      openLeadForm(label, qual);
      offerFAQFollowup(lang);
      return true;
    }
    return false;
  }

  /* ---------------------------
     Quick UI helpers
  ----------------------------*/
  function askQuick(text, options, fieldKey){
    appendMessage(text, "bot");
    const group = document.createElement("div");
    group.className = "quick-group";
    options.forEach(function(opt){
      const b = document.createElement("button");
      b.className = "quick-btn";
      b.type = "button";
      b.innerText = opt.label;
      b.onclick = function(){
        appendMessage(opt.label, "user");
        Funnel.state.data[fieldKey] = opt.value;
        if (fieldKey === "timeline"){
          if (typeof window.onTimelineSelected === "function") window.onTimelineSelected(opt.value);
          group.remove();
          return;
        }
        askNext();
        group.remove();
      };
      group.appendChild(b);
    });
    if (chatLog){ chatLog.appendChild(group); chatLog.scrollTop = chatLog.scrollHeight; }
  }
  function askCards(text, options, fieldKey){
    appendMessage(text, "bot");
    const grid = document.createElement("div");
    grid.className = "pv-card-grid";
    options.forEach(function(opt){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pv-card";
      b.innerHTML = (opt.emoji ? '<div class="pv-card__emoji">'+opt.emoji+'</div>' : '') + '<div class="pv-card__label">'+opt.label+'</div>';
      b.onclick = function(){
        appendMessage(opt.label, "user");
        Funnel.state.data[fieldKey] = opt.value;
        askNext();
        grid.remove();
      };
      grid.appendChild(b);
    });
    if (chatLog){ chatLog.appendChild(grid); chatLog.scrollTop = chatLog.scrollHeight; }
  }
  function askInput(text, fieldKey, validator){
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
    wrap.appendChild(inp); wrap.appendChild(btn);
    btn.onclick = function(){
      const val = (inp.value || "").trim();
      if (validator && !validator(val)){ alert("Bitte gültige Eingabe."); return; }
      appendMessage(val, "user");
      Funnel.state.data[fieldKey] = val;
      askNext();
      wrap.remove();
    };
    if (chatLog){ chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight; }
    setTimeout(()=>{ try{ inp.focus(); }catch(_){}} , 0);
  }

  function askContact(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const opts = (lang==="de" ? ["0–3 Monate","3–6 Monate","6–12 Monate"] : ["0–3 months","3–6 months","6–12 months"])
      .map(function(t,i){ return { label:t, value: (i===0?"0-3":i===1?"3-6":"6-12") }; });
    askQuick(Q.install_timeline_q[lang], opts, "timeline");
  }

  function exitWith(reason){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    track("lead.exit", { product: Funnel.state.product, reason: reason });
    Funnel.state.data.qualified = false;
    Funnel.state.data.disqualifyReason = reason;
    const txt = (lang==="de")
      ? "Danke für dein Interesse! Aufgrund deiner Antworten können wir dir leider keine passende Dienstleistung anbieten. Schau aber gerne mal auf unserer Webseite vorbei!"
      : "Thanks for your interest! Based on your answers we currently have no matching service. Feel free to check our website!";
    const div = document.createElement("div");
    div.className = "exit-bubble";
    div.innerText = txt;
    if (chatLog){ chatLog.appendChild(div); chatLog.scrollTop = chatLog.scrollHeight; }
    if (typeof window.sendDisqualifiedLead === "function") window.sendDisqualifiedLead(reason);
  }

  /* ---------------------------
     Conversational Funnel
  ----------------------------*/
  const Funnel = {
    state: { product:null, productLabel:null, data:{} },
    reset: function(){ this.state = { product:null, productLabel:null, data:{} }; },
    progressByFields: function(){
      const d = this.state.data || {};
      const mapNeeded = {
        pv: ["install_location","building_type","self_occupied","ownership","roof_type","storage_interest","install_timeline","property_street_number","contact_time_window"],
        heatpump: ["building_type","living_area","heating_type","insulation","install_timeline","property_street_number","contact_time_window"],
        aircon: ["building_type","rooms_count","cool_area","install_timeline","property_street_number","contact_time_window"],
        roof: ["roof_type","area_sqm","issues","install_timeline","property_street_number","contact_time_window"],
        tenant: ["building_type","units","ownership","install_timeline","property_street_number","contact_time_window"],
        window: ["window_type","window_count","needs_balcony_door","window_accessory","install_timeline","plz","contact_time_window"]
      };
      const needed = mapNeeded[this.state.product] || [];
      const answered = needed.filter(function(k){ return d[k] !== undefined && d[k] !== null && d[k] !== ""; }).length;
      const percent = needed.length ? Math.min(100, Math.round((answered/needed.length)*100)) : 0;
      this.progress(percent);
    },
    progress: function(percent){
      let bar = document.getElementById("funnel-progress-bar");
      if (!bar){
        const wrap = document.createElement("div");
        wrap.className = "funnel-progress";
        const inner = document.createElement("div");
        inner.className = "funnel-progress__bar";
        inner.id = "funnel-progress-bar";
        wrap.appendChild(inner);
        if (chatLog) chatLog.appendChild(wrap);
      }
      requestAnimationFrame(function(){
        const el = document.getElementById("funnel-progress-bar");
        if (el) el.style.width = Math.min(100, Math.max(0, percent)) + "%";
      });
    }
  };
  window.Funnel = Funnel;

  function askNext(){
    switch (Funnel.state.product){
      case "pv":      askNextPV(); break;
      case "heatpump":askNextHP(); break;
      case "aircon":  askNextAC(); break;
      case "roof":    askNextRoof(); break;
      case "tenant":  askNextTenant(); break;
      case "window":  askNextWindow(); break;
      default: break;
    }
  }

  // ===== PV flow
  function askNextPV(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.install_location === undefined){
      const opts = (lang==="de"
        ? [{label:"Einfamilienhaus",value:"einfamilienhaus",emoji:"🏠"},
           {label:"Mehrfamilienhaus",value:"mehrfamilienhaus",emoji:"🏢"},
           {label:"Gewerbeimmobilie",value:"gewerbeimmobilie",emoji:"🏭"},
           {label:"Sonstiges",value:"sonstiges",emoji:"✨"}]
        : [{label:"Single-family",value:"einfamilienhaus",emoji:"🏠"},
           {label:"Multi-family",value:"mehrfamilienhaus",emoji:"🏢"},
           {label:"Commercial",value:"gewerbeimmobilie",emoji:"🏭"},
           {label:"Other",value:"sonstiges",emoji:"✨"}]);
      askCards(Q.install_location_q[lang], opts, "install_location"); return;
    }
    if (d.install_location==="einfamilienhaus" && d.building_type === undefined){
      const arr = (lang==="de" ? ["Freistehendes Haus","Doppelhaushälfte","Reihenmittelhaus","Reihenendhaus"] : ["Detached","Semi-detached","Mid-terrace","End-terrace"]);
      askCards(Q.building_type_q[lang], arr.map(function(t){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:"🏡"};}), "building_type"); return;
    }
    if (d.self_occupied === undefined){
      askCards(Q.self_occupied_q[lang], (lang==="de"?["Ja","Nein"]:["Yes","No"]).map(function(t,i){return {label:t,value:i===0,emoji:i===0?"✅":"🚫"};}), "self_occupied"); return;
    }
    if (d.ownership === undefined){
      askCards(Q.ownership_q[lang], (lang==="de"?["Ja","Nein"]:["Yes","No"]).map(function(t,i){return {label:t,value:i===0,emoji:i===0?"🔑":"🚫"};}), "ownership"); return;
    }
    if (d.roof_type === undefined){
      const arr = (lang==="de"?["Flachdach","Spitzdach","Andere"]:["Flat","Pitched","Other"]);
      askCards(Q.roof_type_q[lang], arr.map(function(t){return {label:t,value:t.toLowerCase(),emoji:"🏚️"};}), "roof_type"); return;
    }
    if (d.storage_interest === undefined){
      const arr = (lang==="de"?["Ja","Nein","Unsicher"]:["Yes","No","Unsure"]);
      askCards(Q.storage_interest_q[lang], arr.map(function(t){return {label:t,value:t.toLowerCase(),emoji:"🔋"};}), "storage_interest"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"So schnell wie möglich",value:"asap"},{label:"In 1–3 Monaten",value:"1-3"},{label:"In 4–6 Monaten",value:"4-6"},{label:"In mehr als 6 Monaten",value:">6"}]
        : [{label:"As soon as possible",value:"asap"},{label:"In 1–3 months",value:"1-3"},{label:"In 4–6 months",value:"4-6"},{label:"In more than 6 months",value:">6"}]);
      askCards(Q.install_timeline_q[lang], opts, "install_timeline"); return;
    }
    if (d.property_street_number === undefined){
      askInput(Q.property_street_q[lang], "property_street_number", function(v){ return String(v||"").trim().length > 3; }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__done_perspective_summary){
      d.__done_perspective_summary = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Photovoltaik", d);
    }
  }

  // ===== Heatpump
  function askNextHP(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.building_type === undefined){
      const arr = (lang==="de"?["Einfamilienhaus","Doppelhaushälfte","Reihenhaus","Mehrfamilienhaus","Gewerbe"]:["Single-family","Semi-detached","Terraced","Multi-family","Commercial"]);
      askCards(lang==="de"?"Welcher Gebäudetyp?":"What building type?", arr.map(function(t,i){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:["🏠","🏠","🏘️","🏢","🏭"][i]};}), "building_type"); return;
    }
    if (d.living_area === undefined){
      const arr = (lang==="de"?["bis 100 m²","101–200 m²","201–300 m²","über 300 m²"]:["up to 100 m²","101–200 m²","201–300 m²","over 300 m²"]);
      askCards(lang==="de"?"Wohnfläche?":"Living area?", arr.map(function(t,i){return {label:t,value:["<=100","101-200","201-300",">300"][i]};}), "living_area"); return;
    }
    if (d.heating_type === undefined){
      const arr = (lang==="de"?["Gas","Öl","Stromdirekt","Andere"]:["Gas","Oil","Direct electric","Other"]);
      askCards(Q.heatingType_q[lang], arr.map(function(t){return {label:t,value:t.toLowerCase(),emoji:"🔥"};}), "heating_type"); return;
    }
    if (d.insulation === undefined){
      const arr = (lang==="de"?["Gut","Mittel","Schlecht","Unbekannt"]:["Good","Average","Poor","Unknown"]);
      askCards(lang==="de"?"Wärmedämmung des Gebäudes?":"Building insulation level?", arr.map(function(t){return {label:t,value:t.toLowerCase(),emoji:"🧱"};}), "insulation"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"Schnellstmöglich",value:"asap"},{label:"1–3 Monate",value:"1-3"},{label:"4–6 Monate",value:"4-6"},{label:">6 Monate",value:">6"}]
        : [{label:"ASAP",value:"asap"},{label:"1–3 months",value:"1-3"},{label:"4–6 months",value:"4-6"},{label:">6 months",value:">6"}]);
      askCards(Q.install_timeline_q[lang], opts, "install_timeline"); return;
    }
    if (d.property_street_number === undefined){
      askInput(Q.property_street_q[lang], "property_street_number", function(v){ return String(v||"").trim().length > 3; }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__hp_done){
      d.__hp_done = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Wärmepumpe", d);
    }
  }

  // ===== Aircon
  function askNextAC(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.building_type === undefined){
      const arr = (lang==="de"?["Einfamilienhaus","Wohnung","Büro","Gewerbehalle"]:["Single-family","Apartment","Office","Commercial hall"]);
      askCards(lang==="de"?"Welcher Gebäudetyp?":"What building type?", arr.map(function(t,i){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:["🏠","🏢","💼","🏭"][i]};}), "building_type"); return;
    }
    if (d.rooms_count === undefined){
      const arr = (lang==="de"?["1 Raum","2 Räume","3 Räume","mehr als 3"]:["1 room","2 rooms","3 rooms","more than 3"]);
      askCards(lang==="de"?"Wie viele Räume?":"How many rooms?", arr.map(function(t,i){return {label:t,value:["1","2","3",">3"][i]};}), "rooms_count"); return;
    }
    if (d.cool_area === undefined){
      const arr = (lang==="de"?["bis 30 m²","31–60 m²","61–100 m²","über 100 m²"]:["up to 30 m²","31–60 m²","61–100 m²","over 100 m²"]);
      askCards(lang==="de"?"Zu kühlende Fläche?":"Cooling area?", arr.map(function(t,i){return {label:t,value:["<=30","31-60","61-100",">100"][i]};}), "cool_area"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"Schnellstmöglich",value:"asap"},{label:"1–3 Monate",value:"1-3"},{label:"4–6 Monate",value:"4-6"},{label:">6 Monate",value:">6"}]
        : [{label:"ASAP",value:"asap"},{label:"1–3 months",value:"1-3"},{label:"4–6 months",value:"4-6"},{label:">6 months",value:">6"}]);
      askCards(Q.install_timeline_q[lang], opts, "install_timeline"); return;
    }
    if (d.property_street_number === undefined){
      askInput(Q.property_street_q[lang], "property_street_number", function(v){ return String(v||"").trim().length > 3; }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__ac_done){
      d.__ac_done = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Klimaanlage", d);
    }
  }

  // ===== Roof
  function askNextRoof(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.roof_type === undefined){
      const arr = (lang==="de"?["Flachdach","Satteldach","Walmdach","Andere"]:["Flat","Gabled","Hipped","Other"]);
      askCards(lang==="de"?"Dachform?":"Roof type?", arr.map(function(t){return {label:t,value:t.toLowerCase(),emoji:"🏚️"};}), "roof_type"); return;
    }
    if (d.area_sqm === undefined){
      const arr = (lang==="de"?["bis 50 m²","51–100 m²","101–200 m²","über 200 m²"]:["up to 50 m²","51–100 m²","101–200 m²","over 200 m²"]);
      askCards(lang==="de"?"Dachfläche (ca.)?":"Approx. roof area?", arr.map(function(t,i){return {label:t,value:["<=50","51-100","101-200",">200"][i]};}), "area_sqm"); return;
    }
    if (d.issues === undefined){
      const arr = (lang==="de"?["Undicht","Beschädigt","Alterung","Nur Inspektion"]:["Leaking","Damaged","Aged","Inspection only"]);
      askCards(Q.issues_q[lang], arr.map(function(t){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:"🛠️"};}), "issues"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"Schnellstmöglich",value:"asap"},{label:"1–3 Monate",value:"1-3"},{label:"4–6 Monate",value:"4-6"},{label:">6 Monate",value:">6"}]
        : [{label:"ASAP",value:"asap"},{label:"1–3 months",value:"1-3"},{label:"4–6 months",value:"4-6"},{label:">6 months",value:">6"}]);
      askCards(Q.install_timeline_q[lang], opts, "install_timeline"); return;
    }
    if (d.property_street_number === undefined){
      askInput(Q.property_street_q[lang], "property_street_number", function(v){ return String(v||"").trim().length > 3; }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__roof_done){
      d.__roof_done = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Dachsanierung", d);
    }
  }

  // ===== Tenant
  function askNextTenant(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.building_type === undefined){
      const arr = (lang==="de"?["Mehrfamilienhaus","Gewerbeimmobilie"]:["Multi-family","Commercial"]);
      askCards(Q.building_type_q[lang], arr.map(function(t,i){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:["🏢","🏭"][i]};}), "building_type"); return;
    }
    if (d.units === undefined){
      const arr = (lang==="de"?["1–3","4–10","11–20","über 20"]:["1–3","4–10","11–20","over 20"]);
      askCards(lang==="de"?"Anzahl Wohneinheiten?":"Number of units?", arr.map(function(t,i){return {label:t,value:["1-3","4-10","11-20",">20"][i]};}), "units"); return;
    }
    if (d.ownership === undefined){
      askCards(Q.ownership_q[lang], (lang==="de"?["Ja","Nein"]:["Yes","No"]).map(function(t,i){return {label:t,value:i===0,emoji:i===0?"🔑":"🚫"};}), "ownership"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"Schnellstmöglich",value:"asap"},{label:"1–3 Monate",value:"1-3"},{label:"4–6 Monate",value:"4-6"},{label:">6 Monate",value:">6"}])
        : [{label:"ASAP",value:"asap"},{label:"1–3 months",value:"1-3"},{label:"4–6 months",value:"4-6"},{label:">6 months",value:">6"}];
      askCards(Q.install_timeline_q[lang], opts, "install_timeline"); return;
    }
    if (d.property_street_number === undefined){
      askInput(Q.property_street_q[lang], "property_street_number", function(v){ return String(v||"").trim().length > 3; }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__tenant_done){
      d.__tenant_done = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Mieterstrom", d);
    }
  }

  // ===== Window
  function askNextWindow(){
    const lang = (langSwitcher && langSwitcher.value) || "de";
    const d = Funnel.state.data;
    Funnel.progressByFields();
    if (d.window_type === undefined){
      const arr = (lang==="de"?["Standardfenster","Dachfenster","Schiebefenster","Andere"]:["Standard window","Roof window","Sliding window","Other"]);
      askCards(lang==="de"?"Welche Art von Fenster?":"Which type of window?", arr.map(function(t){return {label:t,value:t.toLowerCase().replace(/\s/g,"_"),emoji:"🪟"};}), "window_type"); return;
    }
    if (d.window_count === undefined){
      const arr = (lang==="de"?["1–3","4–7","8+"]:["1–3","4–7","8+"]);
      askCards(lang==="de"?"Wie viele Fenster?":"How many windows?", arr.map(function(t){return {label:t,value:t.replace(/\s/g,"")};}), "window_count"); return;
    }
    if (d.needs_balcony_door === undefined){
      askCards(lang==="de"?"Brauchst du eine Balkon-/Schiebetür?":"Do you need a balcony/sliding door?", (lang==="de"?["Ja","Nein"]:["Yes","No"]).map(function(t,i){return {label:t,value:i===0,emoji:i===0?"🚪":"❌"};}), "needs_balcony_door"); return;
    }
    if (d.window_accessory === undefined){
      const arr = (lang==="de"?["Rollladen","Insektenschutz","Keins","Sonstiges"]:["Roller shutter","Insect screen","None","Other"]);
      askCards(lang==="de"?"Zubehör benötigt?":"Any accessories needed?", arr.map(function(t){return {label:t,value:t.toLowerCase().replace(/\s/g,"_")};}), "window_accessory"); return;
    }
    if (d.install_timeline === undefined){
      const opts = (lang==="de"
        ? [{label:"Schnellstmöglich",value:"asap"},{label:"4–6 Monate",value:"4-6"},{label:">6 Monate",value:">6"}]
        : [{label:"ASAP",value:"asap"},{label:"4–6 months",value:"4-6"},{label:">6 months",value:">6"}]);
      askCards(lang==="de"?"Zeitplan für das Projekt?":"Project timeline?", opts, "install_timeline"); return;
    }
    if (d.plz === undefined){
      askInput(Q.plz_q[lang], "plz", function(v){ return /^\d{4,5}$/.test(String(v||"").trim()); }); return;
    }
    if (d.contact_time_window === undefined){
      const arr = (lang==="de"?["08:00–12:00","12:00–16:00","16:00–20:00","Egal / zu jeder Zeit"]:["08:00–12:00","12:00–16:00","16:00–20:00","Any time"]);
      askCards(Q.contact_time_q[lang], arr.map(function(t){return {label:t,value:t};}), "contact_time_window"); return;
    }
    if (!d.__window_done){
      d.__window_done = true;
      appendMessage(lang==="de" ? "Fast geschafft! Wir brauchen nur noch deine Kontaktdaten:" : "Almost done! We just need your contact details:", "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(d);
      openLeadForm(Funnel.state.productLabel || "Fenster", d);
    }
  }

  /* ---------------------------
     CTA helpers
  ----------------------------*/
  function maybeOfferStartCTA(lang){
    removeInlineOptions();
    const wrap = document.createElement("div");
    wrap.className = "quick-group";
    wrap.id = "cta-start-wrap";
    const btnStart = document.createElement("button");
    btnStart.className = "quick-btn";
    btnStart.textContent = (lang==="de" ? "Jetzt starten" : "Start now");
    btnStart.onclick = function(){
      const label = window.Funnel && Funnel.state && Funnel.state.productLabel ? Funnel.state.productLabel : "Beratung";
      const qual  = window.Funnel && Funnel.state ? (Funnel.state.data || {}) : {};
      openLeadForm(label, qual);
      wrap.remove();
    };
    const btnMore = document.createElement("button");
    btnMore.className = "quick-btn";
    btnMore.textContent = (lang==="de" ? "Weitere Frage stellen" : "Ask another question");
    btnMore.onclick = function(){ wrap.remove(); };
    wrap.appendChild(btnStart); wrap.appendChild(btnMore);
    if (chatLog){ chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight; }
  }
  function offerFAQFollowup(lang){ maybeOfferStartCTA(lang); }
  function offerContinueOrForm(lang){
    removeInlineOptions();
    const wrap = document.createElement("div");
    wrap.className = "quick-group";
    wrap.id = "continue-or-form";
    const cont = document.createElement("button");
    cont.className = "quick-btn";
    cont.textContent = (lang==="de" ? "Weiter im Check" : "Continue the check");
    cont.onclick = function(){ wrap.remove(); askNext(); };
    const formBtn = document.createElement("button");
    formBtn.className = "quick-btn";
    formBtn.textContent = (lang==="de" ? "Formular ausfüllen" : "Fill the form");
    formBtn.onclick = function(){
      const label = window.Funnel && Funnel.state && Funnel.state.productLabel ? Funnel.state.productLabel : "Beratung";
      const qual  = window.Funnel && Funnel.state ? (Funnel.state.data || {}) : {};
      openLeadForm(label, qual);
      wrap.remove();
    };
    wrap.appendChild(cont); wrap.appendChild(formBtn);
    if (chatLog){ chatLog.appendChild(wrap); chatLog.scrollTop = chatLog.scrollHeight; }
  }
  function removeInlineOptions(){
    ["cta-start-wrap","continue-or-form"].forEach(function(id){
      const x = document.getElementById(id);
      if (x) x.remove();
    });
  }

  /* ---------------------------
     Floating Modal (popup)
  ----------------------------*/
  function openLeadFloatForm(productLabel, qualification, lang){
    if (document.getElementById("lead-float-overlay")) return;

    const ov = document.createElement("div");
    ov.id = "lead-float-overlay";
    ov.innerHTML =
`<style>
#lead-float-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999}
#lead-float{position:relative;background:#fff;color:#111;max-width:520px;width:92%;border-radius:16px;padding:18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
#lead-float h3{margin:0 0 10px 0;font-size:18px}
#lead-float form{display:grid;gap:10px}
#lead-float input,#lead-float select{padding:12px 14px;border-radius:12px;border:1px solid #ccc;width:100%;min-height:48px;font-size:16px;background:#fff;color:#111}
#lead-float .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
#lead-float .cta{padding:12px 16px;border-radius:12px;border:none;background:#0f766e;color:#fff;cursor:pointer}
#lead-float .ghost{padding:12px 16px;border-radius:12px;border:1px solid #ddd;background:#fafafa;cursor:pointer}
#lf_close{position:absolute;right:10px;top:10px;background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer}
@media (max-width:768px){
  #lead-float-overlay{align-items:flex-end}
  #lead-float{width:100vw;max-width:100vw;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.35);max-height:92vh;overflow-y:auto;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 18px)}
}
</style>

<div id="lead-float" role="dialog" aria-modal="true">
  <button type="button" id="lf_close" aria-label="Close">×</button>
  <h3>${lang==="de"?"Kurzes Formular":"Quick form"}</h3>
  <form id="lead-float-form">
    <input type="text" id="lf_name"  placeholder="${lang==="de"?"Name":"Name"}" required>
    <input type="text" id="lf_addr"  placeholder="${lang==="de"?"Adresse (Straße + Nr.)":"Address (Street + No.)"}" required>
    <input type="text" id="lf_plz"   placeholder="${lang==="de"?"PLZ":"ZIP"}" required>
    <input type="tel"  id="lf_phone" placeholder="${lang==="de"?"Telefonnummer":"Phone number"}" required>
    <select id="lf_best" required>
      <option value="">${lang==="de"?"Am besten erreichbar":"Best time to reach"}</option>
      <option>08:00–12:00</option><option>12:00–16:00</option><option>16:00–20:00</option><option>${lang==="de"?"Egal / zu jeder Zeit":"Any time"}</option>
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
</div>`;
    document.body.appendChild(ov);

    // lock scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // prefill from qualification
    try{
      if (qualification && qualification.property_street_number){
        ov.querySelector("#lf_addr").value = String(qualification.property_street_number);
      }
      if (qualification && qualification.plz){
        ov.querySelector("#lf_plz").value = String(qualification.plz);
      }
      if (qualification && qualification.contact_time_window){
        ov.querySelector("#lf_best").value = String(qualification.contact_time_window);
      }
    }catch(_){}

    function close(){
      document.body.style.overflow = prevOverflow || "";
      ov.remove();
    }
    ov.querySelector("#lf_close").onclick = close;
    ov.querySelector("#lf_cancel").onclick = close;
    ov.addEventListener("click", function(e){ if (e.target && e.target.id === "lead-float-overlay") close(); });
    document.addEventListener("keydown", function esc(e){ if (e.key === "Escape"){ close(); document.removeEventListener("keydown", esc); } });

    ov.querySelector("#lead-float-form").addEventListener("submit", async function(e){
      e.preventDefault();
      const name  = ov.querySelector("#lf_name").value.trim();
      const addr  = ov.querySelector("#lf_addr").value.trim();
      const plz   = ov.querySelector("#lf_plz").value.trim();
      const phone = ov.querySelector("#lf_phone").value.trim();
      const best  = ov.querySelector("#lf_best").value.trim();
      const ok    = ov.querySelector("#lf_ok").checked;
      if (!ok){ alert(lang==="de"?"Bitte Zustimmung erteilen.":"Please give consent."); return; }

      const qual = Object.assign({}, qualification || {}, {
        property_street_number: addr, plz: plz, contact_time_window: best
      });

      try{
        if (typeof window.sendLeadToBackend === "function"){
          await window.sendLeadToBackend({
            productLabel: productLabel || "Beratung",
            name: name, address: addr, email: "—", phone: phone,
            origin: (__lastOrigin || "chat") + "-float",
            qualification: qual
          });
        }
        appendMessage(lang==="de" ? "Danke! Wir melden uns in Kürze." : "Thank you! We’ll contact you shortly.", "bot");
      }catch(err){
        console.error(err);
        appendMessage(lang==="de" ? "Senden fehlgeschlagen. Bitte später erneut versuchen." : "Submission failed. Please try again later.", "bot");
      }finally{
        close();
      }
    });
  }

  /* ---------------------------
     Nudge (interrupt)
  ----------------------------*/
  function nudgeToFormFromInterrupt(lang){
    try{
      if (document.getElementById("lead-contact-form-chat") || document.getElementById("lead-float-overlay")) return;
      const productLabel = (window.Funnel && Funnel.state && Funnel.state.productLabel) ? Funnel.state.productLabel : "Photovoltaik";
      const qualification = (window.Funnel && Funnel.state) ? (Funnel.state.data || {}) : {};
      const msg = (lang==="de") ? "Alles klar! Dann bräuchten wir nur noch deine Kontaktdaten:" : "All right! We just need your contact details:";
      appendMessage(msg, "bot");
      if (typeof window.showSummaryFromFunnel === "function") window.showSummaryFromFunnel(qualification);
      openLeadForm(productLabel, qualification);
    }catch(_){}
  }

  /* ---------------------------
     Expose a few helpers
  ----------------------------*/
  window.startGreetingFlow   = startGreetingFlow;
  window.showProductOptions  = showProductOptions;
  window.appendMessage       = appendMessage;
  window.sendFAQ             = sendFAQ;

  // A/B variant sticky
  const AB = { variant: localStorage.getItem("ab_variant") || (Math.random() < 0.5 ? "A":"B") };
  localStorage.setItem("ab_variant", AB.variant);

})(); 

